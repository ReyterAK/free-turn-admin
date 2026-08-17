//
// Server Module
// Release 1.0.0
//

"use strict";

const ServerModule = {


//
// lifecycle
//

async init() {


    await this.refresh();


    this.bindEvents();


    console.log(
        "[ServerModule] initialized"
    );

},




bindEvents() {


    const button =
        document.getElementById(
            "restart-btn"
        );


    if (button) {

        button.onclick =
            async () => {


                console.log(
                    "[ServerModule] restart button clicked"
                );


                await this.restart();

            };

    }


    const updateButton =
        document.getElementById(
            "update-server-btn"
        );
    
    
    if (updateButton) {
    
        updateButton.onclick =
            async () => {
    
                console.log(
                    "[ServerModule] update server button clicked"
                );
    
    
                await this.checkForServerUpdate();
    
            };
    
    }

},




//
// data
//

async refresh() {


    await Promise.all([


        ServerStore.refreshStatus(),


        ServerStore.refreshVersion(),


        ServerStore.refreshClientsCount()


    ]);



    await ServerSettingsStore.load();



    this.render();


},




render() {

    ServerSettingsStore.render();

},




//
// actions
//

async restart() {

ServerSettingsStore.clearSaveSuccess();


if (

    window.StatusModule &&

    typeof StatusModule.showRestarting === "function"

) {

    StatusModule.showRestarting();

}


try {


    await ServerStore.restart();


}
catch (error) {


    console.error(

        "[ServerModule] restart failed",

        error

    );


    await Dialog.alert(

        safeT("server.restart_error_title"),

        error?.message ||

        safeT("server.restart_error_message")

    );


    await StatusModule.refresh();


    return;

}


await StatusModule.refresh();

},





async reload() {


    await this.refresh();


},


async saveSettings() {

    try {

        const result =
            await ServerSettingsStore.save();


        console.log(
            "[ServerModule] settings saved",
            result
        );


    } catch (error) {

        console.error(
            "[ServerModule] save settings failed",
            error
        );


        await Dialog.alert(
            safeT("server.save_error_title"),
            error?.message ||
            safeT("server.save_error_message")
        );

    }

},



async checkForServerUpdate() {

    //
    // Step 1.
    // Get current server version.
    //

    let currentVersion;


    try {

        const result =
            await ServerEntityLayer.getVersion();


        currentVersion =
            result?.version;


        console.log(
            "[ServerModule] current server version:",
            currentVersion
        );


        if (!currentVersion) {

            throw new Error(
                "Current server version is not defined"
            );

        }

    }
    catch (error) {

        console.error(
            "[ServerModule] failed to get server version",
            error
        );


        let message =
            safeT("common.unknown_error");


        try {

            await ServerStore.refreshStatus();


            const currentStatus =
                ServerStore.get("status")?.status;


            console.log(
                "[ServerModule] server status after version error:",
                currentStatus
            );


            if (
                currentStatus ===
                "stopped"
            ) {

                message =
                    safeT("server.stopped");

            }

        }
        catch (statusError) {

            console.error(
                "[ServerModule] failed to get server status",
                statusError
            );

        }


        await Dialog.alert(
            safeT("server.version_error_title"),
            message
        );


        return;

    }




    //
    // Step 2.
    // Get latest GitHub release.
    //

    let latestRelease;
    
    let retryInProgress =
        false;
    
    
    while (true) {
    
        try {
    
            latestRelease =
                await ServerEntityLayer.getLatestServerRelease();
    
    
            console.log(
                "[ServerModule] latest GitHub release:",
                latestRelease
            );
    
    
            if (retryInProgress) {
    
                Dialog.close();
    
                retryInProgress =
                    false;
    
            }
    
    
            break;
    
        }
    
    catch (error) {
    
        console.error(
            "[ServerModule] failed to get latest GitHub release",
            error
        );
    
    
        let message =
            safeT("server.update.info_error");
    
    
        switch (
            error?.code
        ) {
    
            case "github_rate_limit":
    
                message =
                    safeT("server.update.rate_limited");
    
                break;
    
    
            case "github_no_route":
    
                message =
                    safeT("server.update.no_route");
    
                break;
    
    
            case "github_dns":
    
                message =
                    safeT("server.update.dns_error");
    
                break;
    
    
            case "github_network":
    
                message =
                    safeT("server.update.connect_error");
    
                break;
    
    
            case "github_http":
    
                message =
                    error?.status
                        ? safeT("server.update.http_status") + error.status + "."
                        : safeT("server.update.http_error_generic");
    
                break;
    
        }
    
    
        const retry =
            await Dialog.confirm(
                safeT("server.update.fetch_error_title"),
                message,
                {
                    actionText:
                        safeT("actions.retry"),
    
                    cancelText:
                        safeT("actions.cancel")
                }
            );
    
    
        if (!retry) {
    
            console.log(
                "[ServerModule] GitHub release check cancelled by user"
            );
    
    
            return;
    
        }
    
    
        console.log(
            "[ServerModule] retrying GitHub release request"
        );
    
    
        retryInProgress =
            true;
    
    
        Dialog.progress(
            safeT("server.update.fetching_title"),
            safeT("server.update.retrying")
        );
    
    }
    
    }


    //
    // Step 3.
    // Compare versions.
    //

    if (
        currentVersion ===
        latestRelease.version
    ) {


        await Dialog.alert(
            safeT("server.update.up_to_date"),
            safeT("server.update.current_version") + currentVersion
        );


        return;


    }


    //
    // New version found.
    //

    console.log(
        "[ServerModule] new server version found:",
        latestRelease.version
    );


    const publishedAt =
        latestRelease.publishedAt
            ? new Date(
                latestRelease.publishedAt
            ).toLocaleString(
                "ru-RU"
            )
            : safeT("server.update.published_unknown");
    
    
    const releaseBody =
        latestRelease.whatsNew ||
        safeT("server.update.no_changelog");
    
    
    const updateMessage =
    
        safeT("server.update.confirm_current") + currentVersion + "\n" +
    
        safeT("server.update.confirm_new") + latestRelease.version + "\n" +
    
        safeT("server.update.confirm_date") + publishedAt + "\n\n" +
    
        `${releaseBody}`;
    
    
    const updateConfirmed =
        await Dialog.confirm(
            safeT("server.update.found_title"),
            updateMessage,
            {
                actionText:
                    safeT("actions.update"),
    
                cancelText:
                    safeT("actions.cancel"),
    
                readonlyMessage:
                    true
            }
        );


    if (!updateConfirmed) {


        console.log(
            "[ServerModule] server update cancelled by user"
        );


        return;


    }


    console.log(
        "[ServerModule] server update confirmed by user"
    );


    //
    // Step 4.
    // Download server update.
    //

    Dialog.progress(
        safeT("server.update.download_title"),
        safeT("server.update.downloading")
    );


    let downloadResult;


    try {

        downloadResult =
            await ServerEntityLayer.downloadServerUpdate(
                latestRelease.asset.downloadUrl,
                latestRelease.asset.digest
            );


        console.log(
            "[ServerModule] server update downloaded:",
            downloadResult
        );


    }
    catch (error) {


        console.error(
            "[ServerModule] failed to download server update",
            error
        );


        Dialog.close();


        await Dialog.alert(
            safeT("server.update.download_error_title"),
            error?.message ||
            safeT("server.update.download_error_message")
        );


        return;

    }


//
// Download completed successfully.
// The backend has already verified
// the SHA-256 digest.
//

console.log(
    "[ServerModule] replacing server binary"
);


let replaceResult;


try {

    replaceResult =
        await ServerEntityLayer.replaceServerBinary();


    console.log(
        "[ServerModule] server binary replaced:",
        replaceResult
    );


}
catch (error) {


    console.error(
        "[ServerModule] failed to replace server binary",
        error
    );


    Dialog.close();


    await Dialog.alert(
        safeT("server.update.install_error_title"),
        error?.message ||
        safeT("server.update.install_error_message")
    );


    return;

}


//
// Binary replaced successfully.
// Refresh server status and version.
//

Dialog.close();


try {

    await StatusModule.refresh();


}
catch (error) {

    console.error(
        "[ServerModule] failed to refresh server status after update",
        error
    );

}


await Dialog.alert(
    safeT("server.update.installed_title"),
    safeT("server.update.installed_message") + latestRelease.version + "."
);


}

};

window.ServerModule =
ServerModule;

window.saveServerSettings =
ServerModule.saveSettings.bind(
ServerModule
);

window.restartServer =
ServerModule.restart.bind(
ServerModule
);
