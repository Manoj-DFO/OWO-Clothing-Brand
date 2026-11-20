
/* =========================================
   OWO - SHOPPING CART
   Normal Products + Custom Designs
   PostgreSQL Connected
========================================= */

(() => {
    "use strict";

    // =====================================
    // 1. API AND CART SETTINGS
    // =====================================

    const PRODUCTS_API = "http://localhost:3000/api/products";
    const CUSTOM_DESIGNS_API = "http://localhost:3000/api/custom-designs/mine";

    const CUSTOMER_TOKEN_KEY = "owoCustomerToken";
    const CART_KEY = "owoCart";

    const LOW_STOCK_LIMIT = 5;

    let cart = [];

    try {
        const savedCart = JSON.parse(localStorage.getItem(CART_KEY));
        cart = Array.isArray(savedCart) ? savedCart : [];
    } catch (error) {
        console.error("OWO Cart Loading Error:", error);
        cart = [];
    }

    // =====================================
    // 2. HTML ELEMENTS
    // =====================================

    const cartProducts = document.getElementById("cart-products");
    const emptyCart = document.getElementById("empty-cart");
    const cartItemCount = document.getElementById("cart-item-count");

    const cartSubtotal = document.getElementById("cart-subtotal");
    const cartTotal = document.getElementById("cart-total");
    const cartShipping = document.getElementById("cart-shipping");

    const checkoutButton = document.getElementById("checkout-button");
    const cartStockMessage = document.getElementById("cart-stock-message");

    // =====================================
    // 3. HELPER FUNCTIONS
    // =====================================

    function saveCart() {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
        } catch (error) {
            console.error("OWO Cart Save Error:", error);
            alert("Unable to save your cart. Please check your browser storage.");
        }
    }

    function formatPrice(price) {
        return "₹" + Number(price || 0).toLocaleString("en-IN");
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

    function getCustomerToken() {
        return localStorage.getItem(CUSTOMER_TOKEN_KEY);
    }

    function isCustomItem(item) {
        return item.isCustom === true;
    }

    function getProductId(item) {
        return Number(item.id);
    }

    function getProductImage(item) {
        return item.image_url || item.imageUrl || item.image || "";
    }

    function getCustomDesignId(item) {
        const id = item.customDesignId ||
            String(item.id || "").replace("custom-", "");

        return Number(id);
    }

    function normalizeStatus(status) {
        return String(status || "").trim().toLowerCase();
    }

    function isPriceConfirmed(item) {
        return (
            normalizeStatus(item.priceStatus) === "confirmed" &&
            Number.isFinite(Number(item.price)) &&
            Number(item.price) > 0
        );
    }

    function isCustomApproved(item) {
        return (
            isCustomItem(item) &&
            normalizeStatus(item.customStatus) === "price confirmed" &&
            isPriceConfirmed(item) &&
            normalizeStatus(item.stockStatus) === "confirmed" &&
            Number(item.stockQuantity) > 0
        );
    }

    function getDesignsFromResponse(result) {
        if (Array.isArray(result)) {
            return result;
        }

        if (Array.isArray(result.designs)) {
            return result.designs;
        }

        if (Array.isArray(result.customDesigns)) {
            return result.customDesigns;
        }

        if (Array.isArray(result.data)) {
            return result.data;
        }

        if (result.data && Array.isArray(result.data.designs)) {
            return result.data.designs;
        }

        if (result.data && Array.isArray(result.data.customDesigns)) {
            return result.data.customDesigns;
        }

        return [];
    }

    function getDesignData(design) {
        let data = design.design_data || {};

        if (typeof data === "string") {
            try {
                data = JSON.parse(data);
            } catch {
                data = {};
            }
        }

        return data && typeof data === "object" ? data : {};
    }

    // =====================================
    // 4. CUSTOMIZATION DETAILS
    // =====================================

    function getCustomizationHTML(customization) {
        if (!customization) return "";

        let html = `<div class="cart-custom-details">`;

        if (customization.garment) {
            html += `
                <p>Garment:
                    <strong>${escapeHTML(customization.garment)}</strong>
                </p>
            `;
        }

        if (customization.colour) {
            html += `
                <p>Colour:
                    <strong>${escapeHTML(customization.colour)}</strong>
                </p>
            `;
        }

        if (customization.fit) {
            html += `
                <p>Fit:
                    <strong>${escapeHTML(customization.fit)}</strong>
                </p>
            `;
        }

        if (customization.measurements) {
            html += `
                <div class="cart-measurements">
                    <strong>Measurements</strong>
            `;

            Object.entries(customization.measurements).forEach(([name, data]) => {
                if (!data || data.value === "") return;

                html += `
                    <p>
                        ${escapeHTML(name)}:
                        ${escapeHTML(data.value)}
                        ${escapeHTML(data.unit)}
                    </p>
                `;
            });

            html += `</div>`;
        }

        html += `
            <p>Logo:
                <strong>${customization.logo ? "Uploaded" : "Not added"}</strong>
            </p>
        `;

        html += `</div>`;

        return html;
    }

    // =====================================
    // 5. REFRESH NORMAL PRODUCT STOCK
    // =====================================

    async function refreshProductStock() {
        try {
            const response = await fetch(PRODUCTS_API, {
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error("Unable to refresh product stock.");
            }

            const result = await response.json();

            const products = Array.isArray(result)
                ? result
                : result.products || [];

            cart.forEach(item => {
                if (isCustomItem(item)) return;

                const product = products.find(
                    p => Number(p.id) === getProductId(item)
                );

                if (!product) {
                    item.stockVerified = true;
                    item.unavailable = true;
                    item.stock_quantity = 0;
                    return;
                }

                item.stockVerified = true;
                item.unavailable = product.is_active === false;

                item.price = Number(product.price);
                item.stock_quantity = Number(product.stock_quantity);

                if (product.name) {
                    item.name = product.name;
                }

                if (product.image_url) {
                    item.image_url = product.image_url;
                }

                if (product.sizes && Array.isArray(product.sizes)) {
                    item.availableSizes = product.sizes;
                }

                if (item.quantity > item.stock_quantity) {
                    item.quantity = Math.max(
                        1,
                        item.stock_quantity
                    );
                }

                if (item.stock_quantity <= 0) {
                    item.unavailable = true;
                }
            });

        } catch (error) {
            console.error("OWO Product Stock Error:", error);
        }
    }

    // =====================================
    // 6. REFRESH CUSTOM DESIGN APPROVAL
    // =====================================

    async function refreshCustomDesignStatus() {
        const customItems = cart.filter(isCustomItem);

        if (customItems.length === 0) return;

        const token = getCustomerToken();

        if (!token) {
            customItems.forEach(item => {
                item.customStatus = "Login Required";
            });

            return;
        }

        try {
            const response = await fetch(CUSTOM_DESIGNS_API, {
                method: "GET",

                cache: "no-store",

                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json"
                }
            });

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem(CUSTOMER_TOKEN_KEY);
                localStorage.removeItem("owoCustomer");

                customItems.forEach(item => {
                    item.customStatus = "Login Required";
                });

                return;
            }

            if (!response.ok) {
                throw new Error(
                    `Custom design request failed: ${response.status}`
                );
            }

            const result = await response.json();

            const designs = getDesignsFromResponse(result);

            console.log("OWO Custom Designs From Database:", designs);

            customItems.forEach(item => {
                const designId = getCustomDesignId(item);

                const design = designs.find(
                    d => Number(d.id) === designId
                );

                if (!design) {
                    item.customStatus = "Not Found";
                    item.priceStatus = "pending";
                    item.stockStatus = "pending";
                    item.adminNote = "Please contact OWO support.";
                    return;
                }

                const designData = getDesignData(design);

                // Latest approval status from PostgreSQL.
                item.customStatus = design.status || "Pending Review";

                item.adminNote = design.admin_note || "";

                item.stockQuantity = Number(
                    design.stock_quantity ?? 0
                );

                const quotedPrice = Number(design.quoted_price);

                // =====================================
                // APPROVED DESIGN
                // =====================================

                if (
                    normalizeStatus(design.status) === "price confirmed" &&
                    Number.isFinite(quotedPrice) &&
                    quotedPrice > 0
                ) {
                    item.price = quotedPrice;
                    item.priceStatus = "confirmed";

                    if (item.stockQuantity > 0) {
                        item.stockStatus = "confirmed";
                        item.stockVerified = true;

                        if (item.quantity > item.stockQuantity) {
                            item.quantity = item.stockQuantity;
                        }
                    } else {
                        item.stockStatus = "unavailable";
                    }
                }

                // =====================================
                // REJECTED DESIGN
                // =====================================

                else if (
                    normalizeStatus(design.status) === "rejected"
                ) {
                    item.priceStatus = "pending";
                    item.stockStatus = "rejected";
                }

                // =====================================
                // PENDING OR OTHER STATUS
                // =====================================

                else {
                    item.priceStatus = "pending";
                    item.stockStatus = "pending";
                }

                // Restore saved customization details.
                if (designData.customization) {
                    item.customization = designData.customization;
                }

                if (designData.size) {
                    item.size = designData.size;
                }
            });

        } catch (error) {
            console.error("OWO Custom Design Status Error:", error);

            // Keep existing cart data if the server is temporarily unavailable.
        }
    }

    // =====================================
    // 7. REFRESH ALL CART DATA
    // =====================================

    async function refreshCartData() {
        await Promise.all([
            refreshProductStock(),
            refreshCustomDesignStatus()
        ]);

        saveCart();
        displayCart();
    }

    // =====================================
    // 8. CART VALIDATION
    // =====================================

    function validateCart() {
        if (cart.length === 0) {
            return "Your shopping bag is empty.";
        }

        for (const item of cart) {
            const quantity = Number(item.quantity);

            if (!Number.isInteger(quantity) || quantity < 1) {
                return "Your cart contains an invalid quantity.";
            }

            if (isCustomItem(item)) {

                if (
                    normalizeStatus(item.customStatus) === "rejected"
                ) {
                    return "One of your custom designs was rejected. Please review your cart.";
                }

                if (
                    normalizeStatus(item.customStatus) === "ordered"
                ) {
                    return "One of your custom designs has already been ordered. Please remove it from your cart.";
                }

                if (!isCustomApproved(item)) {
                    return "Your custom design is not yet approved by OWO. Please wait for price and stock confirmation.";
                }

                if (quantity > Number(item.stockQuantity)) {
                    return "Your custom design quantity exceeds the confirmed stock.";
                }

            } else {

                if (item.unavailable) {
                    return `${item.name} is currently unavailable.`;
                }

                if (!item.stockVerified) {
                    return "Please wait while product stock is verified.";
                }

                if (quantity > Number(item.stock_quantity)) {
                    return `${item.name} has only ${item.stock_quantity} item(s) available.`;
                }

                if (
                    !Number.isFinite(Number(item.price)) ||
                    Number(item.price) <= 0
                ) {
                    return "Your cart contains an invalid product price.";
                }
            }
        }

        return null;
    }

    // =====================================
    // 9. CUSTOM DESIGN STATUS DISPLAY
    // =====================================

    function getCustomStatusHTML(item) {
        const status = normalizeStatus(item.customStatus);

        if (status === "price confirmed") {
            return `
                <div class="custom-status custom-approved">
                    <strong>✓ Design Approved</strong>

                    <p>OWO has confirmed your design.</p>

                    <p>
                        Confirmed Price:
                        <strong>${formatPrice(item.price)}</strong>
                    </p>

                    <p>
                        Available Stock:
                        <strong>${Number(item.stockQuantity)}</strong>
                    </p>

                    ${item.adminNote ? `
                        <p>OWO Note: ${escapeHTML(item.adminNote)}</p>
                    ` : ""}

                    ${Number(item.stockQuantity) <= LOW_STOCK_LIMIT ? `
                        <p>Limited stock available.</p>
                    ` : ""}
                </div>
            `;
        }

        if (status === "rejected") {
            return `
                <div class="custom-status custom-rejected">
                    <strong>✕ Design Rejected</strong>

                    <p>
                        ${escapeHTML(
                            item.adminNote ||
                            "Your design was not approved by OWO."
                        )}
                    </p>
                </div>
            `;
        }

        if (status === "ordered") {
            return `
                <div class="custom-status custom-approved">
                    <strong>✓ Already Ordered</strong>

                    <p>This design has already been purchased.</p>
                </div>
            `;
        }

        if (status === "login required") {
            return `
                <div class="custom-status custom-pending">
                    <strong>Login Required</strong>

                    <p>Please log in to check your design approval.</p>
                </div>
            `;
        }

        if (status === "not found") {
            return `
                <div class="custom-status custom-rejected">
                    <strong>Design Not Found</strong>

                    <p>
                        ${escapeHTML(
                            item.adminNote ||
                            "Please contact OWO support."
                        )}
                    </p>
                </div>
            `;
        }

        return `
            <div class="custom-status custom-pending">
                <strong>Waiting for OWO Approval</strong>

                <p>
                    Your custom design is waiting for price and
                    stock confirmation.
                </p>
            </div>
        `;
    }

    // =====================================
    // 10. UPDATE CART SUMMARY
    // =====================================

    function updateSummary() {
        let subtotal = 0;
        let totalQuantity = 0;

        cart.forEach(item => {
            const quantity = Number(item.quantity) || 0;

            totalQuantity += quantity;

            if (isCustomItem(item) && !isPriceConfirmed(item)) {
                return;
            }

            subtotal += Number(item.price || 0) * quantity;
        });

        // Shipping is not yet calculated by OWO.
        // Do not promise FREE delivery.
        const total = subtotal;

        if (cartItemCount) {
            cartItemCount.textContent = totalQuantity;
        }

        if (cartSubtotal) {
            cartSubtotal.textContent = formatPrice(subtotal);
        }

        if (cartShipping) {
            cartShipping.textContent = "Calculated at checkout";
        }

        if (cartTotal) {
            cartTotal.textContent = formatPrice(total);
        }

        const error = validateCart();

        if (checkoutButton) {
            checkoutButton.disabled = Boolean(error);

            checkoutButton.style.opacity = error ? "0.5" : "1";

            checkoutButton.style.cursor = error
                ? "not-allowed"
                : "pointer";
        }

        if (cartStockMessage) {
            cartStockMessage.textContent = error || "";

            cartStockMessage.style.display = error
                ? "block"
                : "none";
        }
    }

    // =====================================
    // 11. DISPLAY CART ITEMS
    // =====================================

    function displayCart() {
        if (!cartProducts) return;

        cartProducts.innerHTML = "";

        if (cart.length === 0) {
            if (emptyCart) {
                emptyCart.style.display = "block";
            }

            cartProducts.style.display = "none";

            updateSummary();
            return;
        }

        if (emptyCart) {
            emptyCart.style.display = "none";
        }

        cartProducts.style.display = "block";

        cart.forEach((item, index) => {
            const custom = isCustomItem(item);

            const quantity = Number(item.quantity);

            const image = getProductImage(item);

            const priceConfirmed =
                !custom || isPriceConfirmed(item);

            const price = priceConfirmed
                ? Number(item.price || 0)
                : 0;

            const stock = custom
                ? Number(item.stockQuantity || 0)
                : Number(item.stock_quantity || 0);

            const cannotIncrease = custom
                ? !isCustomApproved(item) || quantity >= stock
                : item.unavailable || quantity >= stock;

            const cannotDecrease = quantity <= 1;

            const cartItem = document.createElement("div");

            cartItem.className = "cart-item";

            cartItem.innerHTML = `
                <div class="cart-item-image">

                    ${image ? `
                        <img
                            src="${escapeHTML(image)}"
                            alt="${escapeHTML(item.name)}"
                            onerror="this.style.display='none';"
                        >
                    ` : `
                        <div class="cart-no-image">OWO</div>
                    `}

                </div>

                <div class="cart-item-details">

                    <h3>${escapeHTML(item.name)}</h3>

                    ${custom ? `
                        <p class="custom-label">OWO CUSTOM STUDIO</p>
                    ` : ""}

                    ${item.size ? `
                        <p>
                            Size:
                            <strong>${escapeHTML(item.size)}</strong>
                        </p>
                    ` : ""}

                    ${custom
                        ? getCustomizationHTML(item.customization)
                        : ""}

                    ${custom
                        ? getCustomStatusHTML(item)
                        : ""}

                    ${!custom && item.unavailable ? `
                        <p class="cart-warning">
                            Currently unavailable
                        </p>
                    ` : ""}

                    ${!custom &&
                    item.stock_quantity <= LOW_STOCK_LIMIT &&
                    item.stock_quantity > 0 ? `
                        <p class="cart-warning">
                            Only ${item.stock_quantity} left in stock
                        </p>
                    ` : ""}

                    <div class="cart-quantity-controls">

                        <button
                            type="button"
                            class="quantity-decrease"
                            data-index="${index}"
                            ${cannotDecrease ? "disabled" : ""}
                        >−</button>

                        <span>${quantity}</span>

                        <button
                            type="button"
                            class="quantity-increase"
                            data-index="${index}"
                            ${cannotIncrease ? "disabled" : ""}
                        >+</button>

                    </div>

                    <button
                        type="button"
                        class="remove-cart-item"
                        data-index="${index}"
                    >
                        Remove
                    </button>

                </div>

                <div class="cart-item-price">

                    <strong>
                        ${priceConfirmed
                            ? formatPrice(price * quantity)
                            : "Price Pending"}
                    </strong>

                </div>
            `;

            cartProducts.appendChild(cartItem);
        });

        updateSummary();
    }

    // =====================================
    // 12. QUANTITY AND REMOVE HANDLERS
    // =====================================

    if (cartProducts) {
        cartProducts.addEventListener("click", event => {

            const increaseButton =
                event.target.closest(".quantity-increase");

            const decreaseButton =
                event.target.closest(".quantity-decrease");

            const removeButton =
                event.target.closest(".remove-cart-item");

            if (increaseButton) {
                const index = Number(increaseButton.dataset.index);

                const item = cart[index];

                if (!item) return;

                const stock = isCustomItem(item)
                    ? Number(item.stockQuantity || 0)
                    : Number(item.stock_quantity || 0);

                if (
                    isCustomItem(item) &&
                    !isCustomApproved(item)
                ) {
                    return;
                }

                if (
                    item.unavailable ||
                    Number(item.quantity) >= stock
                ) {
                    return;
                }

                item.quantity++;

                saveCart();
                displayCart();
            }

            if (decreaseButton) {
                const index = Number(decreaseButton.dataset.index);

                const item = cart[index];

                if (!item || Number(item.quantity) <= 1) {
                    return;
                }

                item.quantity--;

                saveCart();
                displayCart();
            }

            if (removeButton) {
                const index = Number(removeButton.dataset.index);

                if (!cart[index]) return;

                const confirmed = confirm(
                    "Are you sure you want to remove this item?"
                );

                if (!confirmed) return;

                cart.splice(index, 1);

                saveCart();
                displayCart();
            }
        });
    }

    // =====================================
    // 13. CHECKOUT BUTTON
    // =====================================

    if (checkoutButton) {
        checkoutButton.addEventListener("click", event => {
            event.preventDefault();

            const error = validateCart();

            if (error) {
                alert(error);
                return;
            }

            saveCart();

            window.location.href = "checkout.html";
        });
    }

    // =====================================
    // 14. MOBILE MENU
    // =====================================

    const menuToggle = document.querySelector(".menu-toggle");

    const navLinks = document.querySelector(".nav-links");

    if (menuToggle && navLinks) {
        menuToggle.addEventListener("click", () => {
            navLinks.classList.toggle("active");
            menuToggle.classList.toggle("active");
        });
    }

    // =====================================
    // 15. INITIALIZE CART
    // =====================================

    async function initializeCart() {
        displayCart();

        await refreshCartData();

        console.log("OWO Cart Connected Successfully!");
    }

    initializeCart();

})();
