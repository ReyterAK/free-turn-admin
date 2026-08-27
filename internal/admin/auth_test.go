package admin

import (
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

// Session cookies carry a timestamp; the tests isolate the key file
// in a temp dir so signSession/validSession are deterministic.
func newAuthTest(t *testing.T) {
	t.Helper()
	ConfigDir = t.TempDir()
	// Path vars are bound at package init from CONFIG_DIR; the tests
	// re-point the key file (and auth file) explicitly.
	SessionKeyFile = filepath.Join(ConfigDir, "session.key")
	AuthFile = filepath.Join(ConfigDir, "auth.json")
}

func TestSessionCookieValid(t *testing.T) {
	newAuthTest(t)
	c := sessionCookie()
	if !validSession(c) {
		t.Fatal("fresh session cookie must be valid")
	}
	if !strings.HasPrefix(c, "2.") {
		t.Fatalf("cookie must be version 2: %q", c)
	}
}

func TestSessionCookieTampered(t *testing.T) {
	newAuthTest(t)
	c := sessionCookie()
	if validSession(c + "x") {
		t.Fatal("tampered cookie must be rejected")
	}
	if validSession("2.1.abc") {
		t.Fatal("bad signature must be rejected")
	}
	if validSession("") {
		t.Fatal("empty cookie must be rejected")
	}
}

func TestSessionCookieExpired(t *testing.T) {
	newAuthTest(t)
	old := time.Now().Add(-48 * time.Hour).Unix()
	expired := "2." + strconv.FormatInt(old, 10) + "." + signSession(strconv.FormatInt(old, 10))
	if validSession(expired) {
		t.Fatal("cookie older than SessionLifetime must be rejected")
	}
}

func TestSessionCookieLegacyRejected(t *testing.T) {
	newAuthTest(t)
	legacy := "1." + signSession("1")
	if validSession(legacy) {
		t.Fatal("legacy v1 cookies must be rejected after the upgrade")
	}
}

func TestSessionCookieFreshness(t *testing.T) {
	newAuthTest(t)
	// a cookie issued just now is valid; one from 12 hours ago is still valid
	twelveHours := time.Now().Add(-12 * time.Hour).Unix()
	c := "2." + strconv.FormatInt(twelveHours, 10) + "." + signSession(strconv.FormatInt(twelveHours, 10))
	if !validSession(c) {
		t.Fatal("cookie within SessionLifetime must be valid")
	}
}

func TestSaveAuthHashesPassword(t *testing.T) {
	newAuthTest(t)
	if err := SaveAuth("admin", "secret1"); err != nil {
		t.Fatalf("SaveAuth: %v", err)
	}
	_, stored := currentCredentials()
	if !isBcryptHash(stored) {
		t.Fatalf("stored password must be a bcrypt hash, got %q", stored)
	}
	if !Authenticate("admin", "secret1") {
		t.Fatal("correct password must authenticate against the hash")
	}
	if Authenticate("admin", "wrong") {
		t.Fatal("wrong password must be rejected")
	}
}

func TestAuthenticateMigratesPlaintext(t *testing.T) {
	newAuthTest(t)
	// legacy plaintext auth.json (as written by pre-bcrypt builds)
	if err := writeJSONFile(AuthFile, map[string]any{
		"user":     "admin",
		"password": "legacy-pass",
	}); err != nil {
		t.Fatalf("write legacy auth: %v", err)
	}
	if !Authenticate("admin", "legacy-pass") {
		t.Fatal("plaintext password must authenticate")
	}
	_, stored := currentCredentials()
	if !isBcryptHash(stored) {
		t.Fatalf("login must migrate plaintext to bcrypt, got %q", stored)
	}
	// второй вход — уже по хешу
	if !Authenticate("admin", "legacy-pass") {
		t.Fatal("authenticate against migrated hash failed")
	}
	if Authenticate("admin", "wrong") {
		t.Fatal("wrong password must be rejected after migration")
	}
}
