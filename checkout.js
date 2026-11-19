
// ===================================
// OWO - CHECKOUT
// ===================================


// 1. API AND CART DATA

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


// 2. HELPER FUNCTIONS

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


function resetOrderButton() {

    isSubmitting = false;

    placeOrderButton.disabled = false;

    placeOrderButton.innerHTML = `
        PLACE YOUR ORDER
        <i class="fa-solid fa-arrow-right"></i>
    `;

}


// 3. DISPLAY PRODUCTS

function displayCheckoutProducts() {

    checkoutProducts.innerHTML = "";

    let subtotal = 0;

    cart.forEach(product => {

        const price = Number(product.price);

        const quantity = Number(product.quantity);

        if (
            !Number.isFinite(price) ||
            price <= 0 ||
            !Number.isInteger(quantity) ||
            quantity < 1
        ) {
            return;
        }

        subtotal += price * quantity;

        const image = getProductImage(product);

        const item = document.createElement("div");

        item.className = "checkout-product";

        item.innerHTML = `
            <img
                src="${escapeHTML(image)}"
                alt="${escapeHTML(product.name)}"
                onerror="this.style.display='none';"
            >

            <div class="checkout-product-info">

                <h3>${escapeHTML(product.name)}</h3>

                ${product.size ? `
                    <p>Size: ${escapeHTML(product.size)}</p>
                ` : ""}

                <p>Quantity: ${quantity}</p>

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


    if (cart.length === 0) {

        checkoutProducts.innerHTML = `
            <p>Your shopping bag is empty.</p>
            <a href="index.html#collections">Continue shopping</a>
        `;

        placeOrderButton.disabled = true;

    }

}


// 4. SUBMIT CUSTOMER ORDER

checkoutForm.addEventListener("submit", async event => {

    event.preventDefault();

    if (isSubmitting) {
        return;
    }


    // CHECK EMPTY CART

    if (cart.length === 0) {

        alert("Your shopping bag is empty.");

        return;

    }


    // CHECK LOGIN

    const customerToken = localStorage.getItem(CUSTOMER_TOKEN_KEY);

    if (!customerToken) {

        alert("Please login before placing an order.");

        window.location.href = "login.html";

        return;

    }


    // CHECK PAYMENT METHOD

    const paymentOption = document.querySelector(
        'input[name="payment"]:checked'
    );

    if (!paymentOption) {

        alert("Please select a payment method.");

        return;

    }


    // ONLINE PAYMENT IS CURRENTLY DISABLED

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


    // BASIC VALIDATION

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

        if (
            !result.order ||
            !result.order.orderNumber
        ) {

            throw new Error(
                "Order confirmation details are missing. Please check My Account before trying again."
            );

        }


        // SAVE PRODUCT IMAGES FOR CONFIRMATION PAGE

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


        // SAVE ORDER CONFIRMATION

        localStorage.setItem(
            "owoLastOrder",
            JSON.stringify(order)
        );


        // CLEAR CART AFTER SUCCESSFUL ORDER

        localStorage.removeItem("owoCart");


        // REDIRECT TO SUCCESS PAGE

        window.location.href = "order-success.html";


    } catch (error) {

        console.error("OWO Checkout Error:", error);

        alert(error.message || "Unable to place your order.");

        resetOrderButton();

    }

});


// 5. INITIAL DISPLAY

displayCheckoutProducts();

console.log("OWO Checkout Connected Successfully!");
