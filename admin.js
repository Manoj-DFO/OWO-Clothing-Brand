
// ============================================
// OWO ADMIN DASHBOARD
// ============================================

const API = "http://localhost:3000/api";
const TOKEN_KEY = "owoAdminToken";

const ALLOWED_STATUSES = [
    "Pending",
    "Processing",
    "Packed",
    "Shipped",
    "In Transit",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
    "Delivery Failed"
];

const CLOTHING_CATEGORIES = [
    "Men",
    "Women",
    "Streetwear",
    "Custom Clothing"
];

const LOW_STOCK_LIMIT = 5;

let orders = [];
let products = [];
let editingProductId = null;


// ============================================
// HELPER FUNCTIONS
// ============================================

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}

function money(value) {
    return "₹" + Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatDateTime(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function dateInputValue(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function showMessage(elementId, message, type = "success") {
    const element = $(elementId);

    if (!element) return;

    element.textContent = message;
    element.className = `message ${type}`;
}

function clearMessage(elementId) {
    const element = $(elementId);

    if (!element) return;

    element.textContent = "";
    element.className = "message";
}

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function getStockStatus(stock) {
    const quantity = Number(stock || 0);

    if (quantity <= 0) return "Out of Stock";
    if (quantity <= LOW_STOCK_LIMIT) return "Low Stock";

    return "In Stock";
}

function getStockClass(stock) {
    const status = getStockStatus(stock);

    if (status === "In Stock") return "in-stock";
    if (status === "Low Stock") return "low-stock";

    return "out-of-stock";
}

function stockBadge(stock) {
    return `
        <span class="stock-badge ${getStockClass(stock)}">
            ${escapeHTML(getStockStatus(stock))}
        </span>
    `;
}

function parseItems(items) {
    if (typeof items === "string") {
        try {
            items = JSON.parse(items);
        } catch (error) {
            items = [];
        }
    }

    return Array.isArray(items) ? items : [];
}


// ============================================
// ADMIN AUTHENTICATION
// ============================================

function logout() {
    localStorage.removeItem("owoAdminToken");
    localStorage.removeItem("owoAdminUsername");

    window.location.replace("admin-login.html");
}

function getAdminUsername() {
    const savedUsername = localStorage.getItem("owoAdminUsername");

    if (savedUsername) return savedUsername;

    try {
        const token = getToken();

        if (!token) return "Administrator";

        const payload = token.split(".")[1];

        const base64 = payload
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        const decoded = JSON.parse(
            atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))
        );

        return decoded.username || "Administrator";

    } catch (error) {
        return "Administrator";
    }
}

function setupProfile() {
    const username = getAdminUsername();

    if ($("profile-username")) {
        $("profile-username").textContent = username;
    }

    if ($("dropdown-username")) {
        $("dropdown-username").textContent = username;
    }

    if ($("account-role")) {
        $("account-role").textContent = "Administrator";
    }

    if ($("dropdown-role")) {
        $("dropdown-role").textContent = "Administrator";
    }

    if ($("welcome-heading")) {
        $("welcome-heading").textContent = `Welcome back, ${username}`;
    }

    $("admin-profile-button")?.addEventListener("click", () => {
        $("admin-profile-menu")?.classList.toggle("show");
    });

    document.addEventListener("click", (event) => {
        const account = $("admin-account");

        if (account && !account.contains(event.target)) {
            $("admin-profile-menu")?.classList.remove("show");
        }
    });

    $("logout-button")?.addEventListener("click", logout);
    $("sidebar-logout")?.addEventListener("click", logout);
}


// ============================================
// AUTHENTICATED API REQUEST
// ============================================

async function adminFetch(endpoint, options = {}) {
    const token = getToken();

    if (!token) {
        logout();
        throw new Error("Please log in again.");
    }

    const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
    };

    if (options.body) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${API}${endpoint}`, {
        ...options,
        headers
    });

    const responseText = await response.text();

    let data = {};

    if (responseText) {
        try {
            data = JSON.parse(responseText);
        } catch (error) {
            data = { message: responseText };
        }
    }

    if (response.status === 401 || response.status === 403) {
        logout();
        throw new Error("Your login has expired. Please log in again.");
    }

    if (!response.ok) {
        throw new Error(
            data.message || "Something went wrong. Please try again."
        );
    }

    return data;
}


// ============================================
// NAVIGATION
// ============================================

function showSection(sectionId) {
    const section = $(sectionId);

    if (!section) return;

    document.querySelectorAll(".page-section").forEach((item) => {
        item.classList.remove("active");
    });

    section.classList.add("active");

    document.querySelectorAll(".nav-link[data-section]").forEach((link) => {
        link.classList.toggle(
            "active",
            link.dataset.section === sectionId
        );
    });

    $("sidebar")?.classList.remove("open");

    if (sectionId === "orders-section") renderOrders();
    if (sectionId === "products-section") renderProducts();
    if (sectionId === "inventory-section") renderInventory();
}

function setupNavigation() {
    document.querySelectorAll(".nav-link[data-section]").forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            showSection(link.dataset.section);
        });
    });

    document.querySelectorAll("[data-go]").forEach((button) => {
        button.addEventListener("click", () => {
            showSection(button.dataset.go);
        });
    });

    $("mobile-menu")?.addEventListener("click", () => {
        $("sidebar")?.classList.toggle("open");
    });
}


// ============================================
// ORDER DATA
// ============================================

async function loadOrders() {
    try {
        const data = await adminFetch("/admin/orders");

        orders = Array.isArray(data)
            ? data
            : Array.isArray(data.orders)
                ? data.orders
                : [];

        renderRecentOrders();
        renderOrders();
        updateDashboardStats();

    } catch (error) {
        showMessage("orders-message", error.message, "error");

        const recentTable = $("recent-orders-table");

        if (recentTable) {
            recentTable.innerHTML = `
                <tr>
                    <td colspan="6">${escapeHTML(error.message)}</td>
                </tr>
            `;
        }
    }
}


// ============================================
// DASHBOARD STATISTICS
// ============================================

function updateDashboardStats() {
    const totalOrders = orders.length;

    const revenueOrders = orders.filter((order) => {
        return !["Payment Pending", "Cancelled"].includes(
            order.order_status
        );
    });

    const totalRevenue = revenueOrders.reduce((total, order) => {
        return total + Number(order.total_amount || 0);
    }, 0);

    const pendingOrders = orders.filter((order) => {
        return ["Pending", "Payment Pending"].includes(
            order.order_status
        );
    }).length;

    const deliveredOrders = orders.filter((order) => {
        return order.order_status === "Delivered";
    }).length;

    if ($("total-orders")) {
        $("total-orders").textContent = totalOrders;
    }

    if ($("total-revenue")) {
        $("total-revenue").textContent = money(totalRevenue);
    }

    if ($("pending-orders")) {
        $("pending-orders").textContent = pendingOrders;
    }

    if ($("delivered-orders")) {
        $("delivered-orders").textContent = deliveredOrders;
    }
}


// ============================================
// ORDER STATUS DESIGN
// ============================================

function statusClass(status) {
    const classes = {
        "Pending": "pending",
        "Payment Pending": "pending",
        "Processing": "processing",
        "Packed": "processing",
        "Shipped": "shipped",
        "In Transit": "shipped",
        "Out for Delivery": "shipped",
        "Delivered": "delivered",
        "Cancelled": "cancelled",
        "Delivery Failed": "cancelled"
    };

    return classes[status] || "pending";
}

function statusBadge(status) {
    return `
        <span class="status-badge ${statusClass(status)}">
            ${escapeHTML(status || "Unknown")}
        </span>
    `;
}


// ============================================
// RECENT ORDERS
// ============================================

function renderRecentOrders() {
    const table = $("recent-orders-table");

    if (!table) return;

    if (orders.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="6">No orders found.</td>
            </tr>
        `;
        return;
    }

    const recentOrders = [...orders]
        .sort((a, b) => {
            return new Date(b.created_at) - new Date(a.created_at);
        })
        .slice(0, 5);

    table.innerHTML = recentOrders.map((order) => `
        <tr>
            <td>${escapeHTML(order.order_number)}</td>
            <td>${escapeHTML(order.customer_name)}</td>
            <td>${formatDate(order.created_at)}</td>
            <td>${money(order.total_amount)}</td>
            <td>${statusBadge(order.order_status)}</td>
            <td>
                <button
                    type="button"
                    class="action-button"
                    data-view-order="${escapeHTML(order.id)}"
                >
                    View
                </button>
            </td>
        </tr>
    `).join("");
}


