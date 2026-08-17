//
// Admin Module
// Release 1.0.0
//

const AdminModule = {


    async init() {

        await AdminStore.refresh();

        this.render();

        console.log(
            "[AdminModule] initialized"
        );

    },


    render() {

        const data =
            AdminStore.getVersion();


        const el =
            document.getElementById(
                "admin-version"
            );


        if (!el)
            return;


        el.textContent =
            "v" +
            (
                data.version ||
                "unknown"
            );

    }


};


window.AdminModule =
    AdminModule;