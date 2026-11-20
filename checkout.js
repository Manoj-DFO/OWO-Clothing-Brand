
/* =====================================
   OWO - CHECKOUT
===================================== */

// =====================================
// 1. API AND CART DATA
// =====================================

const API_URL = "http://localhost:3000/api/orders";

let cart = [];

try {
    const savedCart = JSON.parse(localStorage.getItem("owoCart"));
    cart = Array.isArray(savedCart) ? savedCart : [];
} catch (error) {
    console.error("Cart loading error:", error);
    cart = [];
}

const checkoutProducts = document.getElementById("checkout-products");
const checkoutForm = document.getElementById("checkout-form");
const placeOrderButton = document.querySelector(".place-order-button");

const CUSTOMER_TOKEN_KEY = "owoCustomerToken";

let isSubmitting = false;


// =====================================
// 2. HELPER FUNCTIONS
// =====================================

function formatPrice(price) {
    return "₹" + Number(price).toLocaleString("en-IN");
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function getProductImage(product) {
    return product.image_url || product.imageUrl || product.image || "";
}

function isCustomItem(product) {
    return product.isCustom === true;
}

function hasConfirmedPrice(product) {
    return (
        product.price !== null &&
        product.price !== "" &&
        Number.isFinite(Number(product.price)) &&
        Number(product.price) > 0 &&
        product.priceStatus === "confirmed"
    );
}

function resetOrderButton() {
    isSubmitting = false;

    if (!placeOrderButton) return;

    placeOrderButton.disabled = false;

    placeOrderButton.innerHTML = `
        PLACE YOUR ORDER
        <i class="fa-solid fa-arrow-right"></i>
    `;
}

function getCustomizationHTML(customization) {
    if (!customization) return "";

    let html = "";

    if (customization.colour) {
        html += `
            <p>Colour: <strong>${escapeHTML(customization.colour)}</strong></p>
        `;
    }

    if (customization.fit) {
        const fit = customization.fit === "bootcut"
            ? "Bootcut Fit"
            : "Straight Fit";

        html += `
            <p>Fit: <strong>${escapeHTML(fit)}</strong></p>
        `;
    }

    if (customization.measurements) {
        html += `<div class="checkout-measurements"><strong>Measurements</strong>`;

        Object.entries(customization.measurements).forEach(([name, data]) => {
            if (!data || data.value === "") return;

            html += `
                <p>
                    ${escapeHTML(name)}:
                    ${escapeHTML(data.value)} ${escapeHTML(data.unit)}
                </p>
            `;
        });

        html += `</div>`;
    }

    html += `
        <p>Logo / Design:
            <strong>${customization.logo ? "Uploaded" : "Not added"}</strong>
        </p>
    `;

    return html;
}


// =====================================
// 3. VALIDATE CART BEFORE DISPLAY
// =====================================

function validateCart() {

    if (!Array.isArray(cart) || cart.length === 0) {
        return "Your shopping bag is empty.";
    }

    for (const product of cart) {

        const quantity = Number(product.quantity);

        if (!Number.isInteger(quantity) || quantity < 1) {
            return "Your cart contains an invalid quantity.";
        }

        if (isCustomItem(product)) {

            if (!hasConfirmedPrice(product)) {
                return "Your custom design is waiting for price confirmation from OWO.";
            }

            if (product.stockStatus !== "confirmed") {
                return "Your custom garment is waiting for stock confirmation from OWO.";
            }

        } else {

            const price = Number(product.price);

            if (!Number.isFinite(price) || price <= 0) {
                return "Your cart contains an invalid product price.";
            }

        }
    }

    return null;
}


// =====================================
// 4. DISPLAY PRODUCTS
// =====================================

function displayCheckoutProducts() {

    if (!checkoutProducts) return;

    checkoutProducts.innerHTML = "";

    let subtotal = 0;

    const cartError = validateCart();

    if (cartError) {

        checkoutProducts.innerHTML = `
            <div class="checkout-cart-warning">
                <p>${escapeHTML(cartError)}</p>
                <a href="cart.html">Return to shopping cart</a>
            </div>
        `;

        document.getElementById("checkout-subtotal").textContent = formatPrice(0);
        document.getElementById("checkout-total").textContent = formatPrice(0);

        if (placeOrderButton) {
            placeOrderButton.disabled = true;
        }

        return;
    }

    cart.forEach(product => {

        const price = Number(product.price);
        const quantity = Number(product.quantity);

        subtotal += price * quantity;

        const image = getProductImage(product);

        const custom = isCustomItem(product);

        const item = document.createElement("div");

        item.className = "checkout-product";

        item.innerHTML = `
            ${image ? `
                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(product.name)}"
                    onerror="this.style.display='none';"
                >
            ` : ""}

            <div class="checkout-product-info">

                <h3>${escapeHTML(product.name)}</h3>

                ${custom ? `
                    <p>OWO CUSTOM STUDIO</p>
                ` : ""}

                ${product.size ? `
                    <p>Size: ${escapeHTML(product.size)}</p>
                ` : ""}

                <p>Quantity: ${quantity}</p>

                ${custom ? getCustomizationHTML(product.customization) : ""}

            </div>

            <strong>
                ${formatPrice(price * quantity)}
            </strong>
        `;

        checkoutProducts.appendChild(item);
    });

    document.getElementById("checkout-subtotal").textContent =
        formatPrice(subtotal);

    document.getElementById("checkout-total").textContent =
        formatPrice(subtotal);

    if (placeOrderButton) {
        placeOrderButton.disabled = false;
    }
}


