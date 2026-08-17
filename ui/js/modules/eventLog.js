//
// Event Log Module
// Release 1.0.0
//

const EventLogModule = {


    async open() {

        console.log(
            "[EventLog] open"
        );


        let events = [];


        try {

            const result =
                await ApiClient.get(
                    "/api/events"
                );


            events = result || [];


        } catch (e) {

            console.error(
                "[EventLog]",
                e
            );

            events = [];

        }



        const overlay =
            document.createElement(
                "div"
            );


        overlay.className =
            "event-log-overlay";



        overlay.innerHTML = `

            <div class="event-log-window">


                <div class="event-log-header">

                    <h2>
                        ${safeT("eventlog.title")}
                    </h2>


                    <button
                        class="event-log-close">
                        ×
                    </button>

                </div>



                <div class="event-log-body">


                    ${
                        events.length
                        ?
                        events.map(
                            e =>
                            `
                            <div class="event-log-entry">

                                ${formatEventTime(e.time)}

                                &nbsp;&nbsp;

                                ${e.type}:

                                ${e.message}

                            </div>
                            `
                        ).join("")
                        :
                        `
                        <div class="event-log-empty">
                            ${safeT("eventlog.empty")}
                        </div>
                        `
                    }


                </div>


            </div>

        `;



        document.body.appendChild(
            overlay
        );



        overlay
            .querySelector(
                ".event-log-close"
            )
            .onclick = () => {

                overlay.remove();

            };



        overlay.onclick = (e) => {

            if (
                e.target === overlay
            ) {

                overlay.remove();

            }

        };

    }


};



function formatEventTime(value) {

    try {

        const d =
            new Date(value);


        return (
            String(d.getDate()).padStart(2, "0")
            + "."
            +
            String(d.getMonth() + 1).padStart(2, "0")
            + "."
            +
            d.getFullYear()
            + " "
            +
            String(d.getHours()).padStart(2, "0")
            + ":"
            +
            String(d.getMinutes()).padStart(2, "0")
            + ":"
            +
            String(d.getSeconds()).padStart(2, "0")
        );


    } catch {

        return value;

    }

}



window.EventLogModule =
    EventLogModule;



window.openEventLog = () =>
    EventLogModule.open();