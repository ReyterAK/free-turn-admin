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
	"strings"
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
		"user":         cfg.User,
		"pass_set":     cfg.Pass != "",
		"poll_seconds": cfg.PollSeconds,
	}

	interfaces, errI := client.ListInterfaces()
	if errI != nil {
		resp["interfaces_error"] = errI.Error()
	} else {
		resp["interfaces"] = interfaces
	}

	peers, errP := client.ListPeers()
	if errP != nil {
		resp["peers_error"] = errP.Error()
	} else {
		for i := range peers {
			peers[i].FillDerived(onlineAfter)
		}
		resp["peers"] = peers
	}

	// Обе секции упали с одной ошибкой соединения → отдаём UI
	// классифицированную ошибку для баннера (auth | unreachable).
	if errI != nil && errP != nil {
		resp["error"] = classifyRouterOSError(errI)
	}

	writeJSON(w, resp)
}

// classifyRouterOSError разделяет ошибку соединения с RouterOS:
//
//	"auth"       — авторизация не прошла (неверные/пустые креды),
//	"permission" — прав пользователя недостаточно (нет политик
//	               api/read или RBAC не даёт доступ к меню),
//	"unreachable" — URL недоступен или иная сетевая проблема.
func classifyRouterOSError(err error) map[string]string {
	msg := err.Error()
	low := strings.ToLower(msg)
	kind := "unreachable"
	switch {
	case strings.Contains(msg, "401") || strings.Contains(low, "unauthorized"):
		kind = "auth"
	case strings.Contains(low, "not allowed") ||
		strings.Contains(low, "not enough permissions") ||
		strings.Contains(low, "permission denied") ||
		strings.Contains(msg, "403") ||
		strings.Contains(low, "forbidden"):
		kind = "permission"
	}
	return map[string]string{"kind": kind, "detail": msg}
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
	// Пустой пароль в форме = не менять сохранённый.
	if body.Pass == "" {
		if cur, err := LoadRouterOSConfig(); err == nil {
			body.Pass = cur.Pass
		}
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