// ============================================
// ALL ORDERS
// ============================================

function renderOrders() {
    const table = $("orders-table");

    if (!table) return;

    const search = $("order-search")?.value.toLowerCase().trim() || "";
    const statusFilter = $("order-status-filter")?.value || "all";

    let filteredOrders = [...orders];

    if (search) {
        filteredOrders = filteredOrders.filter((order) => {
            return [
                order.order_number,
                order.customer_name,
                order.email,
                order.phone
            ].some((value) => {
                return String(value || "").toLowerCase().includes(search);
            });
        });
    }

    if (statusFilter !== "all") {
        filteredOrders = filteredOrders.filter((order) => {
            return order.order_status === statusFilter;
        });
    }

    filteredOrders.sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
    });

    if (filteredOrders.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="7">No matching orders found.</td>
            </tr>
        `;
        return;
    }

    table.innerHTML = filteredOrders.map((order) => {
        const currentStatus = order.order_status || "Pending";
        const statusOptions = [...ALLOWED_STATUSES];

        if (!statusOptions.includes(currentStatus)) {
            statusOptions.unshift(currentStatus);
        }

        return `
            <tr>
                <td>${escapeHTML(order.order_number)}</td>

                <td>
                    <strong>${escapeHTML(order.customer_name)}</strong>
                    <small class="table-subtext">
                        ${escapeHTML(order.email)}
                    </small>
                </td>

                <td>${formatDate(order.created_at)}</td>

                <td>${money(order.total_amount)}</td>

                <td>${escapeHTML(order.payment_method || "—")}</td>

                <td>
                    <select
                        class="status-select"
                        data-order-status="${escapeHTML(order.id)}"
                        aria-label="Change order status"
                    >
                        ${statusOptions.map((status) => `
                            <option
                                value="${escapeHTML(status)}"
                                ${status === currentStatus ? "selected" : ""}
                                ${status === "Payment Pending" ? "disabled" : ""}
                            >
                                ${escapeHTML(status)}
                            </option>
                        `).join("")}
                    </select>

                    ${statusBadge(currentStatus)}
                </td>

                <td>
                    <button
                        type="button"
                        class="action-button"
                        data-view-order="${escapeHTML(order.id)}"
                    >
                        View
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}


