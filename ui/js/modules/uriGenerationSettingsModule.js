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


        


        //
        // Load current settings.
        //

        await UriGenerationSettingsStore.load();


        //
        // Render settings UI.
        //

        UriGenerationSettingsStore.render();


        


        return true;

    },



    //
    // Save settings
    //

    async save() {


        await UriGenerationSettingsStore.save();


        


        return true;

    }


};


window.UriGenerationSettingsModule =
    UriGenerationSettingsModule;