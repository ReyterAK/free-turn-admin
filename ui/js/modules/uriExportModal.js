//
// URI Export Modal
// Release 1.0.0
//
// Controls the URI export modal.
//
// Responsibilities:
//
// - show generated URI
// - generate QR from generated URI
// - close modal
// - copy URI to clipboard
//
// Does NOT:
//
// - generate URI
// - encode URI
// - collect export data
//

"use strict";

const UriExportModal = {


//
// Element IDs
//

modalId:
    "uri-export-modal",

valueId:
    "uri-export-value",

qrId:
    "uri-export-qr",

closeButtonId:
    "uri-export-modal-close",

closeActionId:
    "uri-export-modal-close-action",

copyButtonId:
    "uri-export-copy",



//
// Current URI
//

uri:
    "",



//
// Initialize modal
//

init() {


    const modal =
        document.getElementById(
            this.modalId
        );


    if (!modal) {

        console.error(
            "[UriExportModal] modal not found"
        );

        return;

    }


    const closeButton =
        document.getElementById(
            this.closeButtonId
        );


    const closeAction =
        document.getElementById(
            this.closeActionId
        );


    const copyButton =
        document.getElementById(
            this.copyButtonId
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
    // Footer close button.
    //

    if (closeAction) {

        closeAction.onclick =
            () => {

                this.close();

            };

    }


    //
    // Copy button.
    //

    if (copyButton) {

        copyButton.onclick =
            async () => {

                await this.copy();

            };

    }


    //
    // Close when clicking
    // the overlay background.
    //

    modal.onclick =
        event => {

            if (
                event.target === modal
            ) {

                this.close();

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

                this.close();

            }

        }
    );


    

},



//
// Show modal
//

show(uri) {


    if (
        typeof uri !== "string" ||
        !uri
    ) {

        console.error(
            "[UriExportModal] invalid URI"
        );

        return;

    }


    const modal =
        document.getElementById(
            this.modalId
        );


    const value =
        document.getElementById(
            this.valueId
        );


    const qr =
        document.getElementById(
            this.qrId
        );


    if (
        !modal ||
        !value ||
        !qr
    ) {

        console.error(
            "[UriExportModal] modal elements not found"
        );

        return;

    }


    //
    // Store current URI.
    //

    this.uri =
        uri;


    //
    // Display URI.
    //

    value.value =
        uri;


    //
    // Clear previous QR code.
    //

    qr.innerHTML =
        "";


    //
    // Generate QR code.
    //

    if (
        typeof QRCode !== "function"
    ) {

        console.error(
            "[UriExportModal] QRCode library not available"
        );

    }
    else {

        new QRCode(
            qr,
            {
                text:
                    uri,
        
                width:
                    660,
        
                height:
                    660,

                correctLevel:
                    QRCode.CorrectLevel.L
            }
        );

    }


    //
    // Show modal.
    //

    modal.classList.remove(
        "hidden"
    );


    //
    // Focus URI field.
    //

    value.focus();


    value.select();

},



//
// Close modal
//

close() {


    const modal =
        document.getElementById(
            this.modalId
        );


    const qr =
        document.getElementById(
            this.qrId
        );


    if (!modal) {

        return;

    }


    modal.classList.add(
        "hidden"
    );


    //
    // Clear generated QR.
    //

    if (qr) {

        qr.innerHTML =
            "";

    }


    this.uri =
        "";

},



//
// Copy URI
//

async copy() {


    if (
        !this.uri
    ) {

        return;

    }


    try {


        await navigator.clipboard.writeText(
            this.uri
        );


        


    }
    catch (error) {


        console.error(
            "[UriExportModal] copy failed",
            error
        );


        //
        // Fallback for browsers
        // where Clipboard API is unavailable.
        //

        const value =
            document.getElementById(
                this.valueId
            );


        if (!value) {

            return;

        }


        value.focus();

        value.select();


        try {

            document.execCommand(
                "copy"
            );


            

        }
        catch (fallbackError) {

            console.error(
                "[UriExportModal] fallback copy failed",
                fallbackError
            );

        }

    }

}

};

window.UriExportModal =
UriExportModal;