// ============================================
// UPDATE ORDER STATUS
// ============================================

async function updateOrderStatus(orderId, newStatus) {
    if (!ALLOWED_STATUSES.includes(newStatus)) {
        showMessage("orders-message", "Invalid order status.", "error");
        return;
    }

    const order = orders.find((item) => {
        return String(item.id) === String(orderId);
    });

    if (!order || order.order_status === newStatus) return;

    const confirmed = confirm(
        `Change order ${order.order_number} status to ${newStatus}?`
    );

    if (!confirmed) {
        renderOrders();
        return;
    }

    try {
        await adminFetch(`/admin/orders/${orderId}/status`, {
            method: "PATCH",
            body: JSON.stringify({
                order_status: newStatus
            })
        });

        await loadOrders();

        showMessage(
            "orders-message",
            `Order ${order.order_number} updated to ${newStatus}.`,
            "success"
        );

    } catch (error) {
        renderOrders();
        showMessage("orders-message", error.message, "error");
    }
}


// ============================================
// DELIVERY TRACKING HISTORY
// ============================================

function renderTrackingHistory(order) {
    const events =
        order.tracking_history ||
        order.tracking_events ||
        [];

    if (!Array.isArray(events) || events.length === 0) {
        return `<p>No tracking updates available yet.</p>`;
    }

    return `
        <div class="owo-tracking-history">
            ${events.map((event) => `
                <div class="owo-tracking-event"
                    style="border-left:3px solid #b69a76;padding:0 0 18px 15px;margin-left:5px;">

                    <strong>${escapeHTML(event.status || "Update")}</strong>

                    <p style="margin:5px 0;">
                        ${escapeHTML(event.description || "")}
                    </p>

                    ${event.location ? `
                        <small>Location: ${escapeHTML(event.location)}</small>
                    ` : ""}

                    <small style="display:block;color:#777;margin-top:5px;">
                        ${formatDateTime(event.event_time || event.created_at)}
                    </small>
                </div>
            `).join("")}
        </div>
    `;
}


// ============================================
// ORDER DETAILS MODAL
// ============================================

