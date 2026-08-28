//
// CMD Flags Modal
// Release 1.1.3
//
// Controls the console-client launch command modal.
//
// Responsibilities:
//
// - show VK Calls links input
// - validate links against the https://vk.ru/call/join/ prefix
// - warn when no links are provided
// - build the launch command ("client -flags ...")
// - copy the command to the clipboard
// - close the modal
//
// Does NOT:
//
// - collect export data
// - call APIs
// - load files
//

"use strict";


const CmdFlagsModal = {


//
// Element IDs
//

modalId:
    "cmd-flags-modal",

titleId:
    "cmd-flags-modal-title",

descriptionId:
    "cmd-flags-modal-description",

linksId:
    "cmd-flags-links",

warnId:
    "cmd-flags-warn",

errorId:
    "cmd-flags-error",

commandId:
    "cmd-flags-command",

closeButtonId:
    "cmd-flags-close",

closeActionId:
    "cmd-flags-close-action",

copyButtonId:
    "cmd-flags-copy",


//
// Complete export data
// (from UriExportDataCollector).
//

data:
    null,


//
// Current command.
//

command:
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
            "[CmdFlagsModal] modal not found"
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


    const links =
        document.getElementById(
            this.linksId
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
    // Rebuild the command while the user types
    // (live validation of the links list).
    //

    if (links) {

        links.addEventListener(
            "input",
            () => {

                this.regenerate();

            }
        );

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
// Show modal.
//
// data:
//
// - complete export data from UriExportDataCollector
//

show(data) {


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


    const links =
        document.getElementById(
            this.linksId
        );


    if (
        !modal ||
        !title ||
        !description ||
        !links
    ) {

        console.error(
            "[CmdFlagsModal] modal elements not found"
        );

        return;

    }


    //
    // Store export data.
    //

    this.data =
        data || null;


    //
    // Configure modal text.
    //

    title.textContent =
        safeT("cmd_flags.title");


    description.textContent =
        safeT("cmd_flags.description");


    //
    // Clear the links field
    // (fresh input per invocation).
    //

    links.value =
        "";


    //
    // Rebuild the command.
    //

    this.regenerate();


    //
    // Show modal.
    //

    modal.classList.remove(
        "hidden"
    );


    //
    // Focus links field.
    //

    links.focus();

},


//
// Parse raw links input.
//
// Splits on commas, trims each item,
// drops empty entries.
//

parseLinks(raw) {


    if (
        typeof raw !== "string"
    ) {

        return [];

    }


    return raw
        .split(",")
        .map(
            item =>
                item.trim()
        )
        .filter(
            item =>
                item.length > 0
        );

},


//
// Validate one link.
//

isValidLink(link) {


    return link.startsWith(
        ClientCmdBuilder.linksPrefix
    );

},


//
// Rebuild the command from
// the current links input.
//

regenerate() {


    const links =
        document.getElementById(
            this.linksId
        );


    const warn =
        document.getElementById(
            this.warnId
        );


    const error =
        document.getElementById(
            this.errorId
        );


    const command =
        document.getElementById(
            this.commandId
        );


    if (
        !links ||
        !warn ||
        !error ||
        !command
    ) {

        return;

    }


    //
    // Parse and validate the links list.
    //

    const list =
        this.parseLinks(
            links.value
        );


    const invalid =
        list.filter(
            link =>
                !this.isValidLink(
                    link
                )
        );


    const valid =
        list.filter(
            link =>
                this.isValidLink(
                    link
                )
        );


    //
    // Feedback.
    //
    // - empty input: informational warning
    // - invalid entries: error, listing them
    //

    warn.classList.add(
        "hidden"
    );


    error.classList.add(
        "hidden"
    );


    if (
        list.length === 0
    ) {

        warn.textContent =
            safeT("cmd_flags.warn_empty");


        warn.classList.remove(
            "hidden"
        );

    }
    else if (
        invalid.length
    ) {

        error.textContent =
            safeT("cmd_flags.invalid_links") +
            " " +
            invalid.join(
                ", "
            );


        error.classList.remove(
            "hidden"
        );

    }


    //
    // Build the command.
    //
    // Valid links are joined into the -links value;
    // invalid entries are excluded.
    //

    const linksValue =
        valid.length
            ? valid.join(",")
            : "";


    this.command =
        ClientCmdBuilder.build(
            this.data,
            linksValue
        );


    command.value =
        this.command;

},


//
// Close modal.
//

close() {


    const modal =
        document.getElementById(
            this.modalId
        );


    if (!modal) {

        return;

    }


    modal.classList.add(
        "hidden"
    );


    this.data =
        null;


    this.command =
        "";

},


//
// Copy command.
//

async copy() {


    if (
        !this.command
    ) {

        return;

    }


    await ClipboardHelper.copy(
        this.command
    );

}



};

window.CmdFlagsModal =
    CmdFlagsModal;
