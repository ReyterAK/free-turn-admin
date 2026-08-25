//
// wireguard_import_test.go
// FreeTurn Admin — private-key import: validation + derivation
//
// Test vector is the REAL recovered peer15 keypair (verified against
// the router): private xTpMGc… derives to x54Edj… — exactly the
// public key RouterOS holds for the peer.
//

package admin

import "testing"

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
