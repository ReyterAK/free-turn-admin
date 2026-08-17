//
// system.go
// FreeTurn Admin
// Release 1.0.0 
//
// Status, clients and configuration access.
//
// Binary invocations (version, clients, obf key)
// are memoized by mtime of their source files:
// no time-based cache, no invalidation bugs.
//

package admin

import (
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"net"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"
)

func randomToken(bytesLen int) string {
	b := make([]byte, bytesLen)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}

// ---------------------------------------------------------------------
// binary helpers
// ---------------------------------------------------------------------

func runProxyCmd(args ...string) (string, error) {
	cmd := exec.Command(ProxyBin, args...)
	cmd.Env = proxyEnv()
	out, err := cmd.CombinedOutput()
	return string(out), err
}

// ---------------------------------------------------------------------
// version (memoized by binary mtime)
// ---------------------------------------------------------------------

var (
	versionCacheMtime int64 = -1
	versionCacheValue       = "unknown"
)

func proxyBinMtime() int64 {
	info, err := os.Stat(ProxyBin)
	if err != nil {
		return -1
	}
	return info.ModTime().UnixNano()
}

var versionRe = regexp.MustCompile(`version=([0-9]+\.[0-9]+\.[0-9]+)`)
var semverRe = regexp.MustCompile(`\b([0-9]+\.[0-9]+\.[0-9]+)\b`)

func GetVersion() map[string]any {

	mtime := proxyBinMtime()

	if mtime == versionCacheMtime {
		return map[string]any{
			"version": versionCacheValue,
		}
	}

	cmds := [][]string{
		{"-gen-obf-key"},
		{"--version"},
		{"version"},
	}

	for _, args := range cmds {
		out, err := runProxyCmd(args...)
		if err != nil || out == "" {
			continue
		}
		if m := versionRe.FindStringSubmatch(out); m != nil {
			versionCacheMtime = mtime
			versionCacheValue = m[1]
			return map[string]any{"version": m[1]}
		}
		if m := semverRe.FindStringSubmatch(out); m != nil {
			versionCacheMtime = mtime
			versionCacheValue = m[1]
			return map[string]any{"version": m[1]}
		}
	}

	versionCacheMtime = mtime
	versionCacheValue = "unknown"
	return map[string]any{"version": "unknown"}
}

// ---------------------------------------------------------------------
// clients (memoized by clients.json mtime)
// ---------------------------------------------------------------------

var (
	clientsCacheMtime int64 = -1
	clientsCacheValue       = []map[string]string{}
)

func clientsFileMtime() int64 {
	info, err := os.Stat(ClientsFile)
	if err != nil {
		return -1
	}
	return info.ModTime().UnixNano()
}

func parseClientsOutput(out string) []map[string]string {
	var clients []map[string]string

	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "Found") {
			continue
		}
		if !strings.HasPrefix(line, "-") {
			continue
		}
		part := strings.TrimSpace(line[1:])

		clientID := part
		comment := ""

		if idx := strings.Index(part, "(Comment:"); idx >= 0 {
			clientID = strings.TrimSpace(part[:idx])
			comment = strings.TrimSpace(
				strings.TrimSuffix(
					strings.TrimSpace(part[idx+len("(Comment:"):]),
					")",
				),
			)
		}

		if clientID != "" {
			clients = append(clients, map[string]string{
				"id":      clientID,
				"comment": comment,
			})
		}
	}
	return clients
}

func ListClients() []map[string]string {

	mtime := clientsFileMtime()

	if mtime == clientsCacheMtime {
		return clientsCacheValue
	}

	out, err := runProxyCmd("clients", "list")
	if err != nil || out == "" {
		clientsCacheMtime = mtime
		clientsCacheValue = []map[string]string{}
		return clientsCacheValue
	}

	clients := parseClientsOutput(out)

	clientsCacheMtime = mtime
	clientsCacheValue = clients
	return clients
}

func GetClientsCount() int {
	return len(ListClients())
}

func AddClient(clientID, comment string) string {
	if clientID == "" {
		clientID = randomToken(16)
	}
	_, _ = runProxyCmd("clients", "add", clientID, comment)
	return clientID
}

