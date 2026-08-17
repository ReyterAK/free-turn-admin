#!/bin/bash
set -e

podman save \
    --format docker-archive \
    -o free-turn-admin-arm64.tar \
    free-turn-admin:arm64

echo "Created: free-turn-admin-arm64.tar"