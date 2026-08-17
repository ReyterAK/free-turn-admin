//
// Connection Schema
// Release 1.0.0
//

const connectionSchema = {

    sections: [

        {
            title: "Connection",

            fields: [

                {
                    key: "listen",
                    cli: "listen",
                    type: "text",
                    labelKey: "server.listen",
                    placeholder: "127.0.0.1:51820"
                },

                {
                    key: "connect",
                    cli: "connect",
                    type: "text",
                    labelKey: "server.connect",
                    placeholderKey: "server.connect.placeholder"
                },

                {
                    key: "mode",
                    cli: "mode",
                    type: "select",
                    labelKey: "server.mode",
                    default: "udp",
                    options: ["udp", "tcp"]
                },

                {
                    key: "transport",
                    cli: "transport",
                    type: "select",
                    label: "Transport",
                    default: "tcp",
                    options: ["tcp", "udp"]
                },

                {
                    key: "provider",
                    cli: "provider",
                    type: "text",
                    label: "Provider"
                }

            ]

        },

        {
            title: "Obfuscation",

            fields: [

                {
                    key: "obf_profile",
                    cli: "obf-profile",
                    type: "select",
                    labelKey: "server.obf_profile",
                    default: "none",
                    options: ["none", "rtpopus", "rtpopus2", "rtpopus3"]
                },

                {
                    key: "obf_key",
                    cli: "obf-key",
                    type: "text",
                    labelKey: "server.obf_key"
                },

                {
                    key: "obf_timing",
                    cli: "obf-timing",
                    type: "text",
                    labelKey: "server.obf_timing"
                }

            ]

        },

        {
            title: "DNS",

            fields: [

                {
                    key: "dns_mode",
                    cli: "dns_mode",
                    type: "select",
                    labelKey: "server.dns_mode",
                    default: "auto",
                    options: ["plain", "doh", "auto"]
                },

                {
                    key: "dns_servers",
                    cli: "dns_servers",
                    type: "text",
                    label: "DNS servers"
                }

            ]

        },

        {
            title: "Advanced",

            fields: [

                {
                    key: "manual_captcha",
                    cli: "manual-captcha",
                    type: "checkbox",
                    label: "Manual CAPTCHA"
                },

                {
                    key: "n",
                    cli: "n",
                    type: "number",
                    label: "TURN streams"
                },

                {
                    key: "streams_per_cred",
                    cli: "streams-per-cred",
                    type: "number",
                    label: "Streams per credential"
                }

            ]

        }

    ]

};

// =====================================================
// EXPORT (IMPORTANT)
// =====================================================

window.connectionSchema = connectionSchema;