function openOrderDetails(orderId) {
    const order = orders.find((item) => {
        return String(item.id) === String(orderId);
    });

    if (!order) return;

    const items = parseItems(order.items);

    const itemsHTML = items.length
        ? items.map((item) => {
            const productName =
                item.product_name ||
                item.name ||
                "Unknown Product";

            const productSize =
                item.size ||
                item.product_size ||
                "—";

            const quantity = Number(item.quantity || 0);
            const price = item.price ?? item.unit_price ?? 0;

            return `
                <tr>
                    <td>${escapeHTML(productName)}</td>
                    <td>${escapeHTML(productSize)}</td>
                    <td>${quantity}</td>
                    <td>${money(price)}</td>
                </tr>
            `;
        }).join("")
        : `
            <tr>
                <td colspan="4">No item details available.</td>
            </tr>
        `;

    const deliveryHTML = `
        <hr style="margin:22px 0;border:0;border-top:1px solid #ddd;">

        <h3>Delivery Management</h3>

        <p style="color:#777;margin-bottom:15px;">
            Add courier details and delivery updates for this order.
        </p>

        <form id="delivery-form" data-delivery-order="${escapeHTML(order.id)}">

            <div class="order-detail-grid">

                <div>
                    <label for="delivery-courier"><strong>Courier / Delivery Partner</strong></label>
                    <input
                        id="delivery-courier"
                        type="text"
                        maxlength="150"
                        value="${escapeHTML(order.courier_name || "")}"
                        placeholder="e.g. Delhivery, Blue Dart"
                        style="width:100%;padding:10px;margin-top:7px;"
                    >
                </div>

                <div>
                    <label for="delivery-tracking"><strong>Tracking Number</strong></label>
                    <input
                        id="delivery-tracking"
                        type="text"
                        maxlength="150"
                        value="${escapeHTML(order.tracking_number || "")}"
                        placeholder="Enter tracking number"
                        style="width:100%;padding:10px;margin-top:7px;"
                    >
                </div>

                <div>
                    <label for="delivery-date"><strong>Estimated Delivery Date</strong></label>
                    <input
                        id="delivery-date"
                        type="date"
                        value="${dateInputValue(order.estimated_delivery_date)}"
                        style="width:100%;padding:10px;margin-top:7px;"
                    >
                </div>

                <div>
                    <label for="delivery-location"><strong>Current Location</strong></label>
                    <input
                        id="delivery-location"
                        type="text"
                        maxlength="255"
                        value="${escapeHTML(order.current_location || "")}"
                        placeholder="e.g. Bengaluru Hub"
                        style="width:100%;padding:10px;margin-top:7px;"
                    >
                </div>

            </div>

            <div style="margin-top:15px;">
                <label for="delivery-instructions">
                    <strong>Delivery Instructions</strong>
                </label>

                <textarea
                    id="delivery-instructions"
                    rows="3"
                    placeholder="Optional delivery instructions"
                    style="width:100%;padding:10px;margin-top:7px;"
                >${escapeHTML(order.delivery_instructions || "")}</textarea>
            </div>

            <hr style="margin:20px 0;border:0;border-top:1px solid #ddd;">

            <h3>Add Tracking Update</h3>

            <div style="margin-top:12px;">
                <label for="delivery-event-description">
                    <strong>Update Description</strong>
                </label>

                <input
                    id="delivery-event-description"
                    type="text"
                    maxlength="1000"
                    placeholder="e.g. Package reached Bengaluru sorting hub"
                    style="width:100%;padding:10px;margin-top:7px;"
                >
            </div>

            <div style="margin-top:12px;">
                <label for="delivery-event-location">
                    <strong>Update Location</strong>
                </label>

                <input
                    id="delivery-event-location"
                    type="text"
                    maxlength="255"
                    placeholder="e.g. Bengaluru"
                    style="width:100%;padding:10px;margin-top:7px;"
                >
            </div>

            <p id="delivery-message" class="message" style="margin-top:12px;"></p>

            <button
                type="submit"
                class="action-button"
                id="save-delivery-button"
                style="margin-top:12px;"
            >
                Save Delivery Details
            </button>

        </form>

        <hr style="margin:25px 0;border:0;border-top:1px solid #ddd;">

        <h3>Delivery Tracking History</h3>

        <div style="margin-top:15px;">
            ${renderTrackingHistory(order)}
        </div>

        <div style="margin-top:15px;">
            <p><strong>Shipped At:</strong> ${formatDateTime(order.shipped_at)}</p>
            <p><strong>Delivered At:</strong> ${formatDateTime(order.delivered_at)}</p>
        </div>
    `;

    $("order-details-content").innerHTML = `
        <div class="order-detail-grid">

            <div>
                <strong>Order Number</strong>
                <p>${escapeHTML(order.order_number)}</p>
            </div>

            <div>
                <strong>Order Date</strong>
                <p>${formatDate(order.created_at)}</p>
            </div>

            <div>
                <strong>Customer</strong>
                <p>${escapeHTML(order.customer_name)}</p>
            </div>

            <div>
                <strong>Email</strong>
                <p>${escapeHTML(order.email)}</p>
            </div>

            <div>
                <strong>Phone</strong>
                <p>${escapeHTML(order.phone)}</p>
            </div>

            <div>
                <strong>Payment Method</strong>
                <p>${escapeHTML(order.payment_method)}</p>
            </div>

            <div>
                <strong>Order Status</strong>
                <p>${statusBadge(order.order_status)}</p>
            </div>

            <div>
                <strong>Total Amount</strong>
                <p>${money(order.total_amount)}</p>
            </div>

        </div>

        <h3>Delivery Address</h3>

        <p>
            ${escapeHTML(order.address)},
            ${escapeHTML(order.city)},
            ${escapeHTML(order.state)} -
            ${escapeHTML(order.pincode)}
        </p>

        <h3>Ordered Products</h3>

        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Size</th>
                        <th>Quantity</th>
                        <th>Price</th>
                    </tr>
                </thead>

                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>
        </div>

        ${deliveryHTML}
    `;

    $("order-modal")?.classList.add("show");
}

function closeOrderModal() {
    $("order-modal")?.classList.remove("show");
}


// ============================================
// SAVE DELIVERY DETAILS
// ============================================

async function saveDeliveryDetails(event) {
    event.preventDefault();

    const form = event.target.closest("#delivery-form");

    if (!form) return;

    const orderId = form.dataset.deliveryOrder;
    const order = orders.find((item) => {
        return String(item.id) === String(orderId);
    });

    if (!order) return;

    const button = $("save-delivery-button");

    const deliveryData = {
        courier_name: $("delivery-courier").value.trim(),
        tracking_number: $("delivery-tracking").value.trim(),
        estimated_delivery_date: $("delivery-date").value || null,
        current_location: $("delivery-location").value.trim(),
        delivery_instructions: $("delivery-instructions").value.trim(),
        event_description: $("delivery-event-description").value.trim(),
        event_location: $("delivery-event-location").value.trim()
    };

    if (
        deliveryData.event_location &&
        !deliveryData.event_description
    ) {
        showMessage(
            "delivery-message",
            "Enter an update description when adding an update location.",
            "error"
        );
        return;
    }

    button.disabled = true;
    button.textContent = "Saving...";

    try {
        const result = await adminFetch(
            `/admin/orders/${encodeURIComponent(orderId)}/delivery`,
            {
                method: "PATCH",
                body: JSON.stringify(deliveryData)
            }
        );

        await loadOrders();

        openOrderDetails(orderId);

        const message = $("delivery-message");

        if (message) {
            showMessage(
                "delivery-message",
                result.message || "Delivery details saved successfully.",
                "success"
            );
        }

    } catch (error) {
        showMessage("delivery-message", error.message, "error");

        button.disabled = false;
        button.textContent = "Save Delivery Details";
    }
}


// ============================================
// PRODUCT DATA
// ============================================

async function loadProducts() {
    try {
        const data = await adminFetch("/products");

        products = Array.isArray(data)
            ? data
            : Array.isArray(data.products)
                ? data.products
                : [];

        renderProducts();
        renderInventory();

    } catch (error) {
        showMessage("products-message", error.message, "error");
        showMessage("inventory-message", error.message, "error");

        if ($("products-table")) {
            $("products-table").innerHTML = `
                <tr>
                    <td colspan="7">${escapeHTML(error.message)}</td>
                </tr>
            `;
        }

        if ($("inventory-table")) {
            $("inventory-table").innerHTML = `
                <tr>
                    <td colspan="6">${escapeHTML(error.message)}</td>
                </tr>
            `;
        }
    }
}


