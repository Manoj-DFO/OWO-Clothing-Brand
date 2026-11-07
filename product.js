// ===================================
// OWO - PRODUCT DETAILS
// ===================================

const API_URL = "http://localhost:3000/api/products";

let selectedProduct = null;
let selectedSize = null;
let quantity = 1;

const CLOTHING_CATEGORIES = [
    "Men",
    "Women",
    "Streetwear",
    "Custom Clothing"
];

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function getCart() {
    try {
        const cart = JSON.parse(localStorage.getItem("owoCart")) || [];
        return Array.isArray(cart) ? cart : [];
    } catch {
        return [];
    }
}

function getCartQuantity(productId) {
    return getCart().reduce((total, item) => {
        return String(item.id) === String(productId)
            ? total + Number(item.quantity || 0)
            : total;
    }, 0);
}

function getAvailableStock() {
    return Math.max(0, Number(selectedProduct?.stock_quantity) || 0);
}

function getRemainingStock() {
    return Math.max(
        0,
        getAvailableStock() - getCartQuantity(selectedProduct.id)
    );
}


// ===================================
// LOAD PRODUCT
// ===================================

async function loadProduct() {
    const container = document.getElementById("product-details");

    try {
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error("Unable to fetch products.");
        }

        const products = await response.json();

        const params = new URLSearchParams(window.location.search);
        const productId = params.get("id");

        selectedProduct = products.find(
            product => String(product.id) === String(productId)
        );

        if (!selectedProduct) {
            container.innerHTML = "<h2>Product not found.</h2>";
            return;
        }

        quantity = 1;

        const availableSizes = Array.isArray(selectedProduct.sizes)
            ? selectedProduct.sizes
            : [];

        selectedSize = availableSizes.length > 0
            ? availableSizes[0]
            : null;

        renderProduct();

    } catch (error) {
        console.error(error);
        container.innerHTML = "<h2>Unable to load product.</h2>";
    }
}


// ===================================
// QUANTITY DISPLAY
// ===================================

function updateQuantityDisplay() {
    const quantityElement = document.getElementById("quantity-value");
    const increaseButton = document.getElementById("increase-quantity");
    const decreaseButton = document.getElementById("decrease-quantity");
    const addButton = document.getElementById("add-product-to-cart");
    const stockMessage = document.getElementById("product-stock-message");

    if (!quantityElement || !selectedProduct) return;

    const remainingStock = getRemainingStock();

    quantityElement.textContent = quantity;

    if (increaseButton) {
        increaseButton.disabled = quantity >= remainingStock;
    }

    if (decreaseButton) {
        decreaseButton.disabled = quantity <= 1;
    }

    if (addButton) {
        addButton.disabled =
            remainingStock <= 0 ||
            quantity > remainingStock;
    }

    if (stockMessage) {
        if (remainingStock <= 0) {
            stockMessage.textContent = "Out of stock or maximum available quantity already in your cart.";
        } else {
            stockMessage.textContent =
                `${remainingStock} item(s) available to add.`;
        }
    }
}


// ===================================
// RENDER PRODUCT
// ===================================

