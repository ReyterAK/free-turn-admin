//
// handlers.go
// FreeTurn Admin
// Release 1.0.0
//
// REST API handlers (contract-compatible with
// the previous Flask backend) and static UI
// serving from the embedded filesystem.
//

package admin

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"strings"
)

type Router struct {
	uiFS    fs.FS
	version string
}

func NewRouter(uiFS embed.FS, version string) *Router {
	sub, err := fs.Sub(uiFS, "ui")
	if err != nil {
		panic(err)
	}
	return &Router{uiFS: sub, version: version}
}

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------

func (r *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	// Security headers for every response.
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Referrer-Policy", "no-referrer")

	switch {
	case req.URL.Path == "/healthz":
		r.healthz(w, req)
	case strings.HasPrefix(req.URL.Path, "/api/"):
		r.api(w, req)
	default:
		r.static(w, req)
	}
}

func writeJSONStatus(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeJSON(w http.ResponseWriter, v any) {
	writeJSONStatus(w, http.StatusOK, v)
}

func readBodyJSON(req *http.Request) map[string]any {
	var data map[string]any
	if req.Body != nil {
		_ = json.NewDecoder(req.Body).Decode(&data)
	}
	return data
}

func (r *Router) isAuth(req *http.Request) bool {
	cookie, err := req.Cookie(SessionCookie)
	if err != nil {
		return false
	}
	return validSession(cookie.Value)
}

func (r *Router) requireAuth(next func(w http.ResponseWriter, req *http.Request)) func(w http.ResponseWriter, req *http.Request) {
	return func(w http.ResponseWriter, req *http.Request) {
		if !r.isAuth(req) {
			writeJSONStatus(w, http.StatusUnauthorized, map[string]any{
				"error": "unauthorized",
			})
			return
		}
		next(w, req)
	}
}

func (r *Router) setSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookie,
		Value:    sessionCookie(),
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(SessionLifetime.Seconds()),
	})
}

func (r *Router) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})
}

// ---------------------------------------------------------------------
// health
// ---------------------------------------------------------------------

func (r *Router) healthz(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, map[string]any{"status": "ok"})
}

// ---------------------------------------------------------------------
// API routing
// ---------------------------------------------------------------------

func (r *Router) api(w http.ResponseWriter, req *http.Request) {
	method := req.Method
	path := req.URL.Path

	switch {

	// auth (no session required)
	case method == "GET" && path == "/api/auth/status":
		r.authStatus(w, req)
	case method == "POST" && path == "/api/login":
		r.login(w, req)
	case method == "POST" && path == "/api/auth/create":
		r.authCreate(w, req)

	// auth (session required)
	case method == "GET" && path == "/api/auth/current-user":
		r.requireAuth(r.currentUser)(w, req)
	case method == "POST" && path == "/api/logout":
		r.logout(w, req)
	case method == "POST" && path == "/api/auth/change-password":
		r.requireAuth(r.changePassword)(w, req)

	// system
	case method == "GET" && path == "/api/system/status":
		r.requireAuth(r.systemStatus)(w, req)
	case method == "GET" && path == "/api/system/version":
		r.requireAuth(r.systemVersion)(w, req)
	case method == "GET" && path == "/api/system/admin-version":
		r.requireAuth(r.adminVersion)(w, req)
	case method == "GET" && path == "/api/system/clients/count":
		r.requireAuth(r.clientsCount)(w, req)
	case method == "GET" && path == "/api/events":
		r.requireAuth(r.events)(w, req)
	case method == "GET" && path == "/api/server/log":
		r.requireAuth(r.serverLog)(w, req)

	// clients
	case method == "GET" && path == "/api/clients/list":
		r.requireAuth(r.clientsList)(w, req)
	case method == "POST" && path == "/api/clients/add":
		r.requireAuth(r.clientsAdd)(w, req)
	case method == "POST" && path == "/api/clients/remove":
		r.requireAuth(r.clientsRemove)(w, req)
	case method == "POST" && path == "/api/clients/update":
		r.requireAuth(r.clientsUpdate)(w, req)

	// settings / config
	case method == "GET" && path == "/api/settings":
		r.requireAuth(r.settingsGet)(w, req)
	case method == "POST" && path == "/api/settings/save":
		r.requireAuth(r.settingsSave)(w, req)
	case method == "GET" && path == "/api/runargs/get":
		r.requireAuth(r.runargsGet)(w, req)
	case method == "POST" && path == "/api/runargs/save":
		r.requireAuth(r.runargsSave)(w, req)
	case method == "GET" && path == "/api/uri-settings":
		r.requireAuth(r.uriGet)(w, req)
	case method == "POST" && path == "/api/uri-settings":
		r.requireAuth(r.uriSave)(w, req)

	// wireguard (RouterOS REST)
	case method == "GET" && path == "/api/wireguard":
		r.requireAuth(r.wireguardStatus)(w, req)
	case method == "POST" && path == "/api/wireguard/config":
		r.requireAuth(r.wireguardSaveConfig)(w, req)
	case method == "POST" && path == "/api/wireguard/interface":
		r.requireAuth(r.wireguardCreateInterface)(w, req)
	case method == "POST" && path == "/api/wireguard/interface/delete":
		r.requireAuth(r.wireguardDeleteInterface)(w, req)
	case method == "POST" && path == "/api/wireguard/interface":
		r.requireAuth(r.wireguardCreateInterface)(w, req)

	// system actions
	case method == "POST" && path == "/api/system/update/download":
		r.requireAuth(r.updateDownload)(w, req)
	case method == "GET" && path == "/api/system/update/latest":
		r.requireAuth(r.updateLatest)(w, req)
	case method == "POST" && path == "/api/system/update/replace":
		r.requireAuth(r.updateReplace)(w, req)
	case method == "POST" && path == "/api/system/restart":
		r.requireAuth(r.restart)(w, req)
	case method == "POST" && path == "/api/system/generate-obf-key":
		r.requireAuth(r.generateObfKey)(w, req)

	default:
		writeJSONStatus(w, http.StatusNotFound, map[string]any{
			"error": "not_found",
		})
	}
}

