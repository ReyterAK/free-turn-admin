//
// routing_test.go
// FreeTurn Admin — routing diagnostics engine (pure logic)
//

package admin

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"freeturn/admin/internal/routeros"
)

func findCheck(checks []RoutingCheck, id string) *RoutingCheck {
	for i := range checks {
		if checks[i].ID == id {
			return &checks[i]
		}
	}
	return nil
}

func TestRoutingSubnetHelpers(t *testing.T) {
	if got := subnetOf("10.10.30.1/24"); got != "10.10.30.0/24" {
		t.Errorf("subnetOf = %q", got)
	}
	if got := subnetOf("garbage"); got != "" {
		t.Errorf("subnetOf(garbage) = %q", got)
	}
	if !addrCovers("10.10.30.0/24", "10.10.30.7/32") {
		t.Error("10.10.30.0/24 must cover 10.10.30.7/32")
	}
	if addrCovers("10.10.20.0/24", "10.10.30.0/24") {
		t.Error("10.10.20.0/24 must NOT cover 10.10.30.0/24")
	}
	if addrCovers("", "10.10.30.0/24") {
		t.Error("empty network must not cover")
	}
}

func TestContainerDefaultRoute(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "route")
	content := "Iface\tDestination\tGateway\tFlags\n" +
		"eth0\t00000000\t0194010A\t0003\n" +
		"eth0\t00000000\t0194010A\t0003\n"
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	if got := containerDefaultRoute(path); got != "eth0" {
		t.Errorf("default route iface = %q, want eth0", got)
	}
	if got := containerDefaultRoute(filepath.Join(dir, "missing")); got != "" {
		t.Errorf("missing file must yield empty, got %q", got)
	}
}

// sample data mirroring the real router (2026-08-25): connected WG
// route, global masquerade, defconf input drop, fasttrack.
func sampleRoutingData() (
	[]routeros.Route, []routeros.Address, []routeros.NatRule, []routeros.FilterRule,
) {
	routes := []routeros.Route{
		{DstAddress: "0.0.0.0/0", Gateway: "pppoe-out1", RoutingTable: "main"},
		{DstAddress: "10.10.30.0/24", Gateway: "Free_Turn_NEW_WG", RoutingTable: "main"},
	}
	addrs := []routeros.Address{
		{Interface: "Free_Turn_NEW_WG", Address: "10.10.30.1/24"},
		{Interface: "pppoe-out1", Address: "203.0.113.10/32"},
	}
	nat := []routeros.NatRule{
		{Chain: "srcnat", Action: "masquerade"}, // глобальный
		{Chain: "dstnat", Action: "dst-nat", DstAddress: "203.0.113.10", ToAddresses: "192.168.254.15", ToPorts: "56566", Protocol: "udp"},
	}
	filter := []routeros.FilterRule{
		{ID: "*1", Chain: "forward", Action: "accept", DstPort: "18476", Protocol: "udp"},
		{ID: "*24", Chain: "input", Action: "drop", InInterfaceList: "!LAN"},
		{ID: "*8", Chain: "forward", Action: "fasttrack-connection"},
		{ID: "*A", Chain: "forward", Action: "drop"}, // blanket в конце
	}
	return routes, addrs, nat, filter
}

func TestRoutingChecksOkPath(t *testing.T) {
	routes, addrs, nat, filter := sampleRoutingData()
	checks := runRoutingChecks(
		"Free_Turn_NEW_WG", []string{"10.10.30.1/24"}, 25083,
		[]string{"192.168.254.15"}, 55555, true, "eth0",
		routes, addrs, nat, filter,
		nil,
		nil,
	)

	if c := findCheck(checks, "wg_route"); c == nil || c.Status != "ok" {
		t.Errorf("wg_route = %+v, want ok", c)
	}
	if c := findCheck(checks, "wg_srcnat"); c == nil || c.Status != "ok" {
		t.Errorf("wg_srcnat = %+v, want ok (global masquerade covers subnet)", c)
	}
	// dst-nat на 192.168.254.15:56566 не совпадает с 55555
	if c := findCheck(checks, "port_forward"); c == nil || c.Status != "warning" {
		t.Errorf("port_forward = %+v, want warning", c)
	}
	// input: defconf-дроп с in-interface-list не блокирует порт
	if c := findCheck(checks, "wg_input"); c == nil || c.Status != "ok" {
		t.Errorf("wg_input = %+v, want ok", c)
	}
	if c := findCheck(checks, "wg_fasttrack"); c == nil || c.Status != "info" {
		t.Errorf("wg_fasttrack = %+v, want info", c)
	}
}

