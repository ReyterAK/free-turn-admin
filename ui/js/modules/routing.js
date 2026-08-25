//
// Routing Module
// FreeTurn Admin — routing diagnostics (READ-ONLY)
//
// Shows diagnostic verdicts for the container network and the
// WireGuard path, with exact WinBOX commands as recommendations.
// The panel NEVER changes routing/firewall — the admin applies
// the commands consciously, after backing up the router.
//

const RoutingModule = {

//
// Lifecycle
//

async init() {

    this.bindEvents();

    await this.refresh();

},

bindEvents() {

    const refreshBtn =
        document.getElementById(
            "routing-refresh"
        );

    if (refreshBtn) {

        refreshBtn.addEventListener(
            "click",
            () => {

                this.refresh();

            }
        );

    }

},

//
// Data
//

async refresh() {

    const el =
        document.getElementById(
            "routing-results"
        );

    if (!el)
        return;

    el.innerHTML =
        "<div class='routing-loading'>" +
        safeT("routing.loading") +
        "</div>";

    try {

        const data =
            await ApiClient.get(
                "/api/routing/diagnostics"
            );

        this.render(el, data);

    }
    catch (error) {

        console.error(
            "[RoutingModule] refresh failed",
            error
        );

        el.innerHTML =
            escapeHtml(String(error));

    }

},

render(el, data) {

    if (!data || !data.configured) {

        el.innerHTML =
            safeT("wg.not_configured");

        return;

    }

    if (data.error) {

        el.innerHTML =
            safeT("wg.err_unreachable") +
            " " +
            escapeHtml(data.error.detail || "");

        return;

    }

    const groups = [
        ["container", safeT("routing.group_container")],
        ["wg", safeT("routing.group_wg")]
    ];

    let html = "";

    for (const g of groups) {

        const list =
            (data.checks || []).filter(
                c => c.group === g[0]
            );

        if (!list.length)
            continue;

        html +=
            "<h4 class='routing-group'>" +
            g[1] +
            "</h4>";

        for (const c of list) {

            html += this.checkRow(c);

        }

    }

    el.innerHTML =
        html ||
        safeT("routing.no_checks");

},

checkRow(c) {

    let detail =
        safeT(c.detail_key);

    (c.params || []).forEach(
        p => {

            detail =
                detail.replace(
                    "%s",
                    p
                );

        }
    );

    let cmds = "";

    if (
        c.commands &&
        c.commands.length
    ) {

        cmds =
            "<pre class='routing-cmds'>" +
            c.commands
                .map(escapeHtml)
                .join("\n") +
            "</pre>";

    }

    return (
        "<div class='routing-check routing-" +
        c.status +
        "'>" +
        "<div class='routing-title'>" +
        safeT(c.title_key) +
        "</div>" +
        "<div class='routing-detail'>" +
        detail +
        "</div>" +
        cmds +
        "</div>"
    );

}

};

window.RoutingModule =
RoutingModule;
