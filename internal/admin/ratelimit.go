//
// ratelimit.go
// FreeTurn Admin — simple in-memory rate limiter.
//
// Protects /api/login against brute-force attacks.
// Window is per-client IP; buckets are cleaned lazily.
//

package admin

import (
	"net"
	"net/http"
	"sync"
	"time"
)

const (
	loginAttemptsAllowed = 5
	loginWindow          = 5 * time.Minute
)

// loginLimiter tracks failed login attempts per IP.
type loginLimiter struct {
	mu      sync.Mutex
	buckets map[string][]time.Time // timestamps of failed attempts
}

var loginRateLimit = &loginLimiter{buckets: map[string][]time.Time{}}

// clientIP returns the originating client IP, respecting a single
// X-Forwarded-For proxy hop when the request comes from localhost.
func clientIP(req *http.Request) string {
	host, _, _ := net.SplitHostPort(req.RemoteAddr)
	if host == "" {
		host = req.RemoteAddr
	}

	// Trust X-Forwarded-For only from loopback (common when panel is
	// behind a reverse proxy on the same host). Multi-hop chains are
	// ignored to prevent spoofing from the internet.
	if xff := req.Header.Get("X-Forwarded-For"); xff != "" && isLoopback(host) {
		if ip := parseFirstXFF(xff); ip != "" {
			return ip
		}
	}

	return host
}

func isLoopback(host string) bool {
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func parseFirstXFF(xff string) string {
	for _, part := range splitFields(xff, ",") {
		ip := net.ParseIP(part)
		if ip != nil {
			return ip.String()
		}
	}
	return ""
}

func splitFields(s, sep string) []string {
	var out []string
	for _, p := range stringsSplit(s, sep) {
		if t := trimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// allow reports whether the request is within the allowed rate.
// A successful call should not be recorded here; only failed logins
// increment the bucket via recordFailure.
func (l *loginLimiter) allow(req *http.Request) bool {
	ip := clientIP(req)
	if ip == "" {
		return true
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	cutoff := time.Now().Add(-loginWindow)
	attempts := l.buckets[ip]
	recent := attempts[:0]
	for _, t := range attempts {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}
	l.buckets[ip] = recent

	return len(recent) < loginAttemptsAllowed
}

func (l *loginLimiter) recordFailure(req *http.Request) {
	ip := clientIP(req)
	if ip == "" {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	l.buckets[ip] = append(l.buckets[ip], time.Now())
}

// small string helpers to avoid importing strings.
func stringsSplit(s, sep string) []string {
	var out []string
	start := 0
	for i := 0; i+len(sep) <= len(s); i++ {
		if s[i:i+len(sep)] == sep {
			out = append(out, s[start:i])
			start = i + len(sep)
		}
	}
	out = append(out, s[start:])
	return out
}

func trimSpace(s string) string {
	start := 0
	for start < len(s) && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}
	end := len(s)
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}
