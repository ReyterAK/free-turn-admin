//
// auth.go
// FreeTurn Admin
// Release 1.0.0 
//
// Administrator authentication.
//
// Credentials are stored in /config/auth.json
// (plaintext, LAN-only deployment by design).
// Sessions are HMAC-signed cookies persisted
// across restarts via /config/session.key.
//

package admin

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"strings"
)

const SessionCookie = "ft_admin_auth"

// ---------------------------------------------------------------------
// auth.json
// ---------------------------------------------------------------------

func getAuth() map[string]any {
	if v, ok := readJSON(AuthFile, map[string]any{}).(map[string]any); ok {
		return v
	}
	return map[string]any{}
}

func HasAdminAccount() bool {
	auth := getAuth()
	user, _ := auth["user"].(string)
	password, _ := auth["password"].(string)
	return strings.TrimSpace(user) != "" && password != ""
}

func SaveAuth(user, password string) error {
	return writeJSONFile(AuthFile, map[string]any{
		"user":     user,
		"password": password,
	})
}

func currentCredentials() (string, string) {
	auth := getAuth()
	user, _ := auth["user"].(string)
	password, _ := auth["password"].(string)
	return user, password
}

// ---------------------------------------------------------------------
// sessions (HMAC-signed cookie)
// ---------------------------------------------------------------------

func sessionKey() []byte {
	if data, err := os.ReadFile(SessionKeyFile); err == nil &&
		len(data) >= 32 {
		return data
	}
	key := make([]byte, 32)
	if _, err := rand.Read(key); err == nil {
		_ = writeText(SessionKeyFile, hex.EncodeToString(key))
		return key
	}
	// fallback: fixed key (should never happen)
	return []byte("freeturn-dev-key-fallback")
}

func signSession(value string) string {
	mac := hmac.New(sha256.New, sessionKey())
	mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil))
}

func sessionCookie() string {
	return "1." + signSession("1")
}

func validSession(cookie string) bool {
	if cookie == "" {
		return false
	}
	parts := strings.SplitN(cookie, ".", 2)
	if len(parts) != 2 || parts[0] != "1" {
		return false
	}
	return hmac.Equal(
		[]byte(parts[1]),
		[]byte(signSession("1")),
	)
}

// ---------------------------------------------------------------------
// operations
// ---------------------------------------------------------------------

func Authenticate(user, password string) bool {
	storedUser, storedPassword := currentCredentials()
	return storedUser != "" &&
		user == storedUser &&
		password == storedPassword
}

func CreateAccount(user, password string) error {
	if err := SaveAuth(user, password); err != nil {
		return err
	}
	return nil
}