func TestRoutingChecksForwardDropOnly(t *testing.T) {
	routes, addrs, nat, filter := sampleRoutingData()
	// убираем accept-правила forward — остаётся только blanket drop
	var f []routeros.FilterRule
	for _, r := range filter {
		if r.Chain == "forward" && r.Action == "accept" {
			continue
		}
		f = append(f, r)
	}
	checks := runRoutingChecks(
		"Free_Turn_NEW_WG", []string{"10.10.30.1/24"}, 25083,
		[]string{"192.168.254.15"}, 55555, true, "eth0",
		routes, addrs, nat, f,
		nil,
		nil,
	)
	c := findCheck(checks, "wg_forward")
	if c == nil || c.Status != "warning" || len(c.Commands) == 0 {
		t.Fatalf("wg_forward = %+v, want warning with commands", c)
	}
	joined := strings.Join(c.Commands, "\n")
	if !strings.Contains(joined, "place-before=") || !strings.Contains(joined, "10.10.30.0/24") {
		t.Errorf("wg_forward commands lack place-before/subnet: %s", joined)
	}
}

func TestRoutingChecksMissing(t *testing.T) {
	routes, addrs, nat, filter := sampleRoutingData()
	// без маршрута, без masquerade
	var r2 []routeros.Route
	for _, r := range routes {
		if r.DstAddress == "10.10.30.0/24" {
			continue
		}
		r2 = append(r2, r)
	}
	var n2 []routeros.NatRule
	for _, r := range nat {
		if r.Chain == "srcnat" {
			continue
		}
		n2 = append(n2, r)
	}
	checks := runRoutingChecks(
		"Free_Turn_NEW_WG", []string{"10.10.30.1/24"}, 25083,
		[]string{"192.168.254.15"}, 55555, true, "eth0",
		r2, addrs, n2, filter,
		nil,
		nil,
	)
	if c := findCheck(checks, "wg_route"); c == nil || c.Status != "warning" {
		t.Errorf("wg_route = %+v, want warning", c)
	}
	if c := findCheck(checks, "wg_srcnat"); c == nil || c.Status != "warning" || len(c.Commands) == 0 {
		t.Errorf("wg_srcnat = %+v, want warning with masquerade command", c)
	}
}

func TestRoutingChecksNoInterface(t *testing.T) {
	checks := runRoutingChecks(
		"", nil, 0, []string{"192.168.254.15"}, 55555, true, "eth0",
		nil, nil, nil, nil,
		nil,
		nil,
	)
	if c := findCheck(checks, "wg_iface"); c == nil || c.Status != "error" {
		t.Errorf("wg_iface = %+v, want error", c)
	}
	// контейнерные проверки идут, WG-проверки останавливаются на
	// отсутствии интерфейса: wg_iface — последняя
	last := checks[len(checks)-1]
	if last.ID != "wg_iface" {
		t.Errorf("last check = %s, want wg_iface", last.ID)
	}
	for _, c := range checks {
		if c.Group == "wg" && c.ID != "wg_iface" {
			t.Errorf("unexpected WG check %s without interface", c.ID)
		}
	}
}

