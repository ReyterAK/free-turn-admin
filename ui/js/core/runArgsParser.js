//
// RunArgs Parser
// Release 1.0.0
//
// Parses run.args
// into structured settings
//

"use strict";


const RunArgsParser = {


    parse(
        schema,
        text
    ) {


        const tokens =
            this.tokenize(text);


        const settings =
            {};


        for (
            const field of schema.fields
        ) {


            this.parseField(
                field,
                tokens,
                settings
            );


        }


        return settings;


    },



    tokenize(
        text
    ) {


        if (
            !text ||
            typeof text !== "string"
        ) {


            return [];


        }



        return text

            .split(/\r?\n/)

            .map(
                line =>
                    line.trim()
            )

            .filter(
                line =>
                    line.length > 0
            );


    },



    parseField(
        field,
        tokens,
        settings
    ) {


        if (
            !field.cli
        ) {


            return;


        }



        const index =
            tokens.indexOf(
                field.cli
            );



        if (
            index < 0
        ) {


            return;


        }



        //
        // Boolean flag
        //

        if (
            field.type === "boolean"
        ) {


            if (
                index + 1 < tokens.length &&
                this.isBooleanValue(
                    tokens[index + 1]
                )
            ) {


                this.assign(
                    field,
                    this.parseBoolean(
                        tokens[index + 1]
                    ),
                    settings
                );


            } else {


                this.assign(
                    field,
                    true,
                    settings
                );


            }


            return;


        }



        //
        // Value
        //

        if (
            index + 1 >= tokens.length
        ) {


            return;


        }



        this.assign(

            field,

            this.parseValue(
                field,
                tokens[index + 1]
            ),

            settings

        );


    },



    parseValue(
        field,
        value
    ) {
    
    
        switch (
            field.type
        ) {
    
    
            case "address":
            {
    
    
                const parts =
                    String(value)
                        .split(":");
    
    
    
                return {
    
                    host:
                        parts[0] || "",
    
    
                    port:
                        Number(parts[1]) || 0
    
                };
    
    
            }
    
    
    
            case "boolean":
    
    
                return this.parseBoolean(
                    value
                );
    
    
    
            case "num":
            {
    
    
                const match =
                    String(value).match(
                        /\d+/
                    );
    
    
                if (
                    !match
                ) {
    
                    return 0;
    
                }
    
    
                return Number(
                    match[0]
                );
    
            }
    
    
    
            default:
    
    
                return value;
    
    
        }
    
    
    },



    isBooleanValue(
        value
    ) {


        return (
            value === "true" ||
            value === "false" ||
            value === "1" ||
            value === "0"
        );


    },



    parseBoolean(
        value
    ) {


        return (
            value === true ||
            value === "true" ||
            value === "1" ||
            value === 1
        );


    },



    assign(
        field,
        value,
        settings
    ) {


        settings[field.key] =
            value;


    }


};



window.RunArgsParser =
    RunArgsParser;