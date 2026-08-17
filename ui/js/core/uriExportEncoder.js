//
// URI Export Encoder
// Release 1.0.0
//
// Encodes the final URI JSON payload
// into the freeturn:// share URI format.
//
// Responsibilities:
//
// - serialize JSON payload
// - encode UTF-8 data as Base64URL
// - remove Base64 padding
// - build final freeturn:// URI
//
// Does NOT:
//
// - load files
// - call APIs
// - collect export data
// - build payload fields
// - generate QR
//

"use strict";


const UriExportEncoder = {


    //
    // URI scheme
    //

    scheme:
        "freeturn://",



    //
    // Encode final payload
    //

    encode(
        payload
    ) {


        if (
            !payload ||
            typeof payload !== "object"
        ) {

            throw new Error(
                safeT("uri_export.invalid_json")
            );

        }



        //
        // Serialize payload.
        //

        const json =
            JSON.stringify(
                payload
            );



        //
        // Convert UTF-8 string
        // to Base64.
        //
        // unescape/encodeURIComponent is used
        // to correctly handle UTF-8 characters,
        // including client names in non-Latin scripts.
        //

        const binary =
            unescape(
                encodeURIComponent(
                    json
                )
            );



        const base64 =
            btoa(
                binary
            );



        //
        // Convert standard Base64
        // to Base64URL.
        //
        // Go equivalent:
        //
        // base64.RawURLEncoding
        //

        const base64url =
            base64
                .replace(
                    /\+/g,
                    "-"
                )
                .replace(
                    /\//g,
                    "_"
                )
                .replace(
                    /=+$/,
                    ""
                );



        //
        // Build final URI.
        //

        return (
            this.scheme +
            base64url
        );

    }

};


window.UriExportEncoder =
    UriExportEncoder;