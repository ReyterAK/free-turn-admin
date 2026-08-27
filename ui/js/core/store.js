//
// store.js
// Release 1.0.0 CORE LAYER
//

const Store = {


    //
    // application state
    //

    state: {


        //
        // client data
        //

        clients: [],



        //
        // server runtime data
        //

        status: null,

        version: null,

        clientsCount: 0,

        adminVersion: null,

        runArgs: null,
		
		serverSettings: null,



        //
        // connection data
        //

        connection: {},

    },


    //
    // subscriptions
    //

    listeners: {},



    //
    // subscribe
    //

    subscribe(key, callback) {


        if (!this.listeners[key]) {

            this.listeners[key] = [];

        }


        this.listeners[key].push(
            callback
        );


    },



    //
    // mutation
    //

    set(key, value) {


        if (!(key in this.state)) {

            console.warn(
                "[Store] unknown key:",
                key
            );

        }


        this.state[key] = value;


        if (!this.listeners[key])
            return;


        this.listeners[key]
            .forEach(
                cb => cb(value)
            );


    },



    //
    // getter
    //

    get(key) {


        return this.state[key];


    }


};


window.Store = Store;