// =====================================
// 5. SUBMIT CUSTOMER ORDER
// =====================================

if (checkoutForm) {

    checkoutForm.addEventListener("submit", async event => {

        event.preventDefault();

        if (isSubmitting) return;

        // CHECK CART

        const cartError = validateCart();

        if (cartError) {
            alert(cartError);
            window.location.href = "cart.html";
            return;
        }

        // CHECK LOGIN

        const customerToken = localStorage.getItem(CUSTOMER_TOKEN_KEY);

        if (!customerToken) {

            alert("Please login before placing an order.");

            window.location.href = "login.html";

            return;
        }

        // CHECK PAYMENT

        const paymentOption = document.querySelector(
            'input[name="payment"]:checked'
        );

        if (!paymentOption) {
            alert("Please select a payment method.");
            return;
        }

        if (paymentOption.value !== "cod") {
            alert("Online payment is coming soon. Please choose Cash on Delivery.");
            return;
        }

        // CUSTOMER DETAILS

        const customer = {

            name: document.getElementById("customer-name").value.trim(),

            email: document.getElementById("customer-email").value.trim(),

            phone: document.getElementById("customer-phone").value.trim(),

            address: document.getElementById("address").value.trim(),

            city: document.getElementById("city").value.trim(),

            state: document.getElementById("state").value.trim(),

            pincode: document.getElementById("pincode").value.trim()

        };

        // VALIDATE CUSTOMER DETAILS

        if (
            !customer.name ||
            !customer.email ||
            !customer.phone ||
            !customer.address ||
            !customer.city ||
            !customer.state ||
            !customer.pincode
        ) {
            alert("Please complete all customer and delivery details.");
            return;
        }

        if (!/^[0-9]{10}$/.test(customer.phone)) {
            alert("Please enter a valid 10-digit phone number.");
            return;
        }

        if (!/^[0-9]{6}$/.test(customer.pincode)) {
            alert("Please enter a valid 6-digit PIN code.");
            return;
        }

        // PREVENT DUPLICATE SUBMISSION

        isSubmitting = true;

        placeOrderButton.disabled = true;
        placeOrderButton.textContent = "PROCESSING ORDER...";

        try {

            const response = await fetch(API_URL, {

                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${customerToken}`
                },

                body: JSON.stringify({

                    customer: customer,

                    products: cart,

                    payment: "cod"

                })

            });

            // READ SERVER RESPONSE

            let result;

            try {
                result = await response.json();
            } catch {
                throw new Error("Invalid response from OWO server. Please try again.");
            }

            // HANDLE ERRORS

            if (!response.ok) {

                if (
                    response.status === 401 ||
                    response.status === 403
                ) {

                    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
                    localStorage.removeItem("owoCustomer");

                    alert("Your login session has expired. Please login again.");

                    window.location.href = "login.html";

                    return;
                }

                throw new Error(
                    result.message || "Unable to place your order."
                );
            }

            // CHECK ORDER CONFIRMATION

            if (!result.order || !result.order.orderNumber) {
                throw new Error(
                    "Order confirmation details are missing. Please check My Account before trying again."
                );
            }

            // SAVE PRODUCT IMAGES AND CUSTOMIZATION

            const confirmationProducts = cart.map(product => ({
                ...product,
                image_url: getProductImage(product)
            }));

            // PREPARE ORDER DETAILS

            const order = {

                orderId: result.order.orderNumber,

                customer: customer,

                products: confirmationProducts,

                total: result.order.total,

                status: result.order.status,

                paymentMethod: "cod",

                createdAt: result.order.createdAt || new Date().toISOString()

            };

            // SAVE CONFIRMATION

            localStorage.setItem(
                "owoLastOrder",
                JSON.stringify(order)
            );

            // CLEAR CART

            localStorage.removeItem("owoCart");

            // REDIRECT

            window.location.href = "order-success.html";

        } catch (error) {

            console.error("OWO Checkout Error:", error);

            alert(error.message || "Unable to place your order.");

            resetOrderButton();

        }

    });

}


// =====================================
// 6. INITIAL DISPLAY
// =====================================

displayCheckoutProducts();

console.log("OWO Checkout Connected Successfully!");
