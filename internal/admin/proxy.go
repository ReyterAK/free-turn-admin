//
// proxy.go
// FreeTurn Admin
// Release 1.0.0
//
// free-turn-server process management and
// server log handling (size-based rotation).
//

package admin

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const (
	pidFile       = "/tmp/freeturn_proxy.pid"
	MaxLogSize    = 512 * 1024
	StartupWaitMs = 500
)

// ---------------------------------------------------------------------
// process lifecycle
// ---------------------------------------------------------------------

// parseArgs splits run.args into tokens, honoring
// double/single quotes so values with spaces survive
// (strings.Fields would split them).
func parseArgs(text string) []string {
	var args []string
	var cur strings.Builder
	var quote rune // 0 = none, '"' or '\''
	has := false
	flush := func() {
		if has {
			args = append(args, cur.String())
			cur.Reset()
			has = false
		}
	}
	for _, r := range text {
		switch {
		case quote != 0:
			if r == quote {
				quote = 0
			} else {
				cur.WriteRune(r)
			}
			has = true
		case r == '"' || r == '\'':
			quote = r
			has = true
		case r == ' ' || r == '\t' || r == '\n' || r == '\r':
			flush()
		default:
			cur.WriteRune(r)
			has = true
		}
	}
	flush()
	return args
}

// runArgsList returns the server launch arguments, with flags removed
// by the upstream v3.0.0 release filtered out: -mode (TCP tunnel mode
// was dropped; the server defaults to UDP) and -bond (TCP-only).
// Safe for v2 (defaults to udp there as well).
func runArgsList() []string {
	args := parseArgs(readText(RunArgsFile))
	filtered := args[:0]
	skip := false
	for _, a := range args {
		if skip {
			skip = false
			continue
		}
		switch a {
		case "-mode", "-bond":
			skip = true // drop the flag and its value
		default:
			filtered = append(filtered, a)
		}
	}
	return filtered
}

// setConnectArg returns args with the -connect flag set to hostPort:
// an existing -connect pair is replaced in place, otherwise a new
// pair is appended. Used when a WG interface is created via the
// panel — the new interface IS the Backend.
func setConnectArg(args []string, hostPort string) []string {
	out := make([]string, 0, len(args)+2)
	replaced := false
	for i := 0; i < len(args); i++ {
		if args[i] == "-connect" {
			out = append(out, "-connect", hostPort)
			i++ // skip the old value
			replaced = true
			continue
		}
		out = append(out, args[i])
	}
	if !replaced {
		out = append(out, "-connect", hostPort)
	}
	return out
}

func proxyEnv() []string {
	env := os.Environ()
	env = append(env, "CLIENTS_FILE="+ClientsFile)
	return env
}

func StartProxy() error {

	// Log file append mode (line-buffered like before).

	logFile, err := os.OpenFile(LogFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return fmt.Errorf("open log: %w", err)
	}
	defer logFile.Close()

	cmd := exec.Command(ProxyBin, runArgsList()...)
	cmd.Env = proxyEnv()
	cmd.Stdout = logFile
	cmd.Stderr = logFile

	if err := cmd.Start(); err != nil {
		return err
	}

	_ = os.WriteFile(pidFile, []byte(strconv.Itoa(cmd.Process.Pid)), 0o644)

	// give the server a moment to start
	time.Sleep(StartupWaitMs * time.Millisecond)

	if !IsProxyRunning() {
		return fmt.Errorf("server exited immediately")
	}

	return nil
}

func GetProxyPid() int {
	data, err := os.ReadFile(pidFile)
	if err != nil {
		return 0
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		return 0
	}
	return pid
}

// IsProxyRunning reports whether the proxy process is alive.
//
// PID liveness alone is not enough: after a crash the pid file
// can point to a PID reused by an unrelated process. Verify the
// process identity via /proc/<pid>/cmdline and then confirm it
// responds to signal 0.
//
// The binary path may be argv[0] (native execution) or a later
// token — under qemu user-mode emulation (arm64 on x86_64 dev
// hosts) argv[0] is the interpreter (aarch64-binfmt-P) and the
// real binary path follows it. Scan every NUL-separated token.
func IsProxyRunning() bool {
	pid := GetProxyPid()
	if pid <= 0 {
		return false
	}

	cmdline, err := os.ReadFile(fmt.Sprintf("/proc/%d/cmdline", pid))
	if err != nil {
		return false // no such process
	}
	matches := false
	for _, token := range strings.Split(string(cmdline), "\x00") {
		if strings.Contains(strings.ToLower(token), "free-turn-server") {
			matches = true
			break
		}
	}
	if !matches {
		return false // PID reused by another process
	}

	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	err = process.Signal(syscall.Signal(0))
	return err == nil
}

