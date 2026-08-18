//
// FreeTurn Admin
// Server Settings Schema
// Release 1.0.0
//
// Full configuration model.
// No defaults.
// Values must come from configuration.
//

const ServerSettingsSchema = {


groups: [

    {
        id:
            "network",

        title:
            "server.group.network"
    },

    {
        id:
            "security",

        title:
            "server.group.security"
    },

    {
        id:
            "advanced",

        title:
            "server.group.advanced"
    }

],

fields: [

    //
    // =====================================================
    // Network
    // =====================================================
    //

    {
        key:
            "external",

        title:
            "server.external",

        infoKey:
            "server.info.external",

        group:
            "network",

        type:
            "address",

        required:
            true,

        restart_required:
            false,

        children: [

            {
                key:
                    "host",

                title:
                    "server.host",

                type:
                    "ip_name",

                error:
                    "server.validation.external_host",

                required:
                    true
            },

            {
                key:
                    "port",

                title:
                    "server.port",

                type:
                    "num",

                error:
                    "server.validation.external_port",

                required:
                    true,

                min:
                    10000,

                max:
                    65535
            }

        ]
    },

    {
        key:
            "listen",

        cli:
            "-listen",

        title:
            "server.listen",

        infoKey:
            "server.info.listen",

        group:
            "network",

        type:
            "address",

        required:
            true,

        restart_required:
            true,

        children: [

            {
                key:
                    "host",

                title:
                    "server.ip",

                type:
                    "ip",

                error:
                    "server.validation.listen_host",

                required:
                    true
            },

            {
                key:
                    "port",

                title:
                    "server.port",

                type:
                    "num",

                error:
                    "server.validation.listen_port",

                required:
                    true,

                min:
                    10000,

                max:
                    65535
            }

        ]
    },

    {
        key:
            "backend",

        cli:
            "-connect",

        title:
            "server.backend",

        infoKey:
            "server.info.backend",

        group:
            "network",

        type:
            "address",

        required:
            true,

        restart_required:
            true,

        children: [

            {
                key:
                    "host",

                title:
                    "server.ip",

                type:
                    "ip",

                error:
                    "server.validation.backend_host",

                required:
                    true
            },

            {
                key:
                    "port",

                title:
                    "server.port",

                type:
                    "num",

                error:
                    "server.validation.backend_port",

                required:
                    true,

                min:
                    1,

                max:
                    65535
            }

        ]
    },

    //
    // =====================================================
    // Security
    // =====================================================
    //

    {
        key:
            "client_auth",

        cli:
            "-clients-file",

        title:
            "server.client_auth",

        infoKey:
            "server.info.client_auth",

        checkboxLabelKey:
            "actions.enable",

        group:
            "security",

        type:
            "boolean",

        error:
            "server.validation.client_auth",

        cliMode:
            "value",

        cliValue:
            "/config/clients.json",

        required:
            true,

        restart_required:
            true
    },

    {
        key:
            "obf_profile",

        cli:
            "-obf-profile",

        title:
            "server.obf_profile",

        tooltipKey:
            "server.tooltip.obf_profile",

        group:
            "security",

        type:
            "select",

        error:
            "server.validation.obf_profile",

        options: [

            "none",

            "rtpopus",

            "rtpopus2",

            "rtpopus3"

        ],

        required:
            true,

        restart_required:
            true
    },

    {
        key:
            "obf_key",

        cli:
            "-obf-key",

        title:
            "server.obf_key",

        tooltipKey:
            "server.tooltip.obf_key",

        group:
            "security",

        type:
            "hex_key",

        error:
            "server.validation.obf_key",

        enabled_when:
        {
            obf_profile:
            [
                "rtpopus",
                "rtpopus2",
                "rtpopus3"
            ]
        },

        required:
            true,

        restart_required:
            true
    },

    //
    // =====================================================
    // Advanced
    // =====================================================
    //

    {
        key:
            "obf_timing",

        cli:
            "-obf-timing",

        title:
            "server.obf_timing",

        tooltipKey:
            "server.tooltip.obf_timing",

        group:
            "advanced",

        type:
            "num",

        error:
            "server.validation.obf_timing",

        enabled_when:
        {
            obf_profile:
            [
                "rtpopus",
                "rtpopus2",
                "rtpopus3"
            ],

            mode:
            [
                "udp"
            ]
        },

        required:
            false,

        min:
            0,

        max:
            100,

        restart_required:
            true
    },

    {
        key:
            "debug",

        cli:
            "-debug",

        title:
            "server.debug",

        checkboxLabelKey:
            "actions.enable",

        group:
            "advanced",

        type:
            "boolean",

        error:
            "server.validation.debug",

        cliMode:
            "argument",

        required:
            true,

        restart_required:
            true
    },

    {
        key:
            "status_refresh_interval",
    
        title:
            "server.status_refresh_interval",
    
        tooltipKey:
            "server.tooltip.status_refresh_interval",
    
        group:
            "advanced",
    
        type:
            "num",
    
        error:
            "server.validation.status_refresh_interval",
    
        required:
            true,
    
        min:
            0,
    
        max:
            60,
    
        restart_required:
            false
    }

]


};

window.ServerSettingsSchema =
ServerSettingsSchema;