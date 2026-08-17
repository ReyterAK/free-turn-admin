//
// connectionStore.js
// Release 1.0.0
//

const ConnectionStore = {


    async refresh() {

        const data =
            await ConnectionEntityLayer.getAll();


        Store.set(
            "connection",
            data
        );

    },


    get() {

        return Store.get(
            "connection"
        ) || {};

    },


    subscribe(callback) {

        Store.subscribe(
            "connection",
            callback
        );

    }


};


window.ConnectionStore =
    ConnectionStore;