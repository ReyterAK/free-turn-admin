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
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const SessionCookie = "ft_admin_auth"

// SessionLifetime is how long a login session stays valid.
const SessionLifetime = 24 * time.Hour

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
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return writeJSONFile(AuthFile, map[string]any{
		"user":     user,
		"password": string(hash),
	})
}

func currentCredentials() (string, string) {
	auth := getAuth()
	user, _ := auth["user"].(string)
	password, _ := auth["password"].(string)
	return user, password
}

// isBcryptHash reports whether the stored password is a bcrypt hash
// (as opposed to the legacy plaintext).
func isBcryptHash(s string) bool {
	return strings.HasPrefix(s, "$2a$") ||
		strings.HasPrefix(s, "$2b$") ||
		strings.HasPrefix(s, "$2y$")
}

// ---------------------------------------------------------------------
// sessions (HMAC-signed cookie)
// ---------------------------------------------------------------------

func sessionKey() []byte {
	if data, err := os.ReadFile(SessionKeyFile); err == nil && len(data) >= 32 {
		return data
	}
	key := make([]byte, 32)
	if _, err := rand.Read(key); err == nil {
		// Persist the raw bytes so the generated key equals the key
		// read back on the next call (a hex-encoded copy would sign
		// the first cookie differently).
		_ = os.WriteFile(SessionKeyFile, key, 0o600)
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

// sessionCookie builds a versioned, timestamped session cookie:
// "2.<unix_ts>.<hmac(ts)>". The server rejects cookies older than
// SessionLifetime even if copied, and the browser Max-Age drops them.
func sessionCookie() string {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	return "2." + ts + "." + signSession(ts)
}

func validSession(cookie string) bool {
	if cookie == "" {
		return false
	}
	parts := strings.SplitN(cookie, ".", 3)
	if len(parts) != 3 || parts[0] != "2" {
		return false
	}
	ts, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return false
	}
	if time.Since(time.Unix(ts, 0)) > SessionLifetime {
		return false
	}
	return hmac.Equal(
		[]byte(parts[2]),
		[]byte(signSession(parts[1])),
	)
}

// ---------------------------------------------------------------------
// operations
// ---------------------------------------------------------------------

func Authenticate(user, password string) bool {
	storedUser, storedPassword := currentCredentials()
	if storedUser == "" || storedPassword == "" || user != storedUser {
		return false
	}
	if isBcryptHash(storedPassword) {
		return bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(password)) == nil
	}
	// Прозрачная миграция: старый plaintext сверяется и при первом
	// успешном входе пересохраняется хешем (учётка не теряется при
	// обновлении контейнера).
	if password != storedPassword {
		return false
	}
	_ = SaveAuth(storedUser, password) // best-effort: вход уже успешен
	return true
}

func CreateAccount(user, password string) error {
	if err := SaveAuth(user, password); err != nil {
		return err
	}
	return nil
}
