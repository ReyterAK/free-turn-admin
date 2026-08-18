//
// URI Generation Settings Schema
// Release 1.0.0
//
// Recommended parameters used when generating
// client URI / QR.
//
// These settings are stored separately from
// server settings and client data.
//
// The generator later decides which parameters
// are actually included in a specific URI.
//

"use strict";


const UriGenerationSettingsSchema = {


    //
    // =====================================================
    // Groups
    // =====================================================
    //

    groups: [

        {
            id:
                "current",

            titleKey:
                "uri.group.current"
        }

    ],


    //
    // =====================================================
    // Fields
    // =====================================================
    //

    fields: [


        //
        // URI version
        //

        {
            key:
                "v",

            type:
                "select",

            titleKey:
                "uri.version",

            group:
                "current",

            required:
                true,

            options:
            [
                "1"
            ]
        },


        //
        // URI provider
        //

        {
            key:
                "provider",

            type:
                "select",

            titleKey:
                "uri.provider",

            group:
                "current",

            required:
                true,

            options:
            [
                "vk"
            ]
        },


        //
        // Transport to TURN relay
        //

        {
            key:
                "transport",

            type:
                "select",

            titleKey:
                "uri.transport",

            tooltipKey:
                "uri.tooltip.transport",

            group:
                "current",

            required:
                false,

            default:
                "udp",

            options:
            [
                "udp"
            ]
        },


        //
        // TURN streams
        //

        {
            key:
                "n",

            type:
                "number",

            titleKey:
                "uri.n",


            tooltipKey:
                "uri.tooltip.n",

            group:
                "current",

            required:
                true,

            min:
                1,

            max:
                128
        },


        //
        // Streams per VK account cache
        //

        {
            key:
                "spc",

            type:
                "number",

            titleKey:
                "uri.spc",

            tooltipKey:
                "uri.tooltip.spc",

            group:
                "current",

            required:
                true,

            min:
                1,

            max:
                50
        },


        //
        // DNS resolver
        //

        {
            key:
                "dns",

            type:
                "select",

            titleKey:
                "uri.dns",

            tooltipKey:
                "uri.tooltip.dns",

            group:
                "current",

            required:
                true,

            options:
            [
                "auto",
                "doh",
                "plain"
            ]
        },


        //
        // DNS servers
        //

        {
            key:
                "dnss",

            type:
                "ip_list",

            titleKey:
                "uri.dnss",

            tooltipKey:
                "uri.tooltip.dnss",

            group:
                "current",

            required:
                false
        },


        //
        // Manual VK captcha
        //

        {
            key:
                "mcap",

            type:
                "boolean",

            titleKey:
                "uri.mcap",

            tooltipKey:
                "uri.tooltip.mcap",

            checkboxLabelKey:
                "actions.enable",

            group:
                "current",

            required:
                true
        },
        //

        //
        // Bond
        //
        // Removed in v3.0.0: the upstream server dropped TCP tunnel
        // mode, and bond was TCP-only.
        //

    ]

};


window.UriGenerationSettingsSchema =
    UriGenerationSettingsSchema;