// ============================================
// RENDER PRODUCTS
// ============================================

function renderProducts() {
    const table = $("products-table");

    if (!table) return;

    const search = $("product-search")?.value.toLowerCase().trim() || "";
    const category = $("product-category-filter")?.value || "all";
    const stockFilter = $("product-stock-filter")?.value || "all";

    let filteredProducts = [...products];

    if (search) {
        filteredProducts = filteredProducts.filter((product) => {
            return [
                product.name,
                product.category,
                product.description
            ].some((value) => {
                return String(value || "").toLowerCase().includes(search);
            });
        });
    }

    if (category !== "all") {
        filteredProducts = filteredProducts.filter((product) => {
            return product.category === category;
        });
    }

    if (stockFilter !== "all") {
        filteredProducts = filteredProducts.filter((product) => {
            const stock = Number(product.stock_quantity || 0);

            if (stockFilter === "in-stock") return stock > LOW_STOCK_LIMIT;

            if (stockFilter === "low-stock") {
                return stock > 0 && stock <= LOW_STOCK_LIMIT;
            }

            if (stockFilter === "out-of-stock") return stock === 0;

            return true;
        });
    }

    if ($("product-result-count")) {
        $("product-result-count").textContent =
            `${filteredProducts.length} products`;
    }

    if (filteredProducts.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="7">No products found.</td>
            </tr>
        `;
        return;
    }

    table.innerHTML = filteredProducts.map((product) => {
        const sizes = Array.isArray(product.sizes)
            ? product.sizes.join(", ")
            : "—";

        const imageHTML = product.image_url
            ? `
                <img
                    src="${escapeHTML(product.image_url)}"
                    alt="${escapeHTML(product.name)}"
                    class="product-thumbnail"
                    loading="lazy"
                    onerror="this.style.display='none'"
                >
            `
            : "";

        return `
            <tr>
                <td>
                    <div class="product-table-info">
                        ${imageHTML}
                        <strong>${escapeHTML(product.name)}</strong>
                    </div>
                </td>

                <td>${escapeHTML(product.category)}</td>
                <td>${money(product.price)}</td>
                <td>${Number(product.stock_quantity || 0)}</td>
                <td>${escapeHTML(sizes)}</td>
                <td>${stockBadge(product.stock_quantity)}</td>

                <td>
                    <div class="table-actions">
                        <button
                            type="button"
                            class="action-button"
                            data-edit-product="${escapeHTML(product.id)}"
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            class="action-button danger-button"
                            data-archive-product="${escapeHTML(product.id)}"
                        >
                            Archive
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}


// ============================================
// PRODUCT IMAGE PREVIEW
// ============================================

function updateProductImagePreview() {
    const preview = $("product-image-preview");
    const imageInput = $("product-image");

    if (!preview || !imageInput) return;

    const imageURL = imageInput.value.trim();

    preview.innerHTML = "";

    if (!imageURL) {
        preview.hidden = true;
        return;
    }

    let parsedURL;

    try {
        parsedURL = new URL(imageURL);

        if (!["http:", "https:"].includes(parsedURL.protocol)) {
            throw new Error("Invalid protocol");
        }

    } catch (error) {
        preview.hidden = false;

        const message = document.createElement("p");
        message.textContent = "Enter a valid image URL to preview.";
        preview.appendChild(message);

        return;
    }

    const image = document.createElement("img");

    image.src = parsedURL.href;
    image.alt = "Product image preview";
    image.loading = "lazy";

    image.addEventListener("error", () => {
        preview.innerHTML = "";

        const message = document.createElement("p");
        message.textContent = "Unable to load this image. Check the URL.";
        preview.appendChild(message);
    });

    image.addEventListener("load", () => {
        const caption = document.createElement("p");
        caption.textContent = "Product image preview";

        if (!preview.contains(caption)) {
            preview.appendChild(caption);
        }
    });

    preview.hidden = false;
    preview.appendChild(image);
}


// ============================================
// PRODUCT FORM
// ============================================

function updateSizeVisibility() {
    const category = $("product-category")?.value;
    const sizeGroup = $("product-sizes-group");

    if (!sizeGroup) return;

    const isClothing = CLOTHING_CATEGORIES.includes(category);

    sizeGroup.style.display = isClothing ? "block" : "none";

    if (!isClothing) {
        document.querySelectorAll('input[name="product-size"]').forEach((input) => {
            input.checked = false;
        });
    }
}

function resetProductForm() {
    $("product-form")?.reset();

    editingProductId = null;

    if ($("product-form-heading")) {
        $("product-form-heading").textContent = "Add New Product";
    }

    if ($("product-form-description")) {
        $("product-form-description").textContent =
            "Add a new product to your OWO store.";
    }

    if ($("add-product-button")) {
        $("add-product-button").textContent = "Save Product";
        $("add-product-button").disabled = false;
    }

    if ($("cancel-edit-button")) {
        $("cancel-edit-button").hidden = true;
    }

    if ($("product-image-preview")) {
        $("product-image-preview").innerHTML = "";
        $("product-image-preview").hidden = true;
    }

    clearMessage("add-product-message");
    updateSizeVisibility();
}

function getProductFormData() {
    const sizes = Array.from(
        document.querySelectorAll('input[name="product-size"]:checked')
    ).map((input) => input.value);

    return {
        name: $("product-name").value.trim(),
        price: Number($("product-price").value),
        category: $("product-category").value,
        stock_quantity: Number($("product-stock").value),
        image_url: $("product-image").value.trim() || null,
        description: $("product-description").value.trim() || null,
        sizes
    };
}

function validateProductForm(product) {
    if (!product.name) {
        return "Please enter a product name.";
    }

    if (!Number.isFinite(product.price) || product.price <= 0) {
        return "Please enter a valid product price.";
    }

    if (!product.category) {
        return "Please select a product category.";
    }

    if (
        !Number.isSafeInteger(product.stock_quantity) ||
        product.stock_quantity < 0
    ) {
        return "Please enter a valid stock quantity.";
    }

    if (product.image_url) {
        try {
            const url = new URL(product.image_url);

            if (!["http:", "https:"].includes(url.protocol)) {
                return "Image URL must start with http:// or https://.";
            }

        } catch (error) {
            return "Please enter a valid image URL.";
        }
    }

    if (
        CLOTHING_CATEGORIES.includes(product.category) &&
        product.sizes.length === 0
    ) {
        return "Please select at least one clothing size.";
    }

    return null;
}


// ============================================
// SAVE PRODUCT
// ============================================

async function saveProduct(event) {
    event.preventDefault();

    const product = getProductFormData();
    const validationError = validateProductForm(product);

    if (validationError) {
        showMessage("add-product-message", validationError, "error");
        return;
    }

    const button = $("add-product-button");
    const wasEditing = editingProductId !== null;

    button.disabled = true;
    button.textContent = "Saving...";

    try {
        let result;

        if (wasEditing) {
            result = await adminFetch(
                `/admin/products/${encodeURIComponent(editingProductId)}`,
                {
                    method: "PATCH",
                    body: JSON.stringify(product)
                }
            );

        } else {
            result = await adminFetch("/admin/products", {
                method: "POST",
                body: JSON.stringify(product)
            });
        }

        await loadProducts();

        resetProductForm();
        showSection("products-section");

        showMessage(
            "products-message",
            result.message || "Product saved successfully.",
            "success"
        );

    } catch (error) {
        showMessage("add-product-message", error.message, "error");

    } finally {
        button.disabled = false;
        button.textContent = editingProductId !== null
            ? "Update Product"
            : "Save Product";
    }
}


// ============================================
// EDIT PRODUCT
// ============================================

function editProduct(productId) {
    const product = products.find((item) => {
        return String(item.id) === String(productId);
    });

    if (!product) return;

    editingProductId = product.id;

    $("product-name").value = product.name || "";
    $("product-price").value = product.price || "";
    $("product-category").value = product.category || "";
    $("product-stock").value = product.stock_quantity ?? 0;
    $("product-image").value = product.image_url || "";
    $("product-description").value = product.description || "";

    const selectedSizes = Array.isArray(product.sizes)
        ? product.sizes
        : [];

    document.querySelectorAll('input[name="product-size"]').forEach((input) => {
        input.checked = selectedSizes.includes(input.value);
    });

    $("product-form-heading").textContent = "Edit Product";
    $("product-form-description").textContent =
        "Update the details of this product.";

    $("add-product-button").textContent = "Update Product";
    $("cancel-edit-button").hidden = false;

    updateSizeVisibility();
    updateProductImagePreview();

    clearMessage("add-product-message");

    showSection("add-product-section");
}


// ============================================
// ARCHIVE PRODUCT
// ============================================

async function archiveProduct(productId) {
    const product = products.find((item) => {
        return String(item.id) === String(productId);
    });

    if (!product) return;

    const confirmed = confirm(
        `Are you sure you want to archive "${product.name}"?`
    );

    if (!confirmed) return;

    try {
        const result = await adminFetch(
            `/admin/products/${encodeURIComponent(productId)}`,
            {
                method: "DELETE"
            }
        );

        await loadProducts();

        showMessage(
            "products-message",
            result.message || "Product archived successfully.",
            "success"
        );

    } catch (error) {
        showMessage("products-message", error.message, "error");
    }
}


// ============================================
// INVENTORY SUMMARY
// ============================================

function updateInventorySummary() {
    const total = products.length;

    const inStock = products.filter((product) => {
        return Number(product.stock_quantity || 0) > LOW_STOCK_LIMIT;
    }).length;

    const lowStock = products.filter((product) => {
        const stock = Number(product.stock_quantity || 0);
        return stock > 0 && stock <= LOW_STOCK_LIMIT;
    }).length;

    const outOfStock = products.filter((product) => {
        return Number(product.stock_quantity || 0) === 0;
    }).length;

    if ($("inventory-total-products")) {
        $("inventory-total-products").textContent = total;
    }

    if ($("inventory-in-stock-count")) {
        $("inventory-in-stock-count").textContent = inStock;
    }

    if ($("inventory-low-stock-count")) {
        $("inventory-low-stock-count").textContent = lowStock;
    }

    if ($("inventory-out-stock-count")) {
        $("inventory-out-stock-count").textContent = outOfStock;
    }
}


// ============================================
// RENDER FULL INVENTORY TABLE
// ============================================

function renderInventoryTable() {
    const table = $("inventory-table");

    if (!table) return;

    const search = $("inventory-search")?.value.toLowerCase().trim() || "";
    const stockFilter = $("inventory-stock-filter")?.value || "all";

    let filteredProducts = [...products];

    if (search) {
        filteredProducts = filteredProducts.filter((product) => {
            return [
                product.name,
                product.category
            ].some((value) => {
                return String(value || "").toLowerCase().includes(search);
            });
        });
    }

    if (stockFilter !== "all") {
        filteredProducts = filteredProducts.filter((product) => {
            const stock = Number(product.stock_quantity || 0);

            if (stockFilter === "in-stock") {
                return stock > LOW_STOCK_LIMIT;
            }

            if (stockFilter === "low-stock") {
                return stock > 0 && stock <= LOW_STOCK_LIMIT;
            }

            if (stockFilter === "out-of-stock") {
                return stock === 0;
            }

            return true;
        });
    }

    if (filteredProducts.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="6">No matching inventory products found.</td>
            </tr>
        `;
        return;
    }

    table.innerHTML = filteredProducts.map((product) => {
        const stock = Number(product.stock_quantity || 0);

        return `
            <tr>
                <td>
                    <strong>${escapeHTML(product.name)}</strong>
                </td>

                <td>${escapeHTML(product.category)}</td>

                <td>
                    <strong>${stock}</strong>
                </td>

                <td>
                    ${stockBadge(stock)}
                </td>

                <td>
                    <input
                        type="number"
                        class="stock-edit-input"
                        min="0"
                        step="1"
                        value="${stock}"
                        data-stock-input="${escapeHTML(product.id)}"
                        aria-label="New stock quantity for ${escapeHTML(product.name)}"
                    >
                </td>

                <td>
                    <button
                        type="button"
                        class="stock-update-button"
                        data-update-stock="${escapeHTML(product.id)}"
                    >
                        Save Stock
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}


// ============================================
// UPDATE PRODUCT STOCK
// ============================================

async function updateProductStock(productId) {
    const product = products.find((item) => {
        return String(item.id) === String(productId);
    });

    if (!product) {
        showMessage("inventory-message", "Product not found.", "error");
        return;
    }

    const input = document.querySelector(
        `[data-stock-input="${CSS.escape(String(productId))}"]`
    );

    if (!input) return;

    const rawValue = input.value.trim();
    const newStock = Number(rawValue);

    if (
        rawValue === "" ||
        !Number.isSafeInteger(newStock) ||
        newStock < 0
    ) {
        showMessage(
            "inventory-message",
            "Stock must be a whole number greater than or equal to zero.",
            "error"
        );
        return;
    }

    if (newStock === Number(product.stock_quantity || 0)) {
        showMessage(
            "inventory-message",
            "Stock quantity is already up to date.",
            "success"
        );
        return;
    }

    const confirmed = confirm(
        `Update "${product.name}" stock from ${product.stock_quantity} to ${newStock}?`
    );

    if (!confirmed) return;

    const button = document.querySelector(
        `[data-update-stock="${CSS.escape(String(productId))}"]`
    );

    if (button) {
        button.disabled = true;
        button.textContent = "Saving...";
    }

    try {
        const result = await adminFetch(
            `/admin/products/${encodeURIComponent(productId)}/stock`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    stock_quantity: newStock
                })
            }
        );

        const updatedProduct = result.product;

        product.stock_quantity = updatedProduct
            ? Number(updatedProduct.stock_quantity)
            : newStock;

        renderProducts();
        renderInventory();

        showMessage(
            "inventory-message",
            result.message || "Stock updated successfully.",
            "success"
        );

    } catch (error) {
        if (button) {
            button.disabled = false;
            button.textContent = "Save Stock";
        }

        showMessage("inventory-message", error.message, "error");
    }
}


