//
// FreeTurn Admin
// Schema Renderer
// Release 1.0.0
//
// Schema-driven renderer core.
//
// Supports:
// - sections + fields schema
// - groups + fields schema
// - nested composite fields
// - conditional field visibility
// - editable fields
// - readonly fields
// - buttons
// - boolean fields
// - select fields
// - hex key generation
// - validation-compatible value collection
// - nested value paths
// - i18n labels and dynamic controls
// - tooltip hints
// - information dialogs for fields and composite groups
//

"use strict";

// =====================================================
// PUBLIC RENDER
// =====================================================

function renderSchema(
    schema,
    containerId,
    values = {},
    mode = "editable"
) {

    const container =
        document.getElementById(
            containerId
        );

    if (
        !container
    ) {

        return;

    }

    container.replaceChildren();

    //
    // Resolve schema structure.
    //
    // Legacy schema:
    //
    // schema.sections[]
    //
    // Current schema:
    //
    // schema.groups[]
    // schema.fields[]
    //

    const sections =
        buildSchemaSections(
            schema
        );

    for (
        const section of sections
    ) {

        container.appendChild(

            renderSection(
                section,
                values,
                mode
            )

        );

    }

    //
    // Refresh translations
    //

    if (
        window.I18N &&
        typeof window.I18N.refresh === "function"
    ) {

        window.I18N.refresh(
            container
        );

    }

    //
    // Bind dynamic visibility
    //

    bindSchemaVisibility(
        schema,
        container
    );

    //
    // Initial visibility update
    //

    updateSchemaVisibility(
        schema,
        container
    );

    //
    // Information modal
    //

    bindSchemaInformation(
        container
    );

}

// =====================================================
// BUILD SCHEMA SECTIONS
// =====================================================

function buildSchemaSections(
    schema
) {

    if (
        !schema
    ) {

        return [];

    }

    //
    // Legacy sections-based schema
    //

    if (
        Array.isArray(
            schema.sections
        )
    ) {

        return schema.sections;

    }

    //
    // Current groups + fields schema
    //

    if (
        Array.isArray(
            schema.groups
        ) &&
        Array.isArray(
            schema.fields
        )
    ) {

        return schema.groups.map(
            group => {

                return {

                    id:
                        group.id,

                    title:
                        group.title,

                    titleKey:
                        group.titleKey ||
                        group.title,

                    fields:
                        schema.fields.filter(

                            field =>
                                field.group ===
                                group.id

                        )

                };

            }
        );

    }

    //
    // Fallback:
    // fields without groups
    //

    if (
        Array.isArray(
            schema.fields
        )
    ) {

        return [

            {

                id:
                    "default",

                title:
                    "",

                fields:
                    schema.fields

            }

        ];

    }

    return [];

}

// =====================================================
// SECTION
// =====================================================

function renderSection(
    section,
    values,
    mode
) {

    const el =
        document.createElement(
            "div"
        );

    el.className =
        "schema-section";

    //
    // Section title
    //

    if (
        section.title ||
        section.titleKey
    ) {

        const title =
            document.createElement(
                "h3"
            );

        if (
            section.titleKey
        ) {

            title.dataset.i18n =
                section.titleKey;

            title.textContent =
                safeT(
                    section.titleKey
                );

        } else {

            title.textContent =
                section.title ||
                "";

        }

        el.appendChild(
            title
        );

    }

    //
    // Render fields
    //

    for (
        const field of (
            section.fields ||
            []
        )
    ) {

        el.appendChild(

            renderField(
                field,
                getValueByPath(
                    values,
                    field.key
                ),
                mode,
                values
            )

        );

    }

    return el;

}

// =====================================================
// FIELD
// =====================================================

function renderField(
    field,
    rawValue,
    mode,
    allValues = {}
) {

    if (
        !field
    ) {

        return document.createDocumentFragment();

    }

    

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "schema-field";

    if (
        field.key
    ) {

        wrapper.dataset.schemaKey =
            field.key;

    }

    //
    // Conditional visibility
    //

    if (
        field.enabled_when &&
        !SchemaConditions.matches(
            field.enabled_when,
            allValues
        )
    ) {

        wrapper.style.display =
            "none";

    }

    //
    // Composite field
    //

    if (
        Array.isArray(
            field.children
        )
    ) {

        wrapper.appendChild(

            renderCompositeField(
                field,
                rawValue || {},
                mode,
                allValues
            )

        );

        return wrapper;

    }

    //
    // Label
    //
    // Keep the original Server Settings behavior:
    // every ordinary field gets its normal header.
    //
    // Checkbox / boolean fields that define their own
    // checkboxLabel render that label inside the checkbox
    // and therefore do not get an additional header.
    //

    wrapper.appendChild(
    
        renderLabel(
            field
        )
    
    );

    //
    // Readonly state
    //

    const readonly =

        mode === "readonly" ||

        field.readonly === true ||

        field.displayOnly === true;

    const inputWrap =
        document.createElement(
            "div"
        );

    inputWrap.className =
        "schema-input-wrap";

    if (
        readonly
    ) {

        renderReadonlyField(

            inputWrap,

            field,

            rawValue

        );

    } else {

        renderEditableField(

            inputWrap,

            field,

            normalizeEditableValue(

                field,

                rawValue

            )

        );

    }

    wrapper.appendChild(
        inputWrap
    );

    return wrapper;

}

