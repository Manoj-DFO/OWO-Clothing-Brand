
// ===================================
// OWO - CUSTOMER LOGIN
// ===================================

const API_URL = "http://localhost:3000/api/auth/login";
const TOKEN_KEY = "owoCustomerToken";

// PASSWORD VISIBILITY

const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

togglePassword.addEventListener("click", () => {

    const isPassword = passwordInput.type === "password";

    passwordInput.type = isPassword ? "text" : "password";

    togglePassword.innerHTML = isPassword
        ? '<i class="fa-regular fa-eye-slash"></i>'
        : '<i class="fa-regular fa-eye"></i>';

});

// LOGIN FORM

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const loginButton = document.getElementById("loginButton");

loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = passwordInput.value;

    message.textContent = "";
    message.className = "message";

    if (!email || !password) {
        message.textContent = "Please enter your email and password.";
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "SIGNING IN...";

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
            throw new Error("Invalid server response. Please try again.");
        }

        // SAVE CUSTOMER LOGIN TOKEN

        localStorage.setItem(TOKEN_KEY, data.token);

        // SAVE CUSTOMER DETAILS

        localStorage.setItem(
            "owoCustomer",
            JSON.stringify(data.customer)
        );

        message.textContent = "Login successful! Redirecting...";
        message.classList.add("success");

        // GO TO CUSTOMER ACCOUNT

        window.location.href = "account.html";

    } catch (error) {

        console.error("Customer login error:", error);

        message.textContent =
            error.message === "Failed to fetch"
                ? "Unable to connect to server. Please try again."
                : error.message || "Unable to log in.";

    } finally {

        loginButton.disabled = false;

        loginButton.innerHTML =
            'SIGN IN <i class="fa-solid fa-arrow-right"></i>';

    }

});

console.log("OWO Customer Login Connected!");
