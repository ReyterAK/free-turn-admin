# FreeTurn Admin — Operations

Release 0.7.0

## Локальный запуск (Plex, для теста изменений)

    cd ~/free-turn-admin
    ./run.sh            # запуск на :18080
    ./run.sh logs       # логи контейнера
    ./run.sh stop       # остановить dev-контейнер
    ./run.sh reset      # стереть dev-конфиг (моделирует первый деплой)

- порт 18080 (8080 на хосте может быть занят)
- конфиг: `~/free-turn-admin-dev-config` — **персистентный** между
  запусками (как /config на роутере): аккаунт, клиенты, run.args
  и обновлённый бинарник переживают рестарт контейнера.
  Рабочий /config на роутере не затрагивается
- после изменения кода: `./build.sh && ./run.sh`

## Build

    cd ~/free-turn-admin
    ./build.sh

build.sh:
1. компилирует Go-бинарник (`CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build`)
2. собирает образ: `podman build --format docker --arch arm64 -t free-turn-admin:arm64 .`

`--format docker` обязателен: без него HEALTHCHECK из Dockerfile
теряется (podman по умолчанию собирает OCI-образ).

Требуется Go (≥1.22) на сборочной машине (на Plex установлен go1.26).

## Export (для MikroTik)

    cd ~/free-turn-admin
    ./export.sh

Создаёт `free-turn-admin-arm64.tar` (docker-archive) — готов к переносу
на роутер (через Winbox/SCP в файловую систему, далее импорт контейнера).

## Деплой на RB5009 (RouterOS)

Контейнер создаётся по существующей схеме (как остальные):

    /interface veth add name=veth-ft-admin address=192.168.254.5/24 gateway=192.168.254.1
    /interface bridge port add bridge=Bridge-Docker interface=veth-ft-admin
    /container mounts add list=FREE_TURN_ADMIN src=/usb1-part1/docker_configs/free_turn_admin dst="/config" mode=rw
    /container add name=free-turn-admin file=free-turn-admin-arm64.tar interface=veth-ft-admin \
        root-dir=/usb1-part1/docker/free-turn-admin mountlists=FREE_TURN_ADMIN start-on-boot=yes
    /container start free-turn-admin

Проброс порта панели (если нужен доступ не только с LAN):

    /ip firewall nat add chain=dstnat protocol=tcp in-interface-list=WAN dst-port=8080 \
        action=dst-nat to-addresses=192.168.254.5 to-ports=8080 comment="free-turn-admin"

## Healthcheck

Приложение отдаёт неавторизованный `GET /healthz` → 200 `{"status":"ok"}`.

Внутри образа HEALTHCHECK прописан в Dockerfile (работает под
podman/docker с `--format docker`; используется busybox wget).

Для RouterOS задаётся в конфигурации контейнера (скрипт исполняется
внутри контейнера; curl/python в образе нет — busybox wget):

    /container set free-turn-admin \
        healthcheck-script="wget -q -O /dev/null http://127.0.0.1:8080/healthz" \
        healthcheck-interval=30s \
        healthcheck-timeout=5s \
        healthcheck-start-period=10s \
        healthcheck-retries=3 \
        stop-on-unhealthy=yes

## Конфигурация (/config, persistent mount)

| Файл | Назначение |
|---|---|
| auth.json | учётные данные администратора (user/password) |
| clients.json | клиенты proxy (читает/пишет сам free-turn-server) |
| settings.json | настройки панели |
| uri.json | настройки генерации URI |
| run.args | аргументы запуска free-turn-server |
| events.json | журнал событий (кап 500) |
| free-turn-proxy.log | лог сервера (ротация по размеру, 512 КБ, .1) |
| session.key | ключ подписи сессионных cookie (генерируется сам) |
| bin/free-turn-server | активный бинарник (обновляется через панель) |

## Изменения Release 0.7.0

### Фаза 1 (гигиена)

- удалён мёртвый код: app/settings.py, ui/js/modules/serverLog.js,
  метод ServerEntityLayer.installServerUpdate() (и тег script из index.html)
- убраны debug-принты `[GITHUB DEBUG]` и `print()` ошибок сохранения —
  ошибки сохранения теперь пишутся в events.json (SAVE_FAILED)
- журнал событий дополнен: SAVE (settings), RUNARGS_SAVE, URI_SAVE,
  UPDATE_DOWNLOADED, UPDATE_INSTALLED, OBF_KEY_GENERATED
- единые заголовки файлов (# name / FreeTurn Admin / Release 0.7.0)
- Dockerfile: убран неиспользуемый `apk add curl`; добавлен HEALTHCHECK
- добавлен .dockerignore (venv/, *.tar, .git, __pycache__, docs/)
- удалены дубли маршрутов: /api/settings/get и /api/settings (POST)
- мемоизация: версия сервера (по mtime бинарника) и список клиентов
  (по mtime clients.json) — без таймерных кэшей
- ротация лога сервера по размеру (512 КБ) при чтении через панель

### Фаза 2 (Go)

- Python/Flask-бэкенд заменён единым Go-бинарником
  (main.go + internal/admin, REST API 1:1, embed UI)
- образ: alpine:3.20 + ca-certificates + бинарник —
  **23 MB вместо 87.6 MB**
- RAM контейнера: ~8–15 MiB вместо ~47 MiB
- логика core/launch.sh перенесена внутрь бинарника
  (bootstrap конфига, запуск/остановка proxy, ротация лога)
- Python-исходники (app/, venv/, requirements.txt) удалены —
  проект полностью на Go
