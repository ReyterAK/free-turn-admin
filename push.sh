#!/bin/bash
#
# push.sh — публикация образа free-turn-admin на Docker Hub
#
# Использование:
#   ./push.sh                          # интерактивный docker login (спросит токен)
#   HUB_TOKEN=... ./push.sh            # логин по токену (без ввода)
#
# Переменные (можно переопределить):
#   HUB_USER      — аккаунт Docker Hub      (по умолчанию reyterak)
#   REPO_NAME     — имя репозитория         (по умолчанию free-turn-admin-mikrotik)
#   IMAGE_TAG     — тег latest              (по умолчанию latest)
#   VERSION_TAG   — версионный тег          (по умолчанию 1.0.0; "" — не публиковать)
#   SOURCE_IMAGE  — локальный образ         (по умолчанию localhost/free-turn-admin:arm64)
#
# Перед публикацией обновить образ: ./build.sh
# Примечание: для pull с роутера репозиторий должен быть ПУБЛИЧНЫМ
# (RouterOS тянет remote-image без авторизации).
#

set -e

HUB_USER="${HUB_USER:-reyterak}"
REPO_NAME="${REPO_NAME:-free-turn-admin-mikrotik}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
VERSION_TAG="${VERSION_TAG:-1.0.0}"
SOURCE_IMAGE="${SOURCE_IMAGE:-localhost/free-turn-admin:arm64}"

cd "$(dirname "$0")"

echo "[1/4] авторизация на Docker Hub ($HUB_USER)..."
if [ -n "$HUB_TOKEN" ]; then
    echo "$HUB_TOKEN" | podman login -u "$HUB_USER" --password-stdin docker.io
else
    podman login -u "$HUB_USER" docker.io
fi

echo "[2/4] теги..."
podman tag "$SOURCE_IMAGE" "$HUB_USER/$REPO_NAME:$IMAGE_TAG"
if [ -n "$VERSION_TAG" ]; then
    podman tag "$SOURCE_IMAGE" "$HUB_USER/$REPO_NAME:$VERSION_TAG"
fi

echo "[3/4] push..."
podman push "$HUB_USER/$REPO_NAME:$IMAGE_TAG"
if [ -n "$VERSION_TAG" ]; then
    podman push "$HUB_USER/$REPO_NAME:$VERSION_TAG"
fi

echo "[4/4] готово: $HUB_USER/$REPO_NAME ($IMAGE_TAG, $VERSION_TAG)"
