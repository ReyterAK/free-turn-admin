//
// Password Module
// Release 1.0.0 
//

const PasswordModule = {


async init() {

    

},


open() {

    document
        .getElementById("password-modal")
        .classList
        .remove("hidden");


    document.getElementById(
        "new-user"
    ).value = "";


    document.getElementById(
        "old-password"
    ).value = "";


    document.getElementById(
        "new-password"
    ).value = "";


    document.getElementById(
        "new-password-confirm"
    ).value = "";


    this.loadCurrentUser();

},


async loadCurrentUser() {

    try {

        const data =
            await ApiClient.get(
                "/api/auth/current-user"
            );

        document.getElementById(
            "new-user"
        ).value =
            data.user || "";

    } catch(e) {

        console.error(
            "[PasswordModule] Failed to load current user",
            e
        );


        if (
            e
            &&
            e.message === "invalid_auth"
        ) {

            this.close();

            window.location.href =
                "/login";

            return;

        }


        Toast.show(
            safeT("password.get_user_error"),
            "error"
        );

    }

},


close() {

    document
        .getElementById("password-modal")
        .classList
        .add("hidden");


    document.getElementById(
        "new-user"
    ).value = "";


    document.getElementById(
        "old-password"
    ).value = "";


    document.getElementById(
        "new-password"
    ).value = "";


    document.getElementById(
        "new-password-confirm"
    ).value = "";

},


async submit() {


    const user =
        document.getElementById(
            "new-user"
        ).value
        .trim();


    const oldPassword =
        document.getElementById(
            "old-password"
        ).value;


    const newPassword =
        document.getElementById(
            "new-password"
        ).value;


    const confirm =
        document.getElementById(
            "new-password-confirm"
        ).value;



    if (
        !user
        ||
        !oldPassword
        ||
        !newPassword
        ||
        !confirm
    ) {

        Toast.show(
            safeT("password.fill_all"),
            "error"
        );

        return;

    }



    if (
        newPassword !== confirm
    ) {

        Toast.show(
            safeT("password.mismatch"),
            "error"
        );

        return;

    }



    try {


        await ApiClient.post(
            "/api/auth/change-password",
            {
                user:
                    user,

                old_password:
                    oldPassword,

                new_password:
                    newPassword
            }
        );



        Toast.show(
            safeT("password.changed")
        );


        this.close();



    } catch(e) {


        console.error(
            "[PasswordModule]",
            e
        );


        if (
            e
            &&
            e.message === "wrong_password"
        ) {

            Toast.show(
                safeT("password.wrong_current"),
                "error"
            );

            return;

        }



        if (
            e
            &&
            e.message === "invalid_auth"
        ) {

            this.close();


            window.location.href =
                "/login";


            return;

        }



        Toast.show(
            safeT("password.change_error"),
            "error"
        );


    }


}

};

window.PasswordModule =
PasswordModule;