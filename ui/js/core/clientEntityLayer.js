//
// clientEntityLayer.js
// Release 1.0.0 ENTITY LAYER
//

const ClientEntityLayer = {


    //
    // queries
    //


    async list() {

        const data =
            await ApiClient.request(
                "/api/clients/list"
            );


        return data.clients || [];

    },


    //
    // commands
    //


    async add(comment) {

        return ApiClient.request(
            "/api/clients/add",
            {
                method: "POST",

                body: JSON.stringify({
                    comment
                })
            }
        );

    },


    async remove(client_id) {

        return ApiClient.request(
            "/api/clients/remove",
            {
                method: "POST",

                body: JSON.stringify({
                    client_id
                })
            }
        );

    },


    async update(client_id, comment) {

        return ApiClient.request(
            "/api/clients/update",
            {
                method: "POST",

                body: JSON.stringify({
                    client_id,
                    comment
                })
            }
        );

    }


};


window.ClientEntityLayer =
    ClientEntityLayer;