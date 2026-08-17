//
// serverStore.js
// Release 1.0.0 CORE LAYER
//
// Coordinates server data access.
//
// Responsibilities:
//
// - refresh server state
// - keep server data
// - provide server actions
//

"use strict";



const ServerStore = {

    //
    // Refresh all server data
    //

    async refresh() {


        await Promise.all([

            this.refreshStatus(),

            this.refreshVersion(),

            this.refreshClientsCount(),

            this.refreshRunArgs()

        ]);

    },




    //
    // Status
    //

    async refreshStatus() {


        const value =
            await ServerEntityLayer.getStatus();



        Store.set(
            "status",
            value
        );


        return value;

    },




    //
    // Version
    //

    async refreshVersion() {


        const value =
            await ServerEntityLayer.getVersion();



        Store.set(
            "version",
            value
        );


        return value;

    },




    //
    // Clients count
    //

    async refreshClientsCount() {


        const value =
            await ServerEntityLayer.getClientsCount();



        Store.set(
            "clientsCount",
            value
        );


        return value;

    },




    //
    // Current run.args
    //

    async refreshRunArgs() {


        const value =
            await ServerEntityLayer.getRunArgs();



        Store.set(
            "runArgs",
            value
        );


        return value;

    },


    //
    // Accessors
    //

    get(
        key
    ) {

        return Store.get(
            key
        );

    },


    subscribe(
        key,
        callback
    ) {


        Store.subscribe(
            key,
            callback
        );

    },




    //
    // Actions
    //

    async restart() {


        await ServerEntityLayer.restart();

    }


};



window.ServerStore =
    ServerStore;