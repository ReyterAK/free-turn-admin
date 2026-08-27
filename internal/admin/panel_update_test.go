//
// panel_update_test.go
// FreeTurn Admin — version comparison for the Docker Hub check.
//

package admin

import "testing"

func TestParseVersion(t *testing.T) {
	cases := []struct {
		in    string
		maj   int
		ok    bool
	}{
		{"1.0.0", 1, true},
		{"v1.2", 1, true},
		{"2", 2, true},
		{"0.9.0", 0, true},
		{"1.0.10", 1, true},
		{"latest", 0, false},
		{"dev", 0, false},
		{"1.2.3.4", 0, false},
		{"1.x", 0, false},
		{"", 0, false},
	}
	for _, c := range cases {
		maj, _, _, ok := parseVersion(c.in)
		if ok != c.ok || (ok && maj != c.maj) {
			t.Errorf("parseVersion(%q) = (%d, %v), want (%d, %v)", c.in, maj, ok, c.maj, c.ok)
		}
	}
}

func TestVersionLess(t *testing.T) {
	cases := []struct {
		a, b string
		want bool
	}{
		{"0.9.0", "1.0.0", true},
		{"1.0.0", "1.0.0", false},
		{"1.0.0", "0.9.0", false},
		{"1.0.9", "1.0.10", true}, // численно, а не лексикографически
		{"1.9.9", "2.0.0", true},
		{"1.0.1", "1.0.0", false},
		{"1.0", "1.0.0", false},
		{"2", "1.9.9", false},
	}
	for _, c := range cases {
		if got := versionLess(c.a, c.b); got != c.want {
			t.Errorf("versionLess(%q, %q) = %v, want %v", c.a, c.b, got, c.want)
		}
	}
}
