//
// serverEntityLayer.js
// Release 1.0.0 ENTITY LAYER
//
// Server API communication layer.
//
// IMPORTANT:
// - Browser never communicates directly with GitHub.
// - All server update operations go through Flask API.
// - GitHub API access is performed only by the backend container.
//

"use strict";


const ServerEntityLayer = {


    //
    // SYSTEM QUERIES
    //


    async getStatus() {

        return ApiClient.request(
            "/api/system/status"
        );

    },


    async getVersion() {

        return ApiClient.request(
            "/api/system/version"
        );

    },


    async getClientsCount() {

        return ApiClient.request(
            "/api/system/clients/count"
        );

    },


    //
    // SERVER UPDATE
    //
    // All GitHub communication is performed
    // exclusively by the backend container.
    //


    async getLatestServerRelease(force = false) {

        const url = force
            ? "/api/system/update/latest?force=1"
            : "/api/system/update/latest";

        return ApiClient.request(url);

    },


    async downloadServerUpdate(
        downloadUrl,
        digest
    ) {

        return ApiClient.request(
            "/api/system/update/download",
            {
                method:
                    "POST",

                body:
                    JSON.stringify({

                        downloadUrl,

                        digest

                    })
            }
        );

    },


    async replaceServerBinary() {

        return ApiClient.request(
            "/api/system/update/replace",
            {
                method:
                    "POST"
            }
        );

    },


    //
    // SYSTEM COMMANDS
    //


    async restart() {

        return ApiClient.request(
            "/api/system/restart",
            {
                method:
                    "POST"
            }
        );

    },


    //
    // GENERATE OBFUSCATION KEY
    //


    async generateObfKey() {

        return ApiClient.request(
            "/api/system/generate-obf-key",
            {
                method:
                    "POST"
            }
        );

    },


    //
    // RAW run.args ACCESS
    //


    async getRunArgs() {

        return ApiClient.request(
            "/api/runargs/get"
        );

    },


    async saveRunArgs(
        data
    ) {

        return ApiClient.request(
            "/api/runargs/save",
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        data
                    })
            }
        );

    },


    //
    // SETTINGS
    //


    async saveSettings(
        settings
    ) {

        return ApiClient.request(
            "/api/settings/save",
            {
                method:
                    "POST",

                body:
                    JSON.stringify(
                        settings
                    )
            }
        );

    }


};


window.ServerEntityLayer =
    ServerEntityLayer;