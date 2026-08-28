//
// Clipboard Helper
// Release 1.1.3
//
// Copies text to the clipboard with a robust fallback.
//
// navigator.clipboard exists only in secure contexts
// (HTTPS or localhost); the panel on plain HTTP falls
// back to a temporary textarea + execCommand("copy").
//
// The fallback runs synchronously (no await before it),
// preserving the transient user activation that Firefox
// requires for execCommand("copy").
//

"use strict";


const ClipboardHelper = {


    //
    // Copy text to the clipboard.
    //
    // Returns Promise<boolean> — whether the copy
    // was performed (best effort).
    //

    copy(
        text
    ) {


        if (
            typeof text !== "string" ||
            !text
        ) {

            return Promise.resolve(
                false
            );

        }


        //
        // Secure context: modern async API.
        //

        if (
            window.isSecureContext &&
            navigator.clipboard &&
            navigator.clipboard.writeText
        ) {

            return navigator.clipboard
                .writeText(
                    text
                )
                .then(
                    () => true
                )
                .catch(
                    () => this.fallbackCopy(
                        text
                    )
                );

        }


        //
        // Non-secure context (plain HTTP panel):
        // synchronous fallback.
        //

        return Promise.resolve(
            this.fallbackCopy(
                text
            )
        );

    },



    //
    // Synchronous fallback.
    //
    // Temporary textarea + execCommand("copy").
    // Must run inside the user gesture handler
    // (no await in between) for Firefox.
    //

    fallbackCopy(
        text
    ) {


        const textarea =
            document.createElement(
                "textarea"
            );


        textarea.value =
            text;


        textarea.setAttribute(
            "readonly",
            ""
        );


        textarea.style.position =
            "fixed";


        textarea.style.top =
            "0";


        textarea.style.left =
            "0";


        textarea.style.opacity =
            "0";


        document.body.appendChild(
            textarea
        );


        textarea.focus();

        textarea.select();


        let ok =
            false;


        try {

            ok =
                document.execCommand(
                    "copy"
                );

        }
        catch (error) {

            ok =
                false;

        }


        document.body.removeChild(
            textarea
        );


        return ok;

    }


};


window.ClipboardHelper =
    ClipboardHelper;
