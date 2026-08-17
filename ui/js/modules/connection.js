//
// Connection Module
// Release 1.0.0
//

const ConnectionModule = {

    //
    // lifecycle
    //

    async init() {

        await this.refresh();

        this.bindEvents();

        console.log(
            "[ConnectionModule] initialized"
        );

    },


    bindEvents() {

        // reserved

    },


    //
    // data
    //

    async refresh() {

        await ConnectionStore.refresh();

        this.render();

    },


    render() {
    
        const container =
            document.getElementById(
                "connection-form"
            );
    
        if (!container)
            return;
    
        container.replaceChildren();
    
    },


    //
    // actions
    //

    async save() {

        const values =
            SchemaEntityLayer.collect(
                "connection-form"
            );

        await ConnectionStore.save(
            values
        );

        await this.refresh();

    }

};

window.ConnectionModule =
    ConnectionModule;