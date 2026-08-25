//
// routing.go
// FreeTurn Admin — routing diagnostics (READ-ONLY)
//
// Philosophy (user decision): the container NEVER changes routing,
// firewall or anything except WireGuard. This tab only diagnoses
// and prints exact WinBOX commands as recommendations — the admin
// applies them consciously, with a router backup first.
//
// Diagnostics start from the container (its network, the server
// listener, the external port forwarding to it) and then cover the
// WireGuard path (interface, route, NAT, firewall forward/input,
// fasttrack).
//

package admin

import (
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"freeturn/admin/internal/routeros"
)

// RoutingCheck is one diagnostic verdict, rendered by the UI.
// DetailKey/TitleKey are i18n keys; Params fill %s placeholders.
// Commands are exact RouterOS CLI lines for the WinBOX terminal.
type RoutingCheck struct {
	ID        string   `json:"id"`
	Group     string   `json:"group"` // "container" | "wg"
	Status    string   `json:"status"` // ok | info | warning | error
	TitleKey  string   `json:"title_key"`
	DetailKey string   `json:"detail_key"`
	Params    []string `json:"params,omitempty"`
	Commands  []string `json:"commands,omitempty"`
}

func check(id, group, status, titleKey, detailKey string, params, commands []string) RoutingCheck {
	return RoutingCheck{
		ID: id, Group: group, Status: status,
		TitleKey: titleKey, DetailKey: detailKey,
		Params: params, Commands: commands,
	}
}

// containerIPv4s returns the container's own non-loopback IPv4
// addresses (from inside the container; on host-network dev it is
// the host's addresses — reported as-is).
func containerIPv4s() []string {
	var out []string
	ifaces, err := net.Interfaces()
	if err != nil {
		return out
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, a := range addrs {
			var ip net.IP
			switch v := a.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip == nil || ip.To4() == nil {
				continue
			}
			out = append(out, ip.String())
		}
	}
	return out
}

// containerDefaultRoute reads /proc/net/route (Linux) and returns
// the interface of the default route ("" when none).
func containerDefaultRoute(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	for i, line := range strings.Split(string(data), "\n") {
		if i == 0 {
			continue // header
		}
		f := strings.Fields(line)
		if len(f) < 3 {
			continue
		}
		if f[1] == "00000000" {
			return f[0]
		}
	}
	return ""
}

// listenPort extracts the free-turn-server -listen port from
// run.args (0 when not set).
func listenPort() int {
	args := runArgsList()
	for i, a := range args {
		if a == "-listen" && i+1 < len(args) {
			_, portStr, cut := strings.Cut(args[i+1], ":")
			if !cut {
				portStr = args[i+1]
			}
			if p, err := strconv.Atoi(portStr); err == nil {
				return p
			}
		}
	}
	return 0
}

// subnetOf converts "10.10.30.1/24" to the network "10.10.30.0/24".
func subnetOf(addr string) string {
	_, netw, err := net.ParseCIDR(addr)
	if err != nil {
		return ""
	}
	return netw.String()
}

// addrCovers reports whether the CIDR network contains the other
// network (either string may be a bare IP or a CIDR).
func addrCovers(network, contained string) bool {
	if network == "" {
		return false
	}
	var n *net.IPNet
	if ip := net.ParseIP(network); ip != nil {
		bits := 32
		if ip.To4() == nil {
			bits = 128
		}
		n = &net.IPNet{IP: ip, Mask: net.CIDRMask(bits, bits)}
	} else if _, parsed, err := net.ParseCIDR(network); err == nil {
		n = parsed
	} else {
		return false
	}
	var c *net.IPNet
	if ip := net.ParseIP(contained); ip != nil {
		c = &net.IPNet{IP: ip, Mask: net.CIDRMask(32, 32)}
	} else if _, parsed, err := net.ParseCIDR(contained); err == nil {
		c = parsed
	} else {
		return false
	}
	return n.Contains(c.IP)
}

// blanketRule reports whether a filter rule has no constraints at
// all (matches everything) — only such rules can serve as the
// final "drop all"/"accept all" gate.
func blanketRule(r routeros.FilterRule) bool {
	return r.SrcAddress == "" && r.DstAddress == "" &&
		r.DstPort == "" && r.Protocol == "" &&
		r.SrcAddressList == "" && r.DstAddressList == "" &&
		r.InInterface == "" && r.OutInterface == "" &&
		r.InInterfaceList == "" && r.OutInterfaceList == "" &&
		r.ConnectionState == ""
}

