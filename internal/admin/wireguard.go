//
// wireguard.go
// FreeTurn Admin — RouterOS WireGuard monitoring
//
// The tab focuses on the WireGuard interface that matches the
// Backend-server settings (the -connect host:port from the server
// run args): it shows that interface (by IP + listen port) and
// only its peers. Error states are layered:
//   - REST connection not configured / unreachable / auth / rights,
//   - backend not configured,
//   - backend configured but no WG interface with that IP,
//   - IP matches but the listen port differs (warning).
//

package admin

import (
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"freeturn/admin/internal/routeros"
)

// RouterOSConfig holds the connection settings for the RouterOS
// REST API (WireGuard monitoring). Stored in /config/routeros.json.
type RouterOSConfig struct {
	URL         string `json:"url"`
	User        string `json:"user"`
	Pass        string `json:"pass"`
	PollSeconds int    `json:"poll_seconds"`
	// ClientDNS — DNS для клиентских WG-конфигов ("1.1.1.1" по умолчанию).
	ClientDNS string `json:"client_dns,omitempty"`
}

// defaultClientDNS used when the setting is empty.
const defaultClientDNS = "1.1.1.1"

// onlineAfter — a peer counts as online when its last handshake
// is younger than this.
const onlineAfter = 3 * time.Minute

// LoadRouterOSConfig reads the RouterOS connection settings.
// Missing file returns a zero config (feature disabled).
func LoadRouterOSConfig() (RouterOSConfig, error) {
	var cfg RouterOSConfig
	if err := readJSONFile(RouterOSFile, &cfg); err != nil {
		return cfg, err
	}
	if cfg.PollSeconds < 5 || cfg.PollSeconds > 600 {
		cfg.PollSeconds = 15
	}
	if cfg.ClientDNS == "" {
		cfg.ClientDNS = defaultClientDNS
	}
	return cfg, nil
}

// SaveRouterOSConfig persists the RouterOS connection settings.
func SaveRouterOSConfig(cfg RouterOSConfig) error {
	if cfg.PollSeconds < 5 || cfg.PollSeconds > 600 {
		cfg.PollSeconds = 15
	}
	return writeJSONFile(RouterOSFile, cfg)
}

// backendHostPort returns the -connect host:port from the server
// run args — the "Backend-server" settings.
func backendHostPort() (host string, port int, ok bool) {
	fields := runArgsList()
	for i, arg := range fields {
		if arg != "-connect" || i+1 >= len(fields) {
			continue
		}
		h, portStr, cut := strings.Cut(fields[i+1], ":")
		if !cut || h == "" {
			return "", 0, false
		}
		p, err := strconv.Atoi(portStr)
		if err != nil || p < 1 || p > 65535 {
			return "", 0, false
		}
		return h, p, true
	}
	return "", 0, false
}

// hostOf strips the /prefix from a RouterOS address ("10.10.20.1/24").
func hostOf(addr string) string {
	if i := strings.IndexByte(addr, '/'); i >= 0 {
		return addr[:i]
	}
	return addr
}

// ipsByIfaceFrom maps interface name → addresses (with /prefix,
// "10.10.30.1/24").
func ipsByIfaceFrom(addrs []routeros.Address) map[string][]string {
	ipsByIface := map[string][]string{}
	for _, a := range addrs {
		name := a.Interface
		if name == "" {
			name = a.ActualInterface
		}
		if name == "" {
			continue
		}
		ipsByIface[name] = append(ipsByIface[name], a.Address)
	}
	return ipsByIface
}

// matchInterfaceName returns the name of the WG interface whose IP
// matches the Backend -connect host ("" when not found).
func matchInterfaceName(ipsByIface map[string][]string, backendHost string) string {
	for iface, ips := range ipsByIface {
		for _, ip := range ips {
			if hostOf(ip) == backendHost {
				return iface
			}
		}
	}
	return ""
}

