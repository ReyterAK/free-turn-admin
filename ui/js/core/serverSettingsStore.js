//
// Server Settings Store
// Release 1.0.0
//
// Coordinates server settings workflow.
//
// Responsibilities:
//
// - load settings
// - render UI
// - collect values
// - validate
// - build run.args
// - save
//

"use strict";

const ServerSettingsStore = {


//
// Schema
//

schema:
    window.ServerSettingsSchema,



//
// Render target
//

containerId:
    "server-settings-form",



//
// Current settings
//

settings:
    null,



//
// Last validation result
//

validation:
    null,



//
// Validation errors
//

validationErrors:
    [],

saveSuccessElement:
    null,

//
// Load errors
//

loadErrors:
    [],



//
// Load settings
//

async load() {


    this.loadErrors = [];

    this.validationErrors = [];

    await ServerStore.refreshRunArgs();


    const source =
        Store.get(
            "runArgs"
        );


    if (
        !source ||
        source.read_error ||
        typeof source.data !== "string"
    ) {
    
        this.loadErrors.push(
            safeT("server.settings.load_error_title")
        );
    
    }


    this.settings =
        RunArgsParser.parse(
            this.schema,
            source?.data || ""
        );


    await AdminSettingsStore.load();


    const external =
        await AdminSettingsStore.getExternal();
    
    
    const statusRefreshInterval =
        await AdminSettingsStore.getStatusRefreshInterval();
    
    
    if (
        !external ||
        !external.host ||
        !external.port
    ) {
    
        this.loadErrors.push(
            safeT("server.settings.external_load_error")
        );
    
    }
    
    
    this.settings.external =
        external;
    
    
    this.settings.status_refresh_interval =
        statusRefreshInterval;



    this.validation =
        SettingsValidator.validate(
            this.schema,
            this.settings
        );


    if (
        this.loadErrors.length
    ) {

        console.warn(
            "[ServerSettingsStore] load errors",
            this.loadErrors
        );

    }


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
    // This prevents duplicate save buttons
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

    SchemaEntityLayer.renderServerSettings(
        this.containerId,
        this.settings
    );


    //
    // Create top toolbar.
    //
    // The toolbar is inserted above
    // the rendered settings tiles.
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
    // The button is intentionally created
    // here rather than in ServerSettingsSchema.
    //
    // ServerSettingsSchema describes
    // configuration fields.
    //
    // This button belongs to the
    // settings workflow UI.
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


                await window.saveServerSettings();


            } finally {


                saveButton.disabled =
                    false;


            }

        };


    //
    // Append button after the
    // message area.
    //
    // Messages are inserted into
    // messageContainer below.
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
    // for the newly created button.
    //

    if (
        window.I18N &&
        typeof window.I18N.refresh === "function"
    ) {

        window.I18N.refresh(
            toolbar
        );

    }


    //
    // Load warning.
    //

    if (
        this.loadErrors.length
    ) {


        const warning =
            document.createElement(
                "div"
            );


        warning.className =
            "settings-load-warning";


        warning.textContent =
            "⚠ " + safeT("server.settings.load_error");


        messageContainer.appendChild(
            warning
        );

    }


    //
    // Render validation errors.
    //
    // Use the toolbar message container
    // instead of prepending directly into
    // the main settings container.
    //

    this.renderValidationErrors();

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
        SettingsModel.build(
            this.schema,
            values
        );


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
// Find field by path
//
// Supports nested fields:
//
// external.port
// listen.port
// backend.port
//

findFieldByPath(
    path
) {


    if (
        !path ||
        !this.schema ||
        !this.schema.fields
    ) {

        return null;

    }


    const parts =
        String(path)
            .split(".");


    let fields =
        this.schema.fields;


    let field =
        null;


    for (
        const part of parts
    ) {


        field =
            fields.find(
                item =>
                    item.key === part
            );


        if (
            !field
        ) {

            return null;

        }


        fields =
            field.children ||
            [];

    }


    return field;

},




//
// Get parent field for nested field
//

findParentFieldByPath(
    path
) {


    if (
        !path ||
        !this.schema ||
        !this.schema.fields
    ) {

        return null;

    }


    const parts =
        String(path)
            .split(".");


    if (
        parts.length < 2
    ) {

        return null;

    }


    let fields =
        this.schema.fields;


    let parent =
        null;


    for (
        let index = 0;
        index < parts.length - 1;
        index++
    ) {


        parent =
            fields.find(
                field =>
                    field.key === parts[index]
            );


        if (
            !parent
        ) {

            return null;

        }


        fields =
            parent.children ||
            [];

    }


    return parent;

},




//
// Get field title
//

