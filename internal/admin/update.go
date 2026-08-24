//
// update.go
// FreeTurn Admin
// Release 1.0.0
//
// Server self-update from GitHub releases.
//
// Flow: check latest release → download ARM64
// asset → verify SHA-256 → atomic replace with
// backup and rollback on failed verification.
//

package admin

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	githubReleaseURL = "https://api.github.com/repos/samosvalishe/free-turn-proxy/releases/latest"
	updateTempFile   = "free-turn-proxy.update.tmp"
)

var httpClient = &http.Client{Timeout: 30 * time.Second}

// ---------------------------------------------------------------------
// latest release
// ---------------------------------------------------------------------

func GetLatestServerRelease() map[string]any {

	resp, err := httpClient.Get(githubReleaseURL)
	if err != nil {
		if strings.Contains(err.Error(), "no such host") {
			return map[string]any{
				"success": false,
				"code":    "github_dns",
				"status":  503,
				"error":   "Не удалось разрешить доменное имя GitHub.",
			}
		}
		return map[string]any{
			"success": false,
			"code":    "github_network",
			"status":  503,
			"error":   "Не удалось подключиться к GitHub.",
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusForbidden {
			return map[string]any{
				"success": false,
				"code":    "github_rate_limit",
				"status":  403,
				"error":   "GitHub временно ограничил количество запросов. Попробуйте повторить попытку позже.",
			}
		}
		return map[string]any{
			"success": false,
			"code":    "github_http",
			"status":  resp.StatusCode,
			"error":   fmt.Sprintf("GitHub API error: %d", resp.StatusCode),
		}
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return map[string]any{
			"success": false,
			"code":    "github_network",
			"status":  503,
			"error":   "Не удалось прочитать ответ GitHub.",
		}
	}

	var release struct {
		TagName   string `json:"tag_name"`
		Name      string `json:"name"`
		Published string `json:"published_at"`
		Body      string `json:"body"`
		Assets    []struct {
			Name        string `json:"name"`
			DownloadURL string `json:"browser_download_url"`
			Size        int64  `json:"size"`
			Digest      string `json:"digest"`
		} `json:"assets"`
	}
	if err := json.Unmarshal(body, &release); err != nil {
		return map[string]any{
			"success": false,
			"code":    "github_network",
			"status":  503,
			"error":   "Не удалось разобрать ответ GitHub.",
		}
	}

	version := strings.TrimPrefix(release.TagName, "v")

	// MikroTik container is ARM64 only.
	var asset struct {
		Name        string `json:"name"`
		DownloadURL string `json:"browser_download_url"`
		Size        int64  `json:"size"`
		Digest      string `json:"digest"`
	}
	found := false
	for _, a := range release.Assets {
		if a.Name == "server-linux-arm64" {
			asset.Name = a.Name
			asset.DownloadURL = a.DownloadURL
			asset.Size = a.Size
			asset.Digest = a.Digest
			found = true
			break
		}
	}
	if !found {
		return map[string]any{
			"success": false,
			"code":    "github_asset_missing",
			"status":  502,
			"error":   "GitHub release asset server-linux-arm64 не найден.",
		}
	}

	return map[string]any{
		"success":     true,
		"version":     version,
		"name":        release.Name,
		"publishedAt": release.Published,
		"whatsNew":    release.Body,
		"asset": map[string]any{
			"name":        asset.Name,
			"downloadUrl": asset.DownloadURL,
			"size":        asset.Size,
			"digest":      asset.Digest,
		},
	}
}

// ---------------------------------------------------------------------
// download + digest verification
// ---------------------------------------------------------------------

func DownloadServerUpdate(downloadURL, expectedDigest string) map[string]any {

	tempFile := filepath.Join(ConfigDir, updateTempFile)

	_ = os.Remove(tempFile)

	// download to a temp file in /config (same fs as the binary)

	out, err := os.Create(tempFile)
	if err != nil {
		return map[string]any{
			"success": false,
			"error":   fmt.Sprintf("Ошибка создания файла обновления: %v", err),
		}
	}

	resp, err := httpClient.Get(downloadURL)
	if err != nil {
		out.Close()
		_ = os.Remove(tempFile)
		return map[string]any{
			"success": false,
			"error":   fmt.Sprintf("Ошибка скачивания файла: %v", err),
		}
	}
	defer resp.Body.Close()

	hasher := sha256.New()
	if _, err := io.Copy(io.MultiWriter(out, hasher), resp.Body); err != nil {
		out.Close()
		_ = os.Remove(tempFile)
		return map[string]any{
			"success": false,
			"error":   fmt.Sprintf("Ошибка скачивания файла: %v", err),
		}
	}
	out.Close()

	actualDigest := "sha256:" + hex.EncodeToString(hasher.Sum(nil))

	if !strings.EqualFold(actualDigest, expectedDigest) {
		_ = os.Remove(tempFile)
		return map[string]any{
			"success": false,
			"error":   "Контрольная сумма скачанного файла не совпадает.",
		}
	}

	info, err := os.Stat(tempFile)
	if err != nil {
		return map[string]any{
			"success": false,
			"error":   "Не удалось получить размер скачанного файла.",
		}
	}

	return map[string]any{
		"success": true,
		"size":    info.Size(),
		"digest":  actualDigest,
	}
}

// ---------------------------------------------------------------------
// atomic replace with backup + rollback
// ---------------------------------------------------------------------

func ReplaceServerBinary() map[string]any {

	updateFile := filepath.Join(ConfigDir, updateTempFile)
	updateLocal := ProxyBin + ".update.tmp"
	backupFile := ProxyBin + ".backup"

	cleanup := func() {
		_ = os.Remove(updateLocal)
	}

	if _, err := os.Stat(updateFile); err != nil {
		return map[string]any{
			"success": false,
			"error":   "Файл обновления не найден.",
		}
	}

	// copy update next to the active binary
	data, err := os.ReadFile(updateFile)
	if err != nil {
		return map[string]any{
			"success": false,
			"error":   fmt.Sprintf("Не удалось прочитать файл обновления: %v", err),
		}
	}
	if err := os.WriteFile(updateLocal, data, 0o755); err != nil {
		return map[string]any{
			"success": false,
			"error":   fmt.Sprintf("Не удалось подготовить файл обновления: %v", err),
		}
	}
	_ = os.Chmod(updateLocal, 0o755)

	// remove old backup, then backup current binary
	_ = os.Remove(backupFile)
	if err := os.Rename(ProxyBin, backupFile); err != nil {
		cleanup()
		return map[string]any{
			"success": false,
			"error":   fmt.Sprintf("Не удалось создать резервную копию текущего сервера: %v", err),
		}
	}

	// activate new binary
	if err := os.Rename(updateLocal, ProxyBin); err != nil {
		// rollback
		_ = os.Rename(backupFile, ProxyBin)
		return map[string]any{
			"success": false,
			"error":   fmt.Sprintf("Не удалось активировать обновление: %v", err),
		}
	}

	// verify the new binary runs
	if _, err := runProxyCmd("-gen-obf-key"); err != nil {
		_ = os.Remove(ProxyBin)
		if _, rerr := os.Stat(backupFile); rerr == nil {
			_ = os.Rename(backupFile, ProxyBin)
		}
		return map[string]any{
			"success": false,
			"error":   "Новый бинарный файл не прошёл проверку запуска.",
		}
	}

	// cleanup: backup + downloaded temp
	_ = os.Remove(backupFile)
	_ = os.Remove(updateFile)

	return map[string]any{
		"success": true,
	}
}
