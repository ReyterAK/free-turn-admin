package routeros

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestParseLastHandshake(t *testing.T) {
	cases := []struct {
		in   string
		want int64
	}{
		{"14s", 14},
		{"3m5s", 185},
		{"1h", 3600},
		{"1d2h3m4s", 86400 + 7200 + 180 + 4},
		{"never", -1},
		{"", -1},
		{"bogus", -1},
		{"12", -1},
	}
	for _, c := range cases {
		if got := ParseLastHandshake(c.in); got != c.want {
			t.Errorf("ParseLastHandshake(%q)=%d, want %d", c.in, got, c.want)
		}
	}
}

func TestFillDerived(t *testing.T) {
	p := Peer{LastHandshake: "14s"}
	p.FillDerived(3 * time.Minute)
	if !p.Online || p.LastHandshakeSec != 14 {
		t.Errorf("recent handshake must be online: %+v", p)
	}

	p = Peer{LastHandshake: "10m"}
	p.FillDerived(3 * time.Minute)
	if p.Online || p.LastHandshakeSec != 600 {
		t.Errorf("old handshake must be offline: %+v", p)
	}

	p = Peer{LastHandshake: "never"}
	p.FillDerived(3 * time.Minute)
	if p.Online || p.LastHandshakeSec != -1 {
		t.Errorf("never handshake must be offline: %+v", p)
	}
}

// sample routeros REST responses (string booleans/numbers)
const sampleInterfaces = `[
  {".id":"*2F","disabled":"false","listen-port":"25082","mtu":"1420",
   "name":"free-turn-wg","private-key":"*****",
   "public-key":"OEAOND391kmS4KyanN/TnpW/LEnFJ2UF1TIt1zuJUF8=","running":"true"},
  {".id":"*27","disabled":"false","listen-port":"25081","mtu":"1420",
   "name":"wg-awg-server-1","private-key":"*****",
   "public-key":"N1Mjagm7+8zgBWG/INbbAQg7XhGaJo+sgNA/sUr32jw=","running":"true"}
]`

const samplePeers = `[
  {".id":"*3","allowed-address":"10.10.10.2/32","client-allowed-address":"::/0",
   "client-endpoint":"","comment":"awg-server-1-client-1",
   "current-endpoint-address":"172.19.120.142","current-endpoint-port":"51209",
   "disabled":"false","dynamic":"false","endpoint-address":"","endpoint-port":"0",
   "interface":"wg-awg-server-1","last-handshake":"14s","name":"peer1-AWG",
   "preshared-key":"*****","private-key":"*****",
   "public-key":"oVtE7MydYil3+NcSk2O1OZ7JQ6UnTltadnk+5c+uxko=","rx":"8395000","tx":"58834536"}
]`

func TestListInterfaces(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/rest/interface/wireguard" {
			t.Errorf("path = %q", r.URL.Path)
		}
		user, pass, ok := r.BasicAuth()
		if !ok || user != "wg" || pass != "secret" {
			t.Errorf("bad auth: %q %q %v", user, pass, ok)
		}
		_, _ = w.Write([]byte(sampleInterfaces))
	}))
	defer srv.Close()

	c := New(srv.URL+"/rest", "wg", "secret", 3*time.Second)
	ifaces, err := c.ListInterfaces()
	if err != nil {
		t.Fatalf("ListInterfaces: %v", err)
	}
	if len(ifaces) != 2 {
		t.Fatalf("len = %d", len(ifaces))
	}
	if ifaces[0].Name != "free-turn-wg" || int(ifaces[0].ListenPort) != 25082 ||
		!bool(ifaces[0].Running) || bool(ifaces[0].Disabled) {
		t.Errorf("unexpected interface: %+v", ifaces[0])
	}
	if ifaces[1].Name != "wg-awg-server-1" {
		t.Errorf("unexpected interface: %+v", ifaces[1])
	}
}

func TestListPeers(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/rest/interface/wireguard/peers" {
			t.Errorf("path = %q", r.URL.Path)
		}
		_, _ = w.Write([]byte(samplePeers))
	}))
	defer srv.Close()

	c := New(srv.URL+"/rest", "wg", "secret", 3*time.Second)
	peers, err := c.ListPeers()
	if err != nil {
		t.Fatalf("ListPeers: %v", err)
	}
	if len(peers) != 1 {
		t.Fatalf("len = %d", len(peers))
	}
	p := peers[0]
	if p.Name != "peer1-AWG" || p.Interface != "wg-awg-server-1" ||
		p.AllowedAddr != "10.10.10.2/32" || p.CurrentAddr != "172.19.120.142" ||
		int(p.CurrentPort) != 51209 || int(p.Rx) != 8395000 || int(p.Tx) != 58834536 ||
		bool(p.Dynamic) || bool(p.Disabled) {
		t.Errorf("unexpected peer: %+v", p)
	}
	p.FillDerived(3 * time.Minute)
	if !p.Online || p.LastHandshakeSec != 14 {
		t.Errorf("peer must be online: %+v", p)
	}
}

func TestListInterfacesHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":500,"detail":"not allowed"}`))
	}))
	defer srv.Close()

	c := New(srv.URL+"/rest", "wg", "secret", 3*time.Second)
	if _, err := c.ListInterfaces(); err == nil {
		t.Fatal("expected error for HTTP 500")
	}
}