// wireguardStatus reports the backend-matched WireGuard state.
func (r *Router) wireguardStatus(w http.ResponseWriter, req *http.Request) {
	cfg, err := LoadRouterOSConfig()
	if err != nil || cfg.URL == "" {
		writeJSON(w, map[string]any{"configured": false})
		return
	}

	client := routeros.New(cfg.URL, cfg.User, cfg.Pass, 6*time.Second)

	resp := map[string]any{
		"configured":   true,
		"url":          cfg.URL,
		"user":         cfg.User,
		"pass_set":     cfg.Pass != "",
		"poll_seconds": cfg.PollSeconds,
		"client_dns":   cfg.ClientDNS,
	}

	backendHost, backendPort, backendOK := backendHostPort()
	resp["backend_configured"] = backendOK
	resp["backend_host"] = backendHost
	resp["backend_port"] = backendPort

	interfaces, errI := client.ListInterfaces()
	peers, errP := client.ListPeers()
	addresses, errA := client.ListAddresses()

	if errI != nil {
		resp["interfaces_error"] = errI.Error()
	}
	if errP != nil {
		resp["peers_error"] = errP.Error()
	}
	if errA != nil {
		resp["addresses_error"] = errA.Error()
	}
	// Обе ключевые секции упали — это ошибка соединения, баннер.
	if errI != nil && errP != nil {
		resp["error"] = classifyRouterOSError(errI)
		writeJSON(w, resp)
		return
	}

	// interface name -> addresses (с маской, "10.10.30.1/24")
	ipsByIface := ipsByIfaceFrom(addresses)

	// Матч: IP из Backend против IP WG-интерфейсов.
	match := map[string]any{"status": "ip_not_found"}
	if backendOK {
		matchName := matchInterfaceName(ipsByIface, backendHost)
		var matched *routeros.Interface
		for i := range interfaces {
			if interfaces[i].Name == matchName {
				matched = &interfaces[i]
				break
			}
		}

		if matched != nil {
			status := "ok"
			if int(matched.ListenPort) != backendPort {
				status = "port_mismatch"
			}
			match = map[string]any{
				"status": status,
				"interface": map[string]any{
					"name":        matched.Name,
					"comment":     matched.Comment,
					"ips":         ipsByIface[matched.Name],
					"listen-port": int(matched.ListenPort),
					"public-key":  matched.PublicKey,
					"running":     bool(matched.Running),
					"disabled":    bool(matched.Disabled),
				},
			}

			// Только пиры найденного интерфейса + привязка к паре
			// ключей из wg.json (по публичному ключу).
			store, _ := LoadWGStore()
			var filtered []routeros.Peer
			used := map[string]bool{}
			for i := range peers {
				if peers[i].Interface == matched.Name {
					peers[i].FillDerived(onlineAfter)
					if kp := store.FindByPublicKey(peers[i].PublicKey); kp != nil {
						peers[i].HasKeypair = true
						peers[i].KeypairClientID = kp.ClientID
						peers[i].KeypairClient = clientCommentFor(kp.ClientID)
						used[ipOf(peers[i].AllowedAddr)] = true
					}
					filtered = append(filtered, peers[i])
				}
			}

			// Свободный адрес для нового пира (пул подсети интерфейса).
			if len(ipsByIface[matched.Name]) > 0 {
				subnet := ipsByIface[matched.Name][0]
				used[hostOf(subnet)] = true // IP самого интерфейса
				for i := range store.Keypairs {
					if store.Keypairs[i].WGInterface == matched.Name {
						used[ipOf(store.Keypairs[i].AllowedAddr)] = true
					}
				}
				if free := NextFreeAddress(subnet, used); free != "" {
					resp["next_free_address"] = free
				}
			}

			resp["peers"] = filtered
		}
	}
	resp["match"] = match

	writeJSON(w, resp)
}

// createInterfaceRequest is the payload of POST /api/wireguard/interface.
type createInterfaceRequest struct {
	Name       string `json:"name"`
	Comment    string `json:"comment"`
	ListenPort int    `json:"listen_port"`
	Address    string `json:"address"`
}

// maxIfaceName — верхняя граница длины имени интерфейса
// (RouterOS принимает и длиннее, но для панели хватит).
const maxIfaceName = 30

// sanitizeInterfaceName приводит имя к допустимому виду:
// пробелы/табуляции -> "-", недопустимые символы удаляются,
// длина ограничена. Возвращает "" если результат пуст.
func sanitizeInterfaceName(s string) string {
	var out []rune
	for _, r := range strings.TrimSpace(s) {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9',
			r == '_', r == '-', r == '.':
			out = append(out, r)
		case r == ' ' || r == '\t':
			if len(out) == 0 || out[len(out)-1] != '-' {
				out = append(out, '-')
			}
		}
	}
	res := strings.Trim(string(out), "-")
	if len(res) > maxIfaceName {
		res = res[:maxIfaceName]
	}
	return res
}