func TestRoutingPortForwardMatch(t *testing.T) {
	routes, addrs, nat, filter := sampleRoutingData()
	nat = append(nat, routeros.NatRule{
		Chain: "dstnat", Action: "dst-nat",
		ToAddresses: "192.168.254.15", ToPorts: "55555", Protocol: "udp",
	})
	checks := runRoutingChecks(
		"Free_Turn_NEW_WG", []string{"10.10.30.1/24"}, 25083,
		[]string{"192.168.254.15"}, 55555, true, "eth0",
		routes, addrs, nat, filter,
		nil,
		nil,
	)
	if c := findCheck(checks, "port_forward"); c == nil || c.Status != "ok" {
		t.Errorf("port_forward = %+v, want ok", c)
	}
}

// Другой dst-nat на тот же порт раньше нашего — проброс затенён.
func TestRoutingPortForwardShadowed(t *testing.T) {
	routes, addrs, nat, filter := sampleRoutingData()
	nat = append(nat,
		routeros.NatRule{ID: "*S1", Chain: "dstnat", Action: "dst-nat",
			DstPort: "55555", Protocol: "udp", ToAddresses: "10.0.0.5"},
		routeros.NatRule{ID: "*S2", Chain: "dstnat", Action: "dst-nat",
			DstPort: "55555", Protocol: "udp",
			ToAddresses: "192.168.254.15", ToPorts: "55555"},
	)
	checks := runRoutingChecks(
		"Free_Turn_NEW_WG", []string{"10.10.30.1/24"}, 25083,
		[]string{"192.168.254.15"}, 55555, true, "eth0",
		routes, addrs, nat, filter,
		nil,
		nil,
	)
	c := findCheck(checks, "port_forward")
	if c == nil || c.Status != "warning" || len(c.Commands) != 1 ||
		!strings.Contains(c.Commands[0], "remove *S1") {
		t.Fatalf("port_forward = %+v, want warning shadowed by *S1", c)
	}
}

// Порт занят службой RouterOS — предупредить (проброс затеняет службу).
func TestRoutingPortForwardServiceConflict(t *testing.T) {
	routes, addrs, nat, filter := sampleRoutingData()
	nat = append(nat, routeros.NatRule{
		Chain: "dstnat", Action: "dst-nat",
		DstPort: "55555", Protocol: "udp",
		ToAddresses: "192.168.254.15", ToPorts: "55555",
	})
	checks := runRoutingChecks(
		"Free_Turn_NEW_WG", []string{"10.10.30.1/24"}, 25083,
		[]string{"192.168.254.15"}, 55555, true, "eth0",
		routes, addrs, nat, filter,
		nil,
		[]int{80, 55555},
	)
	c := findCheck(checks, "port_forward")
	if c == nil || c.Status != "warning" || c.DetailKey != "routing.c_port_forward_service" {
		t.Fatalf("port_forward = %+v, want warning service conflict", c)
	}
}

func TestRoutingChecksSubnetDrop(t *testing.T) {
	routes, addrs, nat, filter := sampleRoutingData()
	// блокирующее правило, скоупленное на подсеть WG — движок
	// должен его флагнуть (warning с командой remove)
	filter = append([]routeros.FilterRule{
		{ID: "*T1", Chain: "forward", Action: "drop", SrcAddress: "10.10.30.0/24"},
	}, filter...)
	checks := runRoutingChecks(
		"Free_Turn_NEW_WG", []string{"10.10.30.1/24"}, 25083,
		[]string{"192.168.254.15"}, 55555, true, "eth0",
		routes, addrs, nat, filter,
		nil,
		nil,
	)
	c := findCheck(checks, "wg_forward")
	if c == nil || c.Status != "warning" {
		t.Fatalf("wg_forward = %+v, want warning", c)
	}
	if len(c.Commands) != 1 || !strings.Contains(c.Commands[0], "remove *T1") {
		t.Errorf("commands = %v, want [remove *T1]", c.Commands)
	}
}