// =====================================================
// FIELD HEADER
// =====================================================
//
// Shared header renderer for:
//
// - ordinary fields
// - composite fields
//
// Supports:
//
// - title / label
// - help / helpKey tooltip
// - info / infoKey information button
//
// This keeps tooltip and information button logic
// identical for normal fields and composite headers.
//
// =====================================================

function renderFieldHeader(
    field,
    className = "schema-label-wrap"
) {

    const wrap =
        document.createElement(
            "div"
        );

    wrap.className =
        className;

    let titleText =
        "";

    let titleKey =
        null;

    if (
        field.labelKey
    ) {

        titleKey =
            field.labelKey;

        titleText =
            safeT(
                field.labelKey
            );

    } else if (
        field.titleKey
    ) {

        titleKey =
            field.titleKey;

        titleText =
            safeT(
                field.titleKey
            );

    } else if (
        field.title
    ) {

        titleKey =
            field.title;

        titleText =
            safeT(
                field.title
            );

    } else {

        titleText =

            field.label ||

            field.key ||

            "";

    }

    const title =
        document.createElement(
            "span"
        );

    title.className =
        "schema-field-title";

    if (
        titleKey
    ) {

        title.dataset.i18n =
            titleKey;

    }

    title.textContent =
        titleText;

    wrap.appendChild(
        title
    );

    appendSchemaHint(
        wrap,
        field
    );

    appendInformationButton(
        wrap,
        field
    );

    return wrap;

}

function renderLabel(
    field
) {

    const wrap =
        document.createElement(
            "div"
        );

    wrap.className =
        "schema-label-wrap";

    //
    // Buttons have their own label.
    //

    if (
        field.type === "button"
    ) {

        return wrap;

    }

    return renderFieldHeader(
        field,
        "schema-label-wrap"
    );

}

// =====================================================
// SCHEMA HINT / TOOLTIP
// =====================================================
//
// Adds a short tooltip hint.
//
// Supported schema:
//
// help:
//     "Short explanation"
//
// helpKey:
//     "server.help.some_info"
//
// tooltipKey:
//     "server.tooltip.some_info"
//
// tooltipKey is preferred for translated
// tooltip text.
//
// The tooltip uses the native browser title attribute
// for now. This keeps the implementation lightweight
// and independent from the information modal.
//
// =====================================================

function appendSchemaHint(
    parent,
    field
) {

    if (
        !parent ||
        !field
    ) {

        return;

    }

    if (
        !field.help &&
        !field.helpKey &&
        !field.tooltipKey
    ) {

        return;

    }

    const hint =
        document.createElement(
            "span"
        );

    hint.className =
        "schema-hint";

    hint.textContent =
        "ⓘ";

    hint.setAttribute(
        "aria-hidden",
        "true"
    );

    //
    // Preferred i18n tooltip.
    //

    if (
        field.tooltipKey
    ) {

        hint.dataset.i18nTitle =
            field.tooltipKey;

        hint.title =
            safeT(
                field.tooltipKey
            );

    //
    // Legacy i18n tooltip.
    //

    } else if (
        field.helpKey
    ) {

        hint.dataset.i18nTitle =
            field.helpKey;

        hint.title =
            safeT(
                field.helpKey
            );

    //
    // Plain text tooltip.
    //

    } else {

        hint.title =
            field.help;

    }

    parent.appendChild(
        hint
    );

}

// =====================================================
// INFORMATION BUTTON
// =====================================================
//
// Adds the "?" button for detailed information.
//
// Supported schema:
//
// info:
//     "Detailed information text"
//
// infoKey:
//     "server.settings.some_info"
//
// The mechanism is intentionally independent
// from Tooltip (help/helpKey/tooltipKey).
//
// It can be used for:
// - ordinary fields
// - composite fields
//
// =====================================================

