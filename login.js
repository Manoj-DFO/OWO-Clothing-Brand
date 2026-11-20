
// ===================================
// OWO - CUSTOMER LOGIN
// ===================================

const API_BASE_URL = "http://localhost:3000/api/auth";

const API_URL = `${API_BASE_URL}/login`;
const PROFILE_URL = `${API_BASE_URL}/me`;

const TOKEN_KEY = "owoCustomerToken";
const CUSTOMER_KEY = "owoCustomer";

// ===================================
// ELEMENTS
// ===================================

const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const loginButton = document.getElementById("loginButton");

// ===================================
// SHOW MESSAGE
// ===================================

function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = type === "success"
        ? "message success"
        : "message";
}

// ===================================
// PASSWORD VISIBILITY
// ===================================

togglePassword.addEventListener("click", () => {

    const isPassword = passwordInput.type === "password";

    passwordInput.type = isPassword ? "text" : "password";

    togglePassword.innerHTML = isPassword
        ? '<i class="fa-regular fa-eye-slash"></i>'
        : '<i class="fa-regular fa-eye"></i>';

    togglePassword.setAttribute(
        "aria-label",
        isPassword ? "Hide password" : "Show password"
    );

});

// ===================================
// SAVE CUSTOMER SESSION
// ===================================

function saveCustomerSession(token, customer) {

    if (!token || !customer) {
        throw new Error("Invalid customer login response.");
    }

    localStorage.setItem(TOKEN_KEY, token);

    localStorage.setItem(
        CUSTOMER_KEY,
        JSON.stringify(customer)
    );

}

// ===================================
// GOOGLE LOGIN CALLBACK
// ===================================

async function handleGoogleLogin() {

    const hash = window.location.hash;

    if (!hash) {
        return;
    }

    const params = new URLSearchParams(hash.substring(1));

    const googleToken = params.get("google_token");
    const googleError = params.get("google_error");

    // Remove the token from the browser address bar.
    if (googleToken || googleError) {
        window.history.replaceState(
            null,
            document.title,
            window.location.pathname + window.location.search
        );
    }

    if (googleError) {
        showMessage(googleError);
        return;
    }

    if (!googleToken) {
        return;
    }

    loginButton.disabled = true;
    loginButton.innerHTML = '<span>VERIFYING GOOGLE LOGIN...</span>';

    try {

        showMessage("Google verified. Loading your OWO account...", "success");

        // Get the customer profile using the Google-issued OWO token.

        const response = await fetch(PROFILE_URL, {

            method: "GET",

            headers: {
                "Authorization": `Bearer ${googleToken}`
            }

        });

        const data = await response.json();

        if (!response.ok || !data.customer) {
            throw new Error(
                data.message || "Unable to load your OWO account."
            );
        }

        // Save Google customer login.

        saveCustomerSession(
            googleToken,
            data.customer
        );

        showMessage("Google login successful! Redirecting...", "success");

        window.location.replace("account.html");

    } catch (error) {

        console.error("OWO Google login error:", error);

        showMessage(
            error.message || "Google login failed. Please try again."
        );

        loginButton.disabled = false;

        loginButton.innerHTML =
            '<span>SIGN IN</span><i class="fa-solid fa-arrow-right"></i>';

    }

}

// ===================================
// NORMAL EMAIL LOGIN
// ===================================

loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = passwordInput.value;

    showMessage("");

    if (!email || !password) {
        showMessage("Please enter your email and password.");
        return;
    }

    loginButton.disabled = true;

    loginButton.innerHTML = '<span>SIGNING IN...</span>';

    try {

        const response = await fetch(API_URL, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email,
                password
            })

        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Login failed.");
        }

        if (!data.token || !data.customer) {
            throw new Error(
                "Invalid server response. Please try again."
            );
        }

        // Save normal customer login.

        saveCustomerSession(
            data.token,
            data.customer
        );

        showMessage("Login successful! Redirecting...", "success");

        window.location.replace("account.html");

    } catch (error) {

        console.error("Customer login error:", error);

        showMessage(
            error.message === "Failed to fetch"
                ? "Unable to connect to server. Please try again."
                : error.message || "Unable to log in."
        );

    } finally {

        loginButton.disabled = false;

        loginButton.innerHTML =
            '<span>SIGN IN</span><i class="fa-solid fa-arrow-right"></i>';

    }

});

// ===================================
// START GOOGLE LOGIN CALLBACK CHECK
// ===================================

handleGoogleLogin();

console.log("OWO Customer Login Connected!");
