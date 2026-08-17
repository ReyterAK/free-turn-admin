//
// schemaEntityLayer.js
// Release 1.0.0 CORE LAYER
//

const SchemaEntityLayer = {

    //
    // initialization
    //

    async init() {

        console.log(
            "[SchemaEntityLayer] initialized"
        );

        return true;

    },


    //
    // render helpers
    //

    renderConnection(
        containerId,
        values = {}
    ) {

        return SchemaRenderer.render(
            window.connectionSchema,
            containerId,
            values
        );

    },


    renderServer(
        containerId,
        values = {}
    ) {

        return SchemaRenderer.render(
            window.serverSchema,
            containerId,
            values
        );

    },


    renderStatus(
        containerId,
        values = {}
    ) {

        return SchemaRenderer.render(
            window.statusSchema,
            containerId,
            values
        );

    },


    //
    // collect form values
    //

    collect(containerId) {

        return SchemaRenderer.collect(
            containerId
        );

    },

    //
    // render server settings
    //
    
    renderServerSettings(
        containerId,
        values = {}
    ) {
    
        const schema =
            ServerSettingsSchemaAdapter.build(
                window.ServerSettingsSchema
            );
    
        return SchemaRenderer.render(
            schema,
            containerId,
            values
        );
    
    },
    
    
    //
    // render URI generation settings
    //
    
    renderUriGenerationSettings(
        containerId,
        values = {}
    ) {
    
        return SchemaRenderer.render(
            window.UriGenerationSettingsSchema,
            containerId,
            values
        );
    
    }

};




window.SchemaEntityLayer =
    SchemaEntityLayer;