function appendInformationButton(
    parent,
    field
) {

    if (
        !parent ||
        !field
    ) {

        return;

    }

    if (
        !field.info &&
        !field.infoKey
    ) {

        return;

    }

    const button =
        document.createElement(
            "button"
        );

    button.type =
        "button";

    button.className =
        "schema-info-button";

    button.textContent =
        "?";

    button.setAttribute(
        "aria-label",
        getInformationLabel(
            field
        )
    );

    button.setAttribute(
        "aria-expanded",
        "false"
    );

    button.setAttribute(
        "aria-haspopup",
        "dialog"
    );

    //
    // Store information source
    // directly on the button.
    //

    if (
        field.infoKey
    ) {

        button.dataset.infoKey =
            field.infoKey;

    } else {

        button.dataset.info =
            field.info;

    }

    parent.appendChild(
        button
    );

}

// =====================================================
// INFORMATION LABEL
// =====================================================

function getInformationLabel(
    field
) {

    if (
        field.infoLabelKey
    ) {

        return safeT(
            field.infoLabelKey
        );

    }

    if (
        field.infoLabel
    ) {

        return field.infoLabel;

    }

    return "Information";

}

// =====================================================
// INFORMATION TEXT
// =====================================================

function getInformationText(
    button
) {

    if (
        button.dataset.infoKey
    ) {

        return safeT(
            button.dataset.infoKey
        );

    }

    return (
        button.dataset.info ||
        ""
    );

}

// =====================================================
// INFORMATION MODAL
// =====================================================
//
// Displays detailed information in a centered modal.
//
// CSS classes:
//
// - info-overlay
// - info-window
// - info-header
// - info-close
// - info-body
//
// The modal is created dynamically and removed
// from the DOM when closed.
//
// Supports:
//
// - info
// - infoKey
// - close button
// - click on overlay
// - Escape key
// - focus restoration
//
// =====================================================

function showSchemaInformation(
    button
) {

    if (
        !button
    ) {

        return;

    }

    //
    // Close any currently open modal first.
    //

    closeSchemaInformation();

    //
    // Create overlay.
    //

    const overlay =
        document.createElement(
            "div"
        );

    overlay.className =
        "info-overlay";

    overlay.setAttribute(
        "role",
        "presentation"
    );

    //
    // Create modal window.
    //

    const windowElement =
        document.createElement(
            "div"
        );

    windowElement.className =
        "info-window";

    windowElement.setAttribute(
        "role",
        "dialog"
    );

    windowElement.setAttribute(
        "aria-modal",
        "true"
    );

    windowElement.setAttribute(
        "aria-labelledby",
        "schema-info-title"
    );

    //
    // Header.
    //

    const header =
        document.createElement(
            "div"
        );

    header.className =
        "info-header";

    //
    // Title.
    //

    const title =
        document.createElement(
            "h2"
        );

    title.id =
        "schema-info-title";

    title.textContent =
        getInformationLabel(
            getInformationFieldFromButton(
                button
            )
        );

    header.appendChild(
        title
    );

    //
    // Close button.
    //

    const closeButton =
        document.createElement(
            "button"
        );

    closeButton.type =
        "button";

    closeButton.className =
        "info-close";

    closeButton.textContent =
        "×";

    closeButton.setAttribute(
        "aria-label",
        "Close information"
    );

    header.appendChild(
        closeButton
    );

    windowElement.appendChild(
        header
    );

    //
    // Body.
    //

    const body =
        document.createElement(
            "div"
        );

    body.className =
        "info-body";

    body.textContent =
        getInformationText(
            button
        );

    windowElement.appendChild(
        body
    );

    //
    // Store source button.
    //

    overlay._schemaInfoButton =
        button;

    overlay._schemaInfoCloseButton =
        closeButton;

    //
    // Update source button state.
    //

    button.setAttribute(
        "aria-expanded",
        "true"
    );

    //
    // Append modal.
    //

    overlay.appendChild(
        windowElement
    );

    document.body.appendChild(
        overlay
    );

    //
    // Close button.
    //

    closeButton.addEventListener(

        "click",

        event => {

            event.stopPropagation();

            closeSchemaInformation();

        }

    );

    //
    // Close when clicking the dark overlay,
    // but not when clicking inside the modal.
    //

    overlay.addEventListener(

        "click",

        event => {

            if (
                event.target ===
                overlay
            ) {

                closeSchemaInformation();

            }

        }

    );

    //
    // Store focus source.
    //

    overlay._schemaInfoPreviousFocus =
        document.activeElement;

    //
    // Focus close button.
    //

    closeButton.focus();

}

// =====================================================
// INFORMATION FIELD FROM BUTTON
// =====================================================
//
// Reconstructs the minimal field metadata needed
// for the information dialog title.
//
// The button itself stores only the information
// source, so the original field metadata is recovered
// from its surrounding schema field.
//
// =====================================================