func RemoveClient(clientID string) {
	_, _ = runProxyCmd("clients", "remove", clientID)
}

func UpdateClient(clientID, comment string) {
	_, _ = runProxyCmd("clients", "add", clientID, comment)
}

// ---------------------------------------------------------------------
// settings / run.args / uri
// ---------------------------------------------------------------------

func GetSettings() map[string]any {
	if _, err := os.Stat(SettingsFile); err != nil {
		return map[string]any{
			"data":       map[string]any{},
			"read_error": true,
		}
	}
	settings, ok := readJSON(SettingsFile, map[string]any{}).(map[string]any)
	if !ok {
		settings = map[string]any{}
	}
	return map[string]any{
		"data":       settings,
		"read_error": false,
	}
}

func SaveSettings(data map[string]any) error {
	return writeJSONFile(SettingsFile, data)
}

func GetURI() map[string]any {
	if _, err := os.Stat(URIFile); err != nil {
		return map[string]any{
			"data":       map[string]any{},
			"read_error": true,
		}
	}
	uri, ok := readJSON(URIFile, map[string]any{}).(map[string]any)
	if !ok {
		uri = map[string]any{}
	}
	return map[string]any{
		"data":       uri,
		"read_error": false,
	}
}

func SaveURI(data map[string]any) error {
	return writeJSONFile(URIFile, data)
}

func GetRunArgs() map[string]any {
	text, err := os.ReadFile(RunArgsFile)
	if err != nil {
		return map[string]any{
			"data":       "",
			"read_error": true,
		}
	}
	return map[string]any{
		"data":       string(text),
		"read_error": false,
	}
}

func SaveRunArgs(data string) error {
	return writeText(RunArgsFile, data)
}