func TestRoutingChecksBlanketAccept(t *testing.T) {
	routes, addrs, nat, _ := sampleRoutingData()
	filter := []routeros.FilterRule{
		{ID: "*X1", Chain: "forward", Action: "accept"}, // без ограничений
		{ID: "*X2", Chain: "forward", Action: "drop"},
	}
	checks := runRoutingChecks(
		"Free_Turn_NEW_WG", []string{"10.10.30.1/24"}, 25083,
		[]string{"192.168.254.15"}, 55555, true, "eth0",
		routes, addrs, nat, filter,
		nil,
		nil,
	)
	c := findCheck(checks, "wg_forward")
	if c == nil || c.Status != "ok" {
		t.Fatalf("wg_forward = %+v, want ok (blanket accept covers the subnet)", c)
	}
}

// Сценарий пользователя: WG-интерфейс в списке WAN, accept по списку
// только для UDP (awg-паттерн *1A), defconf-дроп «drop all from WAN».
// TCP/ICMP клиента режутся — движок должен дать warning с командой
// accept по интерфейсу перед дропом.
func TestRoutingChecksIfaceInWanListUDPOnly(t *testing.T) {
	routes, addrs, nat, _ := sampleRoutingData()
	filter := []routeros.FilterRule{
		{ID: "*E", Chain: "forward", Action: "reject", Protocol: "tcp", DstAddressList: "vue"},
		{ID: "*1A", Chain: "forward", Action: "accept", InInterfaceList: "WAN", Protocol: "udp"},
		{ID: "*6", Chain: "forward", Action: "accept", IpsecPolicy: "in"},
		{ID: "*7", Chain: "forward", Action: "accept", IpsecPolicy: "out"},
		{ID: "*9", Chain: "forward", Action: "accept", ConnectionState: "established,related,untracked"},
		{ID: "*B", Chain: "forward", Action: "drop", InInterfaceList: "WAN"},
	}
	checks := runRoutingChecks(
		"free-turn-wireguard", []string{"10.10.20.1/24"}, 51820,
		[]string{"192.168.254.15"}, 55555, true, "eth0",
		routes, addrs, nat, filter,
		[]string{"WAN"},
		nil,
	)
	c := findCheck(checks, "wg_forward")
	if c == nil || c.Status != "warning" {
		t.Fatalf("wg_forward = %+v, want warning (UDP-only accept, drop from WAN)", c)
	}
	if len(c.Commands) != 1 ||
		!strings.Contains(c.Commands[0], "in-interface=free-turn-wireguard") ||
		!strings.Contains(c.Commands[0], "place-before=*B") {
		t.Errorf("wg_forward commands = %v, want accept in-interface place-before=*B", c.Commands)
	}
	if len(c.Params) < 4 || c.Params[3] != "WAN" {
		t.Errorf("wg_forward params = %v, want list WAN", c.Params)
	}
}

// ipsec-правила (accept in/out ipsec policy) НЕ покрывают клиентский
// трафик: движок не должен считать их blanket-accept'ом.
func TestRoutingChecksIpsecRulesNotBlanket(t *testing.T) {
	routes, addrs, nat, _ := sampleRoutingData()
	filter := []routeros.FilterRule{
		{ID: "*6", Chain: "forward", Action: "accept", IpsecPolicy: "in"},
		{ID: "*7", Chain: "forward", Action: "accept", IpsecPolicy: "out"},
		{ID: "*B", Chain: "forward", Action: "drop", InInterfaceList: "WAN"},
	}
	checks := runRoutingChecks(
		"free-turn-wireguard", []string{"10.10.20.1/24"}, 51820,
		[]string{"192.168.254.15"}, 55555, true, "eth0",
		routes, addrs, nat, filter,
		[]string{"WAN"},
		nil,
	)
	c := findCheck(checks, "wg_forward")
	if c == nil || c.Status != "warning" {
		t.Fatalf("wg_forward = %+v, want warning (ipsec accepts don't cover client traffic)", c)
	}
}
