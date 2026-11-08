
const TRACK_API = "http://localhost:3000/api";

// ============================================
// GET HTML ELEMENTS
// ============================================

const trackingForm = document.getElementById("tracking-form");
const orderNumberInput = document.getElementById("order-number");
const contactInput = document.getElementById("customer-contact");

const trackButton = document.getElementById("track-button");
const trackButtonText = document.getElementById("track-button-text");
const trackingMessage = document.getElementById("tracking-message");
const trackingResult = document.getElementById("tracking-result");

const orderSummary = document.getElementById("order-summary");
const orderProgress = document.getElementById("order-progress");
const orderItems = document.getElementById("order-items");
const deliveryInformation = document.getElementById("delivery-information");
const trackingHistory = document.getElementById("tracking-history");


// ============================================
// CHECK HTML ELEMENTS
// ============================================

if (
    !trackingForm ||
    !orderNumberInput ||
    !contactInput ||
    !trackButton ||
    !trackButtonText ||
    !trackingMessage ||
    !trackingResult ||
    !orderSummary ||
    !orderProgress ||
    !orderItems ||
    !deliveryInformation ||
    !trackingHistory
) {
    console.error("OWO Tracking Error: One or more HTML elements are missing.");

} else {

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function formatDate(value) {
        if (!value) return "Not available";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Not available";
        }

        return date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function formatDateTime(value) {
        if (!value) return "Not available";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Not available";
        }

        return date.toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function formatMoney(value) {
        const amount = Number(value);

        if (!Number.isFinite(amount)) {
            return "Price unavailable";
        }

        return "₹" + amount.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function getItemPrice(item) {
        const possiblePrices = [
            item.price,
            item.unit_price,
            item.product_price,
            item.item_price,
            item.unitPrice,
            item.productPrice
        ];

        for (const value of possiblePrices) {
            if (
                value !== null &&
                value !== undefined &&
                value !== "" &&
                Number.isFinite(Number(value))
            ) {
                return Number(value);
            }
        }

        return null;
    }

    function statusClass(status) {
        return String(status || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
    }

    function showMessage(message, type = "error") {
        trackingMessage.textContent = message;
        trackingMessage.className = `tracking-message ${type}`;
    }

    function clearResults() {
        orderSummary.innerHTML = "";
        orderProgress.innerHTML = "";
        orderItems.innerHTML = "";
        deliveryInformation.innerHTML = "";
        trackingHistory.innerHTML = "";

        trackingResult.hidden = true;
    }


    // ============================================
    // ORDER SUMMARY
    // ============================================

    function renderSummary(order) {
        const status = order.order_status || "Pending";

        orderSummary.innerHTML = `
            <div class="tracking-card">

                <div class="order-summary-top">

                    <div>
                        <h2>Order Details</h2>

                        <p class="order-number">
                            Order #${escapeHTML(order.order_number)}
                        </p>
                    </div>

                    <span class="status-badge ${statusClass(status)}">
                        ${escapeHTML(status)}
                    </span>

                </div>

                <div class="summary-grid">

                    <div class="summary-item">
                        <small>Order Date</small>
                        <strong>${formatDate(order.created_at)}</strong>
                    </div>

                    <div class="summary-item">
                        <small>Order Total</small>
                        <strong>${formatMoney(order.total_amount)}</strong>
                    </div>

                    <div class="summary-item">
                        <small>Payment Method</small>
                        <strong>
                            ${escapeHTML(order.payment_method || "Not available")}
                        </strong>
                    </div>

                    <div class="summary-item">
                        <small>Order Status</small>
                        <strong>${escapeHTML(status)}</strong>
                    </div>

                </div>

            </div>
        `;
    }


    // ============================================
    // DELIVERY PROGRESS
    // ============================================

    function renderProgress(status) {
        const steps = [
            "Pending",
            "Processing",
            "Packed",
            "Shipped",
            "Delivered"
        ];

        const normalized = String(status || "").toLowerCase();

        if (
            normalized === "cancelled" ||
            normalized === "delivery failed" ||
            normalized === "payment pending"
        ) {
            orderProgress.innerHTML = `
                <div class="tracking-card">
                    <h2>Delivery Progress</h2>

                    <p class="progress-note">
                        Your current order status is
                        <strong>${escapeHTML(status)}</strong>.
                    </p>
                </div>
            `;

            return;
        }

        let currentStep = 0;

        if (normalized === "processing") currentStep = 1;
        if (normalized === "packed") currentStep = 2;

        if (
            ["shipped", "in transit", "out for delivery"].includes(normalized)
        ) {
            currentStep = 3;
        }

        if (normalized === "delivered") currentStep = 4;

        const percentage =
            (currentStep / (steps.length - 1)) * 100;

        orderProgress.innerHTML = `
            <div class="tracking-card">

                <h2>Delivery Progress</h2>

                <div class="progress-track">

                    <div
                        class="progress-line"
                        style="width: ${percentage}%"
                    ></div>

                    ${steps.map((step, index) => `
                        <div class="progress-step ${
                            index <= currentStep ? "completed" : ""
                        }">

                            <div class="progress-dot"></div>

                            <span>${step}</span>

                        </div>
                    `).join("")}

                </div>

                <p class="progress-note">
                    Current status:
                    <strong>${escapeHTML(status)}</strong>
                </p>

            </div>
        `;
    }


    // ============================================
    // ORDER ITEMS
    // ============================================

    function renderItems(items) {
        if (!Array.isArray(items) || items.length === 0) {
            orderItems.innerHTML = "";
            return;
        }

        orderItems.innerHTML = `
            <div class="tracking-card">

                <h2>Items in Your Order</h2>

                ${items.map(item => {

                    const unitPrice = getItemPrice(item);
                    const quantity = Number(item.quantity) || 0;

                    const itemTotal = unitPrice === null
                        ? null
                        : unitPrice * quantity;

                    const size = item.size || item.product_size;

                    return `
                        <div class="item-row">

                            <div>
                                <div class="item-name">
                                    ${escapeHTML(item.product_name || item.name)}
                                </div>

                                <div class="item-details">
                                    Quantity: ${escapeHTML(quantity)}
                                    ${
                                        size
                                            ? ` | Size: ${escapeHTML(size)}`
                                            : ""
                                    }
                                </div>
                            </div>

                            <div class="item-price">
                                ${
                                    itemTotal === null
                                        ? "Price unavailable"
                                        : formatMoney(itemTotal)
                                }
                            </div>

                        </div>
                    `;

                }).join("")}

            </div>
        `;
    }


    // ============================================
    // DELIVERY INFORMATION
    // ============================================

    function renderDelivery(order) {
        const address = [
            order.address,
            order.city,
            order.state,
            order.pincode
        ].filter(Boolean).join(", ");

        const fields = [
            ["Courier", order.courier_name],
            ["Tracking Number", order.tracking_number],
            ["Estimated Delivery", formatDate(order.estimated_delivery_date)],
            ["Current Location", order.current_location],
            ["Shipped On", formatDateTime(order.shipped_at)],
            ["Delivered On", formatDateTime(order.delivered_at)],
            ["Shipping Address", address],
            ["Delivery Instructions", order.delivery_instructions]
        ];

        deliveryInformation.innerHTML = `
            <div class="tracking-card">

                <h2>Delivery Information</h2>

                <div class="delivery-grid">

                    ${fields.map(([label, value]) => `
                        <div class="delivery-field">

                            <small>${escapeHTML(label)}</small>

                            <strong>
                                ${escapeHTML(value || "Not available")}
                            </strong>

                        </div>
                    `).join("")}

                </div>

            </div>
        `;
    }


    // ============================================
    // TRACKING HISTORY
    // ============================================

    function renderHistory(events) {
        if (!Array.isArray(events) || events.length === 0) {
            trackingHistory.innerHTML = `
                <div class="tracking-card">

                    <h2>Tracking History</h2>

                    <p class="empty-history">
                        No tracking updates are available yet.
                    </p>

                </div>
            `;

            return;
        }

        const sortedEvents = [...events].sort((a, b) => {
            return new Date(b.event_time) - new Date(a.event_time);
        });

        trackingHistory.innerHTML = `
            <div class="tracking-card">

                <h2>Tracking History</h2>

                ${sortedEvents.map(event => `
                    <div class="tracking-event">

                        <h3>${escapeHTML(event.status)}</h3>

                        <p>
                            ${escapeHTML(event.description || "")}
                        </p>

                        ${
                            event.location
                                ? `<p>Location: ${escapeHTML(event.location)}</p>`
                                : ""
                        }

                        <time>
                            ${formatDateTime(event.event_time)}
                        </time>

                    </div>
                `).join("")}

            </div>
        `;
    }


    // ============================================
    // TRACK ORDER SUBMIT
    // ============================================

    trackingForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const formData = new FormData(trackingForm);

        const orderNumber = String(
            formData.get("order_number") || ""
        ).trim();

        const contact = String(
            formData.get("customer_contact") || ""
        ).trim();

        if (!orderNumber || !contact) {
            clearResults();

            showMessage(
                "Please enter both your order number and registered email or phone.",
                "error"
            );

            return;
        }

        trackButton.disabled = true;
        trackButtonText.textContent = "Checking...";

        clearResults();

        showMessage("Checking your order details...", "loading");

        try {
            const response = await fetch(`${TRACK_API}/orders/track`, {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    order_number: orderNumber,
                    contact: contact
                })
            });

            let data;

            try {
                data = await response.json();
            } catch {
                throw new Error("The server returned an invalid response.");
            }

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.message ||
                    "Unable to find your order. Please check your details."
                );
            }

            const order = data.order || data;

            if (!order || !order.order_number) {
                throw new Error(
                    "Order information was not returned by the server."
                );
            }

            console.log("OWO Tracking Order Response:", order);

            renderSummary(order);
            renderProgress(order.order_status);
            renderItems(order.items || order.order_items || []);
            renderDelivery(order);

            renderHistory(
                order.tracking_history ||
                order.tracking_events ||
                order.history ||
                []
            );

            trackingResult.hidden = false;

            showMessage(
                "Your order details were found successfully.",
                "success"
            );

            trackingResult.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        } catch (error) {
            console.error("OWO Tracking Error:", error);

            clearResults();

            if (error instanceof TypeError) {
                showMessage(
                    "Unable to connect to OWO. Please make sure the backend server is running.",
                    "error"
                );
            } else {
                showMessage(
                    error.message || "Something went wrong. Please try again.",
                    "error"
                );
            }

        } finally {
            trackButton.disabled = false;
            trackButtonText.textContent = "Track Order";
        }
    });
}

console.log("OWO Tracking Page Loaded!");