function getInformationFieldFromButton(
    button
) {

    if (
        !button
    ) {

        return {};

    }

    const fieldElement =
        button.closest(
            ".schema-field"
        );

    if (
        !fieldElement
    ) {

        return {};

    }

    //
    // The title is already rendered in the same
    // header. Use the visible title as a fallback.
    //

    const title =
        fieldElement.querySelector(
            ".schema-field-title"
        );

    if (
        title
    ) {

        return {

            infoLabel:
                title.textContent

        };

    }

    return {};

}

// =====================================================
// CLOSE INFORMATION MODAL
// =====================================================

function closeSchemaInformation() {

    const overlay =
        document.querySelector(
            ".info-overlay"
        );

    if (
        !overlay
    ) {

        return;

    }

    //
    // Restore source button state.
    //

    const button =
        overlay._schemaInfoButton;

    if (
        button
    ) {

        button.setAttribute(
            "aria-expanded",
            "false"
        );

    }

    //
    // Remember previous focus.
    //

    const previousFocus =
        overlay._schemaInfoPreviousFocus;

    //
    // Remove modal.
    //

    overlay.remove();

    //
    // Restore focus to the information button
    // when possible.
    //

    if (
        button &&
        document.contains(
            button
        )
    ) {

        button.focus();

    } else if (
        previousFocus &&
        typeof previousFocus.focus ===
            "function" &&
        document.contains(
            previousFocus
        )
    ) {

        previousFocus.focus();

    }

}

// =====================================================
// BIND INFORMATION
// =====================================================

function bindSchemaInformation(
    container
) {

    if (
        !container
    ) {

        return;

    }

    //
    // Information buttons.
    //

    container
        .querySelectorAll(
            ".schema-info-button"
        )
        .forEach(

            button => {

                //
                // Prevent duplicate handlers
                // when the same container is rendered
                // again without replacing the page.
                //

                if (
                    button.dataset
                        .schemaInformationBound ===
                    "true"
                ) {

                    return;

                }

                button.addEventListener(

                    "click",

                    event => {

                        event.stopPropagation();

                        showSchemaInformation(
                            button
                        );

                    }

                );

                button.dataset
                    .schemaInformationBound =
                    "true";

            }

        );

    //
    // Global Escape handling.
    //

    if (
        !document.body.dataset
            .schemaInformationBound
    ) {

        document.addEventListener(

            "keydown",

            event => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    closeSchemaInformation();

                }

            }

        );

        //
        // Prevent background scrolling
        // while modal is open.
        //

        document.addEventListener(

            "click",

            event => {

                const overlay =

                    document.querySelector(
                        ".info-overlay"
                    );

                if (
                    !overlay
                ) {

                    return;

                }

                //
                // Clicking inside modal is handled
                // by the modal itself.
                //

                if (
                    event.target.closest(
                        ".info-window"
                    )
                ) {

                    return;

                }

            }

        );

        document.body.dataset
            .schemaInformationBound =
            "true";

    }

}

// =====================================================
// READONLY
// =====================================================

function renderReadonlyField(
    parent,
    field,
    rawValue
) {

    

    const div =
        document.createElement(
            "div"
        );

    div.className =
        "schema-value";

    div.dataset.key =
        field.key;

    if (
        typeof rawValue === "object" &&
        rawValue !== null
    ) {

        div.dataset.value =
            JSON.stringify(
                rawValue
            );

    } else {

        div.dataset.value =
            rawValue ?? "";

    }

    //
    // Formatter receives original value
    //

    div.textContent =
        formatFieldValue(

            field,

            rawValue

        );

    //
    // Special status indicator
    //

    if (
        (
            field.formatter === "status" ||
            field.formatter === "backend_status"
        ) &&
        rawValue &&
        typeof rawValue === "object"
    ) {
    
        div.replaceChildren();
    
        const indicator =
            document.createElement(
                "span"
            );
    
        //
        // Status can be provided as:
        //
        // 1. Object:
        //
        // {
        //     status: "running"
        // }
        //
        // 2. Direct string:
        //
        // "available"
        //
        let status;
    
        if (
            typeof rawValue === "object"
        ) {
    
            status =
                rawValue.status;
    
        } else {
    
            status =
                String(
                    rawValue
                );
    
        }
    
        if (
            !status
        ) {
    
            status =
                "unknown";
    
        }
    
        indicator.className =
    
            "status-indicator " +
    
            status;
    
        const label =
            document.createElement(
                "span"
            );
    
        switch (
            status
        ) {
    
            case "running":
    
                label.textContent =
                    safeT("status.running");
    
                break;
    
            case "stopped":
    
                label.textContent =
                    safeT("status.stopped");
    
                break;
    
            case "restarting":
    
                label.textContent =
                    safeT("status.restarting");
    
                break;
    
            case "available":
    
                label.textContent =
                    safeT("status.available");
    
                break;
    
            case "port_unavailable":
    
                label.textContent =
                    safeT("status.port_unavailable");
    
                break;
    
            case "ip_unavailable":
    
                label.textContent =
                    safeT("status.ip_unavailable");
    
                break;
    
            case "unknown":
    
                label.textContent =
                    safeT("status.unknown");
    
                break;
    
            default:
    
                label.textContent =
                    status;
    
        }
    
        indicator.appendChild(
            label
        );
    
        div.appendChild(
            indicator
        );
    
    }

    parent.appendChild(
        div
    );

}

