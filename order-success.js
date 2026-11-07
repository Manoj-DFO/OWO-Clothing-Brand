
// ===================================
// OWO - ORDER CONFIRMATION
// ===================================

// 1. GET THE SAVED ORDER

const savedOrder = localStorage.getItem("owoLastOrder");

const orderIdElement = document.getElementById("order-id");

// 2. CHECK WHETHER AN ORDER EXISTS

if (!savedOrder) {

    document.querySelector(".confirmation-page").innerHTML = `
        <div class="confirmation-hero">
            <div class="success-icon">
                <i class="fa-solid fa-bag-shopping"></i>
            </div>

            <h1>No Order <span>Found.</span></h1>

            <p class="confirmation-message">
                You haven't placed an order yet.
            </p>

            <a href="index.html" class="continue-shopping">
                GO TO SHOPPING
            </a>
        </div>
    `;

} else {

    const order = JSON.parse(savedOrder);

    // 3. ORDER ID

    if (!order.orderId) {
        order.orderId = "OWO-" + Date.now().toString().slice(-8);

        localStorage.setItem("owoLastOrder", JSON.stringify(order));
    }

    orderIdElement.textContent = order.orderId;

    // 4. FORMAT PRICE

    function formatPrice(price) {
        return "₹" + Number(price).toLocaleString("en-IN");
    }

    // 5. DISPLAY PRODUCTS

    const productsContainer =
        document.getElementById("confirmed-products");

    productsContainer.innerHTML = "";

    (order.products || []).forEach(product => {

        const image = product.image_url || product.imageUrl || product.image || "";

        const item = document.createElement("div");

        item.className = "confirmed-product";

        item.innerHTML = `
            <img
                src="${image}"
                alt="${product.name}"
                onerror="this.style.display='none';"
            >

            <div class="confirmed-product-info">
                <h3>${product.name}</h3>
                ${product.size ? `<p>Size: ${product.size}</p>` : ""}
                <p>Quantity: ${product.quantity}</p>
            </div>

            <strong>
                ${formatPrice(product.price * product.quantity)}
            </strong>
        `;

        productsContainer.appendChild(item);

    });

    // 6. DISPLAY TOTAL

    document.getElementById("confirmed-total").textContent =
        formatPrice(order.total);

    // 7. CUSTOMER DETAILS

    const customer = order.customer;

    document.getElementById("confirmed-name").textContent =
        customer.name;

    document.getElementById("confirmed-email").textContent =
        customer.email;

    document.getElementById("confirmed-phone").textContent =
        customer.phone;

    document.getElementById("confirmed-address").textContent =
        `${customer.address}, ${customer.city}, ${customer.state} - ${customer.pincode}`;

    document.getElementById("confirmed-payment").textContent =
        customer.payment === "cod"
            ? "Cash on Delivery"
            : "Online Payment (Demo)";

    // 8. ORDER DATE

    const orderDate = new Date(order.createdAt);

    document.getElementById("confirmed-date").textContent =
        orderDate.toLocaleString("en-IN");
}

console.log("OWO Order Confirmation Loaded!");
