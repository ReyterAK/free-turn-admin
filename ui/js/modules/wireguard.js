//
// WireGuard Module
// FreeTurn Admin — RouterOS WireGuard monitoring
//
// Shows the WireGuard interface matching the Backend-server
// settings (IP + port) and only its peers.
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


    const createToggle =
        document.getElementById(
            "wg-create-iface"
        );

    if (createToggle) {

        createToggle.addEventListener(
            "click",
            () => {

                this.showCreateForm(false);

            }
        );

    }


    const doCreate =
        document.getElementById(
            "wg-iface-create"
        );

    if (doCreate) {

        doCreate.addEventListener(
            "click",
            () => {

                this.createInterface();

            }
        );

    }


    const cancelCreate =
        document.getElementById(
            "wg-iface-cancel"
        );

    if (cancelCreate) {

        cancelCreate.addEventListener(
            "click",
            () => {

                this.hideCreateForm();

            }
        );

    }

},

//
// help
//

showHelp(kind) {

    const titleKey =
        kind === "user"
            ? "wg.user_help_title"
            : "wg.url_help_title";

    const textKey =
        kind === "user"
            ? "wg.user_help_text"
            : "wg.url_help_text";

    if (window.Dialog) {

        Dialog.alert(
            safeT(titleKey),
            safeT(textKey)
        );

        return;

    }

    alert(safeT(textKey));

},

//
// create interface (v2)
//

showCreateForm(prefillPort) {

    const form =
        document.getElementById(
            "wg-create-form"
        );

    if (!form)
        return;

    const visible =
        form.style.display !== "none";

    form.style.display =
        visible ? "none" : "block";

    this.clearCreateMsg();

    if (!visible) {

        if (prefillPort) {

            const port =
                document.getElementById(
                    "wg-iface-port"
                );

            if (port)
                port.value = "";

        }

        const portInput =
            document.getElementById(
                "wg-iface-port"
            );

        if (portInput && !portInput.value) {

            // подсказка: порт backend, если известен
            const line =
                document.getElementById(
                    "wg-backend-line"
                );

            if (line && line.dataset.port) {

                portInput.placeholder =
                    String(line.dataset.port);

            }

        }

    }

},

hideCreateForm() {

    const form =
        document.getElementById(
            "wg-create-form"
        );

    if (form)
        form.style.display = "none";

    this.clearCreateMsg();

},

clearCreateMsg() {

    const el =
        document.getElementById(
            "wg-create-msg"
        );

    if (el)
        el.textContent = "";

},

createInterfaceError(err) {

    if (!err)
        return "";

    switch (err) {

        case "invalid_name":
            return safeT("wg.iface_err_name");

        case "invalid_port":
            return safeT("wg.iface_err_port");

        case "invalid_address":
            return safeT("wg.iface_err_address");

        case "port_in_use":
            return ""; // деталь с именем интерфейса в errDetail

        default:
            return "";

    }

},

async createInterface() {

    this.clearCreateMsg();

    const name =
        this.inputValue("wg-iface-name").trim();

    const comment =
        this.inputValue("wg-iface-comment").trim();

    const port =
        parseInt(
            this.inputValue("wg-iface-port"),
            10
        );

    const address =
        this.inputValue("wg-iface-address").trim();

    if (!name) {

        this.showCreateError(
            safeT("wg.iface_err_name")
        );

        return;

    }

    if (!port || port < 1 || port > 65535) {

        this.showCreateError(
            safeT("wg.iface_err_port")
        );

        return;

    }

    if (!/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(address)) {

        this.showCreateError(
            safeT("wg.iface_err_address")
        );

        return;

    }

    this.showCreateError(
        safeT("wg.loading")
    );

    try {

        const resp =
            await fetch(
                "/api/wireguard/interface",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers:
                    {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(
                        {
                            name: name,
                            comment: comment,
                            listen_port: port,
                            address: address
                        }
                    )
                }
            );

        const data =
            await resp.json();

        if (data.status === "ok") {

            this.hideCreateForm();

            const created =
                data.interface || {};

            if (window.Dialog) {

                Dialog.alert(
                    safeT("wg.iface_created_title"),
                    safeT("wg.iface_created_text")
                        .replace("%s", created.name || name)
                        .replace("%s", created.address || address)
                        .replace("%s", String(created["listen-port"] || port))
                        .replace("%s", created["public-key"] || "")
                );

            }

            await this.refresh();

            return;

        }

        // port_in_use: data.detail = имя конфликтующего интерфейса
        if (data.error === "port_in_use") {

            this.showCreateError(
                safeT("wg.iface_port_conflict")
                    .replace("%d", String(port))
                    .replace("%s", data.detail || "?")
            );

            return;

        }

        // классифицированная ошибка роутера
        if (
            data.error &&
            typeof data.error === "object"
        ) {

            if (data.error.kind === "permission") {

                this.showCreateError(
                    safeT("wg.iface_err_write")
                );

                return;

            }

            this.showCreateError(
                safeT("wg.err_unreachable") +
                " " +
                (data.error.detail || "")
            );

            return;

        }

        this.showCreateError(
            data.error ||
            safeT("wg.save_error")
        );

    }
    catch (error) {

        console.error(
            "[WireGuardModule] create failed",
            error
        );

        this.showCreateError(
            String(error)
        );

    }

},

