//
// rest.go
// FreeTurn Admin — RouterOS REST API client
//
// Minimal client for reading WireGuard state from a RouterOS
// device via its REST API (/rest, RouterOS 7.1+). The router
// user needs the "api" and "read" group policies (REST access
// is gated by the "api" policy, not "rest-api").
//
// RouterOS REST returns booleans and numbers as JSON STRINGS
// ("true", "8395000", "51209"), so the types here use custom
// unmarshalling.
//

package routeros

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// rosBool accepts RouterOS string booleans ("true"/"false")
// and plain JSON booleans.
type rosBool bool

func (b *rosBool) UnmarshalJSON(data []byte) error {
	s := strings.Trim(string(data), `"`)
	*b = s == "true"
	return nil
}

// rosInt accepts RouterOS string numbers ("8395000") and plain
// JSON numbers.
type rosInt int64

func (i *rosInt) UnmarshalJSON(data []byte) error {
	s := strings.Trim(string(data), `"`)
	if s == "" {
		*i = 0
		return nil
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return err
	}
	*i = rosInt(v)
	return nil
}

// Interface is a RouterOS WireGuard interface (/interface/wireguard).
type Interface struct {
	ID         string  `json:".id"`
	Name       string  `json:"name"`
	Comment    string  `json:"comment"`
	ListenPort rosInt  `json:"listen-port"`
	PublicKey  string  `json:"public-key"`
	Running    rosBool `json:"running"`
	Disabled   rosBool `json:"disabled"`
}

// Peer is a RouterOS WireGuard peer (/interface/wireguard/peers).
type Peer struct {
	ID            string  `json:".id"`
	Name          string  `json:"name"`
	Interface     string  `json:"interface"`
	PublicKey     string  `json:"public-key"`
	AllowedAddr   string  `json:"allowed-address"`
	Comment       string  `json:"comment"`
	EndpointAddr  string  `json:"endpoint-address"`
	EndpointPort  rosInt  `json:"endpoint-port"`
	CurrentAddr   string  `json:"current-endpoint-address"`
	CurrentPort   rosInt  `json:"current-endpoint-port"`
	LastHandshake string  `json:"last-handshake"`
	Rx            rosInt  `json:"rx"`
	Tx            rosInt  `json:"tx"`
	Dynamic       rosBool `json:"dynamic"`
	Disabled      rosBool `json:"disabled"`

	// Derived fields, filled by the panel after fetch:
	// LastHandshakeSec is the parsed handshake age in seconds
	// (-1 when never/unknown), Online — handshake within the
	// configured threshold. HasKeypair/KeypairClientID — binding
	// info from the panel's wg.json (matched by public key).
	LastHandshakeSec int64  `json:"last_handshake_sec"`
	Online           bool   `json:"online"`
	HasKeypair       bool   `json:"has_keypair"`
	KeypairClientID  string `json:"keypair_client_id,omitempty"`
	KeypairClient    string `json:"keypair_client,omitempty"`
}

// Address is a RouterOS IP address entry (/ip/address).
type Address struct {
	ID              string `json:".id"`
	Interface       string `json:"interface"`
	ActualInterface string `json:"actual-interface"`
	Address         string `json:"address"` // "10.10.20.1/24"
}

// Client is a minimal RouterOS REST API client.
type Client struct {
	baseURL string
	user    string
	pass    string
	http    *http.Client
}

// New creates a client for baseURL (e.g. "http://10.10.20.1/rest").
func New(baseURL, user, pass string, timeout time.Duration) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		user:    user,
		pass:    pass,
		http:    &http.Client{Timeout: timeout},
	}
}

func (c *Client) get(path string, out any) error {
	req, err := http.NewRequest(http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return fmt.Errorf("routeros: %w", err)
	}
	req.SetBasicAuth(c.user, c.pass)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("routeros: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("routeros: %s -> HTTP %d: %s",
			path, resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// post sends a JSON POST (RouterOS REST "add" command) and decodes
// the response ({"ret":"*33"}). Non-2xx surfaces the router error.
func (c *Client) post(path string, payload map[string]any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("routeros: %w", err)
	}
	req, err := http.NewRequest(http.MethodPost, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("routeros: %w", err)
	}
	req.SetBasicAuth(c.user, c.pass)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("routeros: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("routeros: %s -> HTTP %d: %s",
			path, resp.StatusCode, strings.TrimSpace(string(data)))
	}
	return nil
}

