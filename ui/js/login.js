//
// login.js
// FreeTurn Admin — Login screen logic and account bootstrap.
//

"use strict";

function showLoginForm() {
    document.getElementById("login-form-container").classList.remove("hidden");
    document.getElementById("create-account-container").classList.add("hidden");
}

function showCreateAccountForm() {
    document.getElementById("login-form-container").classList.add("hidden");
    document.getElementById("create-account-container").classList.remove("hidden");
}

function showError(message) {
    document.getElementById("login-error").innerText = message;
}

function clearError() {
    document.getElementById("login-error").innerText = "";
}

async function login() {
    clearError();

    const user = document.getElementById("user").value;
    const password = document.getElementById("password").value;

    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password })
    });

    if (res.ok) {
        window.location.href = "/app";
        return;
    }

    if (res.status === 429) {
        showError(safeT("auth.rate_limited"));
        return;
    }

    showError(safeT("auth.invalid_credentials"));
}

async function createAccount() {
    clearError();

    const user = document.getElementById("create-user").value;
    const password = document.getElementById("create-password").value;
    const passwordConfirm = document.getElementById("create-password-confirm").value;

    if (password !== passwordConfirm) {
        showError(safeT("password.mismatch"));
        return;
    }

    const res = await fetch("/api/auth/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password })
    });

    if (res.ok) {
        window.location.href = "/app";
        return;
    }

    let message = safeT("auth.create_error");
    try {
        const data = await res.json();
        if (data.error) {
            message = data.error;
        }
    } catch (error) {
        console.error(error);
    }

    showError(message);
}

async function checkAuthStatus() {
    try {
        const res = await fetch("/api/auth/status");

        if (!res.ok) {
            showLoginForm();
            return;
        }

        const data = await res.json();

        if (data.account_exists) {
            showLoginForm();
        } else {
            showCreateAccountForm();
        }
    } catch (error) {
        console.error(error);
        showError(safeT("auth.status_error"));
    }
}

function bindLoginEvents() {
    const langSwitcher = document.getElementById("lang-switcher");
    if (langSwitcher) {
        langSwitcher.addEventListener("change", () => {
            I18N.setLanguage(langSwitcher.value);
        });
    }

    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            login();
        });
    }

    const createForm = document.getElementById("create-account-form");
    if (createForm) {
        createForm.addEventListener("submit", (e) => {
            e.preventDefault();
            createAccount();
        });
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await I18N.init();

    const langSwitcher = document.getElementById("lang-switcher");
    if (langSwitcher) {
        langSwitcher.value = I18N.currentLang();
    }

    bindLoginEvents();
    await checkAuthStatus();
});
