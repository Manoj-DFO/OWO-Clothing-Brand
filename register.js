
// ===================================
// OWO - CUSTOMER REGISTRATION
// ===================================

const API_URL = "http://localhost:3000/api/auth/register";

const TOKEN_KEY = "owoCustomerToken";

// PASSWORD VISIBILITY

function setupPasswordToggle(buttonId, inputId) {
    const button = document.getElementById(buttonId);
    const input = document.getElementById(inputId);

    button.addEventListener("click", () => {
        const isPassword = input.type === "password";

        input.type = isPassword ? "text" : "password";

        button.innerHTML = isPassword
            ? '<i class="fa-regular fa-eye-slash"></i>'
            : '<i class="fa-regular fa-eye"></i>';
    });
}

setupPasswordToggle("togglePassword", "password");

setupPasswordToggle("toggleConfirmPassword", "confirmPassword");

// REGISTRATION FORM

const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");
const registerButton = document.getElementById("registerButton");

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    message.textContent = "";
    message.className = "message";

    // CHECK PASSWORD MATCH

    if (password !== confirmPassword) {
        message.textContent = "Passwords do not match.";
        return;
    }

    // CHECK PHONE NUMBER

    if (!/^\d{10}$/.test(phone)) {
        message.textContent = "Enter a valid 10-digit phone number.";
        return;
    }

    // CHECK PASSWORD LENGTH

    if (password.length < 8) {
        message.textContent = "Password must contain at least 8 characters.";
        return;
    }

    registerButton.disabled = true;
    registerButton.innerHTML = "CREATING ACCOUNT...";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                email,
                phone,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Registration failed.");
        }

        // SAVE CUSTOMER TOKEN

        localStorage.setItem(TOKEN_KEY, data.token);

        // SAVE CUSTOMER DETAILS

        localStorage.setItem(
            "owoCustomer",
            JSON.stringify(data.customer)
        );

        message.textContent = "Account created successfully! Redirecting...";
        message.classList.add("success");

        // GO TO CUSTOMER ACCOUNT

        window.location.href = "account.html";

    } catch (error) {
        message.textContent = error.message || "Unable to connect to server.";
    } finally {
        registerButton.disabled = false;
        registerButton.innerHTML = 'CREATE ACCOUNT <i class="fa-solid fa-arrow-right"></i>';
    }
});
