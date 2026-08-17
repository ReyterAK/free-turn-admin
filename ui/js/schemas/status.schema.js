//
// Status Schema
// Release 1.0.0
//

const statusSchema = {

    sections: [

        {
            titleKey: "server.status_title",
        
            fields: [
        
                {
                    key: "status",
                    type: "text",
                    labelKey: "server.status",
                    readonly: true,
                    formatter: "status"
                },
        
                {
                    key: "backend",
                    type: "text",
                    titleKey: "server.backend_title",
                    tooltipKey: "server.backend_status_hint",
                    readonly: true,
                    formatter: "backend_status"
                }
        
            ]
        },
        
        
                {
                    titleKey: "server.info_title",
        
                    fields: [
        
                        {
                            key: "version",
                            type: "text",
                            labelKey: "server.proxy",
                            readonly: true,
                            formatter: "version"
                        },
        
                        {
                            key: "clients",
                            type: "text",
                            labelKey: "server.clients",
                            readonly: true
                        },
        
                        {
                            key: "memory",
                            type: "text",
                            labelKey: "server.memory",
                            readonly: true
                        }
        
                    ]
        
                }
        
            ]
        
        };


window.statusSchema =
    statusSchema;