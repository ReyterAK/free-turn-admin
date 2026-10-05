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
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
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

// TestStaleFailureIsNotReplayed covers users already on 1.2.2: the failed
// lookup from the vanished upstream is ALREADY on disk, so guarding only
// the write path does not help them. LatestServerUpdate must refuse to
// serve a cached failure and must not overwrite the good result with a
// fresh one.
//
// A stub release endpoint returning 404 keeps the test offline and makes
// the "network still broken" case deterministic.
func TestStaleFailureIsNotReplayed(t *testing.T) {
	origDir := ConfigDir
	ConfigDir = t.TempDir()
	t.Cleanup(func() { ConfigDir = origDir })

	srv := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, `{"message":"Not Found"}`, http.StatusNotFound)
		}))
	defer srv.Close()
	origURL := githubReleaseURL
	githubReleaseURL = srv.URL
	t.Cleanup(func() { githubReleaseURL = origURL })

	// Seed the stale failure exactly as 1.2.2 wrote it.
	if err := writeJSONFile(serverUpdateCachePath(), serverUpdateCache{
		CheckedAt: time.Now().Unix(), // inside the 24h TTL
		Release: map[string]any{
			"success": false,
			"code":    "github_http",
			"status":  404,
			"error":   "GitHub API error: 404",
		},
	}); err != nil {
		t.Fatalf("seeding stale cache: %v", err)
	}

	res := LatestServerUpdate(false) // force=false -> cache path is taken

	// The stub still answers 404, so the result is a failure — but it
	// must be a FRESH one. cached==false proves the stored failure was
	// not replayed: before the fix the cached entry came back verbatim.
	if res["cached"] == true {
		t.Fatalf("a cached failure was served instead of re-checking: %v", res)
	}
	if _, fresh := res["error"]; !fresh {
		t.Errorf("result lacks a live error field: %v", res)
	}
	// And the stale entry must not have been handed back unchanged.
	if res["code"] == "github_http" && res["cached"] == true {
		t.Error("stale failure replayed")
	}
}