func IsClientAuthEnabled() bool {
	for _, arg := range runArgsList() {
		if arg == "-clients-file" {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------
// backend reachability (-connect host:port from run.args)
//
// Two-stage check (ping gate FIRST, port probe second):
//
//   1. host: ICMP ping — if it runs and fails → "ip_unavailable".
//   2. port: probe the -connect endpoint
//      - tcp mode: TCP connect (definitive once the host is up)
//      - udp mode: send a STUN binding request and wait for
//        ICMP port-unreachable; closed port → "connection refused",
//        open port → response or silence (WireGuard/Xray ignore
//        foreign datagrams, so silence means the port accepts).
//
// The probe alone cannot distinguish a down host from a silent
// open port (both time out), so ping must gate first.
// ---------------------------------------------------------------------

const backendProbeTimeout = 2 * time.Second

// stunBindingRequest returns a minimal STUN binding request
// (RFC 5389): a TURN server answers it without authentication,
// other UDP services simply ignore it.
func stunBindingRequest() []byte {
	pkt := make([]byte, 20)
	binary.BigEndian.PutUint16(pkt[0:2], 0x0001) // binding request
	binary.BigEndian.PutUint16(pkt[2:4], 0x0000) // message length
	binary.BigEndian.PutUint32(pkt[4:8], 0x2112A442) // magic cookie
	_, _ = rand.Read(pkt[8:20])                   // transaction id
	return pkt
}

// probePort returns the raw probe outcome:
//
//	"available"       — service answered (definitive: host is up)
//	"silent"          — no ICMP unreachable within the window
//	                   (open port with silent service, or host down)
//	"port_unavailable" — ICMP port-unreachable / TCP refused
//	                   (definitive: host is up, port closed)
//	"unknown"         — probe could not be performed/interpreted
func probePort(mode, addr string) string {

	if mode == "tcp" {
		conn, err := net.DialTimeout("tcp", addr, backendProbeTimeout)
		if err == nil {
			_ = conn.Close()
			return "available"
		}
		if errors.Is(err, syscall.ECONNREFUSED) {
			return "port_unavailable"
		}
		// timeout / filtered — ambiguous, host state decides.
		return "silent"
	}

	// udp
	conn, err := net.DialTimeout("udp", addr, backendProbeTimeout)
	if err != nil {
		return "unknown"
	}
	defer conn.Close()

	if _, err := conn.Write(stunBindingRequest()); err != nil {
		return "unknown"
	}

	_ = conn.SetReadDeadline(time.Now().Add(backendProbeTimeout))
	buf := make([]byte, 128)
	_, err = conn.Read(buf)
	if err == nil {
		// service answered (e.g. TURN/STUN) → host is up.
		return "available"
	}
	if errors.Is(err, os.ErrDeadlineExceeded) {
		// No ICMP port-unreachable within the window.
		return "silent"
	}
	if errors.Is(err, syscall.ECONNREFUSED) {
		// ICMP port-unreachable → host is up, port closed.
		return "port_unavailable"
	}
	return "unknown"
}

func CheckBackend() map[string]any {

	fields := runArgsList()

	connectIdx := -1
	mode := "udp"
	for i, arg := range fields {
		switch arg {
		case "-connect":
			connectIdx = i
		case "-mode":
			if i+1 < len(fields) {
				mode = fields[i+1]
			}
		}
	}
	if connectIdx < 0 || connectIdx+1 >= len(fields) {
		return map[string]any{"status": "not_configured"}
	}

	address := fields[connectIdx+1]
	host, portStr, ok := strings.Cut(address, ":")
	if !ok || host == "" {
		return map[string]any{"status": "not_configured"}
	}
	port, err := strconv.Atoi(portStr)
	if err != nil || port < 1 || port > 65535 {
		return map[string]any{"status": "not_configured"}
	}

	addr := net.JoinHostPort(host, portStr)

	result := map[string]any{
		"host":  host,
		"port":  port,
		"proto": mode,
	}

	// Stage 1: host gate (ICMP ping).
	// Rootless containers (podman) lack CAP_NET_RAW, so ping is
	// rejected with EPERM — the port probe below still works there
	// because it needs no raw sockets.

	cmd := exec.Command("ping", "-c", "1", "-W", "2", host)
	out, perr := cmd.CombinedOutput()
	if perr != nil {
		low := strings.ToLower(string(out))
		denied := strings.Contains(low, "permission denied") ||
			strings.Contains(low, "operation not permitted") ||
			strings.Contains(low, "not permitted")
		if !denied {
			// ping ran and failed: host unreachable.
			result["status"] = "ip_unavailable"
			return result
		}
		// ping cannot run in this environment → probe-only mode:
		// only definitive probe outcomes are trustworthy.
		switch probe := probePort(mode, addr); probe {
		case "available", "port_unavailable":
			result["status"] = probe
		default:
			result["status"] = "unknown"
		}
		return result
	}

	// Stage 2: host is up → interpret the port probe definitively.
	switch probe := probePort(mode, addr); probe {
	case "available", "port_unavailable":
		result["status"] = probe
	case "silent":
		// Port accepts datagrams; the service is silent
		// (normal for WireGuard/Xray) → available.
		result["status"] = "available"
	default:
		result["status"] = "unknown"
	}
	return result
}

// ---------------------------------------------------------------------
// status
// ---------------------------------------------------------------------

func GetStatus() map[string]any {

	status := "stopped"
	if IsProxyRunning() {
		status = "running"
	}

	pid := GetProxyPid()

	return map[string]any{
		"status":              status,
		"version":             GetVersion()["version"],
		"pid":                 pid,
		"client_auth_enabled": IsClientAuthEnabled(),
		"clients":             GetClientsCount(),
		"memory":              GetMemory(),
		"backend":             CheckBackend(),
	}
}

// ---------------------------------------------------------------------
// obfuscation key
// ---------------------------------------------------------------------

var hex64Re = regexp.MustCompile(`\b[0-9a-fA-F]{64}\b`)

func GenerateObfKey() (string, string) {
	out, err := runProxyCmd("-gen-obf-key")
	if err != nil {
		return "", out
	}
	if m := hex64Re.FindString(out); m != "" {
		return m, ""
	}
	return "", "Generated obfuscation key was not found"
}
