//
// FreeTurn Admin
// Settings Validator
// Release 1.0.0
//
// Validates server settings against schema.
//
// Responsibilities:
//
// - validate required fields
// - validate field types
// - validate min / max ranges
// - validate enabled_when conditions
// - validate nested fields
// - validate cross-field dependencies
// - resolve values from root settings
// - preserve source-aware default handling
//

"use strict";

// =====================================================
// SETTINGS VALIDATOR
// =====================================================

const SettingsValidator = {


// =====================================================
// PUBLIC VALIDATION
// =====================================================


validate(
    schema,
    settings,
    sources = {},
    state = {}
) {


    const errors =
        [];


    //
    // Read error
    //
    // A settings read error is a validation error
    // because the current configuration cannot be
    // trusted as a valid source of settings.
    //

    if (
        state.readError
    ) {


        errors.push(
            {
                field:
                    "settings",

                message:
                    "Settings load error"
            }
        );

    }



    //
    // Validate schema
    //

    if (
        !schema ||
        !Array.isArray(
            schema.fields
        )
    ) {


        return {

            valid:
                false,

            errors:
            [
                {
                    field:
                        "settings",

                    message:
                        "Invalid settings schema"
                }
            ]

        };

    }



    //
    // Validate every root field
    //

    for (
        const field of schema.fields
    ) {


        this.validateField(
            field,
            settings,
            errors,
            "",
            settings,
            sources,
            state
        );

    }



    //
    // Validate dependencies between fields.
    //
    // Example:
    //
    // spc cannot be greater than n.
    //

    this.validateCrossFields(
        schema,
        settings,
        errors
    );



    return {

        valid:
            errors.length === 0,

        errors

    };

},




// =====================================================
// FIELD VALIDATION
// =====================================================


validateField(
    field,
    parentValue,
    errors,
    path = "",
    rootSettings = {},
    sources = {},
    state = {}
) {


    if (
        !field ||
        !field.key
    ) {

        return;

    }



    //
    // Build current field path
    //
    // Example:
    //
    // external
    // external.host
    // external.port
    //

    const currentPath =
        path
            ?
                path +
                "." +
                field.key
            :
                field.key;



    //
    // Current value
    //

    const value =
        parentValue &&
        typeof parentValue === "object"
            ?
                parentValue[field.key]
            :
                undefined;



    //
    // Nested object
    //

    if (
        Array.isArray(
            field.children
        )
    ) {


        //
        // If the parent object itself is disabled,
        // its children do not require validation.
        //

        if (
            !this.isEnabled(
                field,
                rootSettings
            )
        ) {

            return;

        }



        //
        // Validate every child
        //

        for (
            const child of field.children
        ) {


            this.validateField(
                child,
                value,
                errors,
                currentPath,
                rootSettings,
                sources,
                state
            );

        }



        return;

    }



    //
    // Enabled check
    //
    // Conditions are evaluated against the complete
    // root settings object.
    //

    if (
        !this.isEnabled(
            field,
            rootSettings
        )
    ) {

        return;

    }



    //
    // Source information
    //
    // Example:
    //
    // sources["external.host"] === "default"
    //

    const source =
        sources[currentPath];



    //
    // Default empty value
    //
    // If the value originates from a default and is
    // intentionally empty, do not report it as a
    // required-field error.
    //

    if (
        source === "default" &&
        this.isEmpty(
            value
        )
    ) {

        return;

    }



    //
    // Required
    //

    if (
        field.required &&
        this.isEmpty(
            value
        )
    ) {


        errors.push(
            {
                field:
                    currentPath,

                message:
                    field.error ||
                    "Required field is empty"
            }
        );


        return;

    }



    //
    // Optional empty value
    //
    // Empty optional fields do not need type or
    // range validation.
    //

    if (
        this.isEmpty(
            value
        )
    ) {

        return;

    }



    //
    // Type validation
    //

    this.validateType(
        field,
        value,
        currentPath,
        errors
    );



    //
    // Range validation
    //

    this.validateRange(
        field,
        value,
        currentPath,
        errors
    );

},




// =====================================================
// CROSS-FIELD VALIDATION
// =====================================================


validateCrossFields(
    schema,
    settings,
    errors
) {


    //
    // URI generation settings
    //
    // spc = streams per VK account cache
    // n   = total parallel TURN streams
    //
    // spc cannot exceed n.
    //

    if (
        schema ===
        window.UriGenerationSettingsSchema
    ) {


        const n =
            Number(
                settings?.n
            );


        const spc =
            Number(
                settings?.spc
            );


        if (
            Number.isFinite(n) &&
            Number.isFinite(spc) &&
            spc > n
        ) {


            errors.push(
                {
                    field:
                        "spc",

                    message:
                        "Value cannot be greater than n"
                }
            );

        }

    }

},




// =====================================================
// ENABLED WHEN
// =====================================================


isEnabled(
    field,
    rootSettings
) {


    //
    // No condition
    //

    if (
        !field ||
        !field.enabled_when
    ) {

        return true;

    }



    //
    // Use the shared SchemaConditions implementation.
    //
    // This guarantees that UI rendering,
    // validation and CLI generation use the
    // same condition semantics.
    //

    if (
        window.SchemaConditions &&
        typeof
            window.SchemaConditions.matches ===
            "function"
    ) {


        return SchemaConditions.matches(
            field.enabled_when,
            rootSettings
        );

    }



    //
    // Fallback.
    //
    // This should normally never be required,
    // but keeps validation safe if SchemaConditions
    // has not yet been loaded.
    //

    for (
        const key of Object.keys(
            field.enabled_when
        )
    ) {


        const expected =
            field.enabled_when[key];


        const actual =
            this.getValueByPath(
                rootSettings,
                key
            );



        if (
            !this.matchCondition(
                actual,
                expected
            )
        ) {

            return false;

        }

    }



    return true;

},




// =====================================================
// CONDITION MATCHING FALLBACK
// =====================================================


matchCondition(
    actual,
    expected
) {


    //
    // Array means allowed values.
    //

    if (
        Array.isArray(
            expected
        )
    ) {

        return expected.includes(
            actual
        );

    }



    //
    // String beginning with "!"
    // means negation.
    //

    if (
        typeof expected === "string" &&
        expected.startsWith("!")
    ) {


        return (
            actual !==
            expected.substring(1)
        );

    }



    //
    // Direct comparison
    //

    return (
        actual ===
        expected
    );

},




// =====================================================
// TYPE VALIDATION
// =====================================================


validateType(
    field,
    value,
    path,
    errors
) {


    switch (
        field.type
    ) {


        //
        // NUMBER
        //

        case "num":

        case "number":


            if (
                !this.isNumeric(
                    value
                )
            ) {


                errors.push(
                    {
                        field:
                            path,

                        message:
                            "Value must be numeric"
                    }
                );

            }


            break;



        //
        // HEX KEY
        //

        case "hex_key":


            if (
                !this.isHexKey(
                    value
                )
            ) {


                errors.push(
                    {
                        field:
                            path,

                        message:
                            "Value must be hexadecimal"
                    }
                );

            }


            break;



        //
        // IPv4
        //

        case "ip":


            if (
                !this.isIp(
                    value
                )
            ) {


                errors.push(
                    {
                        field:
                            path,

                        message:
                            "Invalid IP address"
                    }
                );

            }


            break;



        //
        // IPv4 OR HOSTNAME
        //

        case "ip_name":


            if (
                !this.isIpOrHostname(
                    value
                )
            ) {


                errors.push(
                    {
                        field:
                            path,

                        message:
                            "Invalid IP address or hostname"
                    }
                );

            }


            break;



        //
        // IP LIST
        //
        // Format:
        //
        // ip[:port][,ip[:port]...]
        //
        // Examples:
        //
        // 1.1.1.1
        // 1.1.1.1,8.8.8.8
        // 1.1.1.1:53,8.8.8.8:53
        //

        case "ip_list":


            if (
                !this.isIpList(
                    value
                )
            ) {


                errors.push(
                    {
                        field:
                            path,

                        message:
                            "Invalid IP address list"
                    }
                );

            }


            break;



        //
        // BOOLEAN
        //

        case "checkbox":

        case "boolean":


            if (
                !this.isBoolean(
                    value
                )
            ) {


                errors.push(
                    {
                        field:
                            path,

                        message:
                            "Value must be boolean"
                    }
                );

            }


            break;



        //
        // SELECT
        //

        case "select":


            if (
                Array.isArray(
                    field.options
                ) &&
                !field.options.includes(
                    value
                )
            ) {


                errors.push(
                    {
                        field:
                            path,

                        message:
                            "Invalid option"
                    }
                );

            }


            break;



        //
        // ADDRESS
        //
        // Composite address fields are normally
        // validated through their children.
        //

        case "address":


            break;



        //
        // STRING / TEXT
        //

        case "text":

        case "string":

        case "password":

        case "button":


            break;



        //
        // UNKNOWN
        //
        // Unknown field types are not rejected here.
        // This allows schema extensions without
        // breaking validation.
        //

        default:


            break;

    }

},




// =====================================================
// RANGE VALIDATION
// =====================================================


validateRange(
    field,
    value,
    path,
    errors
) {


    //
    // No range restrictions
    //

    if (
        field.min === undefined &&
        field.max === undefined
    ) {

        return;

    }



    //
    // Convert to number
    //

    const num =
        Number(
            value
        );



    //
    // Invalid number
    //
    // Type validation will report the more appropriate
    // error message.
    //

    if (
        Number.isNaN(
            num
        )
    ) {

        return;

    }



    //
    // Minimum
    //

    if (
        field.min !== undefined &&
        num < field.min
    ) {


        errors.push(
            {
                field:
                    path,

                message:
                    "Value below minimum"
            }
        );

    }



    //
    // Maximum
    //

    if (
        field.max !== undefined &&
        num > field.max
    ) {


        errors.push(
            {
                field:
                    path,

                message:
                    "Value above maximum"
            }
        );

    }

},




// =====================================================
// VALUE HELPERS
// =====================================================


isEmpty(
    value
) {


    return (
        value === undefined ||
        value === null ||
        value === ""
    );

},




isNumeric(
    value
) {


    if (
        value === "" ||
        value === null ||
        value === undefined
    ) {

        return false;

    }



    return Number.isFinite(
        Number(
            value
        )
    );

},




isBoolean(
    value
) {


    return (
        value === true ||
        value === false ||
        value === "true" ||
        value === "false" ||
        value === 1 ||
        value === 0 ||
        value === "1" ||
        value === "0"
    );

},




isHexKey(
    value
) {


    return (
        typeof value === "string" &&
        /^[0-9a-fA-F]+$/.test(
            value
        )
    );

},




// =====================================================
// VALUE BY PATH
// =====================================================


getValueByPath(
    object,
    path
) {


    if (
        !object ||
        !path
    ) {

        return undefined;

    }



    return path
        .split(".")
        .reduce(
            (
                current,
                key
            ) => {


                if (
                    current === undefined ||
                    current === null
                ) {

                    return undefined;

                }


                return current[key];

            },
            object
        );

},




// =====================================================
// IPv4 VALIDATION
// =====================================================


isIp(
    value
) {


    const parts =
        String(
            value
        )
        .trim()
        .split(".");


    if (
        parts.length !== 4
    ) {

        return false;

    }



    return parts.every(
        part => {


            if (
                !/^\d+$/.test(
                    part
                )
            ) {

                return false;

            }



            const number =
                Number(
                    part
                );


            return (
                number >= 0 &&
                number <= 255
            );

        }
    );

},




// =====================================================
// IPv4 LIST VALIDATION
// =====================================================


isIpList(
    value
) {


    if (
        typeof value !== "string"
    ) {

        return false;

    }



    const text =
        value.trim();



    //
    // Empty value is handled by
    // required / optional validation
    // before this method is called.
    //

    if (
        !text
    ) {

        return false;

    }



    //
    // Split list by comma.
    //

    const entries =
        text
            .split(",")
            .map(
                entry =>
                    entry.trim()
            );



    //
    // Reject empty entries.
    //
    // Example:
    //
    // 1.1.1.1,,8.8.8.8
    //

    if (
        entries.some(
            entry =>
                !entry
        )
    ) {

        return false;

    }



    //
    // Validate every entry.
    //

    return entries.every(
        entry => {


            //
            // Plain IPv4.
            //

            if (
                this.isIp(
                    entry
                )
            ) {

                return true;

            }



            //
            // IPv4 with port.
            //

            const match =
                entry.match(
                    /^(.+):(\d+)$/
                );



            if (
                !match
            ) {

                return false;

            }



            const ip =
                match[1];


            const port =
                Number(
                    match[2]
                );



            //
            // Validate IPv4.
            //

            if (
                !this.isIp(
                    ip
                )
            ) {

                return false;

            }



            //
            // Validate port.
            //

            return (
                Number.isInteger(
                    port
                ) &&
                port >= 1 &&
                port <= 65535
            );

        }
    );

},




// =====================================================
// IPv4 OR HOSTNAME VALIDATION
// =====================================================


isIpOrHostname(
    value
) {


    const text =
        String(
            value
        )
        .trim();



    //
    // Empty
    //

    if (
        !text
    ) {

        return false;

    }



    //
    // Valid IPv4
    //

    if (
        this.isIp(
            text
        )
    ) {

        return true;

    }



    //
    // Reject malformed IPv4-like values
    //

    if (
        /^\d+(?:\.\d+){3}$/.test(
            text
        )
    ) {

        return false;

    }



    //
    // localhost
    //

    if (
        text === "localhost"
    ) {

        return true;

    }



    //
    // Hostname length
    //

    if (
        text.length > 253
    ) {

        return false;

    }



    //
    // Hostname labels
    //

    const labels =
        text.split(".");


    return labels.every(
        label => {


            if (
                label.length < 1 ||
                label.length > 63
            ) {

                return false;

            }



            if (
                !/^[a-zA-Z0-9-]+$/.test(
                    label
                )
            ) {

                return false;

            }



            if (
                label.startsWith("-") ||
                label.endsWith("-")
            ) {

                return false;

            }



            return true;

        }
    );

}

};

// =====================================================
// GLOBAL EXPORT
// =====================================================

window.SettingsValidator =
SettingsValidator;