// ruleMatchesSubnet reports whether an accept/drop rule touches the
// WG subnet: unconstrained, address covers the subnet, or the rule
// is scoped to the WG interface itself.
func ruleMatchesSubnet(r routeros.FilterRule, subnet, iface string) bool {
	if r.SrcAddress != "" && addrCovers(r.SrcAddress, subnet) {
		return true
	}
	if r.DstAddress != "" && addrCovers(r.DstAddress, subnet) {
		return true
	}
	if iface != "" && (r.InInterface == iface || r.OutInterface == iface) {
		return true
	}
	return false
}

// ruleHitsPort reports whether a rule targets the UDP port (the WG
// listen port) without other address constraints.
func ruleHitsPort(r routeros.FilterRule, port int) bool {
	if r.DstPort == "" || port <= 0 {
		return false
	}
	if r.Protocol != "" && r.Protocol != "udp" {
		return false
	}
	if r.SrcAddress != "" || r.DstAddress != "" ||
		r.SrcAddressList != "" || r.DstAddressList != "" {
		return false
	}
	for _, p := range strings.Split(r.DstPort, ",") {
		if strings.TrimSpace(p) == strconv.Itoa(port) {
			return true
		}
	}
	return false
}

// toAddressesMatch reports whether a dst-nat rule's to-addresses
// list contains one of the given IPs.
func toAddressesMatch(toAddresses string, ips []string) bool {
	if toAddresses == "" {
		return false
	}
	for _, part := range strings.Split(toAddresses, ",") {
		part = strings.TrimSpace(hostOf(part))
		for _, ip := range ips {
			if part == ip {
				return true
			}
		}
	}
	return false
}

// wanIP returns the IP of the interface carrying the main-table
// default route ("" when undeterminable).
func wanIP(routes []routeros.Route, addrs []routeros.Address) string {
	gw := ""
	for _, r := range routes {
		if r.DstAddress == "0.0.0.0/0" &&
			(r.RoutingTable == "" || r.RoutingTable == "main") {
			gw = r.Gateway
			break
		}
	}
	if gw == "" {
		return ""
	}
	for _, a := range addrs {
		name := a.Interface
		if name == "" {
			name = a.ActualInterface
		}
		if name == gw {
			return hostOf(a.Address)
		}
	}
	return ""
}

