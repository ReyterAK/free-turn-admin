//
// panel_update.go
// FreeTurn Admin — panel self-update check.
//
// The CHECK needs no RouterOS access: the panel queries Docker Hub
// directly and compares version tags with its own VERSION. The
// result is cached for a day (the Hub must not be hammered); a
// manual check bypasses the cache. APPLYING the update does require
// RouterOS (/container/update) — without an API user the UI only
// shows the WinBox command.
//

package admin

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"freeturn/admin/internal/routeros"
)

const (
	hubTagsURL         = "https://hub.docker.com/v2/repositories/reyterak/free-turn-admin-mikrotik/tags?page_size=100"
	panelUpdateCache   = "update-check.json"
	panelUpdateTTL     = 24 * time.Hour
	panelContainerName = "free-turn-admin"
)

type panelUpdateEntry struct {
	CheckedAt int64  `json:"checked_at"`
	Latest    string `json:"latest"`
}

func panelUpdateCachePath() string {
	return filepath.Join(ConfigDir, panelUpdateCache)
}

// parseVersion parses "1.2.3" (or "v1.2", "2") into comparable
// parts; ok=false for non-version strings ("latest", "dev").
func parseVersion(v string) (major, minor, patch int, ok bool) {
	s := strings.TrimPrefix(strings.TrimSpace(v), "v")
	parts := strings.Split(s, ".")
	if len(parts) < 1 || len(parts) > 3 {
		return 0, 0, 0, false
	}
	nums := make([]int, 0, 3)
	for _, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil {
			return 0, 0, 0, false
		}
		nums = append(nums, n)
	}
	for len(nums) < 3 {
		nums = append(nums, 0)
	}
	return nums[0], nums[1], nums[2], true
}

// versionLess reports whether a is an older version than b.
func versionLess(a, b string) bool {
	am, ai, ap, aok := parseVersion(a)
	bm, bi, bp, bok := parseVersion(b)
	if !aok || !bok {
		return a < b
	}
	if am != bm {
		return am < bm
	}
	if ai != bi {
		return ai < bi
	}
	return ap < bp
}

// latestHubVersion queries the Docker Hub tags API and returns the
// newest numeric version tag.
func latestHubVersion() (string, error) {
	resp, err := httpClient.Get(hubTagsURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("hub api: http %d", resp.StatusCode)
	}
	var body struct {
		Results []struct {
			Name string `json:"name"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", err
	}
	latest := ""
	for _, t := range body.Results {
		if _, _, _, ok := parseVersion(t.Name); !ok {
			continue
		}
		if latest == "" || versionLess(latest, t.Name) {
			latest = t.Name
		}
	}
	if latest == "" {
		return "", errors.New("no version tags on hub")
	}
	return latest, nil
}

// panelUpdateResult performs the check (daily cache unless force)
// and returns the payload for the UI.
func (r *Router) panelUpdateResult(force bool) map[string]any {
	current := r.version

	var entry panelUpdateEntry
	if err := readJSONFile(panelUpdateCachePath(), &entry); err == nil &&
		entry.Latest != "" && !force &&
		time.Now().Unix()-entry.CheckedAt < int64(panelUpdateTTL.Seconds()) {
		return map[string]any{
			"status":           "ok",
			"current_version":  current,
			"latest_version":   entry.Latest,
			"update_available": versionLess(current, entry.Latest),
			"checked_at":       entry.CheckedAt,
			"cached":           true,
		}
	}

	latest, err := latestHubVersion()
	if err != nil {
		return map[string]any{
			"status": "error",
			"error":  err.Error(),
		}
	}

	entry = panelUpdateEntry{CheckedAt: time.Now().Unix(), Latest: latest}
	_ = writeJSONFile(panelUpdateCachePath(), &entry) // кэш не критичен

	return map[string]any{
		"status":           "ok",
		"current_version":  current,
		"latest_version":   latest,
		"update_available": versionLess(current, latest),
		"checked_at":       entry.CheckedAt,
	}
}

// GET /api/panel/update/check[?force=1]
func (r *Router) panelUpdateCheck(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, r.panelUpdateResult(req.URL.Query().Get("force") == "1"))
}

// POST /api/panel/update/apply
// Applies the container update via RouterOS /container/update. The
// panel itself lives in the container being updated — the request
// may never complete, and the session dies with the restart.
func (r *Router) panelUpdateApply(w http.ResponseWriter, req *http.Request) {
	cfg, err := LoadRouterOSConfig()
	if err != nil || cfg.URL == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status":  "error",
			"error":   "no_routeros",
			"command": "/container update " + panelContainerName,
		})
		return
	}

	client := routeros.New(cfg.URL, cfg.User, cfg.Pass, 6*time.Second)
	containers, err := client.ListContainers()
	if err != nil {
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"status": "error",
			"error":  classifyRouterOSError(err),
		})
		return
	}
	for _, c := range containers {
		if c.Name == panelContainerName {
			if c.RemoteImage == "" {
				// Установлен из файла: /container/update нечего
				// тянуть — сначала задать remote-image.
				writeJSONStatus(w, http.StatusBadRequest, map[string]any{
					"status": "error",
					"error":  "no_remote_image",
					"command": "/container set remote-image=reyterak/free-turn-admin-mikrotik:latest " +
						panelContainerName + "\n/container update " + panelContainerName,
				})
				return
			}
			if err := client.UpdateContainer(c.ID); err != nil {
				classified := classifyRouterOSError(err)
				if classified["kind"] == "permission" {
					// Пользователь API без write: /container/update
					// возвращает "not enough permissions".
					// Показываем команду для Terminal WinBox.
					writeJSONStatus(w, http.StatusBadRequest, map[string]any{
						"status":  "error",
						"error":   "no_permission",
						"command": "/container update " + panelContainerName,
					})
					return
				}
				writeJSONStatus(w, http.StatusBadGateway, map[string]any{
					"status": "error",
					"error":  classified,
				})
				return
			}
			writeJSON(w, map[string]any{"status": "ok"})
			return
		}
	}

	writeJSONStatus(w, http.StatusNotFound, map[string]any{
		"status":  "error",
		"error":   "container_not_found",
		"command": "/container update " + panelContainerName,
	})
}
