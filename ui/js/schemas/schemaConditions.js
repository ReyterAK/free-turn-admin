//
// FreeTurn Admin
// Schema Conditions
// Release 1.0.0
//
// Evaluates schema conditions.
//
// Supported conditions:
// - enabled_when
// - required_when
// - visible_when
//
// Supports:
// - simple values
// - arrays of allowed values
// - negation with "!value"
// - nested paths
// - boolean/string compatibility
// - numeric/string compatibility
// - multiple conditions as AND
//


"use strict";


const SchemaConditions = {


    //
    // =====================================================
    // PUBLIC
    // =====================================================
    //
    // Evaluate complete condition object.
    //
    // Example:
    //
    // {
    //     obf_profile: [
    //         "rtpopus",
    //         "rtpopus2",
    //         "rtpopus3"
    //     ],
    //
    //     mode: [
    //         "udp"
    //     ]
    // }
    //
    // All fields must match.
    //


    matches(
        condition,
        settings
    ) {


        //
        // No condition -> always true
        //


        if (
            !condition ||
            typeof condition !== "object"
        ) {


            return true;

        }



        //
        // Missing settings object
        //


        if (
            !settings ||
            typeof settings !== "object"
        ) {


            settings =
                {};

        }



        //
        // Every condition must match.
        //


        for (
            const key of Object.keys(
                condition
            )
        ) {


            const actual =

                this.getValueByPath(

                    settings,

                    key

                );



            if (
                !this.matchField(

                    actual,

                    condition[key]

                )
            ) {


                return false;

            }

        }



        return true;

    },



    //
    // =====================================================
    // FIELD
    // =====================================================
    //
    // Evaluate one schema condition field.
    //


    matchField(
        actual,
        expected
    ) {


        return this.matchValue(

            actual,

            expected

        );

    },



    //
    // =====================================================
    // VALUE
    // =====================================================
    //
    // Evaluate one actual value against
    // one expected value or an array of values.
    //


    matchValue(
        actual,
        expected
    ) {


        //
        // Array:
        //
        // Any expected value may match.
        //


        if (
            Array.isArray(
                expected
            )
        ) {


            return expected.some(

                value =>

                    this.matchValue(

                        actual,

                        value

                    )

            );

        }



        //
        // Negation:
        //
        // "!udp"
        // "!false"
        // "!0"
        //
        // Means actual must NOT equal
        // the value after "!".
        //


        if (
            typeof expected === "string" &&
            expected.startsWith("!")
        ) {


            const negatedValue =

                expected.substring(
                    1
                );



            return !this.valuesEqual(

                actual,

                negatedValue

            );

        }



        //
        // Simple comparison.
        //


        return this.valuesEqual(

            actual,

            expected

        );

    },



    //
    // =====================================================
    // VALUE COMPARISON
    // =====================================================
    //
    // Compare schema values while allowing
    // equivalent primitive representations.
    //
    // Examples:
    //
    // true === "true"
    // 1 === "1"
    // 51820 === "51820"
    //
    // This is useful because DOM form values
    // are normally strings.
    //


    valuesEqual(
        actual,
        expected
    ) {


        //
        // Strict equality first.
        //


        if (
            actual === expected
        ) {


            return true;

        }



        //
        // Null / undefined are equivalent
        // only when both represent absence.
        //


        if (
            (
                actual === null ||
                actual === undefined
            )
            &&
            (
                expected === null ||
                expected === undefined
            )
        ) {


            return true;

        }



        //
        // Boolean compatibility.
        //


        if (
            typeof actual === "boolean"
        ) {


            if (
                expected === "true" ||
                expected === "1" ||
                expected === 1
            ) {


                return actual === true;

            }



            if (
                expected === "false" ||
                expected === "0" ||
                expected === 0
            ) {


                return actual === false;

            }

        }



        //
        // Reverse boolean compatibility.
        //


        if (
            typeof expected === "boolean"
        ) {


            if (
                actual === "true" ||
                actual === "1" ||
                actual === 1
            ) {


                return expected === true;

            }



            if (
                actual === "false" ||
                actual === "0" ||
                actual === 0
            ) {


                return expected === false;

            }

        }



        //
        // Numeric compatibility.
        //
        // Do not convert empty strings.
        //


        if (
            actual !== "" &&
            expected !== "" &&
            actual !== null &&
            expected !== null &&
            actual !== undefined &&
            expected !== undefined
        ) {


            const actualNumber =

                Number(
                    actual
                );


            const expectedNumber =

                Number(
                    expected
                );



            if (
                !Number.isNaN(
                    actualNumber
                )
                &&
                !Number.isNaN(
                    expectedNumber
                )
            ) {


                return (

                    actualNumber ===

                    expectedNumber

                );

            }

        }



        //
        // Final string comparison.
        //


        return (

            String(
                actual
            ) ===

            String(
                expected
            )

        );

    },



    //
    // =====================================================
    // GET VALUE BY PATH
    // =====================================================
    //
    // Supports:
    //
    // obf_profile
    // mode
    // external.host
    // external.port
    // backend.host
    // backend.port
    //
    // Example:
    //
    // getValueByPath(
    //     {
    //         external: {
    //             host: "example.com"
    //         }
    //     },
    //     "external.host"
    // )
    //
    // -> "example.com"
    //


    getValueByPath(
        settings,
        path
    ) {


        if (
            !settings ||
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
            settings;



        for (
            const part of parts
        ) {


            if (
                current === null ||
                current === undefined
            ) {


                return undefined;

            }



            if (
                typeof current !== "object"
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



};


window.SchemaConditions =
    SchemaConditions;