//
// Clients Module
// Release 1.0.0
//

const ClientsModule = {

//
// =====================================================
// Lifecycle
// =====================================================
//

async init() {


await this.refresh();

this.bindEvents();

console.log(
    "[ClientsModule] initialized"
);


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

<button
onclick="ClientsModule.export('${client.id}')">
${safeT("actions.export")} </button>

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


console.log(
    "[ClientsModule] Export connection",
    id
);


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

        const wg =
            await UriClientConfigModal.show();


        if (
            wg === null
        ) {

            console.log(
                "[ClientsModule] URI export cancelled"
            );


            return;

        }


        exportData.wg =
            wg;

    }


    const payload =
        UriExportPayloadBuilder.build(
            exportData
        );


    const uri =
        UriExportEncoder.encode(
            payload
        );


    console.log(
        "[ClientsModule] URI generated",
        uri
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
// =====================================================
// Helpers
// =====================================================
//

};

window.ClientsModule =
ClientsModule;