// =====================================================
// EDITABLE FIELD
// =====================================================

function renderEditableField(
    parent,
    field,
    value
) {

    //--------------------------------------------------
    // BUTTON
    //--------------------------------------------------

    if (
        field.type === "button"
    ) {

        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.dataset.key =
            field.key;

        //
        // i18n label key
        //

        if (
            field.labelKey
        ) {

            button.dataset.i18n =
                field.labelKey;

            button.textContent =
                safeT(
                    field.labelKey
                );

        //
        // Title as i18n key
        //

        } else if (
            field.title
        ) {

            button.dataset.i18n =
                field.title;

            button.textContent =
                safeT(
                    field.title
                );

        //
        // Plain label fallback
        //

        } else {

            button.textContent =

                field.label ||

                field.key;

        }

        //
        // Bind action
        //

        if (
            field.action &&
            typeof window[field.action] ===
                "function"
        ) {

            

            button.onclick =
                async function() {

                    

                    try {

                        await window[
                            field.action
                        ]();

                        

                    } catch (
                        error
                    ) {

                        console.error(

                            "[BUTTON ERROR]",

                            error

                        );

                    }

                };

        }

        parent.appendChild(
            button
        );

        return;

    }

    //--------------------------------------------------
    // CHECKBOX / BOOLEAN
    //--------------------------------------------------

    if (
        field.type === "checkbox" ||
        field.type === "boolean"
    ) {

        const wrap =
            document.createElement(
                "label"
            );

        wrap.className =
            "schema-checkbox";

        const input =
            document.createElement(
                "input"
            );

        input.type =
            "checkbox";

        input.checked =
            Boolean(
                value
            );

        input.dataset.key =
            field.key;

        wrap.appendChild(
            input
        );

        const text =
            document.createElement(
                "span"
            );

        if (
            field.checkboxLabelKey
        ) {

            text.dataset.i18n =
                field.checkboxLabelKey;

            text.textContent =
                safeT(
                    field.checkboxLabelKey
                );

        } else {

            text.textContent =

                field.checkboxLabel ||

                field.label ||

                field.title ||

                field.key;

        }

        wrap.appendChild(
            text
        );

        parent.appendChild(
            wrap
        );

        return;

    }

    //--------------------------------------------------
    // SELECT
    //--------------------------------------------------

    if (
        field.type === "select"
    ) {

        const select =
            document.createElement(
                "select"
            );

        select.dataset.key =
            field.key;

        for (
            const option of (
                field.options ||
                []
            )
        ) {

            const opt =
                document.createElement(
                    "option"
                );

            opt.value =
                option;

            opt.textContent =
                option;

            if (
                String(option) ===
                String(value)
            ) {

                opt.selected =
                    true;

            }

            select.appendChild(
                opt
            );

        }

        parent.appendChild(
            select
        );

        return;

    }

    //--------------------------------------------------
    // HEX KEY
    //--------------------------------------------------

    if (
        field.type === "hex_key"
    ) {

        const wrap =
            document.createElement(
                "div"
            );

        wrap.className =
            "schema-hex-key";

        const input =
            document.createElement(
                "input"
            );

        input.type =
            "text";

        input.dataset.key =
            field.key;

        input.value =
            value ?? "";

        input.autocomplete =
            "off";

        input.spellcheck =
            false;

        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        //
        // i18n
        //

        button.dataset.i18n =
            "server.settings.generate_key";

        button.textContent =
            safeT(
                "server.settings.generate_key"
            );

        button.className =
            "schema-hex-key-generate";

        button.onclick =
            async function() {

                button.disabled =
                    true;

                const previousError =

                    button.parentElement
                        .querySelector(
                            ".schema-hex-key-error"
                        );

                if (
                    previousError
                ) {

                    previousError.remove();

                }

                try {

                    const result =

                        await ServerEntityLayer
                            .generateObfKey();

                    if (
                        !result ||
                        result.status !== "ok"
                    ) {

                        throw new Error(

                            "Failed to generate obfuscation key"

                        );

                    }

                    let key =

                        result.key ||

                        "";

                    //
                    // Current backend:
                    // clean 64-character hex key
                    //
                    // Compatibility:
                    // old backend may return
                    // additional text.
                    //

                    const matches =

                        String(
                            key
                        ).match(
                            /[0-9a-fA-F]{64}/g
                        );

                    if (
                        !matches ||
                        !matches.length
                    ) {

                        throw new Error(

                            "Invalid obfuscation key returned by server"

                        );

                    }

                    key =

                        matches[
                            matches.length - 1
                        ];

                    input.value =
                        key;

                    input.dispatchEvent(

                        new Event(

                            "input",

                            {

                                bubbles:
                                    true

                            }

                        )

                    );

                    input.dispatchEvent(

                        new Event(

                            "change",

                            {

                                bubbles:
                                    true

                            }

                        )

                    );

                } catch (
                    error
                ) {

                    console.error(

                        "[SchemaRenderer] obf_key generation failed",

                        error

                    );

                    const errorMessage =

                        document.createElement(
                            "div"
                        );

                    errorMessage.className =
                        "schema-hex-key-error";

                    errorMessage.dataset.i18n =
                        "server.settings.generate_key_error";

                    errorMessage.textContent =

                        safeT(
                            "server.settings.generate_key_error"
                        );

                    button.parentElement.appendChild(

                        errorMessage

                    );

                } finally {

                    button.disabled =
                        false;

                }

            };

        wrap.appendChild(
            input
        );

        wrap.appendChild(
            button
        );

        parent.appendChild(
            wrap
        );

        return;

    }

    //--------------------------------------------------
    // INPUT
    //--------------------------------------------------

    const input =
        document.createElement(
            "input"
        );

    input.type =

        resolveInputType(
            field
        );

    input.dataset.key =
        field.key;

    input.value =
        value ?? "";

    //
    // Numeric constraints
    //

    if (
        field.min !== undefined
    ) {

        input.min =
            field.min;

    }

    if (
        field.max !== undefined
    ) {

        input.max =
            field.max;

    }

    //
    // Placeholder
    //

    if (
        field.placeholderKey
    ) {

        input.dataset.i18nPlaceholder =

            field.placeholderKey;

        input.placeholder =

            safeT(
                field.placeholderKey
            );

    } else if (
        field.placeholder
    ) {

        input.placeholder =
            field.placeholder;

    }

    parent.appendChild(
        input
    );

}

