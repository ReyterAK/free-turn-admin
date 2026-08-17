//
// adminStore.js
// Release 1.0.0
//

const AdminStore = {


    async refresh() {

        const data =
            await AdminEntityLayer.getVersion();


        Store.set(
            "adminVersion",
            data
        );

    },


    getVersion() {

        return Store.get(
            "adminVersion"
        );

    }


};


window.AdminStore =
    AdminStore;