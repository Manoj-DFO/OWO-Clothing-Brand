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

async function apiRequest(endpoint, options = {}) {

    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: options.method || "GET",

        headers: {
            "Authorization": `Bearer ${token}`,
            ...(options.body ? {
                "Content-Type": "application/json"
            } : {})
        },

        ...(options.body ? {
            body: JSON.stringify(options.body)
        } : {})
    });

    const data = await response.json();

    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem("owoCustomer");
        window.location.href = "login.html";

        throw new Error("Please log in again.");
    }

    if (!response.ok) {
        throw new Error(data.message || "Unable to complete your request.");
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

// CANCELLATION INFORMATION

function renderCancellationInformation(cancellation) {

    if (!cancellation) {
        return "";
    }

    return `
        <div class="order-action-information">

            <h4>CANCELLATION DETAILS</h4>

            <p>
                <strong>Reason:</strong>
                ${escapeHTML(cancellation.reason)}
            </p>

            ${cancellation.description ? `
                <p>
                    <strong>Description:</strong>
                    ${escapeHTML(cancellation.description)}
                </p>
            ` : ""}

            <p>
                <strong>Cancelled on:</strong>
                ${formatDateTime(cancellation.created_at)}
            </p>

        </div>
    `;
}

// RETURN REQUEST INFORMATION

function renderReturnInformation(returnRequest) {

    if (!returnRequest) {
        return "";
    }

    return `
        <div class="order-action-information">

            <h4>RETURN REQUEST DETAILS</h4>

            <p>
                <strong>Reason:</strong>
                ${escapeHTML(returnRequest.reason)}
            </p>

            <p>
                <strong>Description:</strong>
                ${escapeHTML(returnRequest.description)}
            </p>

            <p>
                <strong>Return Status:</strong>
                ${escapeHTML(returnRequest.status)}
            </p>

            ${returnRequest.admin_note ? `
                <p>
                    <strong>Admin Note:</strong>
                    ${escapeHTML(returnRequest.admin_note)}
                </p>
            ` : ""}

            <p>
                <strong>Requested on:</strong>
                ${formatDateTime(returnRequest.created_at)}
            </p>

        </div>
    `;
}

// CUSTOMER ORDER ACTIONS

// CUSTOMER ORDER ACTIONS

function renderOrderActions(order) {

    const status = String(order.order_status || "").trim().toLowerCase();

    // Cancellation is allowed only before shipping.

    const cancellableStatuses = [
        "pending",
        "payment pending",
        "processing",
        "packed"
    ];

    const canCancel =
        cancellableStatuses.includes(status) &&
        !order.cancellation;

    const returnRequest = order.return_request;

    const canReturn =
        order.is_return_eligible === true &&
        !returnRequest;

    let html = `
        <hr>

        <h4>ORDER ACTIONS</h4>
    `;

    // CANCELLATION FORM

    if (canCancel) {

        html += `
            <div class="order-action-section">

                <h4>Cancel Order</h4>

                <p>
                    You can cancel this order before it is shipped.
                </p>

                <form
                    class="cancel-order-form"
                    data-order-id="${escapeHTML(order.id)}"
                >

                    <label>
                        Cancellation Reason
                    </label>

                    <select name="reason" required>
                        <option value="">Select a reason</option>

                        <option value="Ordered by mistake">
                            Ordered by mistake
                        </option>

                        <option value="Found a better price">
                            Found a better price
                        </option>

                        <option value="Delivery taking too long">
                            Delivery taking too long
                        </option>

                        <option value="Want to change the order">
                            Want to change the order
                        </option>

                        <option value="Other">
                            Other
                        </option>
                    </select>

                    <label>
                        Additional Details (Optional)
                    </label>

                    <textarea
                        name="description"
                        maxlength="1000"
                        rows="3"
                        placeholder="Tell us why you want to cancel this order..."
                    ></textarea>

                    <button
                        type="submit"
                        class="cancel-order-btn"
                    >
                        CANCEL ORDER
                    </button>

                </form>

            </div>
        `;

    } else if (order.cancellation) {

        html += renderCancellationInformation(order.cancellation);

    }

    // RETURN FORM

    if (canReturn) {

        html += `
            <div class="order-action-section">

                <h4>Return Order</h4>

                <p>
                    Return available until:
                    <strong>
                        ${formatDate(order.return_eligible_until)}
                    </strong>
                </p>

                <form
                    class="return-order-form"
                    data-order-id="${escapeHTML(order.id)}"
                >

                    <label>
                        Return Reason
                    </label>

                    <select name="reason" required>
                        <option value="">Select a reason</option>

                        <option value="Damaged item">
                            Damaged item
                        </option>

                        <option value="Defective item">
                            Defective item
                        </option>

                        <option value="Wrong item received">
                            Wrong item received
                        </option>

                        <option value="Size or fit issue">
                            Size or fit issue
                        </option>

                        <option value="Quality not as expected">
                            Quality not as expected
                        </option>

                        <option value="Missing parts or accessories">
                            Missing parts or accessories
                        </option>

                        <option value="Other">
                            Other
                        </option>
                    </select>

                    <label>
                        Return Description
                    </label>

                    <textarea
                        name="description"
                        maxlength="2000"
                        rows="4"
                        required
                        placeholder="Please describe the issue with your product..."
                    ></textarea>

                    <button
                        type="submit"
                        class="return-order-btn"
                    >
                        SUBMIT RETURN REQUEST
                    </button>

                </form>

            </div>
        `;

    } else if (returnRequest) {

        html += renderReturnInformation(returnRequest);

    } else if (status === "delivered" && order.delivered_at) {

        html += `
            <p class="order-product-info">
                The 5-day return period has expired.
            </p>
        `;

    }

    return html;
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

                <div
                    class="order-details"
                    id="details-${escapeHTML(order.id)}"
                >

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

                    ${renderOrderActions(order)}

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

    // CANCEL ORDER FORMS

    document.querySelectorAll(".cancel-order-form").forEach(form => {

        form.addEventListener("submit", async event => {

            event.preventDefault();

            const orderId = form.dataset.orderId;

            const formData = new FormData(form);

            const reason = formData.get("reason");
            const description = formData.get("description");

            if (!reason) {
                accountMessage.textContent =
                    "Please select a cancellation reason.";

                return;
            }

            const confirmed = window.confirm(
                "Are you sure you want to cancel this order?"
            );

            if (!confirmed) return;

            const submitButton = form.querySelector("button");

            submitButton.disabled = true;
            submitButton.textContent = "CANCELLING...";

            try {

                const result = await apiRequest(
                    `/orders/${orderId}/cancel`,
                    {
                        method: "POST",
                        body: {
                            reason,
                            description
                        }
                    }
                );

                accountMessage.textContent =
                    result.message || "Order cancelled successfully.";

                await loadOrders();

            } catch (error) {

                accountMessage.textContent = error.message;

                submitButton.disabled = false;
                submitButton.textContent = "CANCEL ORDER";

            }

        });

    });

    // RETURN ORDER FORMS

    document.querySelectorAll(".return-order-form").forEach(form => {

        form.addEventListener("submit", async event => {

            event.preventDefault();

            const orderId = form.dataset.orderId;

            const formData = new FormData(form);

            const reason = formData.get("reason");
            const description = formData.get("description");

            if (!reason) {

                accountMessage.textContent =
                    "Please select a return reason.";

                return;
            }

            if (!description || !description.trim()) {

                accountMessage.textContent =
                    "Please describe why you want to return this product.";

                return;
            }

            const confirmed = window.confirm(
                "Are you sure you want to submit this return request?"
            );

            if (!confirmed) return;

            const submitButton = form.querySelector("button");

            submitButton.disabled = true;
            submitButton.textContent = "SUBMITTING...";

            try {

                const result = await apiRequest(
                    `/orders/${orderId}/return`,
                    {
                        method: "POST",
                        body: {
                            reason,
                            description
                        }
                    }
                );

                accountMessage.textContent =
                    result.message || "Return request submitted successfully.";

                await loadOrders();

            } catch (error) {

                accountMessage.textContent = error.message;

                submitButton.disabled = false;
                submitButton.textContent = "SUBMIT RETURN REQUEST";

            }

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