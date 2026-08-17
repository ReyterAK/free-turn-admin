#!/bin/bash
#
# run.sh — run the container locally (Plex) for quick
# testing without exporting to MikroTik.
#
# The dev config dir is PERSISTENT across runs (like the
# router's /config mount): account, clients, run.args and
# the updated proxy binary survive container restarts.
#
# Usage:
#   ./run.sh          run the container on :18080
#   ./run.sh logs     follow container logs
#   ./run.sh stop     stop and remove the dev container
#   ./run.sh reset    wipe the dev config (models first deploy)
#

set -e

NAME="free-turn-admin-dev"
PORT="18080"
CONFIG_DIR="${FREE_TURN_DEV_CONFIG:-$HOME/free-turn-admin-dev-config}"

cd "$(dirname "$0")"

case "${1:-run}" in

  reset)
    echo "[reset] wiping $CONFIG_DIR"
    podman rm -f "$NAME" 2>/dev/null || true
    rm -rf "$CONFIG_DIR"
    echo "[reset] done. run ./run.sh to start fresh (first-deploy mode)"
    ;;

  stop)
    podman rm -f "$NAME" 2>/dev/null && echo "stopped $NAME" || echo "no dev container"
    ;;

  logs)
    podman logs -f "$NAME"
    ;;

  run)
    if ! podman image exists free-turn-admin:arm64; then
      echo "[run] image not found, building..."
      ./build.sh
    fi

    podman rm -f "$NAME" 2>/dev/null || true

    mkdir -p "$CONFIG_DIR"

    podman run -d \
      --name "$NAME" \
      --network host \
      -e PORT="$PORT" \
      -v "$CONFIG_DIR:/config" \
      free-turn-admin:arm64 >/dev/null

    echo "[run] admin panel:  http://127.0.0.1:$PORT"
    echo "[run] config dir:   $CONFIG_DIR (persistent across runs)"
    echo "[run] logs:         ./run.sh logs"
    echo "[run] reset config: ./run.sh reset"
    ;;

  *)
    echo "usage: ./run.sh [run|stop|logs|reset]"
    exit 1
    ;;

esac
