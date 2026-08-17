//
// login.js
// FreeTurn Admin
// Release 1.0.0
//
// Login screen logic and account bootstrap.
//

"use strict";



//
// Show login form
//


function showLoginForm() {

    document.getElementById(
        "login-form-container"
    ).style.display =
        "block";


    document.getElementById(
        "create-account-container"
    ).style.display =
        "none";

}



//
// Show create account form
//


function showCreateAccountForm() {

    document.getElementById(
        "login-form-container"
    ).style.display =
        "none";


    document.getElementById(
        "create-account-container"
    ).style.display =
        "block";

}



//
// Show error
//


function showError(
    message
) {

    document.getElementById(
        "login-error"
    ).innerText =
        message;

}



//
// Clear error
//


function clearError() {

    document.getElementById(
        "login-error"
    ).innerText =
        "";

}



//
// Login
//


async function login() {

    clearError();


    const user =
        document.getElementById(
            "user"
        ).value;


    const password =
        document.getElementById(
            "password"
        ).value;


    const res =
        await fetch(
            "/api/login",
            {
                method:
                    "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        user,
                        password
                    })
            }
        );


    if (
        res.ok
    ) {

        window.location.href =
            "/app";

        return;

    }


    showError(
        safeT("auth.invalid_credentials")
    );

}



//
// Create administrator account
//


async function createAccount() {

    clearError();


    const user =
        document.getElementById(
            "create-user"
        ).value;


    const password =
        document.getElementById(
            "create-password"
        ).value;


    const passwordConfirm =
        document.getElementById(
            "create-password-confirm"
        ).value;


    if (
        password !== passwordConfirm
    ) {

        showError(
            safeT("password.mismatch")
        );

        return;

    }


    const res =
        await fetch(
            "/api/auth/create",
            {
                method:
                    "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        user,
                        password
                    })
            }
        );


    if (
        res.ok
    ) {

        window.location.href =
            "/app";

        return;

    }


    let message =
        safeT("auth.create_error");


    try {

        const data =
            await res.json();


        if (
            data.error
        ) {

            message =
                data.error;

        }

    }
    catch (
        error
    ) {

        console.error(
            error
        );

    }


    showError(
        message
    );

}



//
// Check authentication state
//


async function checkAuthStatus() {

    try {

        const res =
            await fetch(
                "/api/auth/status"
            );


        if (
            !res.ok
        ) {

            showLoginForm();

            return;

        }


        const data =
            await res.json();


        if (
            data.account_exists
        ) {

            showLoginForm();

        }
        else {

            showCreateAccountForm();

        }

    }
    catch (
        error
    ) {

        console.error(
            error
        );


        showError(
            safeT("auth.status_error")
        );

    }

}



//
// Initialize
//


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await I18N.init();


        const langSwitcher =
            document.getElementById(
                "lang-switcher"
            );

        if (
            langSwitcher
        ) {

            langSwitcher.value =
                I18N.currentLang();

        }


        await checkAuthStatus();

    }
);