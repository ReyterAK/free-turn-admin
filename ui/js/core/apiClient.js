//
// apiClient.js
// Release 1.0.0 CORE LAYER
//

"use strict";

const ApiClient = {


async request(url, options = {}) {


    try {


        const config = {


            credentials:
                "same-origin",


            ...options,


            headers: {

                "Content-Type":
                    "application/json",

                ...(options.headers || {})

            }


        };



        const res =
            await fetch(
                url,
                config
            );



        const data =
            await res
                .json()
                .catch(() => ({}));



        if (!res.ok) {


            const error =
                new Error(
                    data.error ||
                    "API error"
                );


            //
            // Preserve structured API error
            // information for higher layers.
            //

            if (
                data.code
            ) {

                error.code =
                    data.code;

            }


            if (
                data.status
            ) {

                error.status =
                    data.status;

            }


            if (
                data.retryAfter
            ) {

                error.retryAfter =
                    data.retryAfter;

            }


            throw error;


        }



        return data;



    }
    catch (e) {


        console.error(

            "[ApiClient]",

            url,

            e

        );


        throw e;


    }

},



async get(url) {


    return this.request(

        url,

        {
            method: "GET"
        }

    );


},



async post(url, data = {}) {


    return this.request(

        url,

        {

            method:
                "POST",

            body:
                JSON.stringify(
                    data
                )

        }

    );


}

};

window.ApiClient =
ApiClient;