// ============================================
// LOW STOCK ALERTS
// ============================================

function renderLowStockAlerts() {
    const list = $("low-stock-list");

    if (!list) return;

    const lowStockProducts = products.filter((product) => {
        return Number(product.stock_quantity || 0) <= LOW_STOCK_LIMIT;
    });

    if ($("stock-alert-count")) {
        $("stock-alert-count").textContent = lowStockProducts.length;
    }

    if (lowStockProducts.length === 0) {
        list.innerHTML = `
            <p>All products have sufficient stock.</p>
        `;
        return;
    }

    list.innerHTML = lowStockProducts.map((product) => {
        const stock = Number(product.stock_quantity || 0);

        return `
            <div class="low-stock-item">
                <div>
                    <strong>${escapeHTML(product.name)}</strong>
                    <small>${escapeHTML(product.category)}</small>
                </div>

                ${stockBadge(stock)}
            </div>
        `;
    }).join("");
}


// ============================================
// RENDER INVENTORY
// ============================================

function renderInventory() {
    updateInventorySummary();
    renderInventoryTable();
    renderLowStockAlerts();
}


// ============================================
// CSV EXPORT HELPERS
// ============================================

function csvSafe(value) {
    let text = String(value ?? "");

    if (/^[\s]*[=+\-@]/.test(text)) {
        text = "'" + text;
    }

    return `"${text.replace(/"/g, '""')}"`;
}

