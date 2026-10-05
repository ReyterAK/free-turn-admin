# free-turn-admin

A web admin panel for [free-turn-proxy](https://github.com/hackdiaz-dev/free-turn-proxy),
packaged as an ARM64 container for **MikroTik RouterOS 7** (RouterOS Containers).
It manages the proxy server, its clients, share URIs and QR codes, the
container's own WireGuard interface, RouterOS diagnostics and self-updates —
all from a browser on your LAN.

Go 1.25 · Alpine 3.24.2 · embedded UI · no external database.

> **The upstream project has disappeared.** The original
> `samosvalishe/free-turn-proxy` account and its releases are gone (the API
> returns 404). This panel now reads server releases from the community
> mirror [hackdiaz-dev/free-turn-proxy](https://github.com/hackdiaz-dev/free-turn-proxy),
> which keeps the same asset names and tag history. Release tags there carry
> a `-mirror` suffix (`v4.0.1-mirror`); the panel strips it before comparing
> versions. The Android client mirror lives at
> [hackdiaz-dev/turn-proxy-android](https://github.com/hackdiaz-dev/turn-proxy-android).

## What it does

- **Server** — start/stop the proxy process, edit its run arguments and URI
  settings, watch its log with size-based rotation, update the binary in place
  (SHA-256 verified, atomic replace with rollback).
- **Clients** — add, remove and edit clients; generate share URIs and QR
  codes; export a `client` launch command with flags; delete the client's
  RouterOS connection.
- **WireGuard** — create/delete the interface, import and rotate X25519 keys,
  create/delete peers, bind peers to clients, download a ready-to-use
  `WG.config`. Keys are generated on the router and stored `0600`.
- **Diagnostics** — read-only RouterOS checks (10: container network and route,
  server listener, port forwarding, plus six WireGuard checks — interface,
  routes, fasttrack, forward, input, src-nat), each with copy-paste commands
  for the WinBox terminal.
- **Routing** — inspect routes, addresses, NAT and firewall rules, detect
  port conflicts and shadowed dst-nat rules.
- **Self-update** — panel updates via Docker Hub (MikroTik's
  `/container/update`), server updates via the GitHub mirror.
- **i18n** — Russian and English UI with a built-in switcher.

## Security model

The panel talks to RouterOS through its REST API, so it needs an API user
with the `api`, `rest-api` and `read` policies — plus `write` if you want
`/container/update` to work from the browser. The panel creates no RouterOS
objects it does not have rights for, and always reports a permission error
with the exact WinBox command to run instead.

- The admin password is stored as a **bcrypt** hash, never in plaintext.
- `/api/login` is rate limited: 5 failed attempts per 5 minutes per IP.
- A strict `Content-Security-Policy` is sent with every response (no
  `unsafe-inline`).
- The session cookie is `HttpOnly` + `SameSite=Lax`. There is **no `Secure`
  flag and no HSTS** — the panel is meant to live on a LAN, reached over
  WireGuard/VPN when you are away.

### Do not expose the panel to the internet

There is deliberately **no HTTPS built in** and no port-forward for it. Keep
it on the LAN, or reach it through your existing VPN. If you do decide to put
it behind a reverse proxy, add a `Secure` cookie flag for
`X-Forwarded-Proto: https` (a few lines) — the UI itself does not depend on a
secure context.

## Install (MikroTik RouterOS 7)

The image is public on Docker Hub, so RouterOS can pull it without
credentials:

```
reyterak/free-turn-admin-mikrotik:1.2.2
```

Container layout expected by the panel:

| Path | Purpose |
|---|---|
| `/config` | persistent volume — config, keys, logs |
| `/app/core` | bundled `free-turn-server`, `run.args`, `uri.json` |

On first start the panel copies the bundled server binary and defaults into
`/config/bin` (only if missing), so an image update never clobbers your
configuration.

### RouterOS API user

Create a dedicated user (replace the password):

```
/user group add name=api-group-ro policy=read,api,rest-api
/user group add name=api-group-rw policy=read,write,api,rest-api
/user add name=free-turn-admin-rw group=api-group-rw password="PassW0rd"
# Restrict login to the container address (IP from /interface veth).
/user set free-turn-admin-rw address=192.168.254.15/32
```

A read-only user works too — the panel then only shows what it may read and
tells you to run `/container update free-turn-admin` from the terminal when an
update needs `write`.

## Building

```sh
go test ./...            # unit tests
./build.sh               # arm64 image via podman -> localhost/free-turn-admin:arm64
VERSION_TAG=1.2.2 ./push.sh
```

`build.sh` cross-compiles the panel with `CGO_ENABLED=0` and builds the image
with `--arch arm64`. The Docker Hub login used by `push.sh` is interactive
unless `HUB_TOKEN` is exported.

`core/free-turn-server` is committed to the repository so the image can be
built without network access. It is a third-party binary; see
`core/run.args` and `core/uri.json` for the default server configuration.

## Layout

| Path | Contents |
|---|---|
| `main.go` | bootstrap, embedded UI, graceful shutdown, `VERSION` |
| `internal/admin/` | HTTP handlers, auth, WireGuard store, updates, diagnostics |
| `internal/routeros/` | RouterOS REST client |
| `ui/` | vanilla JS front-end (embedded via `go:embed`) |
| `docs/` | architecture, coding style, operations notes |

## Development

```sh
go build ./...
go vet ./...
go test ./...
```

Tests cover authentication (including bcrypt migration), the RouterOS REST
client, routing/diagnostics parsing, WireGuard key import, panel version
comparison and release-tag normalization. They need no router and no network.

## License

[MIT](LICENSE) for the panel. `core/free-turn-server` is a third-party binary
from the free-turn-proxy project and carries its own terms.