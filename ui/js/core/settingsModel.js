//
// Settings Model
// Release 1.0.0
//
// Converts schema values
// into structured settings object
//
// Responsibilities:
//
// - build settings object from UI values
// - convert field types
// - flatten settings
// - clone settings
//

"use strict";



const SettingsModel = {



    //
    // Build structured object
    //
    // Example input from SchemaRenderer.collect():
    //
    // {
    //     external: {
    //         host: "example.com",
    //         port: 56566
    //     },
    //
    //     listen: {
    //         host: "0.0.0.0",
    //         port: 56000
    //     },
    //
    //     backend: {
    //         host: "127.0.0.1",
    //         port: 443
    //     },
    //
    //     mode: "udp"
    // }
    //
    // Result:
    //
    // {
    //     external: {
    //         host: "example.com",
    //         port: 56566
    //     },
    //
    //     listen: {
    //         host: "0.0.0.0",
    //         port: 56000
    //     },
    //
    //     backend: {
    //         host: "127.0.0.1",
    //         port: 443
    //     },
    //
    //     mode: "udp"
    // }
    //
    // Nested values are read using paths.
    //


    build(
        schema,
        values = {}
    ) {


        const result =
            {};



        if (
            !schema ||
            !schema.fields
        ) {


            console.error(
                "[SettingsModel] invalid schema",
                schema
            );


            return result;

        }



        for (
            const field of schema.fields
        ) {


            this.processField(
                result,
                field,
                values
            );

        }



        return result;

    },




    //
    // Process field
    //
    // Supports:
    //
    // external.host
    // external.port
    // listen.host
    // listen.port
    // backend.host
    // backend.port
    //
    // Values are read from nested objects.
    //

    processField(
        target,
        field,
        values
    ) {


        //
        // Nested object
        //

        if (
            Array.isArray(
                field.children
            )
        ) {


            target[field.key] =
                {};



            for (
                const child of field.children
            ) {


                const path =
                    field.key +
                    "." +
                    child.key;



                const value =
                    this.getValueByPath(
                        values,
                        path
                    );



                target[field.key][child.key] =

                    this.convertValue(
                        child,
                        value
                    );

            }



            return;

        }



        //
        // Simple value
        //

        target[field.key] =

            this.convertValue(

                field,

                this.getValueByPath(
                    values,
                    field.key
                )

            );

    },




    //
    // Get nested value by path
    //
    // Example:
    //
    // values:
    //
    // {
    //     external: {
    //         host: "example.com"
    //     }
    // }
    //
    // path:
    //
    // external.host
    //
    // returns:
    //
    // example.com
    //

    getValueByPath(
        object,
        path
    ) {


        if (
            object === undefined ||
            object === null ||
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

    },




    //
    // Convert value according to field type
    //

    convertValue(
        field,
        value
    ) {


        //
        // Keep empty values unchanged
        //

        if (
            value === undefined ||
            value === null
        ) {

            return value;

        }



        switch(
            field.type
        ) {



            case "num":

            case "number":


                //
                // Empty string must remain empty.
                // This allows validator to detect
                // missing required numeric values.
                //

                if (
                    value === ""
                ) {


                    return "";

                }



                return Number(
                    value
                );



            case "checkbox":

            case "boolean":


                return (

                    value === true ||

                    value === "true" ||

                    value === "1" ||

                    value === 1

                );



            default:


                return value;

        }


    },




    //
    // Deep clone
    //

    clone(
        object
    ) {


        return JSON.parse(

            JSON.stringify(
                object
            )

        );

    },




    //
    // Flatten structured settings
    //
    // {
    //     external: {
    //         host: "example.com",
    //         port: 56566
    //     }
    // }
    //
    // becomes:
    //
    // {
    //     "external.host": "example.com",
    //     "external.port": 56566
    // }
    //

    flatten(
        settings
    ) {


        const result =
            {};



        const walk =
            (
                object,
                prefix = ""
            ) => {


                if (
                    object === undefined ||
                    object === null
                ) {


                    return;

                }



                for (
                    const key of Object.keys(
                        object
                    )
                ) {


                    const value =
                        object[key];



                    const path =

                        prefix

                            ? prefix +
                              "." +
                              key

                            : key;



                    if (
                        value !== null &&

                        typeof value ===
                            "object" &&

                        !Array.isArray(
                            value
                        )
                    ) {


                        walk(

                            value,

                            path

                        );


                    } else {


                        result[path] =
                            value;

                    }

                }

            };



        walk(
            settings
        );



        return result;

    }


};



window.SettingsModel =
    SettingsModel;