function downloadCSV(filename, rows) {
    if (!rows || rows.length === 0) {
        alert("There is no data to export.");
        return;
    }

    const csvContent = rows
        .map((row) => row.map(csvSafe).join(","))
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csvContent],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}


// ============================================
// EXPORT ORDERS CSV
// ============================================

function exportOrdersCSV() {
    const rows = [
        [
            "Order Number",
            "Customer Name",
            "Email",
            "Phone",
            "Address",
            "City",
            "State",
            "Pincode",
            "Payment Method",
            "Total Amount",
            "Order Status",
            "Courier",
            "Tracking Number",
            "Estimated Delivery",
            "Current Location",
            "Order Date"
        ]
    ];

    orders.forEach((order) => {
        rows.push([
            order.order_number,
            order.customer_name,
            order.email,
            order.phone,
            order.address,
            order.city,
            order.state,
            order.pincode,
            order.payment_method,
            order.total_amount,
            order.order_status,
            order.courier_name,
            order.tracking_number,
            formatDate(order.estimated_delivery_date),
            order.current_location,
            formatDate(order.created_at)
        ]);
    });

    downloadCSV("owo-orders.csv", rows);
}


// ============================================
// EXPORT PRODUCTS CSV
// ============================================

function exportProductsCSV() {
    const rows = [
        [
            "Product ID",
            "Product Name",
            "Category",
            "Price",
            "Stock Quantity",
            "Sizes",
            "Description",
            "Image URL"
        ]
    ];

    products.forEach((product) => {
        const sizes = Array.isArray(product.sizes)
            ? product.sizes.join(", ")
            : "";

        rows.push([
            product.id,
            product.name,
            product.category,
            product.price,
            product.stock_quantity,
            sizes,
            product.description,
            product.image_url
        ]);
    });

    downloadCSV("owo-products.csv", rows);
}


