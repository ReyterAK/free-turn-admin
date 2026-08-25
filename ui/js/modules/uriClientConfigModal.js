//
// URI Client Config Modal
// Release 1.0.0
//
// Controls the WireGuard client configuration modal.
//
// Responsibilities:
//
// - show WireGuard configuration input
// - load configuration from file
// - return entered configuration
// - close modal
//
// Does NOT:
//
// - parse configuration
// - validate configuration
// - generate URI
// - encode URI
// - collect export data
//

"use strict";

const UriClientConfigModal = {


//
// Element IDs
//

modalId:
    "uri-client-config-modal",

titleId:
    "uri-client-config-modal-title",

descriptionId:
    "uri-client-config-modal-description",

valueId:
    "uri-client-config-value",

fileInputId:
    "uri-client-config-file-input",

fileButtonId:
    "uri-client-config-file",

closeButtonId:
    "uri-client-config-close",

cancelButtonId:
    "uri-client-config-cancel",

continueButtonId:
    "uri-client-config-continue",


//
// Current configuration value.
//

value:
    "",


//
// Initialize modal.
//

init() {


    const modal =
        document.getElementById(
            this.modalId
        );


    if (!modal) {

        console.error(
            "[UriClientConfigModal] modal not found"
        );

        return;

    }


    const closeButton =
        document.getElementById(
            this.closeButtonId
        );


    const cancelButton =
        document.getElementById(
            this.cancelButtonId
        );


    const continueButton =
        document.getElementById(
            this.continueButtonId
        );


    const fileButton =
        document.getElementById(
            this.fileButtonId
        );


    const fileInput =
        document.getElementById(
            this.fileInputId
        );


    //
    // Close button.
    //

    if (closeButton) {

        closeButton.onclick =
            () => {

                this.close();

            };

    }


    //
    // Cancel button.
    //

    if (cancelButton) {

        cancelButton.onclick =
            () => {

                this.close(
                    null
                );

            };

    }


    //
    // Continue button.
    //

    if (continueButton) {

        continueButton.onclick =
            () => {

                this.continue();

            };

    }


    //
    // File button.
    //

    if (
        fileButton &&
        fileInput
    ) {

        fileButton.onclick =
            () => {

                fileInput.click();

            };

    }


    //
    // File input.
    //

    if (fileInput) {

        fileInput.onchange =
            event => {

                this.loadFile(
                    event
                );

            };

    }


    //
    // Close when clicking
    // overlay background.
    //

    modal.onclick =
        event => {

            if (
                event.target === modal
            ) {

                this.close(
                    null
                );

            }

        };


    //
    // Close with Escape.
    //

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                !modal.classList.contains(
                    "hidden"
                )
            ) {

                this.close(
                    null
                );

            }

        }
    );


    console.log(
        "[UriClientConfigModal] initialized"
    );

},


//
// Show modal.
// show(defaultText) opens the modal. defaultText (optional)
// pre-fills the configuration field — used when the client is
// bound to a peer (its WG.config is loaded into the field; the
// admin may edit before continuing).
//
// Returns:
//
// - Promise<string> when Continue is pressed
// - Promise<null> when Cancel is pressed
//

show(defaultText = "") {


    const modal =
        document.getElementById(
            this.modalId
        );


    const title =
        document.getElementById(
            this.titleId
        );


    const description =
        document.getElementById(
            this.descriptionId
        );


    const value =
        document.getElementById(
            this.valueId
        );


    if (
        !modal ||
        !title ||
        !description ||
        !value
    ) {

        console.error(
            "[UriClientConfigModal] modal elements not found"
        );

        return Promise.resolve(
            null
        );

    }


    //
    // Current value (pre-filled for bound clients).
    //

    this.value =
        defaultText || "";


    //
    // Configure modal text.
    //

    title.textContent =
        safeT("uri_client_config.title");


    description.textContent =
        safeT("uri_client_config.description");


    //
    // Set input.
    //

    value.value =
        this.value;


    //
    // Reset file input.
    //

    const fileInput =
        document.getElementById(
            this.fileInputId
        );


    if (fileInput) {

        fileInput.value =
            "";

    }


    //
    // Show modal.
    //

    modal.classList.remove(
        "hidden"
    );


    //
    // Focus configuration field.
    //

    value.focus();


    return new Promise(
        resolve => {

            this.resolve =
                resolve;

        }
    );

},


//
// Continue.
//

continue() {


    const value =
        document.getElementById(
            this.valueId
        );


    const configuration =
        value?.value.trim() || "";


    this.value =
        configuration;


    if (
        this.resolve
    ) {

        const resolve =
            this.resolve;


        this.resolve =
            null;


        this.close();


        resolve(
            configuration
        );

        return;

    }


    this.close();

},


//
// Load configuration from file.
//
// No parsing or validation is performed.
//

async loadFile(event) {


    const file =
        event
            ?.target
            ?.files
            ?.[0];


    if (!file)
        return;


    try {

        const text =
            await file.text();


        const value =
            document.getElementById(
                this.valueId
            );


        if (value) {

            value.value =
                text;

            value.focus();

        }

    }
    catch (error) {

        console.error(
            "[UriClientConfigModal] file load failed",
            error
        );


        alert(
            safeT("uri_client_config.file_error")
        );

    }

},


//
// Close modal.
//
// result:
//
// - null -> cancel
// - undefined -> internal close after continue
//

close(result = null) {


    const modal =
        document.getElementById(
            this.modalId
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }


    this.value =
        "";


    if (
        this.resolve
    ) {

        const resolve =
            this.resolve;


        this.resolve =
            null;


        resolve(
            result
        );

    }

}


};

window.UriClientConfigModal =
UriClientConfigModal;