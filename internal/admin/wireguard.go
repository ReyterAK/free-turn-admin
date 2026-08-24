//
// wireguard.go
// FreeTurn Admin — RouterOS WireGuard monitoring
//
// Read-only v1: the panel shows WireGuard interfaces and peers
// from the RouterOS REST API. Connection settings live in
// /config/routeros.json. The router user needs "api" + "read"
// group policies ("write" for future management).
//

package admin

import (
	"encoding/json"
	"net/http"
	"time"

	"freeturn/admin/internal/routeros"
)

// RouterOSConfig holds the connection settings for the RouterOS
// REST API (WireGuard monitoring). Stored in /config/routeros.json.
type RouterOSConfig struct {
	URL         string `json:"url"`
	User        string `json:"user"`
	Pass        string `json:"pass"`
	PollSeconds int    `json:"poll_seconds"`
}

// onlineAfter — a peer counts as online when its last handshake
// is younger than this.
const onlineAfter = 3 * time.Minute

// LoadRouterOSConfig reads the RouterOS connection settings.
// Missing file returns a zero config (feature disabled).
func LoadRouterOSConfig() (RouterOSConfig, error) {
	var cfg RouterOSConfig
	if err := readJSONFile(RouterOSFile, &cfg); err != nil {
		return cfg, err
	}
	if cfg.PollSeconds < 5 || cfg.PollSeconds > 600 {
		cfg.PollSeconds = 15
	}
	return cfg, nil
}

// SaveRouterOSConfig persists the RouterOS connection settings.
func SaveRouterOSConfig(cfg RouterOSConfig) error {
	if cfg.PollSeconds < 5 || cfg.PollSeconds > 600 {
		cfg.PollSeconds = 15
	}
	return writeJSONFile(RouterOSFile, cfg)
}

// wireguardStatus reports the WireGuard state from RouterOS.
// configured=false when no connection settings are stored.
func (r *Router) wireguardStatus(w http.ResponseWriter, req *http.Request) {
	cfg, err := LoadRouterOSConfig()
	if err != nil || cfg.URL == "" {
		writeJSON(w, map[string]any{"configured": false})
		return
	}

	client := routeros.New(cfg.URL, cfg.User, cfg.Pass, 6*time.Second)

	resp := map[string]any{
		"configured":   true,
		"url":          cfg.URL,
		"poll_seconds": cfg.PollSeconds,
	}

	if interfaces, err := client.ListInterfaces(); err != nil {
		resp["interfaces_error"] = err.Error()
	} else {
		resp["interfaces"] = interfaces
	}

	if peers, err := client.ListPeers(); err != nil {
		resp["peers_error"] = err.Error()
	} else {
		for i := range peers {
			peers[i].FillDerived(onlineAfter)
		}
		resp["peers"] = peers
	}

	writeJSON(w, resp)
}

// wireguardSaveConfig stores the RouterOS connection settings.
func (r *Router) wireguardSaveConfig(w http.ResponseWriter, req *http.Request) {
	var body RouterOSConfig
	if req.Body != nil {
		_ = json.NewDecoder(req.Body).Decode(&body)
	}
	if body.URL == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "url_required",
		})
		return
	}
	if err := SaveRouterOSConfig(body); err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	LogEvent("wireguard", "CONFIG_SAVED", "RouterOS connection settings updated")
	writeJSON(w, map[string]any{"status": "ok"})
}
