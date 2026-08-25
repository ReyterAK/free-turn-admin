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

func TestMatchInterfaceName(t *testing.T) {
	ips := map[string][]string{
		"free-turn-wg":     {"10.10.20.1/24"},
		"Free_Turn_NEW_WG": {"10.10.30.1/24", "10.10.30.5/24"},
		"wg-awg-server-1":  {"10.10.10.1/24"},
	}
	cases := []struct {
		host string
		want string
	}{
		{"10.10.20.1", "free-turn-wg"},
		{"10.10.30.1", "Free_Turn_NEW_WG"},
		{"10.10.30.5", "Free_Turn_NEW_WG"},
		{"10.10.99.99", ""}, // нет совпадения
		{"", ""},
	}
	for _, c := range cases {
		if got := matchInterfaceName(ips, c.host); got != c.want {
			t.Errorf("matchInterfaceName(%q) = %q, want %q", c.host, got, c.want)
		}
	}
}
