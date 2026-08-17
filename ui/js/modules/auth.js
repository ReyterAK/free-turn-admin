//
// Auth Module
//

const AuthModule = {

    async logout() {

        await ApiClient.request("/api/logout", {
            method: "POST"
        });

        window.location = "/";

    }

};

window.AuthModule = AuthModule;