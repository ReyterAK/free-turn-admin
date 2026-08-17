//
// connectionEntityLayer.js
// Release 1.0.0
//
// Architecture note:
//
// Connection layer reads server runtime configuration
// to build client connection profile.
//
// It does not own configuration persistence.
//
// Persistence remains in ServerEntityLayer.
//
// WireGuard file handling has been removed.
// Future WireGuard workflow:
//
// 1. Load WireGuard configuration from a user-selected file
//    or from clipboard.
//
// 2. Parse the configuration in the ClientProvisioning layer.
//
// 3. Generate client connection URI / QR code.
//
// The WireGuard configuration is not stored as a permanent
// container configuration file.
//

const ConnectionEntityLayer = {


    //
    // queries
    //


    async getRunArgs() {

        return ApiClient.request(
            "/api/runargs/get"
        );

    },


    //
    // parsers
    //


    parseRunArgs(data = "") {

        const result = {};

        const lines =
            data.split("\n");


        for (
            let i = 0;
            i < lines.length;
            i++
        ) {

            switch (lines[i]) {

                case "-listen":

                    result.listen =
                        lines[i + 1];

                    break;


                case "-connect":

                    result.connect =
                        lines[i + 1];

                    break;


                case "-obf-profile":

                    result.obf_profile =
                        lines[i + 1];

                    break;


                case "-obf-key":

                    result.obf_key =
                        lines[i + 1];

                    break;

            }

        }


        return result;

    },


    //
    // aggregate
    //


    async getAll() {

        let runArgs = {};


        try {

            runArgs =
                await this.getRunArgs();

        }
        catch(e) {

            console.warn(
                "[ConnectionEntityLayer] runArgs unavailable",
                e
            );

        }


        return {

            ...this.parseRunArgs(
                runArgs.data || ""
            )

        };

    }


};


window.ConnectionEntityLayer =
    ConnectionEntityLayer;