
// ===================================
// OWO - CUSTOMER ACCOUNT DASHBOARD
// ===================================

const API_BASE = "http://localhost:3000/api";
const TOKEN_KEY = "owoCustomerToken";

const token = localStorage.getItem(TOKEN_KEY);

const ordersContainer = document.getElementById("ordersContainer");
const accountMessage = document.getElementById("accountMessage");

// CHECK CUSTOMER LOGIN

if (!token) {
    window.location.href = "login.html";
}

// API REQUEST HELPER

async function apiRequest(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    const data = await response.json();

    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem("owoCustomer");
        window.location.href = "login.html";
        throw new Error("Please log in again.");
    }

    if (!response.ok) {
        throw new Error(data.message || "Unable to load information.");
    }

    return data;
}

// DATE FORMATTER

function formatDate(dateValue) {
    if (!dateValue) return "Not available";

    const date = new Date(dateValue);

    if (isNaN(date.getTime())) return "Not available";

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

// DATE AND TIME FORMATTER

function formatDateTime(dateValue) {
    if (!dateValue) return "Not available";

    const date = new Date(dateValue);

    if (isNaN(date.getTime())) return "Not available";

    return date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// CURRENCY FORMATTER

function formatPrice(amount) {
    return Number(amount || 0).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    });
}

// SAFE HTML TEXT

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

// LOAD CUSTOMER PROFILE

async function loadCustomerProfile() {
    const data = await apiRequest("/auth/me");

    const customer = data.customer;

    if (!customer) {
        throw new Error("Customer information not found.");
    }

    document.getElementById("customerName").textContent =
        customer.name || "Customer";

    document.getElementById("customerEmail").textContent =
        customer.email || "Not available";

    document.getElementById("customerPhone").textContent =
        customer.phone || "Not available";

    document.getElementById("customerSince").textContent =
        formatDate(customer.created_at);

    localStorage.setItem(
        "owoCustomer",
        JSON.stringify(customer)
    );
}

// STATUS CLASS

function getStatusClass(status) {
    return String(status || "")
        .toLowerCase()
        .replace(/\s+/g, "-");
}

// GET PRODUCT DETAILS

function renderOrderProducts(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return `
            <p class="order-product-info">
                Product information unavailable.
            </p>
        `;
    }

    return items.map(item => {
        const productName =
            item.product_name ||
            item.name ||
            item.title ||
            "OWO Product";

        const size =
            item.size ||
            item.product_size ||
            "Not specified";

        const quantity = Number(item.quantity || 1);

        const price = Number(
            item.price ??
            item.unit_price ??
            item.product_price ??
            0
        );

        return `
            <div class="order-product">

                <div>
                    <p class="order-product-name">
                        ${escapeHTML(productName)}
                    </p>

                    <p class="order-product-info">
                        Size: ${escapeHTML(size)}
                    </p>

                    <p class="order-product-info">
                        Quantity: ${quantity}
                    </p>
                </div>

                <p class="order-product-price">
                    ${formatPrice(price * quantity)}
                </p>

            </div>
        `;
    }).join("");
}

// TRACKING HISTORY

function renderTrackingHistory(history) {
    if (!Array.isArray(history) || history.length === 0) {
        return `
            <p class="order-product-info">
                No tracking updates available yet.
            </p>
        `;
    }

    return `
        <div class="tracking-history">

            ${history.map(event => {
                const eventStatus =
                    event.status ||
                    event.event_status ||
                    event.tracking_status ||
                    "Order update";

                const eventLocation =
                    event.location ||
                    event.current_location ||
                    "";

                const eventDescription =
                    event.description ||
                    event.notes ||
                    event.message ||
                    "";

                const eventDate =
                    event.created_at ||
                    event.event_time;

                return `
                    <div class="tracking-event">

                        <div class="tracking-event-content">

                            <strong>
                                ${escapeHTML(eventStatus)}
                            </strong>

                            ${eventLocation ? `
                                <p>
                                    ${escapeHTML(eventLocation)}
                                </p>
                            ` : ""}

                            ${eventDescription ? `
                                <p>
                                    ${escapeHTML(eventDescription)}
                                </p>
                            ` : ""}

                            <small>
                                ${formatDateTime(eventDate)}
                            </small>

                        </div>

                    </div>
                `;
            }).join("")}

        </div>
    `;
}

// LOAD ORDER HISTORY

