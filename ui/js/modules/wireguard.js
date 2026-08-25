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

                if (
                    createToggle.dataset.mode ===
                    "delete"
                ) {

                    this.deleteInterface();

                    return;

                }

                this.showCreateForm(true);

            }
        );

    }


    const nameInput =
        document.getElementById(
            "wg-iface-name"
        );

    if (nameInput) {

        nameInput.addEventListener(
            "input",
            () => {

                nameInput.value =
                    nameInput.value
                        .replace(/\s+/g, "-")
                        .replace(/[^A-Za-z0-9_.-]/g, "")
                        .slice(0, 30);

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


    const peerToggle =
        document.getElementById(
            "wg-create-peer"
        );

    if (peerToggle) {

        peerToggle.addEventListener(
            "click",
            () => {

                this.showPeerForm();

            }
        );

    }


    const doPeerCreate =
        document.getElementById(
            "wg-peer-create"
        );

    if (doPeerCreate) {

        doPeerCreate.addEventListener(
            "click",
            () => {

                this.createPeer();

            }
        );

    }


    const cancelPeer =
        document.getElementById(
            "wg-peer-cancel"
        );

    if (cancelPeer) {

        cancelPeer.addEventListener(
            "click",
            () => {

                this.hidePeerForm();

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

    if (!visible && prefillPort && this.backend) {

        const port =
            document.getElementById(
                "wg-iface-port"
            );

        if (port)
            port.value = this.backend.port;

        const addr =
            document.getElementById(
                "wg-iface-address"
            );

        if (addr)
            addr.value =
                this.backend.host +
                "/24";

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

            this.lastCreated =
                created.name || name;

            if (window.Dialog) {

                let createdText =
                    safeT("wg.iface_created_text")
                        .replace("%s", created.name || name)
                        .replace("%s", created.address || address)
                        .replace("%s", String(created["listen-port"] || port))
                        .replace("%s", created["public-key"] || "");

                // Backend обновлён автоматически (созданный
                // интерфейс = Backend); предупреждаем, если
                // перезапуск сервера не удался.
                if (created.backend_updated) {

                    createdText +=
                        "\n\n" +
                        safeT("wg.iface_backend_updated") +
                        ": " +
                        (created.backend || "");

                }

                if (created.backend_updated &&
                    created.restart_ok === false) {

                    createdText +=
                        "\n" +
                        safeT("wg.iface_restart_failed");

                }

                Dialog.alert(
                    safeT("wg.iface_created_title"),
                    createdText
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
// create peer
//

async showPeerForm() {

    const form =
        document.getElementById(
            "wg-peer-form"
        );

    if (!form)
        return;

    const visible =
        form.style.display !== "none";

    form.style.display =
        visible ? "none" : "block";

    this.clearPeerMsg();

    if (visible)
        return;

    // подсказка адреса из пула
    const addr =
        document.getElementById(
            "wg-peer-address"
        );

    if (
        addr &&
        this.lastData &&
        this.lastData.next_free_address
    ) {

        addr.value =
            this.lastData.next_free_address;

    }

    // список клиентов для привязки
    await this.loadClients();

},

hidePeerForm() {

    const form =
        document.getElementById(
            "wg-peer-form"
        );

    if (form)
        form.style.display = "none";

    this.clearPeerMsg();

},

clearPeerMsg() {

    const el =
        document.getElementById(
            "wg-peer-msg"
        );

    if (el)
        el.textContent = "";

},

showPeerError(text) {

    const el =
        document.getElementById(
            "wg-peer-msg"
        );

    if (!el)
        return;

    el.textContent = text;

    el.className = "wg-error";

},

async loadClients() {

    const select =
        document.getElementById(
            "wg-peer-client"
        );

    if (!select)
        return;

    try {

        const resp =
            await fetch(
                "/api/clients/list",
                {
                    credentials: "same-origin"
                }
            );

        const data =
            await resp.json();

        const clients =
            Array.isArray(data.clients)
                ? data.clients
                : [];

        select.innerHTML = "";

        const none =
            document.createElement(
                "option"
            );

        none.value = "";

        none.textContent =
            safeT("wg.peer_no_client");

        select.appendChild(
            none
        );

        clients.forEach(
            c => {

                const opt =
                    document.createElement(
                        "option"
                    );

                opt.value =
                    c.id || "";

                opt.textContent =
                    (c.comment || c.id) +
                    (c.comment ? " (" + c.id + ")" : "");

                select.appendChild(
                    opt
                );

            }
        );

    }
    catch (error) {

        console.error(
            "[WireGuardModule] load clients failed",
            error
        );

    }

},

async createPeer() {

    this.clearPeerMsg();

    const iface =
        this.currentIfaceName;

    const comment =
        this.inputValue(
            "wg-peer-comment"
        ).trim();

    const address =
        this.inputValue(
            "wg-peer-address"
        ).trim();

    const clientID =
        this.inputValue(
            "wg-peer-client"
        ).trim();

    if (!iface) {

        this.showPeerError(
            safeT("wg.fetch_error")
        );

        return;

    }

    if (
        address &&
        !/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(address)
    ) {

        this.showPeerError(
            safeT("wg.peer_err_address")
        );

        return;

    }

    this.showPeerError(
        safeT("wg.loading")
    );

    try {

        const resp =
            await fetch(
                "/api/wireguard/peer",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers:
                    {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(
                        {
                            interface_name: iface,
                            comment: comment,
                            allowed_address: address,
                            client_id: clientID
                        }
                    )
                }
            );

        const data =
            await resp.json();

        if (data.status === "ok") {

            this.hidePeerForm();

            if (window.Dialog) {

                Dialog.alert(
                    safeT("wg.peer_created_title"),
                    safeT("wg.peer_created_text") +
                    "\n\n" +
                    (data.config || "")
                );

            }

            await this.refresh();

            return;

        }

        this.mapPeerError(data);

    }
    catch (error) {

        console.error(
            "[WireGuardModule] create peer failed",
            error
        );

        this.showPeerError(
            String(error)
        );

    }

},

mapPeerError(data) {

    if (
        data.error &&
        typeof data.error === "object"
    ) {

        if (data.error.kind === "permission") {

            this.showPeerError(
                safeT("wg.iface_err_write")
            );

            return;

        }

        this.showPeerError(
            safeT("wg.err_unreachable") +
            " " +
            (data.error.detail || "")
        );

        return;

    }

    switch (data.error) {

        case "pool_exhausted":
            this.showPeerError(
                safeT("wg.peer_err_pool")
            );
            return;

        case "address_out_of_subnet":
            this.showPeerError(
                safeT("wg.peer_err_out")
            );
            return;

        case "client_already_bound":
            this.showPeerError(
                safeT("wg.peer_err_bound")
            );
            return;

        default:
            this.showPeerError(
                data.error ||
                safeT("wg.save_error")
            );

    }

},

//
// WG.config
//

async showPeerConfig(publicKey, name) {

    try {

        const resp =
            await fetch(
                "/api/wireguard/peer/config?public_key=" +
                encodeURIComponent(publicKey),
                {
                    credentials: "same-origin"
                }
            );

        const data =
            await resp.json();

        if (data.status !== "ok") {

            this.showMsg(
                data.error ||
                safeT("wg.save_error"),
                "error"
            );

            return;
        }

        if (window.Dialog && window.Dialog.config) {

            const client =
                data.client_comment || "";

            const title =
                safeT("wg.config_title") +
                " — " +
                name +
                (client
                    ? " · " +
                      safeT("wg.col.client") +
                      ": " +
                      client
                    : "");

            Dialog.config(
                title,
                data.config || "",
                {
                    fileName: "WG.config"
                }
            );

            return;

        }

        // фолбэк без расширенного диалога
        if (window.Dialog) {

            Dialog.alert(
                safeT("wg.config_title") +
                " — " +
                name,
                data.config || ""
            );

        }

    }
    catch (error) {

        console.error(
            "[WireGuardModule] config failed",
            error
        );

        this.showMsg(
            String(error),
            "error"
        );

    }

},

//
// delete interface
//

async deleteInterface() {

    const name =
        this.currentIfaceName;

    if (!name || !window.Dialog)
        return;

    const first =
        await Dialog.confirm(
            safeT("wg.delete_confirm_title"),
            safeT("wg.delete_confirm_text")
                .replace("%s", name)
        );

    if (!first)
        return;

    const second =
        await Dialog.confirm(
            safeT("wg.delete_confirm_title"),
            safeT("wg.delete_confirm2_text")
                .replace("%s", name)
        );

    if (!second)
        return;

    try {

        const resp =
            await fetch(
                "/api/wireguard/interface/delete",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers:
                    {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(
                        {
                            name: name
                        }
                    )
                }
            );

        const data =
            await resp.json();

        if (data.status === "ok") {

            if (this.lastCreated === name) {

                this.lastCreated = null;

            }

            Dialog.alert(
                safeT("wg.delete_ok"),
                name
            );

            await this.refresh();

            return;

        }

        if (
            data.error &&
            typeof data.error === "object"
        ) {

            if (data.error.kind === "permission") {

                this.showMsg(
                    safeT("wg.iface_err_write"),
                    "error"
                );

                return;

            }

            this.showMsg(
                safeT("wg.err_unreachable") +
                " " +
                (data.error.detail || ""),
                "error"
            );

            return;

        }

        this.showMsg(
            data.error ||
            safeT("wg.save_error"),
            "error"
        );

    }
    catch (error) {

        console.error(
            "[WireGuardModule] delete failed",
            error
        );

        this.showMsg(
            String(error),
            "error"
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

    const dns =
        document.getElementById(
            "wg-dns"
        );

    if (dns)
        dns.value = data.client_dns || "1.1.1.1";

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

        // Держим таблицу «Клиенты» в синхроне: привязки/ключи
        // меняются при удалении, ротации, импорте или создании пира.
        if (window.ClientsModule) {

            ClientsModule
                .loadBindings()
                .then(() => ClientsModule.render());

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

    const dnsValue =
        this.inputValue("wg-dns").trim();

    if (
        !/^(\d{1,3}\.){3}\d{1,3}$/.test(dnsValue) &&
        !dnsValue.includes(":")
    ) {

        this.showMsg(
            safeT("wg.dns_err"),
            "error"
        );

        return;

    }

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
            ) || 15,

        client_dns:
            dnsValue

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

            await this.refresh();

            this.showMsg(
                safeT("wg.saved"),
                "ok"
            );

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

    this.backend =
        data.backend_configured
            ? {
                host: data.backend_host,
                port: data.backend_port
            }
            : null;

    this.lastData = data;

    const hint =
        document.getElementById(
            "wg-not-configured"
        );

    if (!data.configured) {

        if (hint)
            hint.style.display = "block";

        this.renderError(null);

        this.renderBackendLine(null);

        // RouterOS не настроен — боксы состояния не показываем:
        // backend_missing относится ТОЛЬКО к случаю «RouterOS
        // настроен, а Backend нет» (иначе ложное сообщение при
        // отсутствии routeros.json).
        [
            "wg-backend-missing",
            "wg-match-missing",
            "wg-port-warn"
        ].forEach(
            id => {

                const el =
                    document.getElementById(
                        id
                    );

                if (el)
                    el.style.display = "none";

            }
        );

        this.updateCreateDeleteButton(null);

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

        this.updateCreateDeleteButton(null);

        return;

    }

    const status =
        data.match && data.match.status;

    if (status === "ip_not_found") {

        if (notFound)
            notFound.style.display = "block";

        this.updateCreateDeleteButton(
            this.lastCreated || null
        );

        return;

    }

    if (status === "port_mismatch" && portWarn) {

        portWarn.style.display = "block";

    }

    this.updateCreateDeleteButton(
        data.match.interface.name
    );

},

//
// create/delete toggle button
//

updateCreateDeleteButton(ifaceName) {

    const btn =
        document.getElementById(
            "wg-create-iface"
        );

    if (!btn)
        return;

    if (ifaceName) {

        btn.textContent =
            safeT("wg.delete_iface");

        btn.title =
            ifaceName;

        btn.dataset.mode = "delete";

        this.currentIfaceName =
            ifaceName;

        return;

    }

    btn.textContent =
        safeT("wg.create_iface");

    btn.title = "";

    btn.dataset.mode = "create";

    this.currentIfaceName =
        null;

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
            "<tr><td colspan='10'>" +
            safeT("wg.fetch_error") +
            " " +
            escapeHtml(err) +
            "</td></tr>";

        return;

    }

    if (!list || !list.length) {

        body.innerHTML =
            "<tr><td colspan='10'>" +
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
                this.td(peer.keypair_client || "")
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

            tr.appendChild(
                this.actionsCell(peer)
            );

            body.appendChild(tr);

        }
    );

},

actionsCell(peer) {

    const cell =
        document.createElement(
            "td"
        );

    const pub =
        peer["public-key"] || peer[".id"];

    const name =
        peer.name || pub.slice(0, 12);

    // Импорт ключа (пир без панельного ключа) или WG.config
    // (с ключом).
    if (peer.has_keypair === true) {

        cell.appendChild(
            this.actionButton(
                safeT("wg.config_btn"),
                () => this.showPeerConfig(pub, name)
            )
        );

        cell.appendChild(
            this.actionButton(
                safeT("wg.rotate_key_btn"),
                () => this.rotatePeerKey(pub, name)
            )
        );

    }
    else {

        cell.appendChild(
            this.actionButton(
                safeT("wg.import_key_btn"),
                () => this.importPeerKey(pub, name)
            )
        );

    }

    // Удаление доступно всем пирам таблицы.
    cell.appendChild(
        this.actionButton(
            safeT("wg.delete_peer_btn"),
            () => this.deletePeer(pub, name, peer)
        )
    );

    return cell;

},

// actionButton is a small helper building a table button.
actionButton(text, onClick) {

    const btn =
        document.createElement(
            "button"
        );

    btn.type = "button";

    btn.className = "wg-peer-config-btn";

    btn.textContent =
        text;

    btn.addEventListener(
        "click",
        onClick
    );

    return btn;

},

// rotatePeerKey replaces the peer's keys (new X25519 pair on the
// router + wg.json). The old client config becomes invalid — the
// new one is shown in a config dialog afterwards.
async rotatePeerKey(publicKey, name) {

    if (!window.Dialog)
        return;

    const ok =
        await Dialog.confirm(
            safeT("wg.rotate_confirm_title"),
            safeT("wg.rotate_confirm_text") +
            "\n\n" +
            name
        );

    if (!ok)
        return;

    try {

        const resp =
            await fetch(
                "/api/wireguard/peer/rotate",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        public_key: publicKey
                    })
                }
            );

        const data =
            await resp.json();

        if (data.status !== "ok") {

            this.mapImportError(data);

            return;

        }

        // Новый конфиг сразу в диалог (старый недействителен).
        if (data.config && Dialog.config) {

            Dialog.config(
                safeT("wg.rotate_success_title") +
                " — " +
                name,
                data.config || "",
                {
                    fileName: "WG.config"
                }
            );

        }
        else {

            this.showMsg(
                safeT("wg.rotate_success_title"),
                "ok"
            );

        }

        this.refresh();

    }
    catch (error) {

        console.error(
            "[WireGuardModule] rotate failed",
            error
        );

        this.showMsg(
            String(error),
            "error"
        );

    }

},

// deletePeer removes the peer from the router and the panel
// keypair (with its client binding). Double confirmation.
async deletePeer(publicKey, name, peer) {

    if (!window.Dialog)
        return;

    const first =
        await Dialog.confirm(
            safeT("wg.delete_peer_title"),
            safeT("wg.delete_peer_confirm") +
            "\n\n" +
            name
        );

    if (!first)
        return;

    const bound =
        peer.keypair_client || "";

    const second =
        await Dialog.confirm(
            safeT("wg.delete_peer_title"),
            safeT("wg.delete_peer_confirm2") +
            "\n\n" +
            name +
            (bound
                ? "\n" +
                  safeT("wg.col.client") +
                  ": " +
                  bound
                : "")
        );

    if (!second)
        return;

    try {

        const resp =
            await fetch(
                "/api/wireguard/peer/delete",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        public_key: publicKey
                    })
                }
            );

        const data =
            await resp.json();

        if (data.status !== "ok") {

            this.mapImportError(data);

            return;

        }

        this.showMsg(
            safeT("wg.delete_peer_ok") +
            " — " +
            name,
            "ok"
        );

        this.refresh();

    }
    catch (error) {

        console.error(
            "[WireGuardModule] delete peer failed",
            error
        );

        this.showMsg(
            String(error),
            "error"
        );

    }

},

// importPeerKey asks the admin for the existing client private key
// and imports it into the panel (POST /api/wireguard/peer/import).
// The public key is derived server-side and must match a router
// peer; afterwards the WG.config button appears for the peer.
async importPeerKey(publicKey, name) {

    if (!window.Dialog || !Dialog.prompt) {

        this.showMsg(
            safeT("wg.import_key_hint"),
            "error"
        );

        return;

    }

    const value =
        await Dialog.prompt(
            safeT("wg.import_key_title") +
            " — " +
            name,
            "",
            safeT("wg.import_key_hint"),
            (v) => {

                const s =
                    (v || "").trim();

                if (
                    s.length < 40 ||
                    s.length > 48
                ) {

                    return safeT(
                        "wg.import_key_format"
                    );

                }

                return true;

            }
        );

    if (!value)
        return; // cancelled

    try {

        const resp =
            await fetch(
                "/api/wireguard/peer/import",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        private_key: value.trim()
                    })
                }
            );

        const data =
            await resp.json();

        if (data.status !== "ok") {

            this.mapImportError(data);

            return;

        }

        this.showMsg(
            safeT("wg.import_success") +
            " — " +
            name,
            "ok"
        );

        this.refresh();

    }
    catch (error) {

        console.error(
            "[WireGuardModule] import failed",
            error
        );

        this.showMsg(
            String(error),
            "error"
        );

    }

},

mapImportError(data) {

    if (
        data.error &&
        typeof data.error === "object"
    ) {

        // classifyRouterOSError (auth/permission/unreachable)
        this.showMsg(
            safeT("wg.err_unreachable") +
            " " +
            (data.error.detail || ""),
            "error"
        );

        return;

    }

    const map = {
        invalid_private_key: "wg.error.invalid_private_key",
        peer_not_found: "wg.error.peer_not_found",
        keypair_exists: "wg.error.keypair_exists"
    };

    this.showMsg(
        map[data.error]
            ? safeT(map[data.error])
            : (data.error || safeT("wg.save_error")),
        "error"
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