function renderProduct() {
    const container = document.getElementById("product-details");

    const productSizes = Array.isArray(selectedProduct.sizes)
        ? selectedProduct.sizes
        : [];

    const isClothing = CLOTHING_CATEGORIES.includes(
        selectedProduct.category
    );

    const hasSizes = productSizes.length > 0;
    const stock = getAvailableStock();

    const price = Number(selectedProduct.price).toLocaleString("en-IN");

    let sizeHTML = "";

    if (hasSizes) {
        sizeHTML = `
            <label class="product-option-label">SELECT SIZE</label>

            <div class="size-options">
                ${productSizes.map(size => `
                    <button
                        type="button"
                        class="size-option ${size === selectedSize ? "active" : ""}"
                        data-size="${escapeHTML(size)}"
                    >
                        ${escapeHTML(size)}
                    </button>
                `).join("")}
            </div>
        `;
    } else if (isClothing) {
        sizeHTML = `
            <p class="product-size-unavailable">
                Sizes are currently unavailable for this product.
            </p>
        `;
    }

    container.innerHTML = `
        <div class="product-detail-layout">

            <div>
                <img
                    class="product-detail-image"
                    src="${escapeHTML(selectedProduct.image_url || "")}"
                    alt="${escapeHTML(selectedProduct.name)}"
                >
            </div>

            <div class="product-detail-info">

                <p class="product-category">
                    ${escapeHTML(selectedProduct.category)}
                </p>

                <h1>${escapeHTML(selectedProduct.name)}</h1>

                <p class="product-detail-price">
                    ₹${price}
                </p>

                <p class="product-description">
                    ${escapeHTML(
                        selectedProduct.description ||
                        "Discover your style with OWO."
                    )}
                </p>

                ${sizeHTML}

                <p id="product-stock-message" class="product-stock-message"></p>

                <label class="product-option-label">QUANTITY</label>

                <div class="quantity-control">
                    <button type="button" id="decrease-quantity">−</button>
                    <span id="quantity-value">${quantity}</span>
                    <button type="button" id="increase-quantity">+</button>
                </div>

                <button
                    type="button"
                    class="add-to-cart-btn"
                    id="add-product-to-cart"
                    ${(isClothing && !hasSizes) || stock <= 0 ? "disabled" : ""}
                >
                    ADD TO CART — ₹${price}
                </button>

            </div>
        </div>
    `;

    updateQuantityDisplay();
    updateCartCount();
}


// ===================================
// PRODUCT PAGE BUTTON ACTIONS
// ===================================

document.addEventListener("click", function(event) {

    const sizeButton = event.target.closest(".size-option");

    if (sizeButton && selectedProduct) {
        selectedSize = sizeButton.dataset.size;

        document.querySelectorAll(".size-option").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.size === selectedSize
            );
        });
    }

    if (event.target.closest("#increase-quantity")) {
        if (quantity < getRemainingStock()) {
            quantity++;
            updateQuantityDisplay();
        } else {
            alert(`Only ${getRemainingStock()} more item(s) can be added.`);
        }
    }

    if (event.target.closest("#decrease-quantity")) {
        if (quantity > 1) {
            quantity--;
            updateQuantityDisplay();
        }
    }

    if (event.target.closest("#add-product-to-cart")) {
        addProductToCart();
    }
});


// ===================================
// ADD PRODUCT TO CART
// ===================================

function addProductToCart() {

    if (!selectedProduct) return;

    const isClothing = CLOTHING_CATEGORIES.includes(
        selectedProduct.category
    );

    const availableSizes = Array.isArray(selectedProduct.sizes)
        ? selectedProduct.sizes
        : [];

    if (isClothing && availableSizes.length === 0) {
        alert("Sizes are currently unavailable for this product.");
        return;
    }

    if (
        availableSizes.length > 0 &&
        !availableSizes.includes(selectedSize)
    ) {
        alert("Please select an available size.");
        return;
    }

    const remainingStock = getRemainingStock();

    if (remainingStock <= 0 || quantity > remainingStock) {
        alert(`Only ${remainingStock} more item(s) are available.`);
        updateQuantityDisplay();
        return;
    }

    const cart = getCart();
    const cartSize = selectedSize || null;

    const existingProduct = cart.find(item =>
        String(item.id) === String(selectedProduct.id) &&
        (item.size || null) === cartSize
    );

    if (existingProduct) {
        existingProduct.quantity =
            Number(existingProduct.quantity) + quantity;

        existingProduct.stock_quantity = getAvailableStock();

    } else {
        cart.push({
            id: selectedProduct.id,
            name: selectedProduct.name,
            price: Number(selectedProduct.price),
            image: selectedProduct.image_url,
            size: cartSize,
            quantity: quantity,
            stock_quantity: getAvailableStock()
        });
    }

    localStorage.setItem("owoCart", JSON.stringify(cart));

    quantity = 1;

    updateQuantityDisplay();
    updateCartCount();

    alert("Product added to your cart!");
}


// ===================================
// UPDATE CART COUNT
// ===================================

function updateCartCount() {
    const cart = getCart();

    const count = cart.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
    );

    const countElement = document.getElementById("cart-count");

    if (countElement) {
        countElement.textContent = count;
    }
}


// ===================================
// INITIALIZE PRODUCT PAGE
// ===================================

loadProduct();