// ---------------------------------------------------------------------
// auth handlers
// ---------------------------------------------------------------------

func (r *Router) authStatus(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, map[string]any{
		"account_exists": HasAdminAccount(),
	})
}

func (r *Router) login(w http.ResponseWriter, req *http.Request) {
	data := readBodyJSON(req)
	user, _ := data["user"].(string)
	password, _ := data["password"].(string)

	if Authenticate(user, password) {
		LogEvent("auth", "LOGIN", fmt.Sprintf("User %s logged in", user))
		r.setSessionCookie(w)
		writeJSON(w, map[string]any{"status": "ok"})
		return
	}

	LogEvent("auth", "LOGIN_FAILED", fmt.Sprintf("Failed login attempt for user %s", user))
	writeJSONStatus(w, http.StatusUnauthorized, map[string]any{"status": "fail"})
}

func (r *Router) authCreate(w http.ResponseWriter, req *http.Request) {
	if HasAdminAccount() {
		writeJSONStatus(w, http.StatusConflict, map[string]any{
			"status": "fail",
			"error":  "account_exists",
		})
		return
	}

	data := readBodyJSON(req)
	user, _ := data["user"].(string)
	password, _ := data["password"].(string)

	if strings.TrimSpace(user) == "" || password == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "fail",
			"error":  "user and password must not be empty",
		})
		return
	}

	if err := CreateAccount(user, password); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "fail",
			"error":  err.Error(),
		})
		return
	}

	LogEvent("auth", "ACCOUNT_CREATED", fmt.Sprintf("Administrator account created for user %s", user))
	r.setSessionCookie(w)
	writeJSON(w, map[string]any{"status": "ok"})
}

func (r *Router) currentUser(w http.ResponseWriter, req *http.Request) {
	user, _ := currentCredentials()
	if user == "" {
		writeJSONStatus(w, http.StatusUnauthorized, map[string]any{
			"status": "fail",
			"error":  "invalid_auth",
		})
		return
	}
	writeJSON(w, map[string]any{"user": user})
}

func (r *Router) logout(w http.ResponseWriter, req *http.Request) {
	LogEvent("auth", "LOGOUT", "User logged out")
	r.clearSessionCookie(w)
	writeJSON(w, map[string]any{"status": "logged_out"})
}

