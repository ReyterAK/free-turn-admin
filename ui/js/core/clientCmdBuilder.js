//
// Client CMD Builder
// Release 1.1.3
//
// Builds the console-client launch command
// (flags only, prefixed with "client")
// from complete export data and VK Calls links.
//
// The command mirrors the URI payload field rules
// (see UriExportPayloadBuilder): the same parameters
// are carried, with the same include/exclude logic.
//
// Does NOT:
//
// - load files
// - call APIs
// - collect export data
// - validate VK Calls links (handled by the modal)
//

"use strict";


const ClientCmdBuilder = {


    //
    // Command prefix.
    //
    // The actual binary name is platform-specific;
    // the operator substitutes their own client binary.
    //

    prefix:
        "client",



    //
    // VK Calls link prefix.
    //
    // Used by the modal for validation.
    //

    linksPrefix:
        "https://vk.ru/call/join/",



    //
    // Build the final launch command.
    //
    // data:
    //
    // - complete export data from UriExportDataCollector
    //
    // links:
    //
    // - validated VK Calls links, comma-separated
    // - empty string means "no links provided"
    //

    build(
        data,
        links
    ) {


        if (
            !data ||
            typeof data !== "object"
        ) {

            throw new Error(
                safeT("cmd_flags.invalid_data")
            );

        }


        const args = [];


        //
        // Required base fields.
        //

        this.append(
            args,
            "-peer",
            data.peer
        );


        this.append(
            args,
            "-provider",
            data.provider
        );


        this.append(
            args,
            "-mode",
            data.mode
        );


        this.append(
            args,
            "-transport",
            data.transport
        );


        this.append(
            args,
            "-n",
            data.n
        );


        this.append(
            args,
            "-streams-per-cred",
            data.spc
        );


        this.append(
            args,
            "-client-id",
            data.cid
        );


        this.append(
            args,
            "-dns-mode",
            data.dns
        );


        //
        // Optional DNS servers.
        //
        // Empty value is omitted
        // (same rule as the URI payload).
        //

        if (
            data.dnss
        ) {

            this.append(
                args,
                "-dns-servers",
                data.dnss
            );

        }


        //
        // Manual VK captcha.
        //
        // Boolean flag, enabled only when
        // explicitly requested.
        //

        if (
            data.mcap === true
        ) {

            args.push(
                "-manual-captcha"
            );

        }


        //
        // Obfuscation profile.
        //
        // "none" is omitted from the command
        // (same rule as the URI payload).
        //

        if (
            data.obf &&
            data.obf !== "none"
        ) {

            this.append(
                args,
                "-obf-profile",
                data.obf
            );


            //
            // Obfuscation key is included
            // only when obfuscation is enabled.
            //

            if (
                data.key
            ) {

                this.append(
                    args,
                    "-obf-key",
                    data.key
                );

            }


            //
            // Obfuscation packet timing.
            //
            // Mirrors the server-side run.args
            // emission: present when the profile
            // is enabled; 0 is emitted explicitly.
            //

            if (
                data.obf_timing !== undefined &&
                data.obf_timing !== null
            ) {

                this.append(
                    args,
                    "-obf-timing",
                    this.formatObfTiming(
                        data.obf_timing
                    )
                );

            }

        }


        //
        // VK Calls links.
        //
        // Optional; validated by the modal.
        //

        if (
            typeof links === "string" &&
            links.trim()
        ) {

            this.append(
                args,
                "-links",
                '"' +
                links.trim() +
                '"'
            );

        }


        return (
            this.prefix +
            " " +
            args.join(
                " "
            )
        );

    },



    //
    // Append one flag/value pair.
    //

    append(
        args,
        flag,
        value
    ) {


        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {

            return;

        }


        args.push(
            flag
        );


        args.push(
            String(
                value
            )
        );

    },



    //
    // Format obfuscation timing.
    //
    // UI stores numeric milliseconds.
    // CLI expects Go duration format.
    //
    // 0  -> 0
    // 10 -> 10ms
    // 20 -> 20ms
    //

    formatObfTiming(
        value
    ) {


        const number =
            Number(
                value
            );


        if (
            Number.isNaN(
                number
            )
        ) {

            return String(
                value
            );

        }


        if (
            number === 0
        ) {

            return "0";

        }


        return (
            String(
                number
            ) +
            "ms"
        );

    }


};


window.ClientCmdBuilder =
    ClientCmdBuilder;
