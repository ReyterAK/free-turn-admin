//
// Server Log Viewer
// Release 1.0.0
//

const LogViewerModule = {

    async open() {

        

        let lines = [];

        try {

        const result =
            await ApiClient.get(
                "/api/server/log"
            );
        
        lines =
            result.lines || [];

        } catch (e) {

            console.error(
                "[LogViewer]",
                e
            );

            lines = [
                "Unable to load server log."
            ];

        }


        const overlay =
            document.createElement(
                "div"
            );

        overlay.className =
            "modal";


        overlay.innerHTML = `

            <div class="modal-content log-viewer">

                <div class="event-log-header">

                    <h3>Server Log</h3>

                    <button class="event-log-close">
                        ×
                    </button>

                </div>

                <pre>${lines.join("\n")}</pre>

            </div>

        `;


        document.body.appendChild(
            overlay
        );


        const pre =
            overlay.querySelector("pre");


        requestAnimationFrame(() => {

            pre.scrollTop =
                pre.scrollHeight;

        });


        const close = () => {

            document.removeEventListener(
                "keydown",
                escHandler
            );

            overlay.remove();

        };


        overlay.querySelector(
            ".event-log-close"
        ).onclick = close;


        overlay.onclick = (e) => {

            if (e.target === overlay) {

                close();

            }

        };


        const escHandler = (e) => {

            if (e.key === "Escape") {

                close();

            }

        };


        document.addEventListener(
            "keydown",
            escHandler
        );

    }

};


window.LogViewerModule =
    LogViewerModule;


window.openServerLog = () =>
    LogViewerModule.open();