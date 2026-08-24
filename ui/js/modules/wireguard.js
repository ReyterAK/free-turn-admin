//
// WireGuard Module
// FreeTurn Admin — RouterOS WireGuard monitoring
//
// Read-only v1: interfaces and peers from the RouterOS REST API.
//

const WireGuardModule = {

//
// lifecycle
//

async init() {

    this.bindEvents();

    await this.loadConfig();

    console.log(
        "[WireGuardModule] initialized"
    );

},

bindEvents() {

    const refreshBtn =
        document.getElementById(
            "wg-refresh"
        );

    if (refreshBtn) {

        refreshBtn.addEventListener(
            "click",
            () => {

                this.refresh();

            }
        );

    }


    const saveBtn =
        document.getElementById(
            "wg-save"
        );

    if (saveBtn) {

        saveBtn.addEventListener(
            "click",
            () => {

                this.saveConfig();

            }
        );

    }

},

//
// data
//

async loadConfig() {

    try {

        const data =
            await this.api();

        if (data.configured) {

            this.fillForm(data);

        }

        this.render(data);

    }
    catch (error) {

        console.error(
            "[WireGuardModule] load failed",
            error
        );

        this.render(
            {
                configured: false,
                error: String(error)
            }
        );

    }

},

async api() {

    const resp =
        await fetch(
            "/api/wireguard",
            {
                credentials: "same-origin"
            }
        );

    return resp.json();

},

fillForm(data) {

    const url =
        document.getElementById(
            "wg-url"
        );

    const poll =
        document.getElementById(
            "wg-poll"
        );

    if (url)
        url.value = data.url || "";

    if (poll)
        poll.value = data.poll_seconds || 15;

    // Пароль намеренно не возвращается в браузер.
    const pass =
        document.getElementById(
            "wg-pass"
        );

    if (pass)
        pass.value = "";

},

async refresh() {

    this.showMsg(
        safeT("wg.loading"),
        ""
    );

    try {

        const data =
            await this.api();

        this.render(data);

        if (!data.interfaces_error && !data.peers_error) {

            this.showMsg(
                "",
                ""
            );

        }

    }
    catch (error) {

        console.error(
            "[WireGuardModule] refresh failed",
            error
        );

        this.showMsg(
            safeT("wg.fetch_error") +
            " " +
            String(error),
            "error"
        );

    }

},

async saveConfig() {

    const body = {

        url:
            this.inputValue("wg-url"),

        user:
            this.inputValue("wg-user"),

        pass:
            this.inputValue("wg-pass"),

        poll_seconds:
            parseInt(
                this.inputValue("wg-poll"),
                10
            ) || 15

    };

    try {

        const resp =
            await fetch(
                "/api/wireguard/config",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers:
                    {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(body)
                }
            );

        const data =
            await resp.json();

        if (data.status === "ok") {

            this.showMsg(
                safeT("wg.saved"),
                "ok"
            );

            await this.refresh();

        }
        else {

            this.showMsg(
                data.error ||
                safeT("wg.save_error"),
                "error"
            );

        }

    }
    catch (error) {

        console.error(
            "[WireGuardModule] save failed",
            error
        );

        this.showMsg(
            safeT("wg.save_error") +
            " " +
            String(error),
            "error"
        );

    }

},

inputValue(id) {

    const el =
        document.getElementById(
            id
        );

    return el
        ? el.value
        : "";

},

showMsg(text, kind) {

    const el =
        document.getElementById(
            "wg-msg"
        );

    if (!el)
        return;

    el.textContent = text;

    el.className =
        kind === "error"
            ? "wg-error"
            : kind === "ok"
                ? "wg-ok"
                : "";

},

//
// render
//

render(data) {

    const hint =
        document.getElementById(
            "wg-not-configured"
        );

    if (!data.configured) {

        if (hint)
            hint.style.display = "block";

        this.renderInterfaces(
            null,
            null
        );

        this.renderPeers(
            null,
            null
        );

        return;

    }

    if (hint)
        hint.style.display = "none";

    this.renderInterfaces(
        data.interfaces,
        data.interfaces_error
    );

    this.renderPeers(
        data.peers,
        data.peers_error
    );

    if (data.interfaces_error || data.peers_error) {

        this.showMsg(
            data.interfaces_error ||
            data.peers_error,
            "error"
        );

    }

},

renderInterfaces(list, err) {

    const body =
        document.getElementById(
            "wg-interfaces-body"
        );

    if (!body)
        return;

    body.innerHTML = "";

    if (err) {

        body.innerHTML =
            "<tr><td colspan='4'>" +
            safeT("wg.fetch_error") +
            " " +
            escapeHtml(err) +
            "</td></tr>";

        return;

    }

    if (!list || !list.length) {

        body.innerHTML =
            "<tr><td colspan='4'>" +
            safeT("wg.no_interfaces") +
            "</td></tr>";

        return;

    }

    list.forEach(
        iface => {

            const tr =
                document.createElement(
                    "tr"
                );

            const status = iface.disabled === "true"
                ? safeT("wg.disabled")
                : iface.running === "true"
                    ? safeT("wg.running")
                    : safeT("wg.stopped");

            tr.appendChild(
                this.td(iface.name || iface[".id"])
            );

            tr.appendChild(
                this.td(String(iface.listen_port || ""))
            );

            tr.appendChild(
                this.td(iface.public_key || "")
            );

            tr.appendChild(
                this.td(status)
            );

            body.appendChild(tr);

        }
    );

},

renderPeers(list, err) {

    const body =
        document.getElementById(
            "wg-peers-body"
        );

    if (!body)
        return;

    body.innerHTML = "";

    if (err) {

        body.innerHTML =
            "<tr><td colspan='7'>" +
            safeT("wg.fetch_error") +
            " " +
            escapeHtml(err) +
            "</td></tr>";

        return;

    }

    if (!list || !list.length) {

        body.innerHTML =
            "<tr><td colspan='7'>" +
            safeT("wg.no_peers") +
            "</td></tr>";

        return;

    }

    list.forEach(
        peer => {

            const tr =
                document.createElement(
                    "tr"
                );

            const online =
                peer.online === true;

            const status =
                peer.disabled === "true"
                    ? safeT("wg.disabled")
                    : online
                        ? safeT("wg.online")
                        : safeT("wg.offline");

            tr.appendChild(
                this.td(peer.name || peer[".id"])
            );

            tr.appendChild(
                this.td(peer.interface || "")
            );

            tr.appendChild(
                this.td(peer.allowed_address || "")
            );

            tr.appendChild(
                this.td(this.endpoint(peer))
            );

            tr.appendChild(
                this.td(this.handshake(peer))
            );

            tr.appendChild(
                this.td(this.bytes(peer.rx))
            );

            tr.appendChild(
                this.td(this.bytes(peer.tx))
            );

            tr.appendChild(
                this.td(status, online ? "wg-online" : "wg-offline")
            );

            body.appendChild(tr);

        }
    );

},

endpoint(peer) {

    if (peer.current_endpoint_address) {

        return (
            peer.current_endpoint_address +
            ":" +
            (peer.current_endpoint_port || 0)
        );

    }

    return peer.endpoint_address || "";

},

handshake(peer) {

    const raw =
        peer.last_handshake || "";

    if (!raw || raw === "never")
        return safeT("wg.never");

    return raw;

},

bytes(v) {

    const n =
        Number(v) || 0;

    if (n < 1024)
        return n + " B";

    if (n < 1024 * 1024)
        return (n / 1024).toFixed(1) + " KB";

    if (n < 1024 * 1024 * 1024)
        return (n / 1024 / 1024).toFixed(1) + " MB";

    return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";

},

td(text, cls) {

    const cell =
        document.createElement(
            "td"
        );

    cell.textContent =
        text;

    if (cls)
        cell.className = cls;

    return cell;

}

};


function escapeHtml(s) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        String(s);

    return div.innerHTML;

}


window.WireGuardModule =
    WireGuardModule;
