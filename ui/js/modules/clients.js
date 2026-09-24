//
// Clients Module
// Release 1.0.0
//

const ClientsModule = {

//
// =====================================================
// Data
// =====================================================
//

// bindings — panel-managed WG keypairs with client bindings
// (from GET /api/wireguard/bindings), for the WireGuard column.
bindings: [],

async loadBindings() {

    try {

        const data =
            await ApiClient.get(
                "/api/wireguard/bindings"
            );

        this.bindings =
            (data && data.keypairs) ||
            [];

    }
    catch (e) {

        this.bindings = [];

        console.error(
            "[ClientsModule] bindings",
            e
        );

    }

},

//
// =====================================================
// Lifecycle
// =====================================================
//

async init() {


await this.refresh();

this.bindEvents();




},

bindEvents() {


    const searchInput =
        document.getElementById(
            "client-search"
        );


    if (!searchInput)
        return;


    searchInput.addEventListener(
        "input",
        () => {

            this.render();

        }
    );


},

//
// =====================================================
// Data
// =====================================================
//

async refresh() {


await ClientStore.refresh();

await this.refreshAuthStatus();

await this.loadBindings();

this.render();


},

render() {


    const table =
        document.getElementById(
            "clients-table"
        );


    if (!table)
        return;


    const searchInput =
        document.getElementById(
            "client-search"
        );


    const searchQuery =
        searchInput?.value
            .trim()
            .toLowerCase() ||
        "";


    const clients =
        ClientStore
            .get()
            .slice()
            .filter(
                client => {

                    if (!searchQuery) {

                        return true;

                    }


                    const id =
                        String(
                            client.id ||
                            ""
                        )
                        .toLowerCase();


                    const comment =
                        String(
                            client.comment ||
                            ""
                        )
                        .toLowerCase();


                    return (
                        id.includes(
                            searchQuery
                        ) ||
                        comment.includes(
                            searchQuery
                        )
                    );

                }
            )
            .sort(
                (a, b) =>
                    a.id.localeCompare(
                        b.id
                    )
            );


    table.innerHTML =
        clients
            .map(
                client =>
                    this.renderRow(
                        client
                    )
            )
            .join("");


},

renderRow(client) {

    const kp =
        this.bindings.find(
            k => k.client_id === client.id
        );

    let bound = "";

    if (kp) {

        // Имя пира (RouterOS) важнее интерфейса: сервер использует
        // один интерфейс, интерфейс в подписи не несёт информации.
        const name =
            kp.peer_name ||
            kp.comment ||
            kp.public_key.slice(0, 12);

        const comment =
            kp.peer_name && kp.comment
                ? " (" + kp.comment + ")"
                : "";

        bound =
            name +
            comment +
            " · " +
            kp.allowed_address;

    }


return `


<tr>

<td
    title="${client.id}">
    ${client.id}
</td>

<td>
    ${client.comment || ""}
</td>

<td>

    ${bound
        ? `<span class="wg-binding">${bound}</span>`
        : safeT("clients.no_binding")}

    <br>

    <button
    onclick="ClientsModule.bindPeer('${client.id}')">
    ${bound
        ? safeT("clients.change_btn")
        : safeT("clients.bind_btn")} </button>

    ${bound
        ? `<button
    onclick="ClientsModule.unbindPeer('${client.id}')">
    ${safeT("clients.unbind_btn")} </button>`
        : ""}

</td>

<td>

<button
onclick="ClientsModule.export('${client.id}')">
${safeT("actions.export")} </button>

<button
onclick="ClientsModule.cmd('${client.id}')">
${safeT("actions.cmd")} </button>

<button
onclick="ClientsModule.edit('${client.id}')">
${safeT("actions.update")} </button>

<button
onclick="ClientsModule.remove('${client.id}')">
${safeT("actions.delete")} </button>

</td>

</tr>

`;

},

async refreshAuthStatus() {


const statusElement =
    document.getElementById(
        "clients-auth-status"
    );


if (!statusElement)
    return;


try {

    const system =
        await ApiClient.get(
            "/api/system/status"
        );


    statusElement.textContent =
        system.client_auth_enabled
            ? safeT("clients.id_enabled")
            : safeT("clients.id_disabled");


} catch (e) {

    console.error(
        "[ClientsModule] auth status",
        e
    );


    statusElement.textContent =
        safeT("clients.id_unknown");

}


},

//
// =====================================================
// Validation
// =====================================================
//

validateComment(comment) {

    //
    // Empty comment is allowed.
    //

    if (!comment) {

        return true;

    }


    //
    // Maximum length.
    //

    if (
        comment.length > 32
    ) {

        return safeT("clients.validation.too_long");

    }


    //
    // Allowed characters:
    //
    // - Cyrillic
    // - Latin
    // - digits
    // - spaces
    // - dot
    // - comma
    // - hyphen
    // - underscore
    // - parentheses
    //

    const validPattern =
        /^[\p{L}\p{N} .,()_-]+$/u;


    if (
        !validPattern.test(
            comment
        )
    ) {

        return safeT("clients.validation.invalid_chars");

    }


    return true;

},

//
// =====================================================
// Actions
// =====================================================
//

async add() {

    const input =
        document.getElementById(
            "client-comment"
        );


    const comment =
        input?.value.trim() || "";


    const validationResult =
        this.validateComment(
            comment
        );


    if (
        validationResult !== true
    ) {

        await Dialog.alert(
            safeT("dialog.title_error"),
            validationResult
        );


        if (input) {

            input.focus();

        }


        return;

    }


    try {
    
        await ClientStore.add(
            comment
        );
    
    
        await this.refresh();
    
    
        if (input) {
    
            input.value = "";
    
            input.focus();
    
        }
    
    
        await Dialog.success(
            safeT("dialog.title_done"),
            safeT("clients.added_message")
        );
    
    
    } catch (error) {
    
    
        console.error(
            "[ClientsModule] add client failed",
            error
        );
    
    
        await Dialog.alert(
            safeT("clients.add_error_title"),
            error?.message ||
            safeT("clients.add_error_message")
        );
    
    
        if (input) {
    
            input.focus();
    
        }
    
    }

},

async edit(id) {


const client =
    ClientStore
        .get()
        .find(
            c => c.id === id
        );


if (!client)
    return;


const comment =
await Dialog.prompt(
safeT("clients.comment"),
client.comment || "",
safeT("clients.edit_prompt"),
value => {

        const normalizedComment =
            value.trim();


        return this.validateComment(
            normalizedComment
        );

    }
);


if (comment === false) {
    return;
}

const normalizedComment =
    comment.trim();

try {

    await ClientStore.update(
        id,
        normalizedComment
    );


    await this.refresh();


    await Dialog.success(
        safeT("dialog.title_done"),
        safeT("clients.updated_message")
    );


} catch (error) {


    console.error(
        "[ClientsModule] edit client failed",
        error
    );


    await Dialog.alert(
        safeT("clients.edit_error_title"),
        error?.message ||
        safeT("clients.edit_error_message")
    );

}

},

async remove(id) {


    const confirmed =
        await Dialog.confirm(
            safeT("clients.delete_title"),
            safeT("clients.delete_confirm") + id
        );


    if (!confirmed) {

        return;

    }


    try {


        await ClientStore.remove(
            id
        );


        await this.refresh();


        await Dialog.success(
            safeT("dialog.title_done"),
            safeT("clients.deleted_message")
        );


    } catch (error) {


        console.error(
            "[ClientsModule] remove client failed",
            error
        );


        await Dialog.alert(
            safeT("clients.delete_error_title"),
            error?.message ||
            safeT("clients.delete_error_message")
        );

    }


},

async export(id) {





const client =
    ClientStore
        .get()
        .find(
            c => c.id === id
        );


if (!client) {

    console.error(
        "[ClientsModule] client not found",
        id
    );


    Dialog.alert(
        safeT("dialog.title_error"),
        safeT("clients.not_found")
    );


    return;

}


try {

    const exportData =
        await UriExportDataCollector.collect(
            client
        );


    //
    // Client-specific WireGuard configuration.
    //
    // WireGuard configuration is relevant only
    // for UDP mode.
    //
    // Empty configuration is allowed.
    //
    // Cancel aborts URI export.
    //

    //
    // Always remove stale WG data first.
    // This prevents a configuration from a previous
    // export from leaking into the current payload.
    //

    delete exportData.wg;


    if (
        exportData.mode === "udp"
    ) {

        //
        // Клиент привязан к пиру — предзаполняем окно
        // конфигурации его WG.config (админ может править).
        // Шаг НЕ пропускается: только префилл.
        //

        let wgDefault =
            "";


        const boundKp =
            this.bindings.find(
                k => k.client_id === client.id
            );


        if (boundKp) {

            try {

                const resp =
                    await fetch(
                        "/api/wireguard/peer/config?public_key=" +
                        encodeURIComponent(
                            boundKp.public_key
                        ),
                        {
                            credentials: "same-origin"
                        }
                    );


                const data =
                    await resp.json();


                if (data.status === "ok") {

                    wgDefault =
                        data.config;

                }

            }
            catch (error) {

                console.error(
                    "[ClientsModule] WG prefill",
                    error
                );

            }

        }


        const wg =
            await UriClientConfigModal.show(
                wgDefault
            );


        if (
            wg === null
        ) {

            


            return;

        }


        exportData.wg =
            wg;

    }


    //
    // Per-client VK Calls link.
    //
    // Since free-turn-proxy 4.0.0 the link can be carried
    // inside freeturn:// as the "vk" field. It is optional
    // and unique for each client.
    //

    const vkLink =
        await Dialog.prompt(
            safeT("clients.export_link_title"),
            "",
            safeT("clients.export_link_message"),
            value => {

                const v =
                    value.trim();


                if (
                    !v
                ) {

                    return true;

                }


                if (
                    v.startsWith(
                        ClientCmdBuilder.linksPrefix
                    )
                ) {

                    return true;

                }


                return (
                    safeT("cmd_flags.invalid_links") +
                    " " +
                    ClientCmdBuilder.linksPrefix +
                    "..."
                );

            }
        );


    if (
        vkLink === false
    ) {

        return;

    }


    exportData.vk =
        vkLink.trim();


    const payload =
        UriExportPayloadBuilder.build(
            exportData
        );


    const uri =
        UriExportEncoder.encode(
            payload
        );


    


    UriExportModal.show(
        uri
    );


} catch (error) {

    console.error(
        "[ClientsModule] URI export failed",
        error
    );


    Dialog.alert(
        safeT("clients.export_error_title"),
        error?.message ||
        safeT("clients.export_error_message")
    );

}


},

//
// Generate the console-client launch command
// ("client -flags ...") for the selected client.
//
// Same data source as URI export (UriExportDataCollector),
// but without the WireGuard configuration step:
// the command carries client parameters only.
//

async cmd(id) {



const client =
    ClientStore
        .get()
        .find(
            c => c.id === id
        );


if (!client) {

    console.error(
        "[ClientsModule] client not found",
        id
    );


    Dialog.alert(
        safeT("dialog.title_error"),
        safeT("clients.not_found")
    );


    return;

}


try {

    const exportData =
        await UriExportDataCollector.collect(
            client
        );


    CmdFlagsModal.show(
        exportData
    );


} catch (error) {

    console.error(
        "[ClientsModule] command generation failed",
        error
    );


    Dialog.alert(
        safeT("cmd_flags.error_title"),
        error?.message ||
        safeT("cmd_flags.error_message")
    );

}


},

//
// =====================================================
// WireGuard binding (peer ↔ client, 1:1)
// =====================================================
//

async bindPeer(id) {

    // Свежие данные: пиры могли появиться/измениться после
    // последней загрузки (создание/импорт во вкладке WireGuard).
    await this.loadBindings();

    // Живой список пиров ОБСЛУЖИВАЕМОГО интерфейса: keypair
    // валиден только когда его пир есть в этом списке. Импорт
    // ключа «чужого» пира или удаление пира вне панели могли
    // оставить запись, которую нельзя предлагать для привязки.
    let validPubs = null;

    try {

        const resp =
            await fetch(
                "/api/wireguard",
                {
                    credentials: "same-origin"
                }
            );

        const data =
            await resp.json();

        if (
            data &&
            Array.isArray(data.peers) &&
            data.peers.length
        ) {

            validPubs =
                new Set(
                    data.peers.map(
                        p => p["public-key"]
                    )
                );

        }

    }
    catch (error) {

        console.error(
            "[ClientsModule] live peers",
            error
        );

    }

    let bindable =
        this.bindings.filter(
            kp =>
                !kp.client_id ||
                kp.client_id === id
        );

    const stray =
        validPubs
            ? bindable.filter(
                kp => !validPubs.has(kp.public_key)
              )
            : [];

    if (validPubs) {

        bindable =
            bindable.filter(
                kp => validPubs.has(kp.public_key)
            );

    }

    // Посторонние ключи (пир на другом интерфейсе или удалён
    // вне панели): предлагаем убрать их из панели — роутер
    // не затрагивается.
    if (stray.length) {

        const names =
            stray
                .map(
                    kp =>
                        kp.peer_name ||
                        kp.comment ||
                        kp.public_key.slice(0, 12)
                )
                .join(", ");

        const clean =
            await Dialog.confirm(
                safeT("clients.stray_confirm_title"),
                safeT("clients.stray_confirm_text") +
                "\n\n" +
                names
            );

        if (clean) {

            for (const kp of stray) {

                try {

                    const resp =
                        await fetch(
                            "/api/wireguard/keypair/delete",
                            {
                                method: "POST",
                                credentials: "same-origin",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    public_key: kp.public_key
                                })
                            }
                        );

                    const data =
                        await resp.json();

                    if (data.status !== "ok") {

                        this.mapBindError(data);

                        return;

                    }

                }
                catch (error) {

                    console.error(
                        "[ClientsModule] stray cleanup",
                        error
                    );

                    await Dialog.alert(
                        safeT("dialog.title_error"),
                        error?.message ||
                        safeT("clients.bind_error_message")
                    );

                    return;

                }

            }

            await this.loadBindings();

        }

    }

    if (!bindable.length) {

        Dialog.alert(
            safeT("dialog.title_error"),
            safeT("clients.no_peers_to_bind")
        );


        return;

    }


    const options =
        bindable.map(
            kp => ({

                value: kp.public_key,

                label:
                    (kp.peer_name ||
                     kp.comment ||
                     kp.public_key.slice(0, 12)) +
                    (kp.peer_name && kp.comment
                        ? " (" + kp.comment + ")"
                        : "") +
                    " · " +
                    kp.allowed_address +
                    (kp.client_id === id
                        ? " (" +
                          safeT("clients.current_binding") +
                          ")"
                        : kp.client_id
                            ? " (" +
                              safeT("clients.bound_other") +
                              ")"
                            : "")

            })
        );


    const pub =
        await Dialog.select(
            safeT("clients.bind_title"),
            safeT("clients.bind_hint"),
            {
                selectOptions: options
            }
        );


    if (!pub)
        return; // cancelled


    try {

        const resp =
            await fetch(
                "/api/wireguard/bind",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        client_id: id,
                        public_key: pub
                    })
                }
            );


        const data =
            await resp.json();


        if (data.status !== "ok") {

            this.mapBindError(data);

            return;

        }


        await Dialog.success(
            safeT("dialog.title_done"),
            safeT("clients.bind_success")
        );


        await this.refresh();

    }
    catch (error) {

        console.error(
            "[ClientsModule] bind failed",
            error
        );


        await Dialog.alert(
            safeT("dialog.title_error"),
            error?.message ||
            safeT("clients.bind_error_message")
        );

    }

},

