//
// i18n.js
// FreeTurn Admin
// Release 1.0.0
//
// Centralized internationalization.
//
// Responsibilities:
//
// - load language
// - store current language
// - translate keys
// - apply translations to DOM
// - refresh dynamically rendered content
// - support text
// - support placeholders
// - support title attributes
//

"use strict";

//
// Current language dictionary
//

let LANG =
{};

//
// Current language
//

let CURRENT_LANG =
"ru";

//
// Language persistence key
//

const LANG_STORAGE_KEY =
"freeTurnLang";

//
// Supported languages
//

const SUPPORTED_LANGS =
["ru", "en"];

//
// Detect the language
//
// Priority:
//
// 1. ?lang= query parameter (persisted)
// 2. localStorage selection
// 3. default "ru"
//

function detectLang() {


    //
    // query parameter
    //

    try {

        const params =
            new URLSearchParams(
                window.location.search
            );

        const query =
            params.get(
                "lang"
            );

        if (
            SUPPORTED_LANGS.includes(
                query
            )
        ) {


            try {

                localStorage.setItem(
                    LANG_STORAGE_KEY,
                    query
                );

            } catch (
                e
            ) {

                // storage unavailable, ignore

            }



            return query;


        }

    } catch (
        e
    ) {

        // URL parsing failed, fall through

    }



    //
    // localStorage
    //

    try {

        const stored =
            localStorage.getItem(
                LANG_STORAGE_KEY
            );

        if (
            SUPPORTED_LANGS.includes(
                stored
            )
        ) {


            return stored;


        }

    } catch (
        e
    ) {

        // storage unavailable, fall through

    }



    //
    // default
    //

    return "ru";


}

//
// I18N state
//

let I18N_READY =
false;

//
// Load language
//

async function loadLang(
lang = detectLang()
) {


CURRENT_LANG =
    lang;



const response =
    await fetch(
        `/lang/${lang}.json`
    );



if (
    !response.ok
) {


    throw new Error(

        `Failed to load language: ${lang}`

    );

}



LANG =
    await response.json();



I18N_READY =
    true;



return LANG;


}

//
// Translation
//
// Returns the translated value.
//
// If the key is missing,
// the key itself is returned.
//
// This keeps the UI usable even
// when a translation is missing.
//

function safeT(
key
) {


if (
    !key
) {

    return "";

}



return (

    LANG[key] ??
    key

);


}

//
// Apply translations
//
// Supported attributes:
//
// data-i18n
// data-i18n-placeholder
// data-i18n-title
//

function applyI18n(
root = document
) {


if (
    !root
) {

    return;

}



//
// Text content
//

root
    .querySelectorAll(
        "[data-i18n]"
    )
    .forEach(
        element => {


            const key =
                element.dataset.i18n;



            if (
                key
            ) {


                element.textContent =
                    safeT(
                        key
                    );

            }

        }
    );



//
// Placeholder
//

root
    .querySelectorAll(
        "[data-i18n-placeholder]"
    )
    .forEach(
        element => {


            const key =
                element.dataset
                    .i18nPlaceholder;



            if (
                key
            ) {


                element.placeholder =
                    safeT(
                        key
                    );

            }

        }
    );



//
// Title attribute
//

root
    .querySelectorAll(
        "[data-i18n-title]"
    )
    .forEach(
        element => {


            const key =
                element.dataset
                    .i18nTitle;



            if (
                key
            ) {


                element.title =
                    safeT(
                        key
                    );

            }

        }
    );


}

//
// Refresh translations
//
// Used after dynamic rendering.
//
// SchemaRenderer creates DOM elements
// dynamically, so translations must be
// applied after those elements exist.
//

function refreshI18n(
root = document
) {


if (
    !root
) {

    return;

}



requestAnimationFrame(
    () => {


        applyI18n(
            root
        );

    }
);


}

//
// Initialize I18N
//

async function initI18N(
lang = detectLang()
) {


await loadLang(
    lang
);



document.documentElement.lang =
    lang;



applyI18n(
    document
);


}

//
// Set the language
//
// Persists the selection and reloads
// the page so all dynamically rendered
// content is rebuilt with the new
// dictionary.
//

function setLanguage(
lang
) {


if (
    !SUPPORTED_LANGS.includes(
        lang
    )
) {


    return;


}



try {

    localStorage.setItem(
        LANG_STORAGE_KEY,
        lang
    );

} catch (
    e
) {

    // storage unavailable, ?lang= still works

}



location.reload();


}

//
// Get current language
//

function getCurrentLang() {


return CURRENT_LANG;


}

//
// Check I18N readiness
//

function isI18NReady() {


return I18N_READY;


}

//
// Public API
//

window.I18N = {


init:
    initI18N,


load:
    loadLang,


translate:
    safeT,


refresh:
    refreshI18n,


currentLang:
    getCurrentLang,


isReady:
    isI18NReady,


detectLang:
    detectLang,


setLanguage:
    setLanguage


};

//
// Global compatibility
//
// Existing code uses safeT()
// directly.
//

window.safeT =
safeT;
