//
// wireguard.go
// FreeTurn Admin — RouterOS WireGuard monitoring
//
// The tab focuses on the WireGuard interface that matches the
// Backend-server settings (the -connect host:port from the server
// run args): it shows that interface (by IP + listen port) and
// only its peers. Error states are layered:
//   - REST connection not configured / unreachable / auth / rights,
//   - backend not configured,
//   - backend configured but no WG interface with that IP,
//   - IP matches but the listen port differs (warning).
//

package admin

import (
	"encoding/json"
	"net/http"
	"strconv"
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

// backendHostPort returns the -connect host:port from the server
// run args — the "Backend-server" settings.
func backendHostPort() (host string, port int, ok bool) {
	fields := runArgsList()
	for i, arg := range fields {
		if arg != "-connect" || i+1 >= len(fields) {
			continue
		}
		h, portStr, cut := strings.Cut(fields[i+1], ":")
		if !cut || h == "" {
			return "", 0, false
		}
		p, err := strconv.Atoi(portStr)
		if err != nil || p < 1 || p > 65535 {
			return "", 0, false
		}
		return h, p, true
	}
	return "", 0, false
}

// hostOf strips the /prefix from a RouterOS address ("10.10.20.1/24").
func hostOf(addr string) string {
	if i := strings.IndexByte(addr, '/'); i >= 0 {
		return addr[:i]
	}
	return addr
}

// wireguardStatus reports the backend-matched WireGuard state.
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

	backendHost, backendPort, backendOK := backendHostPort()
	resp["backend_configured"] = backendOK
	resp["backend_host"] = backendHost
	resp["backend_port"] = backendPort

	interfaces, errI := client.ListInterfaces()
	peers, errP := client.ListPeers()
	addresses, errA := client.ListAddresses()

	if errI != nil {
		resp["interfaces_error"] = errI.Error()
	}
	if errP != nil {
		resp["peers_error"] = errP.Error()
	}
	if errA != nil {
		resp["addresses_error"] = errA.Error()
	}
	// Обе ключевые секции упали — это ошибка соединения, баннер.
	if errI != nil && errP != nil {
		resp["error"] = classifyRouterOSError(errI)
		writeJSON(w, resp)
		return
	}

	// interface name -> IPs (без /prefix)
	ipsByIface := map[string][]string{}
	for _, a := range addresses {
		name := a.Interface
		if name == "" {
			name = a.ActualInterface
		}
		if name == "" {
			continue
		}
		ipsByIface[name] = append(ipsByIface[name], hostOf(a.Address))
	}

	// Матч: IP из Backend против IP WG-интерфейсов.
	match := map[string]any{"status": "ip_not_found"}
	if backendOK {
		var matched *routeros.Interface
		for i := range interfaces {
			for _, ip := range ipsByIface[interfaces[i].Name] {
				if ip == backendHost {
					matched = &interfaces[i]
					break
				}
			}
			if matched != nil {
				break
			}
		}

		if matched != nil {
			status := "ok"
			if int(matched.ListenPort) != backendPort {
				status = "port_mismatch"
			}
			match = map[string]any{
				"status": status,
				"interface": map[string]any{
					"name":        matched.Name,
					"comment":     matched.Comment,
					"ips":         ipsByIface[matched.Name],
					"listen-port": int(matched.ListenPort),
					"public-key":  matched.PublicKey,
					"running":     bool(matched.Running),
					"disabled":    bool(matched.Disabled),
				},
			}

			// Только пиры найденного интерфейса.
			var filtered []routeros.Peer
			for i := range peers {
				if peers[i].Interface == matched.Name {
					peers[i].FillDerived(onlineAfter)
					filtered = append(filtered, peers[i])
				}
			}
			resp["peers"] = filtered
		}
	}
	resp["match"] = match

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
