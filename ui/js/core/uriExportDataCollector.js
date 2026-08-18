//
// URI Export Data Collector
// Release 1.0.0
//
// Collects all data required to generate
// a client URI / QR.
//
// Responsibilities:
//
// - receive selected client
// - load URI generation settings
// - check URI generation settings load errors
// - load server settings
// - check server settings load errors
// - build complete internal URI model
//
// This layer does NOT:
//
// - read configuration files directly
// - access the DOM
// - validate URI payload structure
// - remove optional parameters
// - build JSON
// - encode Base64URL
// - generate URI
// - generate QR
//

"use strict";


const UriExportDataCollector = {


    //
    // Temporary WireGuard configuration.
    //
    // TODO:
    // Replace with a proper API/source later.
    //

    wg:
        "[Interface]\n" +
        "PrivateKey = N1E42y89AnlrjWaKNpMvvuBKbodv/wKNcmeNWkhXDsw=\n" +
        "Address = 10.10.20.2/32\n" +
        "DNS = 1.1.1.1\n" +
        "[Peer]\n" +
        "PublicKey = OEAOND391kmS4KyanN/TnpW/LEnFJ2UF1TIt1zuJUF8=\n" +
        "AllowedIPs = 0.0.0.0/0\n" +
        "Endpoint = 10.10.20.1:25082\n" +
        "PersistentKeepalive = 25",



    //
    // Collect complete URI export data.
    //
    // The selected client is supplied by the caller.
    //

    async collect(
        client
    ) {


        //
        // Validate selected client object.
        //
        // The client itself comes from the existing
        // ClientStore / ClientEntityLayer workflow.
        //

        if (
            !client ||
            !client.id
        ) {


            throw new Error(
                safeT("uri_export.no_client")
            );

        }



        //
        // =================================================
        // 1. Load URI generation settings.
        // =================================================
        //

        await UriGenerationSettingsStore.load();



        //
        // Stop immediately if URI generation settings
        // could not be loaded.
        //

        if (
            UriGenerationSettingsStore.readError ||
            UriGenerationSettingsStore.loadErrors.length
        ) {


            console.error(
                "[UriExportDataCollector] URI generation settings load failed",
                UriGenerationSettingsStore.loadErrors
            );


            throw new Error(
                safeT("uri.load_error_title")
            );

        }



        //
        // =================================================
        // 2. Load server settings.
        // =================================================
        //

        await ServerSettingsStore.load();



        //
        // Stop immediately if any server configuration
        // source reported a load error.
        //
        // ServerSettingsStore.load() already checks:
        //
        // - run.args
        // - external settings
        //
        // We reuse that existing logic instead of
        // duplicating API/file validation here.
        //

        if (
            ServerSettingsStore.loadErrors.length
        ) {


            console.error(
                "[UriExportDataCollector] server settings load failed",
                ServerSettingsStore.loadErrors
            );


            throw new Error(
                safeT("server.settings.load_error_title")
            );

        }



        //
        // =================================================
        // 3. Read already loaded settings.
        // =================================================
        //

        const uriSettings =
            UriGenerationSettingsStore.settings || {};


        const serverSettings =
            ServerSettingsStore.settings || {};



        //
        // =================================================
        // 4. Build peer.
        // =================================================
        //
        // URI peer is built from external server settings.
        //
        // Server listen/connect settings are NOT copied
        // into URI directly.
        //

        const external =
            serverSettings.external;


        if (
            !external ||
            !external.host ||
            !external.port
        ) {


            console.error(
                "[UriExportDataCollector] external settings are unavailable",
                external
            );


            throw new Error(
                safeT("server.settings.external_load_error")
            );

        }


        const peer =
            String(
                external.host
            ) +
            ":" +
            String(
                external.port
            );



        //
        // =================================================
        // 5. Read server-side URI parameters.
        // =================================================
        //

        // v3.0.0 removed TCP tunnel mode; the server is UDP-only.
        const mode =
            serverSettings.mode || "udp";


        const obfProfile =
            serverSettings.obf_profile;


        const obfKey =
            serverSettings.obf_key;



        //
        // =================================================
        // 6. Build complete internal URI model.
        // =================================================
        //
        // This is NOT the final JSON payload.
        //
        // Optional fields are intentionally kept here.
        // They will be removed by the URI JSON Builder
        // in the next stage.
        //

        const data = {


            //
            // uri.json
            //

            v:
                uriSettings.v,

            provider:
                uriSettings.provider,

            transport:
                uriSettings.transport,


            //
            // external settings
            //

            peer:
                peer,


            //
            // run.args / server settings
            //

            mode:
                mode,


            obf:
                obfProfile,

            key:
                obfKey,


            //
            // uri.json
            //

            n:
                uriSettings.n,

            spc:
                uriSettings.spc,


            //
            // selected client
            //

            cid:
                client.id,

            name:
                client.comment,


            //
            // uri.json
            //

            dns:
                uriSettings.dns,

            dnss:
                uriSettings.dnss,

            mcap:
                uriSettings.mcap,


            //
            // bond was removed in v3.0.0 (TCP tunnel mode dropped).
            //

            //
            // temporary constant
            //

            wg:
                this.wg

        };



        //
        // =================================================
        // 7. Return complete internal model.
        // =================================================
        //

        console.log(
            "[UriExportDataCollector] collected export data",
            data
        );


        return data;

    }

};


window.UriExportDataCollector =
    UriExportDataCollector;