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
	// configured threshold.
	LastHandshakeSec int64 `json:"last_handshake_sec"`
	Online           bool  `json:"online"`
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
