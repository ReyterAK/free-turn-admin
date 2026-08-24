package admin

import (
	"errors"
	"testing"
)

func TestClassifyRouterOSError(t *testing.T) {
	cases := []struct {
		err  string
		kind string
	}{
		{"routeros: /interface/wireguard -> HTTP 401: {\"error\":401,\"message\":\"Unauthorized\"}", "auth"},
		{"routeros: get http://x/rest: unauthorized", "auth"},
		{"routeros: /interface/wireguard -> HTTP 500: {\"detail\":\"std failure: not allowed (9)\",\"error\":500}", "permission"},
		{"routeros: /interface/wireguard -> HTTP 500: {\"detail\":\"not enough permissions (9)\",\"error\":500,\"message\":\"Internal Server Error\"}", "permission"},
		{"routeros: /interface/wireguard -> HTTP 403: forbidden", "permission"},
		{"routeros: Get \"http://10.255.255.1/rest/interface/wireguard\": context deadline exceeded", "unreachable"},
		{"routeros: connection refused", "unreachable"},
	}
	for _, c := range cases {
		got := classifyRouterOSError(errors.New(c.err))
		if got["kind"] != c.kind {
			t.Errorf("classify(%q).kind = %q, want %q", c.err, got["kind"], c.kind)
		}
		if got["detail"] == "" {
			t.Errorf("classify(%q): detail empty", c.err)
		}
	}
}
