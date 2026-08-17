//
// adminEntityLayer.js
// Release 1.0.0
//

const AdminEntityLayer = {


    async getVersion() {

        return ApiClient.request(
            "/api/system/admin-version"
        );

    }


};


window.AdminEntityLayer =
    AdminEntityLayer;