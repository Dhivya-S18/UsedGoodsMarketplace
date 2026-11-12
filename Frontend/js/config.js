// config.js

const API_BASE_URL = "http://127.0.0.1:8000";

const API = {
    REGISTER: "/auth/register",
    LOGIN: "/auth/login",
    PROTECTED: "/protected",

    PRODUCTS: "/products/",
    PRODUCT_SEARCH: "/products/search",

    GENERATE_DESCRIPTION: "/products/generate-description",
    RECOMMENDATIONS: "/products/recommendations/me"
};

// Token management
const AuthStorage = {
    saveToken(token) {
        sessionStorage.setItem("access_token", token);
    },

    getToken() {
        return sessionStorage.getItem("access_token");
    },

    saveUser(user) {
        sessionStorage.setItem("current_user", JSON.stringify(user));
    },

    getUser() {
        const user = sessionStorage.getItem("current_user");
        return user ? JSON.parse(user) : null;
    },

    clear() {
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("current_user");
    },

    isLoggedIn() {
        return Boolean(this.getToken());
    }
};

// Common API request function
async function apiRequest(endpoint, options = {}) {
    const token = AuthStorage.getToken();
    const isFormData = options.body instanceof FormData;

    const headers = { ...options.headers };

    if (!isFormData && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message =
            data.detail ||
            data.message ||
            `Request failed with status ${response.status}`;

        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    return data;
}

function resolveImageUrl(imageUrl) {
    return new URL(imageUrl, API_BASE_URL).href;
}

function updateAuthNavigation() {
    const navActions = document.querySelectorAll(".nav-actions");
    const user = AuthStorage.getUser();

    navActions.forEach((container) => {
        container.replaceChildren();

        if (AuthStorage.isLoggedIn()) {
            const greeting = document.createElement("span");
            greeting.className = "nav-user";
            greeting.textContent = `Hi, ${(user && user.name) || "User"}`;

            const logout = document.createElement("button");
            logout.className = "nav-link nav-logout";
            logout.type = "button";
            logout.dataset.logout = "";
            logout.textContent = "Logout";

            container.append(greeting, logout);
            return;
        }

        const loginLink = document.createElement("a");
        loginLink.className = "nav-link";
        loginLink.href = "login.html";
        loginLink.textContent = "Login";

        const registerLink = document.createElement("a");
        registerLink.className = "nav-link";
        registerLink.href = "register.html";
        registerLink.textContent = "Register";

        container.append(loginLink, registerLink);
    });
}
