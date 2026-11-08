
// ===================================
// OWO - ORDER CONFIRMATION
// ===================================

// 1. GET THE SAVED ORDER

const savedOrder = localStorage.getItem("owoLastOrder");

const confirmationPage = document.querySelector(".confirmation-page");


// 2. HELPER FUNCTIONS

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function formatPrice(price) {
    return "₹" + Number(price || 0).toLocaleString("en-IN");
}


// 3. CHECK WHETHER AN ORDER EXISTS

if (!savedOrder) {

    confirmationPage.innerHTML = `
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

    try {

        const order = JSON.parse(savedOrder);

        // 4. VALIDATE ORDER INFORMATION

        if (!order.orderId || !order.customer) {
            throw new Error("Order information is incomplete.");
        }

        // 5. DISPLAY ORDER ID

        document.getElementById("order-id").textContent =
            order.orderId;


        // 6. DISPLAY PRODUCTS

        const productsContainer =
            document.getElementById("confirmed-products");

        productsContainer.innerHTML = "";

        (order.products || []).forEach(product => {

            const image =
                product.image_url ||
                product.imageUrl ||
                product.image ||
                "";

            const item = document.createElement("div");

            item.className = "confirmed-product";

            item.innerHTML = `
                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(product.name)}"
                    onerror="this.style.display='none';"
                >

                <div class="confirmed-product-info">

                    <h3>${escapeHTML(product.name)}</h3>

                    ${product.size ? `
                        <p>Size: ${escapeHTML(product.size)}</p>
                    ` : ""}

                    <p>
                        Quantity: ${Number(product.quantity || 1)}
                    </p>

                </div>

                <strong>
                    ${formatPrice(
                        Number(product.price || 0) *
                        Number(product.quantity || 1)
                    )}
                </strong>
            `;

            productsContainer.appendChild(item);

        });


        // 7. DISPLAY TOTAL

        document.getElementById("confirmed-total").textContent =
            formatPrice(order.total);


        // 8. CUSTOMER DETAILS

        const customer = order.customer;

        document.getElementById("confirmed-name").textContent =
            customer.name || "Not available";

        document.getElementById("confirmed-email").textContent =
            customer.email || "Not available";

        document.getElementById("confirmed-phone").textContent =
            customer.phone || "Not available";

        document.getElementById("confirmed-address").textContent = [
            customer.address,
            customer.city,
            customer.state,
            customer.pincode
        ].filter(Boolean).join(", ");


        // 9. PAYMENT INFORMATION

        const paymentStatus = String(order.paymentStatus || "").toLowerCase();

        if (paymentStatus === "paid") {

            document.getElementById("confirmed-payment").textContent =
                "Online Payment - Paid";

        } else if (customer.payment === "cod") {

            document.getElementById("confirmed-payment").textContent =
                "Cash on Delivery";

        } else {

            document.getElementById("confirmed-payment").textContent =
                "Online Payment - Pending Confirmation";

        }


        // 10. ORDER DATE

        const orderDate = order.createdAt
            ? new Date(order.createdAt)
            : null;

        document.getElementById("confirmed-date").textContent =
            orderDate && !isNaN(orderDate.getTime())
                ? orderDate.toLocaleString("en-IN")
                : "Not available";

    } catch (error) {

        console.error("Order confirmation error:", error);

        confirmationPage.innerHTML = `
            <div class="confirmation-hero">
                <h1>Order <span>Information Unavailable.</span></h1>

                <p class="confirmation-message">
                    We couldn't display your order information.
                    Please check your account order history.
                </p>

                <a href="account.html" class="continue-shopping">
                    VIEW MY ORDERS
                </a>
            </div>
        `;
    }
}

console.log("OWO Order Confirmation Loaded!");
