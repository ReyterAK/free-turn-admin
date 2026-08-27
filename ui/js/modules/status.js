//
// Status Module
// Release 1.0.0 
//

const StatusModule = {


//
// temporary UI state
//

temporaryStatus:
    null,


//
// auto refresh
//

autoRefreshTimer:
    null,


//
// status refresh error dialog
//

statusRefreshErrorDialogShown:
    false,


//
// lifecycle
//

async init() {

    await this.refresh();

    this.bindEvents();

    await this.startAutoRefresh();

    

},


bindEvents() {

    // reserved

},


//
// auto refresh
//

async startAutoRefresh() {

    //
    // Always stop previous timer first.
    //
    // This prevents duplicate intervals
    // when settings are reloaded or module
    // initialization happens more than once.
    //

    this.stopAutoRefresh();


    //
    // Load admin settings.
    //

    await AdminSettingsStore.load();


    const settings =
        AdminSettingsStore.settings ||
        {};


    //
    // Missing value is treated as 0.
    //

    const interval =
        Number(
            settings.status_refresh_interval ||
            0
        );


    //
    // 0 = auto refresh disabled.
    //

    if (
        !interval
    ) {

        

        return;

    }


    //
    // Start periodic status refresh.
    //
    // Convert minutes to milliseconds.
    //

    this.autoRefreshTimer =
        setInterval(

            async () => {

                


                await this.refresh();

            },

            interval *
            60 *
            1000

        );


    

},


stopAutoRefresh() {

    if (
        this.autoRefreshTimer
    ) {

        clearInterval(
            this.autoRefreshTimer
        );


        this.autoRefreshTimer =
            null;


        

    }

},


//
// public
//

async refresh() {

    try {

        await ServerStore.refreshStatus();

        //
        // Successful refresh clears
        // previous error state.
        //

        this.statusRefreshErrorDialogShown =
            false;


        this.temporaryStatus =
            null;


        this.render();

    }
    catch (error) {

        console.error(
            "[StatusModule] status refresh failed",
            error
        );


        //
        // Discard temporary UI state.
        // Keep the last known real server status
        // from Store.
        //

        this.temporaryStatus =
            null;


        this.render();


        //
        // Do not open multiple dialogs
        // when automatic refresh keeps failing.
        //

        if (
            this.statusRefreshErrorDialogShown
        ) {

            return;

        }


        this.statusRefreshErrorDialogShown =
            true;


        try {

            await Dialog.alert(
                safeT("status.refresh_error_title"),
                error?.message ||
                safeT("status.refresh_error_message")
            );

        }
        finally {

            //
            // Allow the next new failure
            // to show an alert again.
            //

            this.statusRefreshErrorDialogShown =
                false;

        }

    }

},


showRestarting() {

    const currentStatus =
        Store.get("status") || {};


    this.temporaryStatus = {

        status:
            "restarting",

        version:
            currentStatus.version ||
            "unknown",

        clients:
            currentStatus.clients ||
            0,

        client_auth_enabled:
            currentStatus.client_auth_enabled,

        memory:
            currentStatus.memory,

        backend:
            currentStatus.backend

    };


    this.render();

},


//
// render
//

render() {


    const status =

        this.temporaryStatus ||

        Store.get("status") ||

        {};


    


    


    const data = {

        status:
            status,

        version:
            status.version ||
            "unknown",

        clients:
            status.client_auth_enabled
                ? String(
                    status.clients ||
                    0
                )
                : safeT(
                    "clients.auth_disabled"
                ),

        memory:
            status.memory
                ? `Used ${Math.round(status.memory.used_kb / 1024)} MB / Free ${Math.round(status.memory.free_kb / 1024)} MB / Total ${Math.round(status.memory.limit_kb / 1024)} MB`
                : "unknown",

        backend:
            status.backend

    };


    if (
        !window.SchemaEntityLayer
    )

        return;


    SchemaEntityLayer.renderStatus(
        "system-card",
        data
    );


    this.injectBackendLink();

},


//
// backend -> wireguard tab shortcut
//

injectBackendLink() {

    const card =
        document.getElementById(
            "system-card"
        );

    if (!card)
        return;

    const label =
        safeT("server.backend");

    const fields =
        card.querySelectorAll(
            ".schema-field"
        );

    for (
        let i = 0;
        i < fields.length;
        i++
    ) {

        const labelWrap =
            fields[i].querySelector(
                ".schema-label-wrap"
            );

        if (
            !labelWrap ||
            !labelWrap.textContent.includes(label)
        ) {

            continue;

        }

        const old =
            labelWrap.querySelector(
                ".wg-goto"
            );

        if (old)
            old.remove();

        const btn =
            document.createElement(
                "button"
            );

        btn.type = "button";

        btn.className = "wg-goto";

        btn.textContent = ">>";

        btn.title = safeT("wg.goto_title");

        btn.addEventListener(
            "click",
            () => {

                showTab("wireguard");

            }
        );

        labelWrap.appendChild(
            btn
        );

        return;

    }

},

};


window.StatusModule =
StatusModule;