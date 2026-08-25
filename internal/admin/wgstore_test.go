//
// wgstore_test.go
// FreeTurn Admin — client↔peer binding (1:1) on the keypair store
//

package admin

import (
	"errors"
	"testing"
)

func newTestStore() *WGStore {
	return &WGStore{
		Version: 1,
		Keypairs: []WGKeypair{
			{
				ID:          "kp-peer-a",
				WGInterface: "Free_Turn_NEW_WG",
				PublicKey:   "pub-a",
				PrivateKey:  "priv-a",
				AllowedAddr: "10.10.30.2/32",
				Comment:     "User_1",
			},
			{
				ID:          "kp-peer-b",
				WGInterface: "Free_Turn_NEW_WG",
				PublicKey:   "pub-b",
				PrivateKey:  "priv-b",
				AllowedAddr: "10.10.30.3/32",
				Comment:     "peer-b",
			},
		},
	}
}

func TestBindClient(t *testing.T) {
	s := newTestStore()

	// bind ok
	if err := s.BindClient("client-1", "pub-a"); err != nil {
		t.Fatalf("bind: %v", err)
	}
	if s.FindByPublicKey("pub-a").ClientID != "client-1" {
		t.Errorf("binding not stored")
	}

	// 1:1 — same client to another peer must conflict
	if err := s.BindClient("client-1", "pub-b"); !errors.Is(err, ErrClientAlreadyBound) {
		t.Errorf("expected ErrClientAlreadyBound, got %v", err)
	}
	if s.FindByPublicKey("pub-b").ClientID != "" {
		t.Errorf("conflicting bind must not be applied")
	}

	// peer re-bound to another client is allowed (сменить) — after
	// unbinding the old client first
	if err := s.UnbindClient("pub-a"); err != nil {
		t.Fatalf("unbind: %v", err)
	}
	if err := s.BindClient("client-2", "pub-a"); err != nil {
		t.Fatalf("re-bind to another client: %v", err)
	}
	if s.FindByPublicKey("pub-a").ClientID != "client-2" {
		t.Errorf("re-binding not stored")
	}
}

func TestBindClientErrors(t *testing.T) {
	s := newTestStore()

	// unknown peer keypair
	if err := s.BindClient("client-1", "pub-unknown"); !errors.Is(err, ErrPeerKeypairNotFound) {
		t.Errorf("expected ErrPeerKeypairNotFound, got %v", err)
	}
	// empty args
	if err := s.BindClient("", "pub-a"); err == nil {
		t.Error("empty client_id must fail")
	}
	if err := s.BindClient("client-1", ""); err == nil {
		t.Error("empty public_key must fail")
	}
	// unbind unknown peer
	if err := s.UnbindClient("pub-unknown"); !errors.Is(err, ErrPeerKeypairNotFound) {
		t.Errorf("expected ErrPeerKeypairNotFound on unbind, got %v", err)
	}
}