getFieldTitle(
    field
) {


    if (
        !field
    ) {

        return "";

    }


    if (
        field.title
    ) {

        return safeT(
            field.title
        );

    }


    if (
        field.label
    ) {

        return field.label;

    }


    return field.key ||
        "";

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
    // Technical validation keys from schema
    // must never be displayed directly to admin.
    //

    const validationMessages = {

        "server.validation.external_host":
            safeT("server.validation.hostname_hint")

    };


    const field =
        this.findFieldByPath(
            error.field
        );


    const parentField =
        this.findParentFieldByPath(
            error.field
        );


    const fieldTitle =
        this.getFieldTitle(
            field
        );


    const parentTitle =
        this.getFieldTitle(
            parentField
        );


    let message =
        error.message ||
        safeT("server.validation.invalid_value");


    switch (
        message
    ) {


        case "Value below minimum":


            message =
                safeT("server.validation.below_minimum");


            break;



        case "Value above maximum":


            message =
                safeT("server.validation.above_maximum");


            break;



        case "Value must be numeric":


            message =
                safeT("server.validation.must_be_numeric");


            break;



        case "Value must be hexadecimal":


            message =
                safeT("server.validation.must_be_hex");


            break;



        case "Invalid IP address":


            message =
                safeT("server.validation.invalid_ip");


            break;

        case "Invalid IP address or hostname":
        
        
            message =
                safeT("server.validation.invalid_host");
        
        
            break;

    }



    //
    // Existing custom validation message.
    //
    // Convert internal validation key
    // into a user-facing message.
    //

    if (
        field &&
        field.error &&
        error.message === field.error
    ) {

        message =
            validationMessages[field.error] ||
            safeT("server.validation.invalid_custom");

    }



    //
    // Nested field.
    //

    if (
        parentTitle &&
        fieldTitle
    ) {

        return (
            parentTitle +
            " → " +
            fieldTitle +
            ": " +
            message
        );

    }



    //
    // Root field.
    //

    if (
        fieldTitle
    ) {

        return (
            fieldTitle +
            ": " +
            message
        );

    }



    return message;

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
// Render validation errors
//

renderValidationErrors(
    errors
) {


    this.clearSaveSuccess();


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
        "⚠ " + safeT("server.settings.save_error");


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



    //
    // Insert into the message area.
    //
    // This keeps all messages above
    // the save button.
    //

    messageContainer.appendChild(
        errorContainer
    );



    //
    // Scroll to validation errors
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


    const blocks =
        document.querySelectorAll(
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

    if (
        this.saveSuccessElement
    ) {

        this.saveSuccessElement.remove();

        this.saveSuccessElement =
            null;

    }

},


hideSaveSuccess() {

    this.clearSaveSuccess();

},


//
// Show save success
//

async showSaveSuccess() {


    //
    // Remove any previous success message.
    //

    this.clearSaveSuccess();


    //
    // Ask administrator whether to restart.
    //

    const restart =
        await Dialog.confirm(

            safeT("server.settings.save_success_title"),

            safeT("server.settings.save_success_restart")

        );


    //
    // Administrator chose restart.
    //
    // Do not wait for the restart result.
    // The right status panel will show
    // the restart process.
    //

    if (restart) {
    
        ServerSettingsStore.clearSaveSuccess();
    
        StatusModule.showRestarting();
    
        ServerEntityLayer.restart();
    
        setTimeout(
            () => {
    
                StatusModule.refresh();
    
            },
            2500
        );
    
        return;
    
    }

    //
    // Administrator chose Cancel.
    //
    // Show the existing success message.
    //

    const messageContainer =
        this.getSaveMessageContainer();


    if (
        !messageContainer
    ) {

        return;

    }


    const success =
        document.createElement(
            "div"
        );
    
    
    success.className =
        "settings-save-success";
    
    
    success.textContent =
        "✓ " + safeT("server.settings.save_success");
    
    
    messageContainer.appendChild(
        success
    );
    
    
    this.saveSuccessElement =
        success;


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
// Save settings
//

async save() {


    const validation =
        this.collect();


    this.clearSaveSuccess();



    if (
        !validation.valid
    ) {


        this.renderValidationErrors(
            validation.errors
        );


        return validation;

    }



    const args =
        RunArgsBuilder.build(
            this.schema,
            this.settings
        );



    await ServerEntityLayer.saveSettings(
        {
            external:
                this.settings.external,
    
            status_refresh_interval:
                this.settings.status_refresh_interval
        }
    );



    await ServerEntityLayer.saveRunArgs(

        args.join("\n")

    );



    //
    // Reload actual saved settings
    //

    await this.load();



    //
    // Re-render UI from saved server state
    //

    this.render();



    //
    // Clear previous validation errors
    //

    this.clearValidationErrors();



    //
    // Show save success after render
    //

    await this.showSaveSuccess();



    return {

        valid:
            true,

        args:
            args

    };

}


};

window.ServerSettingsStore =
ServerSettingsStore;