// wireguardCreateInterface creates a new WireGuard interface on the
// router (with its address) via the REST API. Requires a RouterOS
// user with the "write" policy. The listen-port is checked by the
// panel first: RouterOS itself ALLOWS duplicate ports on several WG
// interfaces, which would break packet delivery.
func (r *Router) wireguardCreateInterface(w http.ResponseWriter, req *http.Request) {
	cfg, err := LoadRouterOSConfig()
	if err != nil || cfg.URL == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "not_configured",
		})
		return
	}

	var body createInterfaceRequest
	if req.Body != nil {
		_ = json.NewDecoder(req.Body).Decode(&body)
	}
	body.Name = sanitizeInterfaceName(body.Name)
	body.Address = strings.TrimSpace(body.Address)
	body.Comment = strings.TrimSpace(body.Comment)
	if len(body.Comment) > 200 {
		body.Comment = body.Comment[:200]
	}

	if body.Name == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "invalid_name",
		})
		return
	}
	if body.ListenPort < 1 || body.ListenPort > 65535 {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "invalid_port",
		})
		return
	}
	if _, _, err := net.ParseCIDR(body.Address); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "invalid_address",
		})
		return
	}

	client := routeros.New(cfg.URL, cfg.User, cfg.Pass, 6*time.Second)

	// Проверка занятости listen-port (роутер дубли разрешает).
	existing, err := client.ListInterfaces()
	if err != nil {
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"status": "error",
			"error":  classifyRouterOSError(err),
		})
		return
	}
	for _, iface := range existing {
		if int(iface.ListenPort) == body.ListenPort {
			writeJSONStatus(w, http.StatusConflict, map[string]any{
				"status": "error",
				"error":  "port_in_use",
				"detail": iface.Name,
			})
			return
		}
	}

	if err := client.AddInterface(body.Name, body.ListenPort, body.Comment); err != nil {
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"status": "error",
			"error":  classifyRouterOSError(err),
		})
		return
	}

	// Адрес; при неудаче откатываем созданный интерфейс.
	if err := client.AddAddress(body.Name, body.Address, body.Comment); err != nil {
		// rollback: найти .id созданного интерфейса и удалить
		if list, lerr := client.ListInterfaces(); lerr == nil {
			for _, iface := range list {
				if iface.Name == body.Name {
					_ = client.DeleteInterface(iface.ID)
					break
				}
			}
		}
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"status": "error",
			"error":  classifyRouterOSError(err),
		})
		return
	}

	// Публичный ключ и итоговое состояние.
	created := map[string]any{
		"name":        body.Name,
		"comment":     body.Comment,
		"listen-port": body.ListenPort,
		"address":     body.Address,
	}
	if list, lerr := client.ListInterfaces(); lerr == nil {
		for _, iface := range list {
			if iface.Name == body.Name {
				created[".id"] = iface.ID
				created["public-key"] = iface.PublicKey
				created["running"] = bool(iface.Running)
				break
			}
		}
	}

	LogEvent("wireguard", "INTERFACE_CREATED", "WireGuard interface "+body.Name+" created")
	writeJSON(w, map[string]any{"status": "ok", "interface": created})
}

// wireguardDeleteInterface removes the interface together with its
// peers and addresses (RouterOS leaves orphaned peers/addresses
// otherwise). Requires the "write" policy.
func (r *Router) wireguardDeleteInterface(w http.ResponseWriter, req *http.Request) {
	cfg, err := LoadRouterOSConfig()
	if err != nil || cfg.URL == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "not_configured",
		})
		return
	}

	var body struct {
		Name string `json:"name"`
	}
	if req.Body != nil {
		_ = json.NewDecoder(req.Body).Decode(&body)
	}
	body.Name = strings.TrimSpace(body.Name)
	if body.Name == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "invalid_name",
		})
		return
	}

	client := routeros.New(cfg.URL, cfg.User, cfg.Pass, 6*time.Second)

	ifaces, err := client.ListInterfaces()
	if err != nil {
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"status": "error",
			"error":  classifyRouterOSError(err),
		})
		return
	}
	var target *routeros.Interface
	for i := range ifaces {
		if ifaces[i].Name == body.Name {
			target = &ifaces[i]
			break
		}
	}
	if target == nil {
		writeJSONStatus(w, http.StatusNotFound, map[string]any{
			"status": "error",
			"error":  "not_found",
		})
		return
	}

	// 1) пиры интерфейса
	if peers, err := client.ListPeers(); err == nil {
		for _, p := range peers {
			if p.Interface == body.Name {
				_ = client.DeletePeer(p.ID)
			}
		}
	}
	// 2) адреса интерфейса
	if addrs, err := client.ListAddresses(); err == nil {
		for _, a := range addrs {
			an := a.Interface
			if an == "" {
				an = a.ActualInterface
			}
			if an == body.Name {
				_ = client.DeleteAddress(a.ID)
			}
		}
	}
	// 3) сам интерфейс
	if err := client.DeleteInterface(target.ID); err != nil {
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"status": "error",
			"error":  classifyRouterOSError(err),
		})
		return
	}

	LogEvent("wireguard", "INTERFACE_DELETED", "WireGuard interface "+body.Name+" deleted")
	writeJSON(w, map[string]any{"status": "ok"})
}

// createPeerRequest is the payload of POST /api/wireguard/peer.
type createPeerRequest struct {
	InterfaceName string `json:"interface_name"`
	Comment       string `json:"comment"`
	AllowedAddr   string `json:"allowed_address"`
	ClientID      string `json:"client_id"`
}