// runRoutingChecks is the pure diagnostic engine: all data is
// passed in, verdicts are returned. Testable with sample data.
func runRoutingChecks(
	ifaceName string, ifaceIPs []string, ifacePort int,
	containerIPs []string, listenPort int, serverRunning bool, containerDefRoute string,
	routes []routeros.Route, addrs []routeros.Address,
	nat []routeros.NatRule, filter []routeros.FilterRule,
) []RoutingCheck {
	var out []RoutingCheck

	// ------------------------------------------------------------------
	// A. Container
	// ------------------------------------------------------------------

	// A1. network interfaces
	if len(containerIPs) == 0 {
		out = append(out, check("container_net", "container", "warning",
			"routing.c_container_net", "routing.c_container_net_none", nil, nil))
	} else {
		out = append(out, check("container_net", "container", "info",
			"routing.c_container_net", "routing.c_container_net_ok",
			[]string{strings.Join(containerIPs, ", ")}, nil))
	}
	if containerDefRoute != "" {
		out = append(out, check("container_route", "container", "ok",
			"routing.c_container_route", "routing.c_container_route_ok",
			[]string{containerDefRoute}, nil))
	} else {
		out = append(out, check("container_route", "container", "warning",
			"routing.c_container_route", "routing.c_container_route_none", nil, nil))
	}

	// A2. server listener
	if !serverRunning {
		out = append(out, check("server_listen", "container", "error",
			"routing.c_server_listen", "routing.c_server_listen_down", nil, nil))
	} else if listenPort > 0 {
		out = append(out, check("server_listen", "container", "ok",
			"routing.c_server_listen", "routing.c_server_listen_ok",
			[]string{strconv.Itoa(listenPort)}, nil))
	} else {
		out = append(out, check("server_listen", "container", "warning",
			"routing.c_server_listen", "routing.c_server_listen_no_port", nil, nil))
	}

	// A3. external port forwarding (dst-nat to the container)
	if serverRunning && listenPort > 0 && len(containerIPs) > 0 {
		found := false
		for _, r := range nat {
			if r.Chain != "dstnat" || r.Disabled {
				continue
			}
			if r.Action == "dst-nat" &&
				toAddressesMatch(r.ToAddresses, containerIPs) &&
				(r.ToPorts == "" || r.ToPorts == strconv.Itoa(listenPort)) {
				found = true
				break
			}
		}
		if found {
			out = append(out, check("port_forward", "container", "ok",
				"routing.c_port_forward", "routing.c_port_forward_ok",
				[]string{strconv.Itoa(listenPort), containerIPs[0]}, nil))
		} else {
			wan := wanIP(routes, addrs)
			if wan == "" {
				wan = "<WAN-IP>"
			}
			out = append(out, check("port_forward", "container", "warning",
				"routing.c_port_forward", "routing.c_port_forward_missing",
				[]string{strconv.Itoa(listenPort), containerIPs[0]},
				[]string{
					"/ip firewall nat add chain=dstnat dst-address=" + wan +
						" protocol=udp dst-port=" + strconv.Itoa(listenPort) +
						" action=dst-nat to-addresses=" + containerIPs[0] +
						" to-ports=" + strconv.Itoa(listenPort) +
						" comment=\"FreeTurn " + strconv.Itoa(listenPort) + "→контейнер\"",
				}))
		}
	}

	// ------------------------------------------------------------------
	// B. WireGuard path (only when the interface is matched)
	// ------------------------------------------------------------------

	if ifaceName == "" || len(ifaceIPs) == 0 {
		out = append(out, check("wg_iface", "wg", "error",
			"routing.wg_iface", "routing.wg_iface_none", nil, nil))
		return out
	}
	subnet := subnetOf(ifaceIPs[0])
	if subnet == "" {
		out = append(out, check("wg_iface", "wg", "error",
			"routing.wg_iface", "routing.wg_iface_no_subnet",
			[]string{ifaceIPs[0]}, nil))
		return out
	}
	out = append(out, check("wg_iface", "wg", "ok",
		"routing.wg_iface", "routing.wg_iface_ok",
		[]string{ifaceName, strings.Join(ifaceIPs, ", "), strconv.Itoa(ifacePort)}, nil))

	// B2. route to the WG subnet (main table)
	routeOK := false
	for _, r := range routes {
		if r.DstAddress == subnet &&
			(r.RoutingTable == "" || r.RoutingTable == "main") {
			routeOK = true
			break
		}
	}
	if routeOK {
		out = append(out, check("wg_route", "wg", "ok",
			"routing.wg_route", "routing.wg_route_ok", []string{subnet}, nil))
	} else {
		out = append(out, check("wg_route", "wg", "warning",
			"routing.wg_route", "routing.wg_route_missing", []string{subnet},
			[]string{
				"/ip address add address=" + ifaceIPs[0] +
					" interface=" + ifaceName + " comment=\"FreeTurn WG\"",
			}))
	}

	// B3. srcnat masquerade for the WG subnet
	masqOK := false
	for _, r := range nat {
		if r.Chain != "srcnat" || r.Disabled {
			continue
		}
		if r.Action == "masquerade" &&
			(r.SrcAddress == "" || addrCovers(r.SrcAddress, subnet)) {
			masqOK = true
			break
		}
	}
	if masqOK {
		out = append(out, check("wg_srcnat", "wg", "ok",
			"routing.wg_srcnat", "routing.wg_srcnat_ok", []string{subnet}, nil))
	} else {
		out = append(out, check("wg_srcnat", "wg", "warning",
			"routing.wg_srcnat", "routing.wg_srcnat_missing", []string{subnet},
			[]string{
				"/ip firewall nat add chain=srcnat src-address=" + subnet +
					" action=masquerade comment=\"FreeTurn WG " + ifaceName + "\"",
			}))
	}

	// B4. firewall forward: an accept for the subnet BEFORE any
	// blanket drop; otherwise recommend inserting before the drop.
	forwardOK := false
	dropID := ""
	for _, r := range filter {
		if r.Chain != "forward" || r.Disabled {
			continue
		}
		if r.Action == "drop" && blanketRule(r) {
			dropID = r.ID
			break
		}
		if r.Action == "accept" && ruleMatchesSubnet(r, subnet, ifaceName) {
			forwardOK = true
			break
		}
	}
	if forwardOK {
		out = append(out, check("wg_forward", "wg", "ok",
			"routing.wg_forward", "routing.wg_forward_ok", []string{subnet}, nil))
	} else if dropID != "" {
		out = append(out, check("wg_forward", "wg", "warning",
			"routing.wg_forward", "routing.wg_forward_before_drop", []string{subnet, dropID},
			[]string{
				"/ip firewall filter add chain=forward action=accept src-address=" + subnet +
					" place-before=" + dropID + " comment=\"FreeTurn WG " + ifaceName + "\"",
				"/ip firewall filter add chain=forward action=accept dst-address=" + subnet +
					" place-before=" + dropID + " comment=\"FreeTurn WG " + ifaceName + "\"",
			}))
	} else {
		out = append(out, check("wg_forward", "wg", "info",
			"routing.wg_forward", "routing.wg_forward_default", []string{subnet}, nil))
	}

	// B5. firewall input: is the WG port explicitly blocked?
	inputOK := true
	for _, r := range filter {
		if r.Chain != "input" || r.Disabled {
			continue
		}
		if r.Action == "drop" && ruleHitsPort(r, ifacePort) {
			inputOK = false
			out = append(out, check("wg_input", "wg", "warning",
				"routing.wg_input", "routing.wg_input_blocked", []string{strconv.Itoa(ifacePort), r.ID},
				[]string{"/ip firewall filter remove " + r.ID}))
			break
		}
	}
	if inputOK {
		out = append(out, check("wg_input", "wg", "ok",
			"routing.wg_input", "routing.wg_input_ok", []string{strconv.Itoa(ifacePort)}, nil))
	}

	// B6. fasttrack (informational)
	fasttrack := false
	for _, r := range filter {
		if r.Disabled {
			continue
		}
		if r.Action == "fasttrack-connection" {
			fasttrack = true
			break
		}
	}
	if fasttrack {
		out = append(out, check("wg_fasttrack", "wg", "info",
			"routing.wg_fasttrack", "routing.wg_fasttrack_note", nil, nil))
	}

	return out
}