func (r *Router) changePassword(w http.ResponseWriter, req *http.Request) {
	data := readBodyJSON(req)

	oldPassword, _ := data["old_password"].(string)
	user, _ := data["user"].(string)
	newPassword, _ := data["new_password"].(string)

	if user == "" {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "fail",
			"error":  "invalid_auth",
		})
		return
	}

	currentUser, currentPassword := currentCredentials()
	if currentUser == "" || currentPassword == "" {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "fail",
			"error":  "invalid_auth",
		})
		return
	}

	if oldPassword != currentPassword {
		writeJSONStatus(w, http.StatusUnauthorized, map[string]any{
			"status": "fail",
			"error":  "wrong_password",
		})
		return
	}

	if err := SaveAuth(user, newPassword); err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "fail",
			"error":  "save_failed",
		})
		return
	}

	LogEvent("auth", "PASSWORD_CHANGED", "Administrator credentials changed")
	writeJSON(w, map[string]any{"status": "ok"})
}

// ---------------------------------------------------------------------
// system handlers
// ---------------------------------------------------------------------

func (r *Router) systemStatus(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, GetStatus())
}

func (r *Router) systemVersion(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, GetVersion())
}

func (r *Router) adminVersion(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, map[string]any{"version": r.version})
}

func (r *Router) clientsCount(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, map[string]any{"count": GetClientsCount()})
}

func (r *Router) events(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, GetEvents(100))
}

func (r *Router) serverLog(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, map[string]any{"lines": GetServerLog(200)})
}

// ---------------------------------------------------------------------
// clients handlers
// ---------------------------------------------------------------------

func (r *Router) clientsList(w http.ResponseWriter, req *http.Request) {
	clients := ListClients()
	if clients == nil {
		clients = []map[string]string{}
	}
	writeJSON(w, map[string]any{"clients": clients})
}

func (r *Router) clientsAdd(w http.ResponseWriter, req *http.Request) {
	data := readBodyJSON(req)
	clientID, _ := data["client_id"].(string)
	comment, _ := data["comment"].(string)

	id := AddClient(clientID, comment)

	LogEvent("clients", "ADD", fmt.Sprintf("Client added: %s", id))
	writeJSON(w, map[string]any{"status": "ok"})
}

func (r *Router) clientsRemove(w http.ResponseWriter, req *http.Request) {
	data := readBodyJSON(req)
	clientID, _ := data["client_id"].(string)

	RemoveClient(clientID)

	LogEvent("clients", "REMOVE", fmt.Sprintf("Client removed: %s", clientID))
	writeJSON(w, map[string]any{"status": "ok"})
}

func (r *Router) clientsUpdate(w http.ResponseWriter, req *http.Request) {
	data := readBodyJSON(req)
	clientID, _ := data["client_id"].(string)
	comment, _ := data["comment"].(string)

	UpdateClient(clientID, comment)

	LogEvent("clients", "UPDATE", fmt.Sprintf("Client updated: %s", clientID))
	writeJSON(w, map[string]any{"status": "ok"})
}

// ---------------------------------------------------------------------
// settings / config handlers
// ---------------------------------------------------------------------

func (r *Router) settingsGet(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, GetSettings())
}

func (r *Router) settingsSave(w http.ResponseWriter, req *http.Request) {
	data := readBodyJSON(req)
	if err := SaveSettings(data); err != nil {
		LogEvent("settings", "SAVE_FAILED", "Failed to save settings", err.Error())
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "fail",
			"error":  "save_failed",
		})
		return
	}
	LogEvent("settings", "SAVE", "Settings saved")
	writeJSON(w, map[string]any{"status": "ok"})
}

func (r *Router) runargsGet(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, GetRunArgs())
}

func (r *Router) runargsSave(w http.ResponseWriter, req *http.Request) {
	data := readBodyJSON(req)
	value, _ := data["data"].(string)
	if err := SaveRunArgs(value); err != nil {
		LogEvent("config", "SAVE_FAILED", "Failed to save run arguments", err.Error())
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "fail",
			"error":  "save_failed",
		})
		return
	}
	LogEvent("config", "RUNARGS_SAVE", "Server run arguments saved")
	writeJSON(w, map[string]any{"status": "ok"})
}

