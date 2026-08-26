//
// FreeTurn Admin
// app.js
//
// Release 1.0.0 APPLICATION LAYER
//

const App = {


    //
    // initialization
    //

    async init() {


        console.log(
            "FreeTurn Admin initializing..."
        );


        //
        // i18n
        //

        if (window.I18N) {

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

        }


        //
        // schema layer
        //

        if (window.SchemaEntityLayer) {

            await SchemaEntityLayer.init();

        }

        //
        // modules
        //

        if (window.ClientsModule) {
        
            UriExportModal.init();
        
            UriClientConfigModal.init();
        
            await ClientsModule.init();
        
        }


        if (window.ServerModule) {

            await ServerModule.init();

        }


        if (window.ConnectionModule) {
        
            await ConnectionModule.init();
        
        }
        
        
        if (window.UriGenerationSettingsModule) {
        
            await UriGenerationSettingsModule.init();
        
        }
        
        
        if (window.StatusModule) {
        
            await StatusModule.init();
        
        }
        
        
        if (window.WireGuardModule) {
        
            await WireGuardModule.init();
        
        }

        if (window.RoutingModule) {

            await RoutingModule.init();

        }

        if (window.AdminModule) {

            await AdminModule.init();

        }


        //
        // default tab: WireGuard — first-run onboarding and the
        // live server/peer picture (клиенты — вторая по частоте)
        //

        this.showTab(
            "wireguard"
        );


        console.log(
            "FreeTurn Admin initialized."
        );


    },


    //
    // tabs
    //

    showTab(name) {


        const tabs =
            document.querySelectorAll(
                ".tab"
            );


        tabs.forEach(
            tab => {

                tab.classList.add(
                    "hidden"
                );

            }
        );


        const target =
            document.getElementById(
                "tab-" + name
            );


        if (!target)
            return;


        target.classList.remove(
            "hidden"
        );


        //
        // Per-tab show hooks. The WireGuard view is refreshed every
        // time its tab is opened: bindings done from the «Клиенты»
        // tab (or router changes outside the panel) must be visible
        // immediately — the tab has no background polling.
        //

        if (
            name === "wireguard" &&
            window.WireGuardModule
        ) {

            WireGuardModule.refresh();

        }

        // Настройки сервера перечитываются при каждом показе: создание
        // WG-интерфейса автообновляет Backend (-connect в run.args),
        // и форма должна показывать свежие значения, а не устаревшие
        // (иначе сохранение затирает авто-обновление).
        if (
            name === "server" &&
            window.ServerModule
        ) {

            ServerModule.refresh();

        }

        if (
            name === "routing" &&
            window.RoutingModule
        ) {

            RoutingModule.refresh();

        }

    }


};


// compatibility export

window.App = App;



//
// start
//

document.addEventListener(
    "DOMContentLoaded",
    () => {

        App.init()
            .catch(
                err => {

                    console.error(
                        "[App] initialization failed",
                        err
                    );

                }
            );

    }
);