// wireguardCreatePeer generates a client keypair, stores it in
// wg.json and adds the peer (public key + allowed address) to the
// router. Requires the "write" policy.
func (r *Router) wireguardCreatePeer(w http.ResponseWriter, req *http.Request) {
	cfg, err := LoadRouterOSConfig()
	if err != nil || cfg.URL == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "not_configured",
		})
		return
	}

	var body createPeerRequest
	if req.Body != nil {
		_ = json.NewDecoder(req.Body).Decode(&body)
	}
	body.InterfaceName = strings.TrimSpace(body.InterfaceName)
	body.Comment = strings.TrimSpace(body.Comment)
	body.AllowedAddr = strings.TrimSpace(body.AllowedAddr)

	if body.InterfaceName == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "invalid_interface",
		})
		return
	}

	client := routeros.New(cfg.URL, cfg.User, cfg.Pass, 6*time.Second)

	// Подсеть интерфейса + занятые адреса.
	ifaces, err := client.ListInterfaces()
	if err != nil {
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"status": "error",
			"error":  classifyRouterOSError(err),
		})
		return
	}
	var ifaceSubnet string
	found := false
	for i := range ifaces {
		if ifaces[i].Name == body.InterfaceName {
			found = true
			break
		}
	}
	if !found {
		writeJSONStatus(w, http.StatusNotFound, map[string]any{
			"status": "error",
			"error":  "not_found",
		})
		return
	}
	addrs, err := client.ListAddresses()
	if err != nil {
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"status": "error",
			"error":  classifyRouterOSError(err),
		})
		return
	}
	used := map[string]bool{}
	for _, a := range addrs {
		an := a.Interface
		if an == "" {
			an = a.ActualInterface
		}
		if an == body.InterfaceName {
			if ifaceSubnet == "" {
				ifaceSubnet = a.Address
			}
			used[ipOf(a.Address)] = true
		}
	}
	if ifaceSubnet == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "no_address_on_interface",
		})
		return
	}

	// Пул: занятые пирами + нашими парами.
	if peers, err := client.ListPeers(); err == nil {
		for i := range peers {
			if peers[i].Interface == body.InterfaceName {
				used[ipOf(peers[i].AllowedAddr)] = true
			}
		}
	}
	store, _ := LoadWGStore()
	for i := range store.Keypairs {
		if store.Keypairs[i].WGInterface == body.InterfaceName {
			used[ipOf(store.Keypairs[i].AllowedAddr)] = true
		}
	}

	// Адрес: указан или из пула.
	if body.AllowedAddr == "" {
		body.AllowedAddr = NextFreeAddress(ifaceSubnet, used)
		if body.AllowedAddr == "" {
			writeJSONStatus(w, http.StatusConflict, map[string]any{
				"status": "error",
				"error":  "pool_exhausted",
			})
			return
		}
	} else if !addrInSubnet(body.AllowedAddr, ifaceSubnet) {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "address_out_of_subnet",
		})
		return
	}

	// Клиентская привязка: 1:1.
	if body.ClientID != "" {
		if kp := store.FindByClient(body.ClientID); kp != nil {
			writeJSONStatus(w, http.StatusConflict, map[string]any{
				"status": "error",
				"error":  "client_already_bound",
			})
			return
		}
	}

	// Пара ключей + пир на роутере.
	kp, err := store.GenerateKeypair(body.InterfaceName, body.AllowedAddr, body.Comment, body.ClientID)
	if err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	if err := client.AddPeer(body.InterfaceName, kp.PublicKey, body.AllowedAddr, body.Comment); err != nil {
		store.Remove(kp.PublicKey) // rollback
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"status": "error",
			"error":  classifyRouterOSError(err),
		})
		return
	}
	// Запомнить имя, которое RouterOS назначил пиру (peer<N>):
	// в UI показывается имя/комментарий пира, не интерфейс.
	if peers, err := client.ListPeers(); err == nil {
		for i := range peers {
			if peers[i].PublicKey == kp.PublicKey {
				kp.PeerName = peers[i].Name
				break
			}
		}
	}
	if err := store.Save(); err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}

	LogEvent("wireguard", "PEER_CREATED", "WG peer "+kp.PublicKey[:12]+" on "+body.InterfaceName)
	writeJSON(w, map[string]any{
		"status":          "ok",
		"public_key":      kp.PublicKey,
		"private_key":     kp.PrivateKey,
		"allowed_address": kp.AllowedAddr,
		"config": buildClientConfig(
			kp.PrivateKey,
			kp.AllowedAddr,
			serverPublicKeyFor(client, body.InterfaceName),
			backendEndpoint(),
			cfg.ClientDNS,
		),
	})
}

// importPeerRequest is the payload of POST /api/wireguard/peer/import.
type importPeerRequest struct {
	PrivateKey string `json:"private_key"`
}

