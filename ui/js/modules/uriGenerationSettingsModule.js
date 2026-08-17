//
// URI Generation Settings Module
// Release 1.0.0
//
// Coordinates URI / QR generation parameters UI.
//
// Responsibilities:
//
// - initialize URI generation settings
// - load settings
// - render settings UI
// - save settings
//

"use strict";


const UriGenerationSettingsModule = {


    //
    // Initialization
    //

    async init() {


        console.log(
            "[UriGenerationSettingsModule] initializing..."
        );


        //
        // Load current settings.
        //

        await UriGenerationSettingsStore.load();


        //
        // Render settings UI.
        //

        UriGenerationSettingsStore.render();


        console.log(
            "[UriGenerationSettingsModule] initialized."
        );


        return true;

    },



    //
    // Save settings
    //

    async save() {


        await UriGenerationSettingsStore.save();


        console.log(
            "[UriGenerationSettingsModule] settings saved."
        );


        return true;

    }


};


window.UriGenerationSettingsModule =
    UriGenerationSettingsModule;