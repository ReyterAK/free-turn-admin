//
// URI Export Payload Builder
// Release 1.0.0
//
// Builds the final JSON payload for a client URI.
//
// Responsibilities:
//
// - build URI payload from complete export data
// - include required fields
// - remove optional empty/default fields
// - apply field dependencies
//
// Does NOT:
//
// - load files
// - call APIs
// - validate API load errors
// - encode Base64URL
// - generate freeturn:// URI
// - generate QR
//

"use strict";

const UriExportPayloadBuilder = {


//
// Build final URI JSON payload
//

build(
    data
) {


    if (
        !data ||
        typeof data !== "object"
    ) {

        throw new Error(
            safeT("uri_export.invalid_payload")
        );

    }


    //
    // Required base fields.
    //
    // These fields are expected to be present
    // after successful data collection.
    //

    const payload = {

        //
        // URI format version.
        //

        v:
            Number(
                data.v
            ),


        //
        // TURN credentials provider.
        //

        provider:
            data.provider,


        //
        // Transport to TURN relay.
        //

        transport:
            data.transport,


        //
        // Server address.
        //

        peer:
            data.peer,


        //
        // Tunnel mode.
        //

        mode:
            data.mode,


        //
        // TURN streams.
        //

        n:
            Number(
                data.n
            ),


        //
        // Streams per VK account cache.
        //

        spc:
            Number(
                data.spc
            ),


        //
        // Client ID.
        //

        cid:
            data.cid,


        //
        // DNS resolver mode.
        //

        dns:
            data.dns

    };


    //
    // Optional client name / comment.
    //
    // Empty comment is omitted from URI.
    //

    if (
        data.name
    ) {

        payload.name =
            data.name;

    }


    //
    // Optional DNS servers.
    //
    // Empty value is omitted.
    //

    if (
        data.dnss
    ) {

        payload.dnss =
            data.dnss;

    }


    //
    // Manual VK captcha.
    //
    // Enabled only when explicitly requested.
    //

    if (
        data.mcap === true
    ) {

        payload.mcap =
            true;

    }


    //
    // WireGuard configuration.
    //
    // Relevant only for UDP mode.
    //
    // Empty configuration is omitted.
    //

    if (
        data.mode === "udp" &&
        data.wg
    ) {

        payload.wg =
            data.wg;

    }


    //
    // Obfuscation profile.
    //
    // "none" is omitted from URI.
    //

    if (
        data.obf &&
        data.obf !== "none"
    ) {

        payload.obf =
            data.obf;


        //
        // Obfuscation key is included
        // only when obfuscation is enabled.
        //

        if (
            data.key
        ) {

            payload.key =
                data.key;

        }

    }


    //
    // Bonding was removed in v3.0.0 (TCP tunnel mode dropped).
    //

    return payload;

}


};

window.UriExportPayloadBuilder =
UriExportPayloadBuilder;