async unbindPeer(id) {

    const kp =
        this.bindings.find(
            k => k.client_id === id
        );


    if (!kp)
        return;


    const ok =
        await Dialog.confirm(
            safeT("clients.unbind_title"),
            safeT("clients.unbind_confirm")
        );


    if (!ok)
        return;


    try {

        const resp =
            await fetch(
                "/api/wireguard/unbind",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        public_key: kp.public_key
                    })
                }
            );


        const data =
            await resp.json();


        if (data.status !== "ok") {

            this.mapBindError(data);

            return;

        }


        await Dialog.success(
            safeT("dialog.title_done"),
            safeT("clients.unbind_success")
        );


        await this.refresh();

    }
    catch (error) {

        console.error(
            "[ClientsModule] unbind failed",
            error
        );


        await Dialog.alert(
            safeT("dialog.title_error"),
            error?.message ||
            safeT("clients.bind_error_message")
        );

    }

},

mapBindError(data) {

    const map = {
        client_already_bound: "wg.peer_err_bound",
        peer_keypair_not_found: "wg.error.peer_keypair_not_found",
        client_not_found: "wg.error.client_not_found"
    };


    Dialog.alert(
        safeT("dialog.title_error"),
        map[data.error]
            ? safeT(map[data.error])
            : (data.error || safeT("clients.bind_error_message"))
    );

},

//
// =====================================================
// Helpers
// =====================================================
//

};

window.ClientsModule =
ClientsModule;