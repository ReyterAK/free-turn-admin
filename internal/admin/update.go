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
	"sync/atomic"
	"time"
)

const (
	// The original upstream (samosvalishe/free-turn-proxy) has
	// disappeared, taking its account and releases with it. The
	// community mirror hackdiaz-dev/free-turn-proxy keeps the same
	// asset names and tag history, so only the URL changes here.
	// Tags carry a "-mirror" suffix (v4.0.1-mirror); normalizeTag
	// strips it so the UI compares 4.0.1 against 4.0.1 instead of
	// offering an update that is already installed.
	githubReleaseURL = "https://api.github.com/repos/hackdiaz-dev/free-turn-proxy/releases/latest"
	updateTempFile   = "free-turn-proxy.update.tmp"

	serverUpdateCacheFile = "server-update-check.json"
	serverUpdateTTL       = 24 * time.Hour
)

var httpClient = &http.Client{Timeout: 30 * time.Second}

// ---------------------------------------------------------------------
// server update cache + background checker
// ---------------------------------------------------------------------

type serverUpdateCache struct {
	CheckedAt int64          `json:"checked_at"`
	Release   map[string]any `json:"release"`
}

// latestServerRelease holds the most recent check result in memory.
// It is initialised to a "not checked" state so the UI has a status
// before the first background check completes.
var latestServerRelease atomic.Value

func init() {
	latestServerRelease.Store(map[string]any{
		"success": false,
		"code":    "not_checked",
		"error":   "Проверка обновлений ещё не выполнена.",
	})
}

func serverUpdateCachePath() string {
	return filepath.Join(ConfigDir, serverUpdateCacheFile)
}

func readServerUpdateCache() (serverUpdateCache, error) {
	var c serverUpdateCache
	err := readJSONFile(serverUpdateCachePath(), &c)
	return c, err
}

func cacheServerUpdateResult(result map[string]any) {
	c := serverUpdateCache{
		CheckedAt: time.Now().Unix(),
		Release:   result,
	}
	_ = writeJSONFile(serverUpdateCachePath(), c)
	latestServerRelease.Store(result)
}

// LatestServerUpdate returns the cached GitHub release information if it is
// fresh, otherwise fetches it. Pass force=true to bypass the cache.
func LatestServerUpdate(force bool) map[string]any {
	now := time.Now().Unix()
	 ttl := int64(serverUpdateTTL.Seconds())

	// 1. In-memory cache.
	if !force {
		mem := latestServerRelease.Load().(map[string]any)
		if checkedAt, ok := mem["checked_at"].(int64); ok && now-checkedAt < ttl {
			mem["cached"] = true
			return mem
		}
	}

	// 2. Persistent cache (survives container restarts).
	if !force {
		if c, err := readServerUpdateCache(); err == nil && c.Release != nil &&
			now-c.CheckedAt < ttl {
			c.Release["checked_at"] = c.CheckedAt
			c.Release["cached"] = true
			latestServerRelease.Store(c.Release)
			return c.Release
		}
	}

	// 3. Fetch from GitHub.
	result := GetLatestServerRelease()
	result["checked_at"] = now
	result["cached"] = false
	cacheIfSuccessful(result)
	return result
}

// cacheIfSuccessful persists the update-check result, but only when the
// lookup actually succeeded. Caching a failure would replay it for the
// whole TTL: a network blip, a GitHub rate limit or a mirror outage
// would keep reporting "could not check for server updates" for a day.
// Worse, /config is a persistent mount, so a stale failure survives an
// image upgrade — after switching from a dead upstream to a working
// mirror the panel would keep serving the old error.
func cacheIfSuccessful(result map[string]any) {
	if success, _ := result["success"].(bool); !success {
		return
	}
	cacheServerUpdateResult(result)
}

// StartServerUpdateChecker runs the first update check asynchronously and
// then rechecks every 24 hours. It is safe to call multiple times.
func StartServerUpdateChecker() {
	go func() {
		// Initial check shortly after startup so the UI status populates quickly.
		time.Sleep(10 * time.Second)
		LatestServerUpdate(false)

		ticker := time.NewTicker(serverUpdateTTL)
		defer ticker.Stop()
		for range ticker.C {
			LatestServerUpdate(false)
		}
	}()
}

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

	version := normalizeTag(release.TagName)

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

// normalizeTag reduces a release tag to a comparable version: it
// strips the leading "v" and any pre-release/build suffix, so the
// mirror's "v4.0.1-mirror" becomes "4.0.1" and matches the version
// the running server reports. Without this the panel would offer an
// update forever on a version that is already installed.
func normalizeTag(tag string) string {
	v := strings.TrimPrefix(strings.TrimSpace(tag), "v")
	if i := strings.IndexAny(v, "-+"); i >= 0 {
		v = v[:i]
	}
	return v
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
