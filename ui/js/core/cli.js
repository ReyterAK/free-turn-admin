//
// FreeTurn Admin
// CLI Engine
// Release 1.0.0
//

// =====================================================
// HELPERS
// =====================================================

function normalizeKey(key) {
    return String(key).replace(/-/g, "_");
}

function denormalizeKey(key) {
    return String(key).replace(/_/g, "-");
}

// =====================================================
// SCHEMA LOOKUP
// =====================================================

function getSchemaField(schema, key) {

    for (const section of schema.sections) {

        for (const field of section.fields) {

            if (field.key === key)
                return field;

        }

    }

    return null;
}

// =====================================================
// CLI → OBJECT
// =====================================================

function parseArgs(text) {

    const result = {};

    if (!text)
        return result;

    const lines = text
        .split(/\r?\n/)
        .map(x => x.trim())
        .filter(x => x.length);

    for (let i = 0; i < lines.length; i++) {

        const line = lines[i];

        if (!line.startsWith("-"))
            continue;

        const cliKey = line.substring(1);

        let value = true;

        if (
            i + 1 < lines.length &&
            !lines[i + 1].startsWith("-")
        ) {
            value = lines[++i];
        }

        result[normalizeKey(cliKey)] = value;

    }

    return result;
}

// =====================================================
// HYDRATE
// =====================================================

function hydrateSchema(schema, parsed) {

    const values = {};

    schema.sections.forEach(section => {

        section.fields.forEach(field => {

            const cliKey =
                normalizeKey(
                    field.cli || field.key
                );

            if (parsed[cliKey] !== undefined) {

                values[field.key] =
                    parsed[cliKey];

                return;

            }

            if (field.default !== undefined) {

                values[field.key] =
                    field.default;

                return;

            }

            switch (field.type) {

                case "checkbox":
                    values[field.key] = false;
                    break;

                default:
                    values[field.key] = "";

            }

        });

    });

    return values;

}

// =====================================================
// OBJECT → CLI
// =====================================================

function buildArgs(schema, values) {

    const out = [];

    schema.sections.forEach(section => {

        section.fields.forEach(field => {

            const cli =
                field.cli ||
                denormalizeKey(field.key);

            const value =
                values[field.key];

            const def =
                field.default;

            const required =
                field.required === true;

            //------------------------------------------------
            // checkbox
            //------------------------------------------------

            if (field.type === "checkbox") {

                if (value)
                    out.push("-" + cli);

                return;

            }

            //------------------------------------------------
            // defaults
            //------------------------------------------------

            if (
                !required &&
                (
                    value === undefined ||
                    value === "" ||
                    value === def
                )
            ) {
                return;
            }

            out.push("-" + cli);
            out.push(String(value));

        });

    });

    return out.join("\n");

}

// =====================================================
// FIELD NORMALIZATION
// =====================================================

function normalizeFieldValue(field, value) {

    if (value === undefined || value === null) {

        if (field.default !== undefined)
            value = field.default;

    }

    switch (field.type) {

        case "checkbox":

            return (
                value === true ||
                value === "true" ||
                value === "1" ||
                value === 1
            );

        case "number":

            if (
                value === "" ||
                value === undefined ||
                value === null
            )
                return "";

            return Number(value);

        default:

            if (
                value === undefined ||
                value === null
            )
                return "";

            return String(value);

    }

}