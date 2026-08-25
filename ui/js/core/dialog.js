/*
FreeTurn Admin
Dialog
Release 1.0.0
======

Universal modal dialog for:

* alert
* confirm
* success
* progress
* prompt
  */

const Dialog = (() => {

const modal =
document.getElementById(
"dialog-modal"
);

const title =
document.getElementById(
"dialog-modal-title"
);

const message =
document.getElementById(
"dialog-modal-message"
);

const whatsNew =
document.getElementById(
"dialog-modal-whats-new"
);

const input =
document.getElementById(
"dialog-modal-input"
);

const saveButton =
document.getElementById(
"dialog-modal-save"
);

const cancelButton =
document.getElementById(
"dialog-modal-cancel"
);

const actionButton =
document.getElementById(
"dialog-modal-action"
);

const closeButton =
document.getElementById(
"dialog-modal-close"
);

let resolver =
null;

let currentType =
null;

let currentValidator =
null;

/*
Prompt state

*/

let promptState =
null;

/*
OPEN

*/

function open(
type,
dialogTitle,
dialogMessage,
inputValue = "",
options = {}
) {

currentType =
type;

title.textContent =
dialogTitle || "";

saveButton.dataset.fileName =
options.fileName ||
"WG.config";

saveButton.dataset.downloadUrl =
options.downloadUrl ||
"";

message.textContent =
dialogMessage || "";

/*
Reset WhatsNew readonly field.
*/

whatsNew.value =
"";

whatsNew.classList.add(
"hidden"
);

whatsNew.readOnly =
!options.editable;

message.classList.remove(
"hidden"
);

/*
Button labels.

Default values preserve
existing behavior.
*/

actionButton.textContent =
options.actionText ||
safeT("actions.ok");

cancelButton.textContent =
options.cancelText ||
safeT("actions.cancel");

/*
Always reset input first.
*/

input.value =
inputValue || "";

input.classList.add(
"hidden"
);

/*
READONLY MESSAGE

Used for long informational text,
such as server update WhatsNew.

The normal dialog message remains
untouched for all other dialog types.
*/

if (
options.readonlyMessage
) {


message.classList.add(
    "hidden"
);


whatsNew.classList.remove(
    "hidden"
);


whatsNew.value =
    dialogMessage || "";


}

/*
CONFIG ACTIONS

Copy-to-clipboard and save-to-file buttons
for the WG.config dialog.
*/

saveButton.classList.add(
    "hidden"
);

if (
options.showConfigActions
) {

saveButton.classList.remove(
    "hidden"
);

}

/*
ALERT / SUCCESS
*/

if (
type === "alert" ||
type === "success"
) {


cancelButton.classList.add(
    "hidden"
);


actionButton.classList.remove(
    "hidden"
);


}

/*
CONFIRM
*/

if (
type === "confirm"
) {


cancelButton.classList.remove(
    "hidden"
);


actionButton.classList.remove(
    "hidden"
);


}

/*
PROMPT
*/

if (
type === "prompt"
) {


input.classList.remove(
    "hidden"
);


cancelButton.classList.remove(
    "hidden"
);


actionButton.classList.remove(
    "hidden"
);


}

/*
VALIDATION ERROR
*/

if (
type === "validation-error"
) {


input.classList.add(
    "hidden"
);


cancelButton.classList.add(
    "hidden"
);


actionButton.classList.remove(
    "hidden"
);


}

/*
PROGRESS

Modal without buttons.

Used for operations that are currently
in progress and must not be interrupted
by accidental clicks.
*/

if (
type === "progress"
) {


input.classList.add(
    "hidden"
);


cancelButton.classList.add(
    "hidden"
);


actionButton.classList.add(
    "hidden"
);


}

/*
Show modal.
*/

modal.classList.remove(
"hidden"
);

/*
Focus input for prompt.
*/

if (
type === "prompt"
) {


setTimeout(
    () => {

        input.focus();

        input.select();

    },
    0
);


}

}

/*
CLOSE

*/

function close(
result
) {

modal.classList.add(
"hidden"
);

input.classList.add(
"hidden"
);

whatsNew.classList.add(
"hidden"
);

whatsNew.value =
"";

message.classList.remove(
"hidden"
);

currentType =
null;

currentValidator =
null;

promptState =
null;

if (
resolver
) {


const resolve =
    resolver;


resolver =
    null;


resolve(
    result
);


}

}

/*
ALERT

*/

function alert(
dialogTitle,
dialogMessage
) {

return new Promise(
resolve => {


    resolver =
        resolve;


    open(
        "alert",
        dialogTitle,
        dialogMessage
    );

}


);

}

/*
SUCCESS

*/

function success(
dialogTitle,
dialogMessage
) {

return new Promise(
resolve => {


    resolver =
        resolve;


    open(
        "success",
        dialogTitle,
        dialogMessage
    );

}


);

}

/*
PROGRESS

Modal without buttons.

Used for operations that are currently
in progress and must not be interrupted
by accidental clicks.
*/

function progress(
dialogTitle,
dialogMessage
) {


/*
   If another dialog is currently open,
   do not create a new Promise resolver.
   This dialog is purely informational.
*/

currentType =
    "progress";


title.textContent =
    dialogTitle || "";


message.textContent =
    dialogMessage || "";


message.classList.remove(
    "hidden"
);


whatsNew.value =
    "";


whatsNew.classList.add(
    "hidden"
);


input.classList.add(
    "hidden"
);


cancelButton.classList.add(
    "hidden"
);


actionButton.classList.add(
    "hidden"
);


modal.classList.remove(
    "hidden"
);


}

/*
CONFIRM

*/

function confirm(
dialogTitle,
dialogMessage,
options = {}
) {

return new Promise(
resolve => {


    resolver =
        resolve;


    open(
        "confirm",
        dialogTitle,
        dialogMessage,
        "",
        options
    );

}


);

}

/*
PROMPT

*/

function config(
dialogTitle,
configText,
options = {}
) {

return new Promise(
resolve => {


    resolver =
        resolve;


    open(
        "alert",
        dialogTitle,
        configText,
        "",
        {
            readonlyMessage: true,
            showConfigActions: true,
            editable: true,
            fileName:
                options.fileName ||
                "WG.config",
            downloadUrl:
                options.downloadUrl ||
                ""
        }
    );

}
);


}

function prompt(
dialogTitle,
inputValue = "",
dialogMessage = "",
validator = null
) {

return new Promise(
resolve => {


    resolver =
        resolve;


    currentValidator =
        validator;


    promptState = {

        title:
            dialogTitle,

        message:
            dialogMessage,

        value:
            inputValue || "",

        validator:
            validator

    };


    open(
        "prompt",
        dialogTitle,
        dialogMessage,
        inputValue
    );

}


);

}

/*
SHOW VALIDATION ERROR

*/

function showValidationError(
errorMessage
) {

/*
Save the current prompt state.

The original resolver is NOT changed.
*/

if (
!promptState
) {


return;


}

promptState.value =
input.value;

/*
Switch only the visual state
of the modal.

The active prompt resolver
remains untouched.
*/

open(
"validation-error",
safeT("dialog.title_error"),
errorMessage
);

}

/*
RESTORE PROMPT

*/

function restorePrompt()
{

if (
!promptState
) {


return;


}

/*
Restore prompt state.
*/

currentType =
"prompt";

currentValidator =
promptState.validator;

/*
Reopen prompt with the exact
text entered by the user.
*/

open(
"prompt",
promptState.title,
promptState.message,
promptState.value
);

}

/*
ACTION BUTTON

*/

actionButton.addEventListener(
"click",
async () => {


/*
   ==========================================
   VALIDATION ERROR
   ==========================================
*/

if (
    currentType === "validation-error"
) {

    restorePrompt();

    return;

}


/*
   ==========================================
   PROMPT
   ==========================================
*/

if (
    currentType === "prompt"
) {


    const value =
        input.value;


    /*
       Save the current value.
    */

    if (
        promptState
    ) {

        promptState.value =
            value;

    }


    /*
       Run validator.
    */

    if (
        currentValidator
    ) {


        let validationResult;


        try {

            validationResult =
                await currentValidator(
                    value
                );

        }
        catch (error) {


            console.error(
                "[Dialog] validation failed",
                error
            );


            validationResult =
                safeT("dialog.validation_error");

        }


        /*
           Validation failed.

           The original prompt Promise
           remains unresolved.
        */

        if (
            validationResult !== true
        ) {


            const errorMessage =
                typeof validationResult === "string"
                    ? validationResult
                    : safeT("dialog.invalid_value");


            showValidationError(
                errorMessage
            );


            return;

        }

    }


    /*
       Validation successful.

       Empty string is valid.
    */

    close(
        value
    );


    return;

}


/*
   ==========================================
   ALERT / SUCCESS / CONFIRM
   ==========================================
*/

close(
    true
);


}

);

/*
CANCEL BUTTON

*/

cancelButton.addEventListener(
"click",
() => {


close(
    false
);


}

);

/*
CLOSE BUTTON

*/

closeButton.addEventListener(
"click",
() => {


close(
    false
);


}

);

/*
SAVE handler for the config dialog.
*/

saveButton.addEventListener(
"click",
() => {

    // Сохраняем ровно тот текст, что в окне — включая
    // свежие правки администратора. Клиентский blob-файл,
    // сервер не участвует.
    const text =
        whatsNew.value ||
        "";

    const name =
        saveButton.dataset.fileName ||
        "WG.config";

    const blob =
        new Blob(
            [text],
            {
                type: "text/plain"
            }
        );

    const blobUrl =
        URL.createObjectURL(
            blob
        );

    const a =
        document.createElement(
            "a"
        );

    a.href = blobUrl;

    a.download = name;

    a.rel = "noopener";

    document.body.appendChild(
        a
    );

    // Firefox: клик отдельным таском. Якорь и blob-url
    // НЕ удаляем и НЕ revoke — живут до закрытия страницы
    // (малые ресурсы, зато ничто не может отменить скачивание).
    setTimeout(
        () => {

            a.click();

        },
        0
    );

}
);

/*
CLICK OUTSIDE

*/

modal.addEventListener(
"click",
event => {


if (
    event.target !== modal
) {

    return;

}


close(
    false
);


}

);

/*
ESC

*/

document.addEventListener(
"keydown",
event => {


if (
    event.key !== "Escape"
) {

    return;

}


if (
    modal.classList.contains(
        "hidden"
    )
) {

    return;

}


close(
    false
);


}

);

/*
ENTER

*/

input.addEventListener(
"keydown",
event => {


if (
    event.key !== "Enter"
) {

    return;

}


if (
    currentType !== "prompt"
) {

    return;

}


event.preventDefault();


actionButton.click();


}

);

/*
PUBLIC API

*/

return {


alert,

config,

confirm,

success,

progress,

close,

prompt

};

})();

// =====================================================
// GLOBAL ACCESS
// =====================================================

window.Dialog =
Dialog;