func (r *Router) uriGet(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, GetURI())
}

func (r *Router) uriSave(w http.ResponseWriter, req *http.Request) {
	data := readBodyJSON(req)
	if err := SaveURI(data); err != nil {
		LogEvent("config", "SAVE_FAILED", "Failed to save URI settings", err.Error())
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "fail",
			"error":  "save_failed",
		})
		return
	}
	LogEvent("config", "URI_SAVE", "URI settings saved")
	writeJSON(w, map[string]any{"status": "ok"})
}

// ---------------------------------------------------------------------
// system action handlers
// ---------------------------------------------------------------------

func (r *Router) updateDownload(w http.ResponseWriter, req *http.Request) {
	data := readBodyJSON(req)

	downloadURL, _ := data["downloadUrl"].(string)
	digest, _ := data["digest"].(string)

	if downloadURL == "" || digest == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "Не указаны параметры скачивания обновления.",
		})
		return
	}

	result := DownloadServerUpdate(downloadURL, digest)

	if success, _ := result["success"].(bool); !success {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  result["error"],
		})
		return
	}

	LogEvent("server", "UPDATE_DOWNLOADED",
		fmt.Sprintf("Server update downloaded: %v bytes", result["size"]))

	writeJSON(w, map[string]any{
		"status": "ok",
		"size":   result["size"],
		"digest": result["digest"],
	})
}

func (r *Router) updateLatest(w http.ResponseWriter, req *http.Request) {
	result := GetLatestServerRelease()

	if success, _ := result["success"].(bool); !success {
		response := map[string]any{
			"status": "error",
			"error":  result["error"],
		}
		if code, ok := result["code"]; ok {
			response["code"] = code
		}
		status := http.StatusInternalServerError
		if s, ok := result["status"].(int); ok {
			status = s
		}
		writeJSONStatus(w, status, response)
		return
	}

	writeJSON(w, map[string]any{
		"status":      "ok",
		"version":     result["version"],
		"name":        result["name"],
		"publishedAt": result["publishedAt"],
		"whatsNew":    result["whatsNew"],
		"asset":       result["asset"],
	})
}

func (r *Router) updateReplace(w http.ResponseWriter, req *http.Request) {
	result := ReplaceServerBinary()

	if success, _ := result["success"].(bool); !success {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  result["error"],
		})
		return
	}

	LogEvent("server", "UPDATE_INSTALLED", "Server update installed")
	writeJSON(w, map[string]any{"status": "ok"})
}

func (r *Router) restart(w http.ResponseWriter, req *http.Request) {
	if !RestartProxy() {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  "restart_failed",
		})
		return
	}
	writeJSON(w, map[string]any{"status": "ok"})
}

func (r *Router) generateObfKey(w http.ResponseWriter, req *http.Request) {
	key, errMsg := GenerateObfKey()
	if errMsg != "" {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  errMsg,
		})
		return
	}
	LogEvent("server", "OBF_KEY_GENERATED", "Obfuscation key generated")
	writeJSON(w, map[string]any{"status": "ok", "key": key})
}

// ---------------------------------------------------------------------
// static UI
// ---------------------------------------------------------------------

func (r *Router) static(w http.ResponseWriter, req *http.Request) {

	path := req.URL.Path

	switch path {
	case "/", "/app":
		name := "login.html"
		if r.isAuth(req) {
			name = "index.html"
		}
		r.serveFile(w, req, name)
		return
	case "/login":
		r.serveFile(w, req, "login.html")
		return
	case "/favicon.ico":
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// /lang/*, /css/*, /js/*, /js/**/*
	fileServer := http.FileServer(http.FS(r.uiFS))
	fileServer.ServeHTTP(w, req)
}

func (r *Router) serveFile(w http.ResponseWriter, req *http.Request, name string) {
	data, err := fs.ReadFile(r.uiFS, name)
	if err != nil {
		http.NotFound(w, req)
		return
	}
	contentType := "text/html; charset=utf-8"
	if strings.HasSuffix(name, ".js") {
		contentType = "application/javascript"
	}
	w.Header().Set("Content-Type", contentType)
	_, _ = w.Write(data)
}
