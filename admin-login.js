
const LOGIN_API = "http://localhost:3000/api/admin/login";

const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("login-button");
const loginMessage = document.getElementById("login-message");

if (localStorage.getItem("owoAdminToken")) {
    window.location.replace("admin.html");
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    loginMessage.textContent = "";
    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";

    try {
        const response = await fetch(LOGIN_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Login failed.");
        }

        if (!data.token) {
            throw new Error("Authentication token was not received.");
        }

        localStorage.setItem("owoAdminToken", data.token);
        localStorage.setItem("owoAdminUsername", username);

        loginMessage.style.color = "#26965d";
        loginMessage.textContent = "Login successful!";

        window.location.replace("admin.html");

    } catch (error) {
        loginMessage.style.color = "#d93636";
        loginMessage.textContent = error.message;

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Sign In";
    }
});