// wireguardRoutingDiagnostics is the handler for
// GET /api/routing/diagnostics.
func (r *Router) wireguardRoutingDiagnostics(w http.ResponseWriter, req *http.Request) {
	cfg, err := LoadRouterOSConfig()
	if err != nil || cfg.URL == "" {
		writeJSON(w, map[string]any{"configured": false})
		return
	}

	client := routeros.New(cfg.URL, cfg.User, cfg.Pass, 6*time.Second)

	resp := map[string]any{"configured": true}
	ifaces, errI := client.ListInterfaces()
	addrs, errA := client.ListAddresses()
	peers, errP := client.ListPeers()
	routes, errR := client.ListRoutes()
	natRules, errN := client.ListNatRules()
	filterRules, errF := client.ListFilterRules()

	// Матч интерфейса по Backend (как во вкладке WireGuard).
	ifaceName, ifacePort, ifaceIPs := "", 0, []string{}
	if errI == nil && errA == nil {
		ipsByIface := ipsByIfaceFrom(addrs)
		backendHost, _, backendOK := backendHostPort()
		if backendOK {
			ifaceName = matchInterfaceName(ipsByIface, backendHost)
			if ifaceName != "" {
				ifaceIPs = ipsByIface[ifaceName]
				for i := range ifaces {
					if ifaces[i].Name == ifaceName {
						ifacePort = int(ifaces[i].ListenPort)
						break
					}
				}
			}
		}
	}

	checks := runRoutingChecks(
		ifaceName, ifaceIPs, ifacePort,
		containerIPv4s(), listenPort(), IsProxyRunning(),
		containerDefaultRoute("/proc/net/route"),
		routes, addrs, natRules, filterRules,
	)

	// Ошибки чтения — отдельным полем (проверки с неполными
	// данными помечаются самим движком по возможности).
	if errI != nil || errR != nil || errN != nil || errF != nil {
		for _, e := range []error{errI, errA, errP, errR, errN, errF} {
			if e != nil {
				resp["error"] = classifyRouterOSError(e)
				break
			}
		}
	}
	_ = peers // пиры для диагностики не нужны (только интерфейс)

	resp["checks"] = checks
	writeJSON(w, resp)
}