async function loadOrders() {
    const data = await apiRequest("/orders/my-orders");

    const orders = data.orders || [];

    // ORDER COUNTS

    const cancelledCount = orders.filter(order => {
        const status = String(order.order_status || "").toLowerCase();

        return status === "cancelled" ||
            status === "delivery failed";
    }).length;

    document.getElementById("totalOrders").textContent =
        data.totalOrders ?? orders.length;

    document.getElementById("processingOrders").textContent =
        data.processing ?? 0;

    document.getElementById("shippingOrders").textContent =
        data.shipping ?? 0;

    document.getElementById("deliveredOrders").textContent =
        data.delivered ?? 0;

    document.getElementById("cancelledOrders").textContent =
        cancelledCount;

    // EMPTY ORDER HISTORY

    if (orders.length === 0) {
        ordersContainer.innerHTML = `
            <div class="empty-orders">
                <i class="fa-solid fa-bag-shopping"></i>

                <h3>No orders yet</h3>

                <p>Your OWO shopping journey starts here.</p>

                <br>

                <a href="shop.html" class="shop-link">
                    EXPLORE COLLECTIONS
                </a>
            </div>
        `;

        return;
    }

    // DISPLAY ORDERS

    ordersContainer.innerHTML = orders.map(order => {
        const status = order.order_status || "Pending";
        const statusClass = getStatusClass(status);

        return `
            <article class="order-card">

                <div class="order-top">

                    <div>
                        <p class="order-number">
                            Order #${escapeHTML(order.order_number)}
                        </p>

                        <p class="order-date">
                            Placed on ${formatDate(order.created_at)}
                        </p>
                    </div>

                    <span class="order-status status-${escapeHTML(statusClass)}">
                        ${escapeHTML(status)}
                    </span>

                </div>

                <div class="order-products">

                    ${renderOrderProducts(order.items)}

                </div>

                <div class="order-bottom">

                    <div class="order-total">
                        <span>ORDER TOTAL</span>

                        <strong>
                            ${formatPrice(order.total_amount)}
                        </strong>
                    </div>

                    <button
                        class="view-order-btn"
                        type="button"
                        data-order-id="${escapeHTML(order.id)}"
                    >
                        VIEW DETAILS
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>

                </div>

                <div class="order-details" id="details-${escapeHTML(order.id)}">

                    <h4>ORDER INFORMATION</h4>

                    <p>
                        <strong>Order Number:</strong>
                        ${escapeHTML(order.order_number)}
                    </p>

                    <p>
                        <strong>Payment Method:</strong>
                        ${escapeHTML(order.payment_method || "Not available")}
                    </p>

                    <p>
                        <strong>Payment Status:</strong>
                        ${escapeHTML(order.payment_status || "Not available")}
                    </p>

                    <p>
                        <strong>Order Status:</strong>
                        ${escapeHTML(status)}
                    </p>

                    <p>
                        <strong>Estimated Delivery:</strong>
                        ${formatDate(order.estimated_delivery_date)}
                    </p>

                    <p>
                        <strong>Courier:</strong>
                        ${escapeHTML(order.courier_name || "Not assigned")}
                    </p>

                    <p>
                        <strong>Tracking Number:</strong>
                        ${escapeHTML(order.tracking_number || "Not assigned")}
                    </p>

                    <hr>

                    <h4>TRACKING HISTORY</h4>

                    ${renderTrackingHistory(order.tracking_history)}

                </div>

            </article>
        `;
    }).join("");

    // VIEW DETAILS BUTTONS

    document.querySelectorAll(".view-order-btn").forEach(button => {
        button.addEventListener("click", () => {
            const orderId = button.dataset.orderId;

            const details = document.getElementById(
                `details-${orderId}`
            );

            details.classList.toggle("active");

            button.innerHTML = details.classList.contains("active")
                ? 'HIDE DETAILS <i class="fa-solid fa-arrow-up"></i>'
                : 'VIEW DETAILS <i class="fa-solid fa-arrow-right"></i>';
        });
    });
}

// LOGOUT

document.getElementById("logoutButton").addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("owoCustomer");

    window.location.href = "index.html";
});

// INITIALIZE DASHBOARD

async function initializeAccount() {
    try {
        await loadCustomerProfile();
        await loadOrders();

    } catch (error) {
        accountMessage.textContent = error.message;

        ordersContainer.innerHTML = `
            <div class="loading-message">
                Unable to load your account information.
            </div>
        `;
    }
}

if (token) {
    initializeAccount();
}
