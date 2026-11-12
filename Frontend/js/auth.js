// auth.js

document.addEventListener("DOMContentLoaded", () => {
    updateAuthNavigation();
    initializeRegistration();
    initializeLogin();
    initializeLogout();
});

// ---------------- REGISTER ----------------

function initializeRegistration() {
    const form = document.getElementById("register-form");

    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = document.getElementById("full-name")?.value.trim();
        const email = document.getElementById("email")?.value.trim();
        const password = document.getElementById("password")?.value;
        const confirmPassword =
            document.getElementById("confirm-password")?.value;

        const message = document.getElementById("register-message");

        if (!name || !email || !password || !confirmPassword) {
            showMessage(message, "Please fill in all fields.", "error");
            return;
        }

        if (password !== confirmPassword) {
            showMessage(message, "Passwords do not match.", "error");
            return;
        }

        if (password.length < 8) {
            showMessage(
                message,
                "Password must contain at least 8 characters.",
                "error"
            );
            return;
        }

        try {
            const result = await apiRequest(API.REGISTER, {
                method: "POST",
                body: JSON.stringify({
                    name,
                    email,
                    password
                })
            });

            showMessage(
                message,
                result.message || "Registration successful!",
                "success"
            );

            form.reset();

            setTimeout(() => {
                window.location.href = "login.html";
            }, 1200);

        } catch (error) {
            showMessage(message, error.message, "error");
        }
    });
}

// ---------------- LOGIN ----------------

function initializeLogin() {
    const form = document.getElementById("login-form");

    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("email")?.value.trim();
        const password = document.getElementById("password")?.value;

        const message = document.getElementById("login-message");

        if (!email || !password) {
            showMessage(
                message,
                "Please enter your email and password.",
                "error"
            );
            return;
        }

        try {
            const result = await apiRequest(API.LOGIN, {
                method: "POST",
                body: JSON.stringify({
                    email,
                    password
                })
            });

            AuthStorage.saveToken(result.access_token);
            AuthStorage.saveUser(result.user);

            showMessage(
                message,
                result.message || "Login successful!",
                "success"
            );

            setTimeout(() => {
                const nextPage = new URLSearchParams(window.location.search)
                    .get("next");
                const isProductDetailsPage =
                    /^product-details\.html\?id=\d+$/.test(nextPage || "");
                window.location.href = isProductDetailsPage
                    ? nextPage
                    : "products.html";
            }, 800);

        } catch (error) {
            showMessage(message, error.message, "error");
        }
    });
}

// ---------------- LOGOUT ----------------

function initializeLogout() {
    const logoutButtons = document.querySelectorAll("[data-logout]");

    logoutButtons.forEach((button) => {
        button.addEventListener("click", () => {
            AuthStorage.clear();
            window.location.href = "index.html";
        });
    });
}

// ---------------- AUTH CHECK ----------------

async function checkAuthentication() {
    if (!AuthStorage.isLoggedIn()) {
        window.location.href = "login.html";
        return false;
    }

    try {
        await apiRequest(API.PROTECTED, {
            method: "GET"
        });

        return true;

    } catch (error) {
        AuthStorage.clear();
        window.location.href = "login.html";
        return false;
    }
}

// ---------------- MESSAGE HELPER ----------------

function showMessage(element, message, type = "info") {
    if (!element) return;

    element.textContent = message;
    element.hidden = false;

    element.classList.remove("is-error", "is-success", "is-info");
    element.classList.add(`is-${type}`);
}