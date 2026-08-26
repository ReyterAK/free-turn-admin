//
// wireguard_import_test.go
// FreeTurn Admin — private-key import: validation + derivation
//
// Test vector is the REAL recovered peer15 keypair (verified against
// the router): private xTpMGc… derives to x54Edj… — exactly the
// public key RouterOS holds for the peer.
//

package admin

import (
	"testing"

	"freeturn/admin/internal/routeros"
)

func TestParsePrivateKeyValid(t *testing.T) {
	priv := "xTpMGcwMD1tkEfkg+ADPO0xl6rwYRfF5Ics5QdZLAj8="
	wantPub := "x54EdjXFauQOQ1FzpnZjhxZhFT3FoQiaAXUPrE1uwkE="
	got, err := parsePrivateKey(priv)
	if err != nil {
		t.Fatalf("parsePrivateKey: %v", err)
	}
	if got != wantPub {
		t.Errorf("derived public key = %q, want %q", got, wantPub)
	}
}

func TestParsePrivateKeyTrimsSpace(t *testing.T) {
	priv := "  xTpMGcwMD1tkEfkg+ADPO0xl6rwYRfF5Ics5QdZLAj8=\n"
	got, err := parsePrivateKey(priv)
	if err != nil {
		t.Fatalf("parsePrivateKey: %v", err)
	}
	want := "x54EdjXFauQOQ1FzpnZjhxZhFT3FoQiaAXUPrE1uwkE="
	if got != want {
		t.Errorf("derived public key = %q, want %q", got, want)
	}
}

func TestParsePrivateKeyInvalid(t *testing.T) {
	cases := []string{
		"",                        // empty
		"not-base64!",             // bad alphabet
		"x54EdjXFauQOQ1FzpnZjhx",  // valid base64 but wrong length (18 bytes)
		"AAAA",                    // 3 bytes
	}
	for _, c := range cases {
		if pub, err := parsePrivateKey(c); err == nil {
			t.Errorf("parsePrivateKey(%q) = %q, want error", c, pub)
		}
	}
}

func TestPreferMatchedPeer(t *testing.T) {
	other := routeros.Peer{Name: "peer-other", Interface: "wg-other", PublicKey: "K"}
	served := routeros.Peer{Name: "peer-served", Interface: "wg-served", PublicKey: "K"}

	// ключ только на обслуживаемом интерфейсе
	if got := preferMatchedPeer([]routeros.Peer{served}, "wg-served"); got == nil || got.Name != "peer-served" {
		t.Errorf("preferMatchedPeer(served only) = %+v, want peer-served", got)
	}

	// дубль: сначала чужой интерфейс, потом обслуживаемый — берём обслуживаемый
	got := preferMatchedPeer([]routeros.Peer{other, served}, "wg-served")
	if got == nil || got.Name != "peer-served" {
		t.Errorf("preferMatchedPeer(dup, other first) = %+v, want peer-served", got)
	}

	// ключ только на чужом интерфейсе — nil
	if got := preferMatchedPeer([]routeros.Peer{other}, "wg-served"); got != nil {
		t.Errorf("preferMatchedPeer(other only) = %+v, want nil", got)
	}

	// пустой список — nil
	if got := preferMatchedPeer(nil, "wg-served"); got != nil {
		t.Errorf("preferMatchedPeer(empty) = %+v, want nil", got)
	}
}