// parsePrivateKey validates a WireGuard private key (base64 std,
// 32 bytes) and returns the DERIVED public key (base64 std) — the
// router peer is matched by it.
func parsePrivateKey(s string) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(s))
	if err != nil {
		return "", fmt.Errorf("base64: %w", err)
	}
	if len(raw) != 32 {
		return "", fmt.Errorf("длина %d байт, ожидается 32", len(raw))
	}
	priv, err := ecdh.X25519().NewPrivateKey(raw)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(priv.PublicKey().Bytes()), nil
}

// wireguardImportPeer imports an EXISTING client private key for a
// router peer (matched by the derived public key). Lets the panel
// re-issue WG.config for peers whose keys were generated outside
// the panel (imported from another tool, or recovered from a saved
// config). Requires the "write" policy.
func (r *Router) wireguardImportPeer(w http.ResponseWriter, req *http.Request) {
	cfg, err := LoadRouterOSConfig()
	if err != nil || cfg.URL == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "not_configured",
		})
		return
	}

	var body importPeerRequest
	if req.Body != nil {
		_ = json.NewDecoder(req.Body).Decode(&body)
	}
	pub, err := parsePrivateKey(body.PrivateKey)
	if err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "invalid_private_key",
		})
		return
	}

	store, err := LoadWGStore()
	if err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	if store.FindByPublicKey(pub) != nil {
		writeJSONStatus(w, http.StatusConflict, map[string]any{
			"status": "error",
			"error":  "keypair_exists",
		})
		return
	}

	client := routeros.New(cfg.URL, cfg.User, cfg.Pass, 6*time.Second)
	peers, err := client.ListPeers()
	if err != nil {
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"status": "error",
			"error":  classifyRouterOSError(err),
		})
		return
	}
	var found *routeros.Peer
	for i := range peers {
		if peers[i].PublicKey == pub {
			found = &peers[i]
			break
		}
	}
	if found == nil {
		writeJSONStatus(w, http.StatusNotFound, map[string]any{
			"status": "error",
			"error":  "peer_not_found",
		})
		return
	}

	// Панель обслуживает ОДИН интерфейс — тот, что совпадает с
	// Backend. Ключ пира с ДРУГОГО интерфейса импортировать нельзя
	// (иначе в панели появляется «чужой» пир, недостижимый для
	// управления). Проверка по IP Backend против IP интерфейсов.
	backendHost, _, backendOK := backendHostPort()
	if !backendOK {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "backend_interface_not_found",
		})
		return
	}
	addrs, err := client.ListAddresses()
	if err != nil {
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"status": "error",
			"error":  classifyRouterOSError(err),
		})
		return
	}
	matchedName := matchInterfaceName(ipsByIfaceFrom(addrs), backendHost)
	if matchedName == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "backend_interface_not_found",
		})
		return
	}
	if found.Interface != matchedName {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "peer_on_other_interface",
		})
		return
	}

	id := make([]byte, 16)
	if _, err := rand.Read(id); err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	kp := &WGKeypair{
		ID:          base64.RawURLEncoding.EncodeToString(id),
		WGInterface: found.Interface,
		PublicKey:   pub,
		PrivateKey:  strings.TrimSpace(body.PrivateKey),
		AllowedAddr: found.AllowedAddr,
		Comment:     found.Comment,
		PeerName:    found.Name,
		CreatedAt:   time.Now().Unix(),
	}
	store.Keypairs = append(store.Keypairs, *kp)
	if err := store.Save(); err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}

	LogEvent("wireguard", "KEY_IMPORTED", "imported key for "+pub[:12]+" on "+found.Interface)
	writeJSON(w, map[string]any{
		"status":          "ok",
		"public_key":      pub,
		"wg_interface":    found.Interface,
		"allowed_address": found.AllowedAddr,
		"comment":         found.Comment,
	})
}

// bindPeerRequest is the payload of POST /api/wireguard/bind.
type bindPeerRequest struct {
	ClientID  string `json:"client_id"`
	PublicKey string `json:"public_key"`
}

// clientExists reports whether a client with the id exists.
func clientExists(id string) bool {
	if id == "" {
		return false
	}
	for _, c := range ListClients() {
		if c["id"] == id {
			return true
		}
	}
	return false
}

