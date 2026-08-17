#!/bin/bash
set -e

echo "[1/3] building Go binary (arm64)..."

mkdir -p bin
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -ldflags="-s -w" -o bin/free-turn-admin .

echo "[2/3] building image..."

podman build --format docker \
  --arch arm64 \
  -t free-turn-admin:arm64 .

echo "[3/3] done"
