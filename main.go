//
// main.go
// FreeTurn Admin
// Release 1.0.0 
//
// Single static binary: embeds the admin UI,
// manages the free-turn-server process and
// serves the REST API (replaces the Flask
// backend; API contract is unchanged).
//

package main

import (
	"embed"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"freeturn/admin/internal/admin"
)

// VERSION of the admin panel.
const VERSION = "1.2.3"

//go:embed ui
var uiFS embed.FS

func main() {

	// Bootstrap config files and start the proxy
	// (same behaviour as the old core/launch.sh).

	if err := admin.Bootstrap(); err != nil {
		log.Printf("[BOOT] config bootstrap failed: %v", err)
	}

	if err := admin.StartProxy(); err != nil {
		log.Printf("[BOOT] WARNING: free-turn-server failed to start: %v", err)
		admin.LogEvent("server", "START_FAILED", "Free Turn Proxy server failed to start")
	} else {
		admin.LogEvent("server", "START", "Free Turn Proxy server started")
	}

	// Start background check for server binary updates (GitHub).
	admin.StartServerUpdateChecker()

	mux := admin.NewRouter(uiFS, VERSION)

	// HTTP listen port: PORT env (e.g. host-network dev) or 8080 default.
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:    "0.0.0.0:" + port,
		Handler: mux,
	}

	// Stop the proxy on shutdown.

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)

	go func() {
		<-stop
		log.Printf("[SHUTDOWN] stopping proxy...")
		_ = admin.StopProxy()
		os.Exit(0)
	}()

	log.Printf("[BOOT] FreeTurn Admin %s listening on :8080", VERSION)

	if err := server.ListenAndServe(); err != nil &&
		err != http.ErrServerClosed {
		log.Fatalf("http server error: %v", err)
	}
}
