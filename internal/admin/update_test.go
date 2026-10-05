//
// update_test.go
// FreeTurn Admin
// Release 1.2.2
//
// Tests for release-tag normalization.
//
// The community mirror (hackdiaz-dev/free-turn-proxy) publishes tags
// with a "-mirror" suffix ("v4.0.1-mirror"). The UI compares the tag
// against the version the running server reports ("4.0.1") with a
// plain string equality, so an unnormalized tag makes the panel offer
// an update forever on a version that is already installed.
//

package admin

import (
	"os"
	"testing"
)

func TestNormalizeTag(t *testing.T) {
	cases := []struct {
		tag  string
		want string
	}{
		// Mirror tags: the suffix must be dropped, otherwise the
		// panel never reports "up to date".
		{"v4.0.1-mirror", "4.0.1"},
		{"v4.0.0-mirror", "4.0.0"},

		// Plain upstream tags stay as they were.
		{"v4.0.0", "4.0.0"},
		{"v3.2.0", "3.2.0"},

		// Other pre-release / build suffixes.
		{"v4.0.1-rc1", "4.0.1"},
		{"v4.0.1+build.7", "4.0.1"},

		// Already normalized or unusual input must not panic.
		{"4.0.1", "4.0.1"},
		{"", ""},
		{"latest", "latest"},
	}

	for _, c := range cases {
		if got := normalizeTag(c.tag); got != c.want {
			t.Errorf("normalizeTag(%q) = %q, want %q", c.tag, got, c.want)
		}
	}
}

// TestNormalizeTagMatchesRunningServer pins the actual user-visible
// consequence: after normalization the tag must equal the version the
// server reports, otherwise the UI shows a permanent phantom update.
func TestNormalizeTagMatchesRunningServer(t *testing.T) {
	// GetVersion() extracts the bare version from the server output
	// via semverRe — it never keeps the "-mirror" suffix.
	const serverReported = "4.0.1"

	for _, tag := range []string{"v4.0.1-mirror", "v4.0.1"} {
		got := normalizeTag(tag)
		if got != serverReported {
			t.Errorf("tag %q normalizes to %q, server reports %q — "+
				"panel would offer a permanent phantom update",
				tag, got, serverReported)
		}
	}
}

// TestFailedCheckIsNotCached pins the bug reported after upgrading to
// 1.2.2: the panel kept showing "could not check for server updates"
// although the mirror answered fine. The previous release cached the
// failure together with the success flag, and /config is a persistent
// mount, so a stale entry survived an image upgrade and was replayed for
// the whole 24h TTL. A failed lookup must never reach the cache.
func TestFailedCheckIsNotCached(t *testing.T) {
	origDir := ConfigDir
	ConfigDir = t.TempDir()
	t.Cleanup(func() { ConfigDir = origDir })

	failed := map[string]any{
		"success": false,
		"code":    "github_http",
		"status":  404,
		"error":   "GitHub API error: 404",
	}

	// LatestServerUpdate persists a result only when it succeeded.
	// Reproduce that decision without touching the network.
	if success, _ := failed["success"].(bool); success {
		t.Fatal("fixture must be a failed lookup")
	}
	cacheIfSuccessful(failed)

	c, err := readServerUpdateCache()
	if err == nil && c.Release != nil {
		if ok, _ := c.Release["success"].(bool); !ok {
			t.Error("a failed lookup was persisted; it would be replayed " +
				"for 24h and across image upgrades")
		}
	return
	}

	// No cache file at all is the other acceptable outcome.
	if _, statErr := os.Stat(serverUpdateCachePath()); statErr == nil {
		t.Error("cache file exists although nothing succeeded")
	}
}