// wireguardBindPeer attaches a panel-managed peer keypair to a
// client (1:1). A peer may be re-bound to another client; a client
// already bound to another peer is a conflict. Requires "write".
func (r *Router) wireguardBindPeer(w http.ResponseWriter, req *http.Request) {
	var body bindPeerRequest
	if req.Body != nil {
		_ = json.NewDecoder(req.Body).Decode(&body)
	}
	body.ClientID = strings.TrimSpace(body.ClientID)
	body.PublicKey = strings.TrimSpace(body.PublicKey)

	if body.ClientID == "" || body.PublicKey == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "client_id_and_public_key_required",
		})
		return
	}
	if !clientExists(body.ClientID) {
		writeJSONStatus(w, http.StatusNotFound, map[string]any{
			"status": "error",
			"error":  "client_not_found",
		})
		return
	}

	store, err := LoadWGStore()
	if err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	if err := store.BindClient(body.ClientID, body.PublicKey); err != nil {
		switch {
		case errors.Is(err, ErrClientAlreadyBound):
			writeJSONStatus(w, http.StatusConflict, map[string]any{
				"status": "error",
				"error":  "client_already_bound",
			})
		case errors.Is(err, ErrPeerKeypairNotFound):
			writeJSONStatus(w, http.StatusNotFound, map[string]any{
				"status": "error",
				"error":  "peer_keypair_not_found",
			})
		default:
			writeJSONStatus(w, http.StatusBadRequest, map[string]any{
				"status": "error",
				"error":  err.Error(),
			})
		}
		return
	}
	if err := store.Save(); err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}

	LogEvent("wireguard", "PEER_BOUND", "client "+body.ClientID[:8]+" → peer "+body.PublicKey[:12])
	writeJSON(w, map[string]any{"status": "ok", "public_key": body.PublicKey, "client_id": body.ClientID})
}

// wireguardUnbindPeer clears the client binding of a peer keypair.
func (r *Router) wireguardUnbindPeer(w http.ResponseWriter, req *http.Request) {
	var body bindPeerRequest
	if req.Body != nil {
		_ = json.NewDecoder(req.Body).Decode(&body)
	}
	pub := strings.TrimSpace(body.PublicKey)
	if pub == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "public_key_required",
		})
		return
	}

	store, err := LoadWGStore()
	if err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	if err := store.UnbindClient(pub); err != nil {
		writeJSONStatus(w, http.StatusNotFound, map[string]any{
			"status": "error",
			"error":  "peer_keypair_not_found",
		})
		return
	}
	if err := store.Save(); err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}

	LogEvent("wireguard", "PEER_UNBOUND", "peer "+pub[:12])
	writeJSON(w, map[string]any{"status": "ok", "public_key": pub})
}

// wireguardBindings lists the panel-managed keypairs (public_key,
// interface, comment, allowed address, client binding) for the
// clients-table bind UI. Cheap: reads wg.json only, no router.
func (r *Router) wireguardBindings(w http.ResponseWriter, req *http.Request) {
	store, err := LoadWGStore()
	if err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	out := make([]map[string]any, 0, len(store.Keypairs))
	for i := range store.Keypairs {
		kp := &store.Keypairs[i]
		out = append(out, map[string]any{
			"public_key":      kp.PublicKey,
			"wg_interface":    kp.WGInterface,
			"peer_name":       kp.PeerName,
			"comment":         kp.Comment,
			"allowed_address": kp.AllowedAddr,
			"client_id":       kp.ClientID,
			"client_comment":  clientCommentFor(kp.ClientID),
		})
	}
	writeJSON(w, map[string]any{"status": "ok", "keypairs": out})
}

// wireguardRotatePeer replaces the keys of a panel-managed peer:
// a new X25519 pair is generated, the peer's public-key on the
// router is updated, then the keys in wg.json are swapped (the
// entry keeps its interface/address/comment/peer name and client
// binding). The old client config stops working — the admin gets
// the new one. Requires the "write" policy.
func (r *Router) wireguardRotatePeer(w http.ResponseWriter, req *http.Request) {
	cfg, err := LoadRouterOSConfig()
	if err != nil || cfg.URL == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "not_configured",
		})
		return
	}

	var body bindPeerRequest // uses PublicKey only
	if req.Body != nil {
		_ = json.NewDecoder(req.Body).Decode(&body)
	}
	pub := strings.TrimSpace(body.PublicKey)
	if pub == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "public_key_required",
		})
		return
	}

	store, err := LoadWGStore()
	if err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	if store.FindByPublicKey(pub) == nil {
		writeJSONStatus(w, http.StatusNotFound, map[string]any{
			"status": "error",
			"error":  "peer_keypair_not_found",
		})
		return
	}

	client := routeros.New(cfg.URL, cfg.User, cfg.Pass, 6*time.Second)
	peers, err := client.ListPeers()
	if err != nil {
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"status": "error",
			"error":  classifyRouterOSError(err),
		})
		return
	}
	var peer *routeros.Peer
	for i := range peers {
		if peers[i].PublicKey == pub {
			peer = &peers[i]
			break
		}
	}
	if peer == nil {
		writeJSONStatus(w, http.StatusNotFound, map[string]any{
			"status": "error",
			"error":  "peer_not_found",
		})
		return
	}

	// Новая пара ключей (X25519, как при создании пира).
	priv, err := ecdh.X25519().GenerateKey(rand.Reader)
	if err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	newPub := base64.StdEncoding.EncodeToString(priv.PublicKey().Bytes())
	newPriv := base64.StdEncoding.EncodeToString(priv.Bytes())

	// Роутер сначала, хранилище потом: при ошибке роутера
	// wg.json не трогаем (ротация не состоялась).
	if err := client.UpdatePeer(peer.ID, map[string]any{"public-key": newPub}); err != nil {
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"status": "error",
			"error":  classifyRouterOSError(err),
		})
		return
	}

	kp, err := store.RotateKey(pub, newPub, newPriv)
	if err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	if err := store.Save(); err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}

	LogEvent("wireguard", "KEY_ROTATED", "rotated key for "+newPub[:12]+" on "+kp.WGInterface)
	writeJSON(w, map[string]any{
		"status":          "ok",
		"public_key":      newPub,
		"wg_interface":    kp.WGInterface,
		"allowed_address": kp.AllowedAddr,
		"client_id":       kp.ClientID,
		"config": buildClientConfig(
			newPriv,
			kp.AllowedAddr,
			serverPublicKeyFor(client, kp.WGInterface),
			backendEndpoint(),
			cfg.ClientDNS,
		),
	})
}

