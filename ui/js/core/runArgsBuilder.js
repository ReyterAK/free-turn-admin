//
// RunArgs Builder
// Release 1.0.0
//
// Builds complete run.args
// from server settings.
//

"use strict";


const RunArgsBuilder = {


    //
    // Build complete CLI arguments
    //

    build(
        schema,
        settings
    ) {

        const args = [];


        if (
            !schema ||
            !schema.fields
        ) {

            console.error(
                "[RunArgsBuilder] invalid schema",
                schema
            );

            return args;

        }



        for (
            const field of schema.fields
        ) {

            this.processField(
                field,
                settings,
                args
            );

        }



        return args;

    },



    //
    // Process field
    //

    processField(
        field,
        settings,
        args
    ) {


        //
        // Not a CLI option
        //

        if (
            !field.cli
        ) {

            return;

        }



        //
        // Hidden by conditions
        //

        if (
            field.enabled_when &&
            !SchemaConditions.matches(
                field.enabled_when,
                settings
            )
        ) {

            return;

        }



        const value =
            this.getValueByPath(
                settings,
                field.key
            );



        this.append(
            args,
            field,
            value
        );

    },



    //
    // Get nested value
    //
    // "listen.port"
    // =>
    // settings.listen.port
    //

    getValueByPath(
        obj,
        path
    ) {

        return path
            .split(".")
            .reduce(
                (current, key) =>
                    current?.[key],
                obj
            );

    },



    //
    // Append one argument
    //

    append(
        args,
        field,
        value
    ) {


        const mode =
            field.cliMode || "argument";



        switch (
            mode
        ) {



            //
            // Boolean flag
            //

            case "flag":


                if (
                    value
                ) {

                    args.push(
                        field.cli
                    );

                }


                return;



            //
            // Boolean with value
            //

            case "value":


                if (
                    value
                ) {

                    args.push(
                        field.cli
                    );


                    args.push(
                        field.cliValue
                    );

                }


                return;



            //
            // Ordinary argument
            //

            default:


                if (
                    value === undefined ||
                    value === null
                ) {

                    return;

                }


                args.push(
                    field.cli
                );


                args.push(
                    this.formatValue(
                        field,
                        value
                    )
                );

        }


    },



    //
    // Format value
    //

    formatValue(
        field,
        value
    ) {


        //
        // Obfuscation packet timing
        //
        // UI stores numeric milliseconds.
        // CLI expects Go duration format.
        //
        // 0  -> 0
        // 10 -> 10ms
        // 20 -> 20ms
        //

        if (
            field.key === "obf_timing"
        ) {


            if (
                Number(value) === 0
            ) {

                return "0";

            }


            return (
                String(value) +
                "ms"
            );

        }



        switch (
            field.type
        ) {



            case "address":


                if (
                    !value ||
                    !value.host ||
                    !value.port
                ) {

                    return "";

                }


                return (
                    value.host +
                    ":" +
                    value.port
                );



            default:


                return String(
                    value
                );


        }


    }


};


window.RunArgsBuilder =
    RunArgsBuilder;