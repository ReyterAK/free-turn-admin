//
// config.go
// FreeTurn Admin
// Release 1.0.0 
//
// /config file storage (same paths and formats
// as the previous Python backend).
//

package admin

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Paths under the persistent /config mount.

var (
	ConfigDir = envOr("CONFIG_DIR", "/config")

	AuthFile       = filepath.Join(ConfigDir, "auth.json")
	ClientsFile    = filepath.Join(ConfigDir, "clients.json")
	SettingsFile   = filepath.Join(ConfigDir, "settings.json")
	URIFile        = filepath.Join(ConfigDir, "uri.json")
	RunArgsFile    = filepath.Join(ConfigDir, "run.args")
	EventsFile     = filepath.Join(ConfigDir, "events.json")
	LogFile        = filepath.Join(ConfigDir, "free-turn-proxy.log")
	ProxyBin       = filepath.Join(ConfigDir, "bin", "free-turn-server")
	SessionKeyFile = filepath.Join(ConfigDir, "session.key")
)

func envOr(name, def string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return def
}

func ensureDir(dir string) error {
	return os.MkdirAll(dir, 0o755)
}

func readJSON(path string, def any) any {
	data, err := os.ReadFile(path)
	if err != nil {
		return def
	}
	var out any
	if err := json.Unmarshal(data, &out); err != nil {
		return def
	}
	return out
}

// writeFileAtomic writes data to path atomically:
// temp file in the same directory + rename. A crash in the
// middle leaves either the old file or the new one, never a
// truncated/corrupt config.
func writeFileAtomic(path string, data []byte, perm os.FileMode) error {
	dir := filepath.Dir(path)
	if err := ensureDir(dir); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".tmp-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer func() {
		if tmpName != "" {
			_ = os.Remove(tmpName)
		}
	}()

	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmpName, perm); err != nil {
		return err
	}
	if err := os.Rename(tmpName, path); err != nil {
		return err
	}
	tmpName = ""
	return nil
}

func writeJSONFile(path string, v any) error {
	if err := ensureDir(ConfigDir); err != nil {
		return err
	}
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return writeFileAtomic(path, data, 0o644)
}

func readText(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return string(data)
}

func writeText(path string, text string) error {
	if err := ensureDir(ConfigDir); err != nil {
		return err
	}
	return writeFileAtomic(path, []byte(text), 0o644)
}
