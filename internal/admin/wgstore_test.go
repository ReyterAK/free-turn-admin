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

func TestRotateKey(t *testing.T) {
	s := newTestStore()
	if err := s.BindClient("client-1", "pub-a"); err != nil {
		t.Fatalf("bind: %v", err)
	}

	kp, err := s.RotateKey("pub-a", "pub-a-new", "priv-a-new")
	if err != nil {
		t.Fatalf("rotate: %v", err)
	}
	if kp.PublicKey != "pub-a-new" || kp.PrivateKey != "priv-a-new" {
		t.Errorf("keys not replaced: %+v", kp)
	}
	// привязка, интерфейс, адрес, комментарий сохраняются
	if kp.ClientID != "client-1" {
		t.Errorf("binding lost after rotation: %q", kp.ClientID)
	}
	if kp.WGInterface != "Free_Turn_NEW_WG" || kp.AllowedAddr != "10.10.30.2/32" || kp.Comment != "User_1" {
		t.Errorf("entry fields changed: %+v", kp)
	}
	// старый ключ больше не находится, новый — находится
	if s.FindByPublicKey("pub-a") != nil {
		t.Error("old public key still present after rotation")
	}
	if s.FindByPublicKey("pub-a-new") == nil {
		t.Error("new public key not findable after rotation")
	}
	// привязка клиента следует за пиром
	if s.FindByClient("client-1") == nil || s.FindByClient("client-1").PublicKey != "pub-a-new" {
		t.Error("client binding did not follow the rotated peer")
	}

	// неизвестный пир
	if _, err := s.RotateKey("pub-unknown", "x", "y"); !errors.Is(err, ErrPeerKeypairNotFound) {
		t.Errorf("expected ErrPeerKeypairNotFound, got %v", err)
	}
}