// ============================================
// EVENT LISTENERS
// ============================================

function setupEvents() {
    $("refresh-dashboard-button")?.addEventListener("click", refreshDashboard);
    $("refresh-orders-button")?.addEventListener("click", loadOrders);
    $("refresh-products-button")?.addEventListener("click", loadProducts);
    $("refresh-inventory-button")?.addEventListener("click", loadProducts);

    // Orders filters
    $("order-search")?.addEventListener("input", renderOrders);
    $("order-status-filter")?.addEventListener("change", renderOrders);

    // Products filters
    $("product-search")?.addEventListener("input", renderProducts);
    $("product-category-filter")?.addEventListener("change", renderProducts);
    $("product-stock-filter")?.addEventListener("change", renderProducts);

    // Inventory filters
    $("inventory-search")?.addEventListener("input", renderInventoryTable);
    $("inventory-stock-filter")?.addEventListener("change", renderInventoryTable);

    // Product form
    $("product-form")?.addEventListener("submit", saveProduct);
    $("product-category")?.addEventListener("change", updateSizeVisibility);

    $("product-image")?.addEventListener(
        "input",
        updateProductImagePreview
    );

    $("cancel-edit-button")?.addEventListener("click", () => {
        resetProductForm();
        showSection("products-section");
    });

    // CSV exports
    $("export-orders-button")?.addEventListener("click", exportOrdersCSV);
    $("export-products-button")?.addEventListener("click", exportProductsCSV);

    // Click actions
    document.addEventListener("click", (event) => {
        const viewButton = event.target.closest("[data-view-order]");

        if (viewButton) {
            openOrderDetails(viewButton.dataset.viewOrder);
            return;
        }

        const editButton = event.target.closest("[data-edit-product]");

        if (editButton) {
            editProduct(editButton.dataset.editProduct);
            return;
        }

        const archiveButton = event.target.closest("[data-archive-product]");

        if (archiveButton) {
            archiveProduct(archiveButton.dataset.archiveProduct);
            return;
        }

        const stockButton = event.target.closest("[data-update-stock]");

        if (stockButton) {
            updateProductStock(stockButton.dataset.updateStock);
        }
    });

    // Form submission for delivery details
    document.addEventListener("submit", (event) => {
        if (event.target.matches("#delivery-form")) {
            saveDeliveryDetails(event);
        }
    });

    // Order status changes
    document.addEventListener("change", (event) => {
        const statusSelect = event.target.closest("[data-order-status]");

        if (statusSelect) {
            updateOrderStatus(
                statusSelect.dataset.orderStatus,
                statusSelect.value
            );
        }
    });

    // Modal controls
    $("close-order-modal")?.addEventListener("click", closeOrderModal);

    $("order-modal")?.addEventListener("click", (event) => {
        if (event.target === $("order-modal")) {
            closeOrderModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeOrderModal();
        }
    });
}


// ============================================
// REFRESH DASHBOARD
// ============================================

async function refreshDashboard() {
    await Promise.all([
        loadOrders(),
        loadProducts()
    ]);
}


// ============================================
// INITIALIZE ADMIN
// ============================================

async function initializeAdmin() {
    if (!getToken()) {
        window.location.replace("admin-login.html");
        return;
    }

    setupProfile();
    setupNavigation();
    setupEvents();

    resetProductForm();
    showSection("dashboard");

    await refreshDashboard();
}

document.addEventListener("DOMContentLoaded", initializeAdmin);