// wireguardDeletePeer removes a peer from the router and, when a
// panel keypair exists, its wg.json entry (the client binding, if
// any, is dropped with it). Requires the "write" policy.
func (r *Router) wireguardDeletePeer(w http.ResponseWriter, req *http.Request) {
	cfg, err := LoadRouterOSConfig()
	if err != nil || cfg.URL == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "not_configured",
		})
		return
	}

	var body bindPeerRequest // uses PublicKey only
	if req.Body != nil {
		_ = json.NewDecoder(req.Body).Decode(&body)
	}
	pub := strings.TrimSpace(body.PublicKey)
	if pub == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "public_key_required",
		})
		return
	}

	client := routeros.New(cfg.URL, cfg.User, cfg.Pass, 6*time.Second)
	peers, err := client.ListPeers()
	if err != nil {
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"status": "error",
			"error":  classifyRouterOSError(err),
		})
		return
	}
	var peer *routeros.Peer
	for i := range peers {
		if peers[i].PublicKey == pub {
			peer = &peers[i]
			break
		}
	}
	if peer == nil {
		writeJSONStatus(w, http.StatusNotFound, map[string]any{
			"status": "error",
			"error":  "peer_not_found",
		})
		return
	}

	if err := client.DeletePeer(peer.ID); err != nil {
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"status": "error",
			"error":  classifyRouterOSError(err),
		})
		return
	}

	// Keypair панели (если был) — вместе с привязкой клиента.
	store, err := LoadWGStore()
	if err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	if store.FindByPublicKey(pub) != nil {
		store.Remove(pub)
		if err := store.Save(); err != nil {
			writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
				"status": "error",
				"error":  err.Error(),
			})
			return
		}
	}

	LogEvent("wireguard", "PEER_DELETED", "deleted peer "+pub[:12])
	writeJSON(w, map[string]any{"status": "ok", "public_key": pub})
}

// wireguardDeleteKeypair removes a wg.json keypair WITHOUT touching
// the router — for stray/foreign entries (a keypair whose router
// peer lives on another interface, or whose peer was deleted
// outside the panel). Requires the "write" policy.
func (r *Router) wireguardDeleteKeypair(w http.ResponseWriter, req *http.Request) {
	var body bindPeerRequest // uses PublicKey only
	if req.Body != nil {
		_ = json.NewDecoder(req.Body).Decode(&body)
	}
	pub := strings.TrimSpace(body.PublicKey)
	if pub == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "public_key_required",
		})
		return
	}

	store, err := LoadWGStore()
	if err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	if store.FindByPublicKey(pub) == nil {
		writeJSONStatus(w, http.StatusNotFound, map[string]any{
			"status": "error",
			"error":  "peer_keypair_not_found",
		})
		return
	}
	store.Remove(pub)
	if err := store.Save(); err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}

	LogEvent("wireguard", "KEYPAIR_DELETED", "deleted stray keypair "+pub[:12])
	writeJSON(w, map[string]any{"status": "ok", "public_key": pub})
}

// serverPublicKeyFor returns the public key of a WG interface.
func serverPublicKeyFor(client *routeros.Client, ifaceName string) string {
	ifaces, err := client.ListInterfaces()
	if err != nil {
		return ""
	}
	for i := range ifaces {
		if ifaces[i].Name == ifaceName {
			return ifaces[i].PublicKey
		}
	}
	return ""
}

// backendEndpoint returns "host:port" of the Backend server
// settings ("" when not configured).
func backendEndpoint() string {
	h, p, ok := backendHostPort()
	if !ok {
		return ""
	}
	return h + ":" + strconv.Itoa(p)
}