showCreateError(text) {

    const el =
        document.getElementById(
            "wg-create-msg"
        );

    if (!el)
        return;

    el.textContent = text;

    el.className = "wg-error";

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

    const user =
        document.getElementById(
            "wg-user"
        );

    const poll =
        document.getElementById(
            "wg-poll"
        );

    if (url)
        url.value = data.url || "";

    if (user)
        user.value = data.user || "";

    if (poll)
        poll.value = data.poll_seconds || 15;

    // Пароль намеренно не возвращается в браузер —
    // показываем только признак «задан» (звёздочки).
    const pass =
        document.getElementById(
            "wg-pass"
        );

    if (pass)
        pass.value = data.pass_set
            ? "••••••••"
            : "";

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

        if (!data.error &&
            !data.interfaces_error &&
            !data.peers_error) {

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

    const passValue =
        this.inputValue("wg-pass");

    const body = {

        url:
            this.inputValue("wg-url"),

        user:
            this.inputValue("wg-user"),

        // Звёздочки/пусто = сохранить прежний пароль.
        pass:
            passValue === "••••••••"
                ? ""
                : passValue,

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

        this.renderError(null);

        this.renderBackendLine(null);

        this.renderBackendState(null);

        this.renderInterface(null);

        this.renderPeers(null, null);

        return;

    }

    if (hint)
        hint.style.display = "none";

    this.renderError(data.error);

    this.renderBackendLine(data);

    this.renderBackendState(data);

    const iface =
        data.match && data.match.interface
            ? data.match.interface
            : null;

    this.renderInterface(iface);

    this.renderPeers(
        iface ? data.peers : null,
        data.peers_error
    );

},

renderError(err) {

    const el =
        document.getElementById(
            "wg-error"
        );

    if (!el)
        return;

    if (!err) {

        el.style.display = "none";

        el.textContent = "";

        return;

    }

    let prefix;

    switch (err.kind) {

        case "auth":
            prefix = safeT("wg.err_auth");
            break;

        case "permission":
            prefix = safeT("wg.err_permission");
            break;

        default:
            prefix = safeT("wg.err_unreachable");

    }

    el.style.display = "block";

    el.textContent =
        prefix +
        " " +
        (err.detail || "");

},

renderBackendLine(data) {

    const el =
        document.getElementById(
            "wg-backend-line"
        );

    if (!el)
        return;

    if (data && data.backend_configured) {

        el.style.display = "block";

        el.textContent =
            safeT("wg.backend_label") +
            " " +
            data.backend_host +
            ":" +
            data.backend_port;

        el.dataset.port =
            String(data.backend_port);

        return;

    }

    el.style.display = "none";

    delete el.dataset.port;

},

renderBackendState(data) {

    const missing =
        document.getElementById(
            "wg-backend-missing"
        );

    const notFound =
        document.getElementById(
            "wg-match-missing"
        );

    const portWarn =
        document.getElementById(
            "wg-port-warn"
        );

    const hide = el => {

        if (el)
            el.style.display = "none";

    };

    hide(missing);
    hide(notFound);
    hide(portWarn);

    if (!data || !data.backend_configured) {

        if (missing)
            missing.style.display = "block";

        return;

    }

    const status =
        data.match && data.match.status;

    if (status === "ip_not_found") {

        if (notFound)
            notFound.style.display = "block";

        return;

    }

    if (status === "port_mismatch" && portWarn) {

        portWarn.style.display = "block";

    }

},

renderInterface(iface) {

    const body =
        document.getElementById(
            "wg-interfaces-body"
        );

    if (!body)
        return;

    body.innerHTML = "";

    if (!iface) {

        body.innerHTML =
            "<tr><td colspan='6'></td></tr>";

        return;

    }

    const tr =
        document.createElement(
            "tr"
        );

    const disabled =
        iface.disabled === true ||
        iface.disabled === "true";

    const running =
        iface.running === true ||
        iface.running === "true";

    const status = disabled
        ? safeT("wg.disabled")
        : running
            ? safeT("wg.running")
            : safeT("wg.stopped");

    tr.appendChild(
        this.td(iface.name || "")
    );

    tr.appendChild(
        this.td(iface.comment || "")
    );

    tr.appendChild(
        this.td((iface.ips || []).join(", "))
    );

    tr.appendChild(
        this.td(String(iface["listen-port"] || ""))
    );

    tr.appendChild(
        this.td(iface["public-key"] || "")
    );

    tr.appendChild(
        this.td(status)
    );

    body.appendChild(tr);

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
            "<tr><td colspan='8'>" +
            safeT("wg.fetch_error") +
            " " +
            escapeHtml(err) +
            "</td></tr>";

        return;

    }

    if (!list || !list.length) {

        body.innerHTML =
            "<tr><td colspan='8'>" +
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

            const disabled =
                peer.disabled === true ||
                peer.disabled === "true";

            const status = disabled
                ? safeT("wg.disabled")
                : online
                    ? safeT("wg.online")
                    : safeT("wg.offline");

            tr.appendChild(
                this.td(peer.name || peer[".id"])
            );

            tr.appendChild(
                this.td(peer.comment || "")
            );

            tr.appendChild(
                this.td(peer["allowed-address"] || "")
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

    if (peer["current-endpoint-address"]) {

        return (
            peer["current-endpoint-address"] +
            ":" +
            (peer["current-endpoint-port"] || 0)
        );

    }

    return peer["endpoint-address"] || "";

},

handshake(peer) {

    const raw =
        peer["last-handshake"] || "";

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
