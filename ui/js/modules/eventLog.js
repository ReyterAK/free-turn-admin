//
// Event Log Module
// Release 1.1.5
//

const EventLogModule = {


    events: [],
    overlay: null,


    async open() {

        let events = [];

        try {
            const result = await ApiClient.get("/api/events");
            events = result || [];
        } catch (e) {
            console.error("[EventLog]", e);
            events = [];
        }

        this.events = events;

        const overlay = document.createElement("div");
        overlay.className = "event-log-overlay";

        overlay.innerHTML = `
            <div class="event-log-window">

                <div class="event-log-header">

                    <h2>
                        ${safeT("eventlog.title")}
                    </h2>

                    <input
                        id="event-log-search"
                        class="event-log-search"
                        type="search"
                        placeholder="${safeT("eventlog.search_placeholder")}"
                        autocomplete="off"
                        autocapitalize="off"
                        autocorrect="off"
                        spellcheck="false">

                    <button class="event-log-close">
                        ×
                    </button>

                </div>

                <div class="event-log-body" id="event-log-body">
                </div>

            </div>
        `;

        document.body.appendChild(overlay);
        this.overlay = overlay;

        overlay.querySelector(".event-log-close").onclick = () => {
            this.close();
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                this.close();
            }
        };

        const searchInput = overlay.querySelector("#event-log-search");
        searchInput.oninput = () => {
            this.render(searchInput.value.trim());
        };

        this.render("");
        searchInput.focus();
    },


    close() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    },


    render(filterText) {
        const body = this.overlay?.querySelector("#event-log-body");
        if (!body) {
            return;
        }

        const events = this.filterEvents(this.events, filterText);

        if (!events.length) {
            body.innerHTML = `
                <div class="event-log-empty">
                    ${safeT(filterText ? "eventlog.no_matches" : "eventlog.empty")}
                </div>
            `;
            return;
        }

        body.innerHTML = events.map(e => `
            <div class="event-log-entry">
                ${formatEventTime(e.time)}
                &nbsp;&nbsp;
                ${escapeHtml(e.type)}:
                ${escapeHtml(e.message)}
            </div>
        `).join("");
    },


    filterEvents(events, filterText) {
        if (!filterText) {
            return events;
        }

        const needle = filterText.toLowerCase();

        return events.filter(e => {
            const haystack = [
                e.message,
                e.type,
                e.source,
                e.time
            ].join(" ").toLowerCase();

            return haystack.includes(needle);
        });
    }


};


function formatEventTime(value) {
    try {
        const d = new Date(value);
        return (
            String(d.getDate()).padStart(2, "0")
            + "."
            + String(d.getMonth() + 1).padStart(2, "0")
            + "."
            + d.getFullYear()
            + " "
            + String(d.getHours()).padStart(2, "0")
            + ":"
            + String(d.getMinutes()).padStart(2, "0")
            + ":"
            + String(d.getSeconds()).padStart(2, "0")
        );
    } catch {
        return value;
    }
}


function escapeHtml(text) {
    if (text == null) {
        return "";
    }
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


window.EventLogModule = EventLogModule;
window.openEventLog = () => EventLogModule.open();
window.closeEventLog = () => EventLogModule.close();
