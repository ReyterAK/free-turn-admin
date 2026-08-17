//
// URI Generation Settings Store
// Release 1.0.0
//
// Coordinates URI / QR generation parameters.
//
// Responsibilities:
//
// - load settings from uri.json
// - render UI
// - collect values
// - validate
// - save settings
// - display load / validation / save messages
//

"use strict";

const UriGenerationSettingsStore = {


//
// Schema
//

schema:
    window.UriGenerationSettingsSchema,



//
// Render target
//

containerId:
    "connection-form",



//
// Current settings
//

settings:
    null,



//
// Read error state
//

readError:
    false,



//
// Load errors
//

loadErrors:
    [],



//
// Validation result
//

validation:
    null,



//
// Validation errors
//

validationErrors:
    [],



//
// Load settings
//

async load() {


    this.readError =
        false;


    this.loadErrors =
        [];


    this.validationErrors =
        [];


    //
    // Load uri.json.
    //

    const source =
        await ApiClient.get(
            "/api/uri-settings"
        );


    //
    // Read error.
    //

    this.readError =
        Boolean(
            source?.read_error
        );


    if (
        this.readError
    ) {


        console.warn(
            "[UriGenerationSettingsStore] failed to load uri.json",
            source
        );


        this.loadErrors.push(
            safeT("uri.load_error_title")
        );


        this.settings =
            {};

    }
    else {


        this.settings =
            source?.data || {};


    }


    //
    // Validate loaded settings.
    //
    // The read error itself is handled separately
    // by the UI warning above.
    //

    this.validation =
        SettingsValidator.validate(
            this.schema,
            this.settings,
            {},
            {
                readError:
                    this.readError
            }
        );


    this.validationErrors =
        this.validation.errors || [];


    console.log(
        "[UriGenerationSettingsStore] loaded settings",
        this.settings
    );


    return this.settings;

},



//
// Render settings
//

render() {


    const container =
        document.getElementById(
            this.containerId
        );


    if (!container) {

        return;

    }



    //
    // Remove previous toolbar.
    //
    // Prevent duplicate save buttons
    // and messages after re-render.
    //

    const previousToolbar =
        container.querySelector(
            ".settings-save-toolbar"
        );


    if (previousToolbar) {

        previousToolbar.remove();

    }



    //
    // Render settings tiles.
    //

    SchemaEntityLayer.renderUriGenerationSettings(
        this.containerId,
        this.settings || {}
    );



    //
    // Create top toolbar.
    //
    // Messages are displayed above
    // the Save button.
    //

    const toolbar =
        document.createElement(
            "div"
        );


    toolbar.className =
        "settings-save-toolbar";



    //
    // Save button.
    //

    const saveButton =
        document.createElement(
            "button"
        );


    saveButton.type =
        "button";


    saveButton.className =
        "settings-save-button";


    saveButton.dataset.i18n =
        "actions.save";


    saveButton.textContent =
        safeT(
            "actions.save"
        );


    saveButton.onclick =
        async () => {


            saveButton.disabled =
                true;


            try {


                await this.save();


            }
            catch (
                error
            ) {


                console.error(
                    "[UriGenerationSettingsStore] save failed",
                    error
                );


                this.showSaveError(
                    safeT("uri.save_error_message")
                );


            }
            finally {


                saveButton.disabled =
                    false;


            }

        };



    //
    // Message container.
    //
    // All warnings, validation errors
    // and success messages are shown
    // above the Save button.
    //

    const messageContainer =
        document.createElement(
            "div"
        );


    messageContainer.className =
        "settings-save-messages";



    toolbar.appendChild(
        messageContainer
    );


    toolbar.appendChild(
        saveButton
    );



    //
    // Insert toolbar above
    // settings tiles.
    //

    container.prepend(
        toolbar
    );



    //
    // Refresh translations
    // for newly created UI.
    //

    if (
        window.I18N &&
        typeof window.I18N.refresh ===
            "function"
    ) {

        window.I18N.refresh(
            toolbar
        );

    }



    //
    // Load warning.
    //

    if (
        this.readError ||
        this.loadErrors.length
    ) {


        const warning =
            document.createElement(
                "div"
            );


        warning.className =
            "settings-load-warning";


        warning.textContent =
            "⚠ " + safeT("uri.load_error");


        messageContainer.appendChild(
            warning
        );

    }



    //
    // Render validation errors
    // from loaded settings.
    //

    if (
        this.validationErrors.length
    ) {


        this.renderValidationErrors(
            this.validationErrors
        );

    }

},



//
// Collect values from UI
//

collect() {


    const values =
        SchemaRenderer.collect(
            this.containerId
        );


    this.settings =
        values;


    //
    // Validate collected values.
    //

    this.validation =
        SettingsValidator.validate(
            this.schema,
            this.settings
        );


    this.validationErrors =
        this.validation.errors || [];


    return this.validation;

},



//
// Get save toolbar message container
//

getSaveMessageContainer() {


    const container =
        document.getElementById(
            this.containerId
        );


    if (!container) {

        return null;

    }


    return container.querySelector(
        ".settings-save-messages"
    );

},



//
// Format validation message
//

formatValidationMessage(
    error
) {


    if (
        !error
    ) {

        return "";

    }



    //
    // User-facing validation messages.
    //

    const validationMessages = {


        "Value below minimum":
            safeT("uri.validation.below_minimum"),


        "Value above maximum":
            safeT("uri.validation.above_maximum"),


        "Value must be numeric":
            safeT("uri.validation.must_be_numeric"),


        "Value must be boolean":
            safeT("uri.validation.must_be_boolean"),


        "Invalid option":
            safeT("uri.validation.invalid_option"),


        "Value cannot be greater than n":
            safeT("uri.validation.spc_gt_n")


    };



    //
    // Field titles.
    //

    const fieldTitles = {


        "n":
            safeT("uri.n"),


        "spc":
            safeT("uri.spc"),


        "v":
            safeT("uri.version"),


        "provider":
            safeT("uri.provider"),


        "dns":
            safeT("uri.dns"),


        "dnss":
            safeT("uri.dnss"),


        "mcap":
            safeT("uri.mcap"),


        "bond":
            safeT("uri.bond")

    };



    const fieldTitle =
        fieldTitles[
            error.field
        ] ||
        error.field ||
        safeT("common.parameter");



    const message =
        validationMessages[
            error.message
        ] ||
        error.message ||
        safeT("uri.validation.invalid_option");



    return (
        fieldTitle +
        ": " +
        message
    );

},



//
// Render validation errors
//

renderValidationErrors(
    errors
) {


    this.clearValidationErrors();



    if (
        !errors ||
        !errors.length
    ) {

        return;

    }



    const messageContainer =
        this.getSaveMessageContainer();


    if (!messageContainer) {

        return;

    }



    const errorContainer =
        document.createElement(
            "div"
        );


    errorContainer.className =
        "settings-validation-errors";



    const title =
        document.createElement(
            "div"
        );


    title.className =
        "settings-validation-errors-title";


    title.textContent =
        "⚠ " + safeT("uri.save_error_title");


    errorContainer.appendChild(
        title
    );



    const list =
        document.createElement(
            "ul"
        );



    for (
        const error of errors
    ) {


        const item =
            document.createElement(
                "li"
            );


        item.textContent =
            this.formatValidationMessage(
                error
            );


        list.appendChild(
            item
        );

    }



    errorContainer.appendChild(
        list
    );



    messageContainer.appendChild(
        errorContainer
    );



    //
    // Scroll to validation errors.
    //

    errorContainer.scrollIntoView({

        behavior:
            "smooth",

        block:
            "start"

    });

},



//
// Clear validation errors
//

clearValidationErrors() {


    this.validationErrors =
        [];


    const container =
        document.getElementById(
            this.containerId
        );


    if (!container) {

        return;

    }


    const blocks =
        container.querySelectorAll(
            ".settings-validation-errors"
        );


    blocks.forEach(

        block => {

            block.remove();

        }

    );

},



//
// Clear save success
//

clearSaveSuccess() {


    const container =
        document.getElementById(
            this.containerId
        );


    if (!container) {

        return;

    }


    const successBlocks =
        container.querySelectorAll(
            ".settings-save-success"
        );


    successBlocks.forEach(

        success => {

            success.remove();

        }

    );

},



//
// Clear save error
//

clearSaveError() {


    const container =
        document.getElementById(
            this.containerId
        );


    if (!container) {

        return;

    }


    const errorBlocks =
        container.querySelectorAll(
            ".settings-save-error"
        );


    errorBlocks.forEach(

        error => {

            error.remove();

        }

    );

},



//
// Show save success
//

showSaveSuccess() {


    this.clearSaveSuccess();


    this.clearSaveError();


    const messageContainer =
        this.getSaveMessageContainer();


    if (!messageContainer) {

        return;

    }


    const success =
        document.createElement(
            "div"
        );


    success.className =
        "settings-save-success";


    success.textContent =
        "✓ " + safeT("uri.save_success");


    messageContainer.appendChild(
        success
    );


    //
    // Scroll to success message.
    //

    success.scrollIntoView({

        behavior:
            "smooth",

        block:
            "start"

    });

},



//
// Show save error
//

showSaveError(
    message
) {


    this.clearSaveSuccess();


    this.clearSaveError();


    const messageContainer =
        this.getSaveMessageContainer();


    if (!messageContainer) {

        return;

    }


    const error =
        document.createElement(
            "div"
        );


    error.className =
        "settings-save-error";


    error.textContent =
        "⚠ " +
        (
            message ||
            safeT("uri.save_error_message")
        );


    messageContainer.appendChild(
        error
    );


    error.scrollIntoView({

        behavior:
            "smooth",

        block:
            "start"

    });

},



//
// Save settings
//

async save() {


    //
    // Collect and validate current UI values.
    //

    const validation =
        this.collect();



    this.clearSaveSuccess();


    this.clearSaveError();



    //
    // Validation failed.
    //

    if (
        !validation.valid
    ) {


        console.warn(
            "[UriGenerationSettingsStore] validation failed",
            validation.errors
        );


        this.renderValidationErrors(
            validation.errors
        );


        return {

            valid:
                false,

            errors:
                validation.errors

        };

    }



    //
    // Save to uri.json.
    //

    const response =
        await ApiClient.post(
            "/api/uri-settings",
            this.settings
        );



    if (
        !response ||
        response.status !== "ok"
    ) {


        throw new Error(
            "Failed to save URI generation settings"
        );

    }



    //
    // Reload actual saved settings.
    //

    await this.load();



    //
    // Re-render UI from saved state.
    //

    this.render();



    //
    // Show save success after render.
    //

    this.showSaveSuccess();



    console.log(
        "[UriGenerationSettingsStore] settings saved",
        this.settings
    );



    return {

        valid:
            true,

        settings:
            this.settings

    };

}

};

window.UriGenerationSettingsStore =
UriGenerationSettingsStore;
