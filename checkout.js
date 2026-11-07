
// ===================================
// OWO - CHECKOUT
// ===================================

// 1. API AND CART DATA

const API_URL = "http://localhost:3000/api/orders";

const cart = JSON.parse(localStorage.getItem("owoCart")) || [];

const checkoutProducts = document.getElementById("checkout-products");

const checkoutForm = document.getElementById("checkout-form");

const placeOrderButton = document.querySelector(".place-order-button");


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

// Get the product image from available image fields.

function getProductImage(product) {
    return product.image_url || product.imageUrl || product.image || "";
}


// 3. DISPLAY PRODUCTS

function displayCheckoutProducts() {

    checkoutProducts.innerHTML = "";

    let subtotal = 0;

    cart.forEach(product => {

        subtotal += Number(product.price) * Number(product.quantity);

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

                <p>Quantity: ${Number(product.quantity)}</p>
            </div>

            <strong>
                ${formatPrice(Number(product.price) * Number(product.quantity))}
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

    if (cart.length === 0) {
        alert("Your shopping bag is empty.");
        return;
    }

    const paymentOption = document.querySelector(
        'input[name="payment"]:checked'
    );

    if (!paymentOption) {
        alert("Please select a payment method.");
        return;
    }

    const customer = {

        name: document.getElementById("customer-name").value.trim(),

        email: document.getElementById("customer-email").value.trim(),

        phone: document.getElementById("customer-phone").value.trim(),

        address: document.getElementById("address").value.trim(),

        city: document.getElementById("city").value.trim(),

        state: document.getElementById("state").value.trim(),

        pincode: document.getElementById("pincode").value.trim(),

        payment: paymentOption.value
    };

    placeOrderButton.disabled = true;

    placeOrderButton.textContent = "PROCESSING ORDER...";

    try {

        // Send order to backend.

        const response = await fetch(API_URL, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                customer: customer,
                products: cart,
                payment: customer.payment
            })

        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Unable to place order.");
        }

        // Preserve product images for the confirmation page.

        const confirmationProducts = cart.map(product => ({
            ...product,
            image_url: getProductImage(product)
        }));

        // Prepare confirmation information.

        const order = {

            orderId: result.order.orderNumber,

            customer: customer,

            products: confirmationProducts,

            total: result.order.total,

            status: result.order.status,

            createdAt: new Date().toISOString()

        };

        // Save confirmation information.

        localStorage.setItem(
            "owoLastOrder",
            JSON.stringify(order)
        );

        // Clear cart.

        localStorage.removeItem("owoCart");

        // Open confirmation page.

        window.location.href = "order-success.html";

    } catch (error) {

        console.error("Checkout error:", error);

        alert(error.message);

        placeOrderButton.disabled = false;

        placeOrderButton.innerHTML = `
            PLACE YOUR ORDER
            <i class="fa-solid fa-arrow-right"></i>
        `;
    }

});


// 5. INITIAL DISPLAY

displayCheckoutProducts();

console.log("OWO Checkout Connected!");