// =====================================================
// INPUT TYPE RESOLUTION
// =====================================================

function resolveInputType(
    field
) {

    switch (
        field.type
    ) {

        case "num":

            return "number";

        case "number":

            return "number";

        case "ip":

        case "ip_name":

        case "text":

        default:

            return "text";

    }

}

// =====================================================
// FORMATTERS
// =====================================================

function formatFieldValue(
    field,
    value
) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }

    switch (
        field.formatter
    ) {

        //--------------------------------------------------
        // STATUS
        //--------------------------------------------------

        case "status":

            if (
                typeof value === "object" &&
                value.status
            ) {

                return value.status;

            }

            return String(
                value
            );

        //--------------------------------------------------
        // VERSION
        //--------------------------------------------------

        case "version":

            return (

                safeT("system.version") + " " +

                String(
                    value
                )

            );

        //--------------------------------------------------
        // BOOLEAN
        //--------------------------------------------------

        case "bool":

            return value

                ? "☑ " + safeT("common.on")

                : "☐ " + safeT("common.off");

        //--------------------------------------------------
        // DURATION
        //--------------------------------------------------

        case "duration":

            if (
                value === "" ||
                value === 0 ||
                value === "0"
            ) {

                return safeT("common.off");

            }

            return (

                String(
                    value
                ) +

                " ms"

            );

        //--------------------------------------------------
        // JSON
        //--------------------------------------------------

        case "json":

            if (
                typeof value === "string"
            ) {

                return value;

            }

            return JSON.stringify(

                value,

                null,

                2

            );

        //--------------------------------------------------
        // ENUM
        //--------------------------------------------------

        case "enum":

            if (
                field.enumLabels &&
                field.enumLabels[value]
            ) {

                return field.enumLabels[
                    value
                ];

            }

            return String(
                value
            );

        //--------------------------------------------------
        // DEFAULT
        //--------------------------------------------------

        default:

            return String(
                value
            );

    }

}

// =====================================================
// EDITABLE VALUE NORMALIZATION
// =====================================================

