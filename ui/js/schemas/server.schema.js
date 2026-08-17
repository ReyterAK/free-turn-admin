//
// server.schema.js
// Release 1.0.0
//

const serverSchema = {


    sections: [


        {
            titleKey: "server.info_title",

            fields: [

                {
                    key: "version",
                    type: "text",
                    labelKey: "server.version",
                    readonly: true
                },


                {
                    key: "clients",
                    type: "text",
                    labelKey: "server.clients",
                    readonly: true
                }

            ]

        },


        {
            titleKey: "server.actions_title",

            fields: [

              {
                  key: "restart",
              
                  type: "button",
              
                  labelKey: "actions.restart",
              
                  action: "restartServer",
              
                  readonly: false
              
              }

            ]

        }


    ]

};


window.serverSchema =
    serverSchema;