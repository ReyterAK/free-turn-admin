//
// Admin Settings Store
// Release 1.0.0
//
// Loads admin-only configuration.
//
// Source:
// /config/settings.json
//
// Contains:
// - external endpoint
// - status refresh interval
// - admin connection settings
//

"use strict";


const AdminSettingsStore = {


    settings: null,


    readError:
        false,



    async load() {


        const response =
            await ApiClient.get(
                "/api/settings"
            );


        


        this.readError =
            Boolean(
                response?.read_error
            );


        this.settings =
            response?.data || {};


        


        return this.settings;

    },



    async ensureLoaded() {


        if (
            !this.settings
        ) {

            await this.load();

        }


        return this.settings;

    },



    async getExternal() {


        await this.ensureLoaded();


        return {


            host:
                this.settings.external?.host ||
                "",


            port:
                this.settings.external?.port ||
                null


        };

    },



    async getStatusRefreshInterval() {


        await this.ensureLoaded();


        const value =
            this.settings.status_refresh_interval;


        if (
            typeof value !== "number"
        ) {

            return 0;

        }


        return value;

    }


};



window.AdminSettingsStore =
    AdminSettingsStore;