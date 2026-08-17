//
// serverSettingsSchemaAdapter.js
//
// Converts ServerSettingsSchema
// to SchemaRenderer format
//

"use strict";


const ServerSettingsSchemaAdapter = {



    build(
        schema
    ) {


        if (
            !schema ||
            !schema.groups ||
            !schema.fields
        ) {

            console.error(
                "[ServerSettingsSchemaAdapter] invalid schema",
                schema
            );


            return {
                sections: []
            };

        }



        return {

            sections:

                schema.groups.map(

                    group => ({

                        titleKey:
                            group.title,


                        fields:

                            schema.fields.filter(

                                field =>
                                    field.group === group.id

                            )

                    })

                )

        };


    },




    //
    // Convert nested settings
    // to SchemaRenderer values
    //
    // {
    //   external:{
    //      host:"x"
    //   }
    // }
    //
    // becomes
    //
    // {
    //   "external.host":"x"
    // }
    //

    flattenValues(
        values
    ) {


        const result =
            {};



        const walk =
            (
                obj,
                prefix = ""
            ) => {


                for (
                    const key of Object.keys(obj || {})
                ) {


                    const value =
                        obj[key];


                    const path =
                        prefix
                        ? prefix + "." + key
                        : key;



                    if (
                        value !== null
                        &&
                        typeof value === "object"
                        &&
                        !Array.isArray(value)
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



        walk(values);



        return result;

    },




    //
    // Convert SchemaRenderer values
    // back to settings object
    //

    expandValues(
        values
    ) {


        const result =
            {};



        for (
            const key in values
        ) {


            const parts =
                key.split(".");


            let current =
                result;



            parts.forEach(
                (
                    part,
                    index
                ) => {


                    if (
                        index === parts.length - 1
                    ) {


                        current[part] =
                            values[key];


                    } else {


                        current[part] =
                            current[part] || {};


                        current =
                            current[part];

                    }

                }
            );

        }



        return result;

    }


};



window.ServerSettingsSchemaAdapter =
    ServerSettingsSchemaAdapter;