function normalizeEditableValue(
    field,
    value
) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }

    switch (
        field.type
    ) {

        case "checkbox":

        case "boolean":

            return (

                value === true ||

                value === "true" ||

                value === 1 ||

                value === "1"

            );

        case "num":

        case "number":

            if (
                value === ""
            ) {

                return "";

            }

            return Number(
                value
            );

        default:

            return String(
                value
            );

    }

}

// =====================================================
// FORM COLLECTION
// =====================================================

function collectSchemaValues(
    containerId
) {

    const container =
        document.getElementById(
            containerId
        );

    const result =
        {};

    if (
        !container
    ) {

        return result;

    }

    container
        .querySelectorAll(
            "[data-key]"
        )
        .forEach(
            el => {

                const key =
                    el.dataset.key;

                if (
                    !key
                ) {

                    return;

                }

                //--------------------------------------------------
                // readonly
                //--------------------------------------------------

                if (
                    el.classList.contains(
                        "schema-value"
                    )
                ) {

                    const stored =
                        el.dataset.value;

                    const value =

                        stored === undefined

                            ? ""

                            : parseStoredValue(
                                stored
                            );

                    setValueByPath(

                        result,

                        key,

                        value

                    );

                    return;

                }

                //--------------------------------------------------
                // checkbox
                //--------------------------------------------------

                if (
                    el.type === "checkbox"
                ) {

                    setValueByPath(

                        result,

                        key,

                        el.checked

                    );

                    return;

                }

                //--------------------------------------------------
                // input/select
                //--------------------------------------------------

                let value =
                    el.value;

                //
                // Preserve numeric fields
                // as numbers.
                //

                const field =
                    el.closest(
                        ".schema-field"
                    );

                if (
                    field &&
                    el.type === "number"
                ) {

                    if (
                        value === ""
                    ) {

                        value =
                            "";

                    } else {

                        value =
                            Number(
                                value
                            );

                    }

                }

                setValueByPath(

                    result,

                    key,

                    value

                );

            }

        );

    return result;

}

// =====================================================
// SCHEMA HELPERS
// =====================================================

function getSchemaField(
    schema,
    key
) {

    if (
        !schema
    ) {

        return null;

    }

    //
    // Legacy sections
    //

    if (
        Array.isArray(
            schema.sections
        )
    ) {

        for (
            const section of schema.sections
        ) {

            for (
                const field of (
                    section.fields ||
                    []
                )
            ) {

                const found =
                    findFieldRecursive(
                        field,
                        key
                    );

                if (
                    found
                ) {

                    return found;

                }

            }

        }

    }

    //
    // Current fields
    //

    if (
        Array.isArray(
            schema.fields
        )
    ) {

        for (
            const field of schema.fields
        ) {

            const found =
                findFieldRecursive(
                    field,
                    key
                );

            if (
                found
            ) {

                return found;

            }

        }

    }

    return null;

}

// =====================================================
// COMPOSITE FIELD
// =====================================================

function renderCompositeField(
    field,
    value,
    mode,
    allValues = {}
) {

    const container =
        document.createElement(
            "div"
        );

    container.className =
        "schema-composite";

    //
    // Add semantic type class.
    //
    // Example:
    //
    // type: "address"
    //
    // becomes:
    //
    // schema-composite schema-composite-address
    //
    // This allows CSS to provide a
    // specialized compact layout
    // without hard-coding individual
    // schema field keys.
    //

    if (
        field.type
    ) {

        const typeClass =

            String(
                field.type
            )
                .trim()
                .toLowerCase()
                .replace(
                    /[^a-z0-9_-]/g,
                    "-"
                );

        if (
            typeClass
        ) {

            container.classList.add(

                "schema-composite-" +

                typeClass

            );

        }

    }

    //
    // Composite title.
    //
    // The title uses the same shared
    // header logic as ordinary fields.
    //
    // This means composite headers now
    // support:
    //
    // - help / helpKey / tooltipKey
    // - info / infoKey
    //
    // directly in the composite title.
    //

    if (
        field.title ||
        field.titleKey ||
        field.labelKey ||
        field.label
    ) {

        const title =

            renderFieldHeader(

                field,

                "schema-composite-title"

            );

        container.appendChild(
            title
        );

    }

    //
    // Render children
    //

    for (
        const child of (
            field.children ||
            []
        )
    ) {

        const childKey =

            field.key +

            "." +

            child.key;

        const childValue =

            value &&

            typeof value === "object"

                ? value[
                    child.key
                ]

                : undefined;

        container.appendChild(

            renderField(

                {

                    ...child,

                    key:
                        childKey

                },

                childValue,

                mode,

                allValues

            )

        );

    }

    return container;

}

// =====================================================
// CONDITIONAL VISIBILITY
// =====================================================