// wireguardPeerConfig returns the client WG config for a
// panel-managed peer (by public key).
func (r *Router) wireguardPeerConfig(w http.ResponseWriter, req *http.Request) {
	pub := strings.TrimSpace(req.URL.Query().Get("public_key"))
	if pub == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "public_key_required",
		})
		return
	}
	store, err := LoadWGStore()
	if err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	kp := store.FindByPublicKey(pub)
	if kp == nil {
		writeJSONStatus(w, http.StatusNotFound, map[string]any{
			"status": "error",
			"error":  "not_found",
		})
		return
	}

	cfg, err := LoadRouterOSConfig()
	if err != nil || cfg.URL == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "not_configured",
		})
		return
	}
	client := routeros.New(cfg.URL, cfg.User, cfg.Pass, 6*time.Second)

	writeJSON(w, map[string]any{
		"status":         "ok",
		"name":           kp.WGInterface + "-" + kp.Comment,
		"client_id":      kp.ClientID,
		"client_comment": clientCommentFor(kp.ClientID),
		"config": buildClientConfig(
			kp.PrivateKey,
			kp.AllowedAddr,
			serverPublicKeyFor(client, kp.WGInterface),
			backendEndpoint(),
			cfg.ClientDNS,
		),
	})
}

// clientCommentFor resolves a client id to its comment.
func clientCommentFor(id string) string {
	if id == "" {
		return ""
	}
	for _, c := range ListClients() {
		if c["id"] == id {
			return c["comment"]
		}
	}
	return id
}

// wireguardPeerConfigDownload serves the client WG config as a real
// file download (Content-Disposition: attachment) — the most
// reliable way across browsers (no blob/revoke pitfalls).
func (r *Router) wireguardPeerConfigDownload(w http.ResponseWriter, req *http.Request) {
	pub := strings.TrimSpace(req.URL.Query().Get("public_key"))
	if pub == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "public_key_required",
		})
		return
	}
	store, err := LoadWGStore()
	if err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	kp := store.FindByPublicKey(pub)
	if kp == nil {
		writeJSONStatus(w, http.StatusNotFound, map[string]any{
			"status": "error",
			"error":  "not_found",
		})
		return
	}

	cfg, err := LoadRouterOSConfig()
	if err != nil || cfg.URL == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "not_configured",
		})
		return
	}
	client := routeros.New(cfg.URL, cfg.User, cfg.Pass, 6*time.Second)

	text := buildClientConfig(
		kp.PrivateKey,
		kp.AllowedAddr,
		serverPublicKeyFor(client, kp.WGInterface),
		backendEndpoint(),
		cfg.ClientDNS,
	)

	fileName := "WG.config"
	if kp.Comment != "" {
		fileName = "WG-" + sanitizeInterfaceName(kp.Comment) + ".conf"
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+fileName+"\"")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write([]byte(text))
}

// wireguardSaveConfig stores the RouterOS connection settings.
func (r *Router) wireguardSaveConfig(w http.ResponseWriter, req *http.Request) {
	var body RouterOSConfig
	if req.Body != nil {
		_ = json.NewDecoder(req.Body).Decode(&body)
	}
	if body.URL == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"status": "error",
			"error":  "url_required",
		})
		return
	}
	// Пустой пароль в форме = не менять сохранённый.
	if body.Pass == "" {
		if cur, err := LoadRouterOSConfig(); err == nil {
			body.Pass = cur.Pass
		}
	}
	// Пустой DNS = сохранить прежний (или дефолт).
	if body.ClientDNS == "" {
		if cur, err := LoadRouterOSConfig(); err == nil && cur.ClientDNS != "" {
			body.ClientDNS = cur.ClientDNS
		} else {
			body.ClientDNS = defaultClientDNS
		}
	}
	if err := SaveRouterOSConfig(body); err != nil {
		writeJSONStatus(w, http.StatusInternalServerError, map[string]any{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	LogEvent("wireguard", "CONFIG_SAVED", "RouterOS connection settings updated")
	writeJSON(w, map[string]any{"status": "ok"})
}

// classifyRouterOSError разделяет ошибку соединения с RouterOS:
//
//	"auth"       — авторизация не прошла (неверные/пустые креды),
//	"permission" — прав пользователя недостаточно (нет политик
//	               api/read или RBAC не даёт доступ к меню),
//	"unreachable" — URL недоступен или иная сетевая проблема.
func classifyRouterOSError(err error) map[string]string {
	msg := err.Error()
	low := strings.ToLower(msg)
	kind := "unreachable"
	switch {
	case strings.Contains(msg, "401") || strings.Contains(low, "unauthorized"):
		kind = "auth"
	case strings.Contains(low, "not allowed") ||
		strings.Contains(low, "not enough permissions") ||
		strings.Contains(low, "permission denied") ||
		strings.Contains(msg, "403") ||
		strings.Contains(low, "forbidden"):
		kind = "permission"
	}
	return map[string]string{"kind": kind, "detail": msg}
}