// patch sends a JSON PATCH (RouterOS REST partial update of a
// concrete item, path ends with .id).
func (c *Client) patch(path string, payload map[string]any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("routeros: %w", err)
	}
	req, err := http.NewRequest(http.MethodPatch, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("routeros: %w", err)
	}
	req.SetBasicAuth(c.user, c.pass)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("routeros: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("routeros: %s -> HTTP %d: %s",
			path, resp.StatusCode, strings.TrimSpace(string(data)))
	}
	return nil
}

// del sends a DELETE for a concrete item (path ends with .id).
func (c *Client) del(path string) error {
	req, err := http.NewRequest(http.MethodDelete, c.baseURL+path, nil)
	if err != nil {
		return fmt.Errorf("routeros: %w", err)
	}
	req.SetBasicAuth(c.user, c.pass)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("routeros: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("routeros: %s -> HTTP %d: %s",
			path, resp.StatusCode, strings.TrimSpace(string(data)))
	}
	return nil
}

// ListInterfaces returns all WireGuard interfaces.
func (c *Client) ListInterfaces() ([]Interface, error) {
	var out []Interface
	if err := c.get("/interface/wireguard", &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListPeers returns all WireGuard peers across interfaces.
func (c *Client) ListPeers() ([]Peer, error) {
	var out []Peer
	if err := c.get("/interface/wireguard/peers", &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListAddresses returns all IP addresses (/ip/address) — used to
// map WireGuard interface names to their IPs.
func (c *Client) ListAddresses() ([]Address, error) {
	var out []Address
	if err := c.get("/ip/address", &out); err != nil {
		return nil, err
	}
	return out, nil
}

// AddInterface creates a WireGuard interface. RouterOS generates the
// keypair automatically. Returns the new item .id.
func (c *Client) AddInterface(name string, listenPort int, comment string) error {
	payload := map[string]any{
		"name":        name,
		"listen-port": listenPort,
	}
	if comment != "" {
		payload["comment"] = comment
	}
	return c.post("/interface/wireguard/add", payload)
}

// DeleteInterface removes a WireGuard interface by .id.
func (c *Client) DeleteInterface(id string) error {
	return c.del("/interface/wireguard/" + id)
}

// DeletePeer removes a WireGuard peer by .id.
func (c *Client) DeletePeer(id string) error {
	return c.del("/interface/wireguard/peers/" + id)
}

// UpdatePeer changes fields of a peer by .id (e.g. "public-key"
// during key rotation; the new key must already belong to the
// client before the change takes effect).
func (c *Client) UpdatePeer(id string, fields map[string]any) error {
	return c.patch("/interface/wireguard/peers/"+id, fields)
}

// ---------------------------------------------------------------------
// routing diagnostics (read-only)
// ---------------------------------------------------------------------

// Route is a RouterOS route (/ip/route).
type Route struct {
	ID           string  `json:".id"`
	DstAddress   string  `json:"dst-address"`
	Gateway      string  `json:"gateway"`
	RoutingTable string  `json:"routing-table"`
	Dynamic      rosBool `json:"dynamic"`
	Connect      rosBool `json:"connect"`
}

// FilterRule is a RouterOS firewall filter rule (/ip/firewall/filter).
// Constraint fields (address-lists, interface-lists, connection-state)
// matter: a rule is "blanket" only when ALL of them are empty.
type FilterRule struct {
	ID               string  `json:".id"`
	Chain            string  `json:"chain"`
	Action           string  `json:"action"`
	SrcAddress       string  `json:"src-address"`
	DstAddress       string  `json:"dst-address"`
	DstPort          string  `json:"dst-port"`
	Protocol         string  `json:"protocol"`
	SrcAddressList   string  `json:"src-address-list"`
	DstAddressList   string  `json:"dst-address-list"`
	InInterface      string  `json:"in-interface"`
	OutInterface     string  `json:"out-interface"`
	InInterfaceList  string  `json:"in-interface-list"`
	OutInterfaceList string  `json:"out-interface-list"`
	ConnectionState  string  `json:"connection-state"`
	IpsecPolicy      string  `json:"ipsec-policy"`
	Comment          string  `json:"comment"`
	Disabled         rosBool `json:"disabled"`
}

// NatRule is a RouterOS firewall NAT rule (/ip/firewall/nat).
type NatRule struct {
	ID          string  `json:".id"`
	Chain       string  `json:"chain"`
	Action      string  `json:"action"`
	SrcAddress  string  `json:"src-address"`
	DstAddress  string  `json:"dst-address"`
	DstPort     string  `json:"dst-port"`
	Protocol    string  `json:"protocol"`
	ToAddresses string  `json:"to-addresses"`
	ToPorts     string  `json:"to-ports"`
	Disabled    rosBool `json:"disabled"`
}

// ListRoutes returns all routes (routing tables included).
func (c *Client) ListRoutes() ([]Route, error) {
	var out []Route
	if err := c.get("/ip/route", &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListFilterRules returns all firewall filter rules in execution
// order (the array order matches RouterOS print order).
func (c *Client) ListFilterRules() ([]FilterRule, error) {
	var out []FilterRule
	if err := c.get("/ip/firewall/filter", &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListNatRules returns all firewall NAT rules.
func (c *Client) ListNatRules() ([]NatRule, error) {
	var out []NatRule
	if err := c.get("/ip/firewall/nat", &out); err != nil {
		return nil, err
	}
	return out, nil
}

// InterfaceListMember is one entry of /interface/list/member.
type InterfaceListMember struct {
	List      string `json:"list"`
	Interface string `json:"interface"`
}

// ListInterfaceListMembers returns all interface-list memberships
// (e.g. which interfaces sit in the "WAN" list — matters for the
// defconf "drop all from WAN" rule).
func (c *Client) ListInterfaceListMembers() ([]InterfaceListMember, error) {
	var out []InterfaceListMember
	if err := c.get("/interface/list/member", &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListServicePorts returns the TCP ports of enabled RouterOS services
// (/ip/service) — a dst-nat on the same port would shadow them.
func (c *Client) ListServicePorts() ([]int, error) {
	var out []struct {
		Port int `json:"port"`
	}
	if err := c.get("/ip/service", &out); err != nil {
		return nil, err
	}
	ports := make([]int, 0, len(out))
	for _, s := range out {
		if s.Port > 0 {
			ports = append(ports, s.Port)
		}
	}
	return ports, nil
}

// ContainerInfo is one RouterOS container (/container).
type ContainerInfo struct {
	ID          string `json:".id"`
	Name        string `json:"name"`
	RemoteImage string `json:"remote-image"`
}

// ListContainers returns all RouterOS containers in print order.
func (c *Client) ListContainers() ([]ContainerInfo, error) {
	var out []ContainerInfo
	if err := c.get("/container", &out); err != nil {
		return nil, err
	}
	return out, nil
}

// UpdateContainer runs /container/update — RouterOS re-pulls the
// container's remote-image and swaps the layers (the container
// restarts). The container is addressed by its .id.
func (c *Client) UpdateContainer(id string) error {
	return c.post("/container/update", map[string]any{"number": id})
}

// AddPeer creates a WireGuard peer (public key + allowed address).
func (c *Client) AddPeer(iface, publicKey, allowedAddress, comment string) error {
	payload := map[string]any{
		"interface":       iface,
		"public-key":      publicKey,
		"allowed-address": allowedAddress,
	}
	if comment != "" {
		payload["comment"] = comment
	}
	return c.post("/interface/wireguard/peers/add", payload)
}

// AddAddress assigns an address to an interface ("10.10.30.1/24").
func (c *Client) AddAddress(iface, address, comment string) error {
	payload := map[string]any{
		"address":   address,
		"interface": iface,
	}
	if comment != "" {
		payload["comment"] = comment
	}
	return c.post("/ip/address/add", payload)
}

// DeleteAddress removes an IP address entry by .id.
func (c *Client) DeleteAddress(id string) error {
	return c.del("/ip/address/" + id)
}

// ParseLastHandshake parses RouterOS relative handshake time
// ("14s", "3m5s", "1d2h3m4s") into seconds. Returns -1 for
// "never" or unparseable values.
func ParseLastHandshake(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" || s == "never" {
		return -1
	}
	var total int64
	var num strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			num.WriteRune(r)
			continue
		}
		v, err := strconv.ParseInt(num.String(), 10, 64)
		if err != nil {
			return -1
		}
		num.Reset()
		switch r {
		case 'd':
			total += v * 86400
		case 'h':
			total += v * 3600
		case 'm':
			total += v * 60
		case 's':
			total += v
		default:
			return -1
		}
	}
	if num.Len() > 0 {
		return -1 // trailing digits without a unit
	}
	return total
}

// FillDerived computes LastHandshakeSec and Online (handshake
// within maxAge) for a peer.
func (p *Peer) FillDerived(maxAge time.Duration) {
	p.LastHandshakeSec = ParseLastHandshake(p.LastHandshake)
	p.Online = p.LastHandshakeSec >= 0 &&
		time.Duration(p.LastHandshakeSec)*time.Second <= maxAge
}