function bindSchemaVisibility(
    schema,
    container
) {

    container
        .querySelectorAll(
            "input[data-key], select[data-key]"
        )
        .forEach(
            input => {

                input.addEventListener(

                    "change",

                    () => {

                        updateSchemaVisibility(

                            schema,

                            container

                        );

                    }

                );

            }

        );

}

// =====================================================
// UPDATE SCHEMA VISIBILITY
// =====================================================

function updateSchemaVisibility(
    schema,
    container
) {

    if (
        !schema ||
        !container
    ) {

        return;

    }

    const values =
        collectSchemaValues(
            container.id
        );

    const fields =
        getAllSchemaFields(
            schema
        );

    for (
        const field of fields
    ) {

        if (
            !field.enabled_when
        ) {

            continue;

        }

        //
        // Composite fields are represented
        // by their root wrapper.
        //

        const fieldElement =

            container.querySelector(

                `[data-key="${field.key}"]`

            ) ||

            container.querySelector(

                `[data-schema-key="${field.key}"]`

            );

        if (
            !fieldElement
        ) {

            continue;

        }

        const wrapper =

            fieldElement.closest(

                ".schema-field"

            ) || fieldElement;

        const enabled =

            SchemaConditions.matches(

                field.enabled_when,

                values

            );

        wrapper.style.display =

            enabled

                ? ""

                : "none";

    }

}

// =====================================================
// GET ALL SCHEMA FIELDS
// =====================================================

function getAllSchemaFields(
    schema
) {

    const result =
        [];

    if (
        !schema
    ) {

        return result;

    }

    const roots =

        Array.isArray(
            schema.fields
        )

            ? schema.fields

            : Array.isArray(
                schema.sections
            )

                ? schema.sections.flatMap(

                    section =>

                        section.fields ||
                        []

                )

                : [];

    for (
        const field of roots
    ) {

        collectFieldRecursive(

            field,

            result

        );

    }

    return result;

}

// =====================================================
// COLLECT FIELD RECURSIVELY
// =====================================================

function collectFieldRecursive(
    field,
    result
) {

    if (
        !field
    ) {

        return;

    }

    result.push(
        field
    );

    for (
        const child of (
            field.children ||
            []
        )
    ) {

        collectFieldRecursive(

            child,

            result

        );

    }

}

// =====================================================
// FIND FIELD RECURSIVELY
// =====================================================

function findFieldRecursive(
    field,
    key
) {

    if (
        !field
    ) {

        return null;

    }

    if (
        field.key === key
    ) {

        return field;

    }

    for (
        const child of (
            field.children ||
            []
        )
    ) {

        const found =

            findFieldRecursive(

                child,

                key

            );

        if (
            found
        ) {

            return found;

        }

    }

    return null;

}

// =====================================================
// VALUE PATH HELPERS
// =====================================================

function getValueByPath(
    object,
    path
) {

    if (
        !object ||
        !path
    ) {

        return undefined;

    }

    const parts =

        String(
            path
        ).split(
            "."
        );

    let current =
        object;

    for (
        const part of parts
    ) {

        if (
            current === undefined ||
            current === null
        ) {

            return undefined;

        }

        current =
            current[
                part
            ];

    }

    return current;

}

// =====================================================
// SET VALUE BY PATH
// =====================================================

function setValueByPath(
    object,
    path,
    value
) {

    if (
        !object ||
        !path
    ) {

        return;

    }

    const parts =

        String(
            path
        ).split(
            "."
        );

    let current =
        object;

    for (
        let index = 0;

        index <
        parts.length - 1;

        index++
    ) {

        const part =
            parts[index];

        if (
            !current[part] ||
            typeof current[part] !==
                "object"
        ) {

            current[part] =
                {};

        }

        current =
            current[part];

    }

    current[
        parts[
            parts.length - 1
        ]
    ] =
        value;

}

// =====================================================
// PARSE STORED VALUE
// =====================================================

function parseStoredValue(
    value
) {

    if (
        value === undefined
    ) {

        return "";

    }

    try {

        return JSON.parse(
            value
        );

    } catch (
        error
    ) {

        return value;

    }

}

// =====================================================
// EXPORTS
// =====================================================

window.renderSchema =
    renderSchema;

window.collectSchemaValues =
    collectSchemaValues;

window.getSchemaField =
    getSchemaField;

window.SchemaRenderer = {

    render(

        schema,

        containerId,

        values = {},

        mode = "editable"

    ) {

        return renderSchema(

            schema,

            containerId,

            values,

            mode

        );

    },

    collect(

        containerId

    ) {

        return collectSchemaValues(

            containerId

        );

    },

    getField(

        schema,

        key

    ) {

        return getSchemaField(

            schema,

            key

        );

    }

};