func StopProxy() error {
	pid := GetProxyPid()
	if pid <= 0 {
		return nil
	}
	process, err := os.FindProcess(pid)
	if err != nil {
		return nil
	}
	_ = process.Signal(syscall.SIGTERM)

	for i := 0; i < 50; i++ {
		if !IsProxyRunning() {
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	// force kill if needed
	_ = process.Signal(syscall.SIGKILL)
	return nil
}

func RestartProxy() bool {
	if err := StopProxy(); err != nil {
		LogEvent("server", "RESTART_FAILED", "Failed to stop Free Turn Proxy server", err.Error())
		return false
	}
	if err := StartProxy(); err != nil {
		LogEvent("server", "RESTART_FAILED", "Failed to start Free Turn Proxy server", err.Error())
		return false
	}
	LogEvent("server", "RESTART", "Free Turn Proxy server restarted")
	return true
}

// ---------------------------------------------------------------------
// memory (cgroup v2 with /proc/meminfo fallback)
// ---------------------------------------------------------------------

func GetMemory() map[string]any {
	result := map[string]any{}

	if data, err := os.ReadFile("/sys/fs/cgroup/memory.current"); err == nil {
		if used, perr := strconv.ParseInt(strings.TrimSpace(string(data)), 10, 64); perr == nil {
			result["used_kb"] = used / 1024
		}
	}
	if data, err := os.ReadFile("/sys/fs/cgroup/memory.max"); err == nil {
		limit := strings.TrimSpace(string(data))
		if limit != "max" {
			if v, perr := strconv.ParseInt(limit, 10, 64); perr == nil {
				result["limit_kb"] = v / 1024
			}
		}
	}

	meminfo, err := os.ReadFile("/proc/meminfo")
	if err == nil {
		for _, line := range strings.Split(string(meminfo), "\n") {
			fields := strings.Fields(line)
			if len(fields) < 2 {
				continue
			}
			switch fields[0] {
			case "MemAvailable:":
				if v, perr := strconv.ParseInt(fields[1], 10, 64); perr == nil {
					result["free_kb"] = v
				}
			case "MemTotal:":
				if _, has := result["limit_kb"]; !has {
					if v, perr := strconv.ParseInt(fields[1], 10, 64); perr == nil {
						result["limit_kb"] = v
					}
				}
			}
		}
	}

	return result
}

// ---------------------------------------------------------------------
// server log (size-based lazy rotation)
// ---------------------------------------------------------------------

func rotateLogIfNeeded() {
	info, err := os.Stat(LogFile)
	if err != nil {
		return
	}
	if info.Size() <= MaxLogSize {
		return
	}
	archive := LogFile + ".1"
	_ = os.Remove(archive)
	_ = os.Rename(LogFile, archive)
}

func GetServerLog(lines int) []string {
	if lines <= 0 {
		lines = 200
	}
	rotateLogIfNeeded()
	data, err := os.ReadFile(LogFile)
	if err != nil {
		return []string{}
	}
	raw := strings.Split(strings.TrimRight(string(data), "\n"), "\n")
	if len(raw) > lines {
		raw = raw[len(raw)-lines:]
	}
	out := make([]string, 0, len(raw))
	for _, line := range raw {
		if line == "" {
			continue
		}
		out = append(out, strings.TrimRight(line, "\r"))
	}
	return out
}

// ---------------------------------------------------------------------
// bootstrap (former launch.sh duties)
// ---------------------------------------------------------------------

func Bootstrap() error {

	if err := ensureDir(ConfigDir); err != nil {
		return err
	}
	if err := ensureDir(filepath.Join(ConfigDir, "bin")); err != nil {
		return err
	}

	copyIfMissing := func(src, dst string) {
		if _, err := os.Stat(dst); err == nil {
			return
		}
		data, err := os.ReadFile(src)
		if err != nil {
			return
		}
		_ = os.WriteFile(dst, data, 0o644)
	}

	copyIfMissing("/app/core/run.args", RunArgsFile)
	copyIfMissing("/app/core/uri.json", URIFile)
	copyIfMissing("/app/core/free-turn-server", ProxyBin)
	_ = os.Chmod(ProxyBin, 0o755)

	return nil
}
