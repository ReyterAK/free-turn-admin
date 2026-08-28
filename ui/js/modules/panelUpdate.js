//
// PanelUpdate Module
// FreeTurn Admin — panel self-update check and container update.
//
// The check talks to Docker Hub (server-side, cached for a day);
// applying the update requires RouterOS (/container/update) — with
// no API user the UI only shows the WinBox command.
//

const PanelUpdateModule = {

//
// lifecycle
//

async init() {

    this.bindEvents();

    // Авто-проверка: сервер сам ограничивает частоту (раз в сутки).
    await this.check(false);

},

bindEvents() {

    const checkBtn =
        document.getElementById(
            "panel-update-check-btn"
        );

    if (checkBtn) {

        checkBtn.addEventListener(
            "click",
            () => {

                this.check(true);

            }
        );

    }

    const applyBtn =
        document.getElementById(
            "panel-update-apply-btn"
        );

    if (applyBtn) {

        applyBtn.addEventListener(
            "click",
            () => {

                this.apply();

            }
        );

    }

},

//
// check
//

async check(force) {

    const line =
        document.getElementById(
            "panel-update-line"
        );

    if (line)
        line.textContent =
            safeT("panel.checking");

    try {

        const data =
            await ApiClient.get(
                "/api/panel/update/check" +
                (force ? "?force=1" : "")
            );

        this.render(data);

    }
    catch (error) {

        console.error(
            "[PanelUpdateModule] check",
            error
        );

        if (line)
            line.textContent =
                safeT("panel.check_error");

    }

},

render(data) {

    const line =
        document.getElementById(
            "panel-update-line"
        );

    if (!line)
        return;

    if (data.status !== "ok") {

        line.textContent =
            safeT("panel.check_error");

        return;

    }

    if (data.update_available) {

        line.textContent =
            safeT("panel.update_available")
                .replace(
                    "%s",
                    data.latest_version
                );

        return;

    }

    line.textContent =
        safeT("panel.up_to_date");

},

//
// apply
//

async apply() {

    if (!window.Dialog)
        return;

    const ok =
        await Dialog.confirm(
            safeT("panel.update_title"),
            safeT("panel.update_confirm")
        );

    if (!ok)
        return;

    const line =
        document.getElementById(
            "panel-update-line"
        );

    if (line)
        line.textContent =
            safeT("panel.updating");

    try {

        const resp =
            await fetch(
                "/api/panel/update/apply",
                {
                    method: "POST",
                    credentials: "same-origin"
                }
            );

        const data =
            await resp.json();

        if (data.status === "ok") {

            // Панель сейчас перезапустится.
            await Dialog.alert(
                safeT("panel.update_title"),
                safeT("panel.update_started")
            );

            return;

        }

        if (
            data.error === "no_routeros" ||
            data.error === "no_remote_image" ||
            data.error === "container_not_found" ||
            data.error === "no_permission"
        ) {

            await Dialog.alert(
                safeT("panel.update_title"),
                (data.error === "no_permission"
                    ? safeT("panel.update_permission")
                    : safeT("panel.update_manual")) +
                "\n\n" +
                (data.command || "")
            );

            // Восстановить строку статуса (была переведена в
            // «Обновление запускается…»).
            await this.check(false);

            return;

        }

        await Dialog.alert(
            safeT("panel.update_title"),
            typeof data.error === "string"
                ? data.error
                : (data.error && data.error.detail) ||
                  safeT("panel.check_error")
        );

        await this.check(false);

    }
    catch (error) {

        // Запрос мог оборваться потому, что контейнер уже
        // перезапускается — считаем обновление запущенным.
        console.error(
            "[PanelUpdateModule] apply",
            error
        );

        await Dialog.alert(
            safeT("panel.update_title"),
            safeT("panel.update_started")
        );

    }

}

};

window.PanelUpdateModule =
    PanelUpdateModule;
