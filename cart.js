
(() => {

// ===================================
// OWO - SHOPPING CART
// ===================================

const PRODUCTS_API = "http://localhost:3000/api/products";

let cart = [];

const cartProducts = document.getElementById("cart-products");
const emptyCart = document.getElementById("empty-cart");

let stockVerified = false;


// ===================================
// PRODUCT IMAGES
// ===================================

const productImages = {
    "Essential White Tee":
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=400&q=80",

    "Urban Leather Jacket":
        "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=400&q=80",

    "Classic Timepiece":
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80",

    "Signature Fragrance":
        "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=400&q=80"
};


// ===================================
// HELPERS
// ===================================

function loadCart() {
    try {
        const savedCart = JSON.parse(localStorage.getItem("owoCart")) || [];
        return Array.isArray(savedCart) ? savedCart : [];
    } catch (error) {
        console.error("Cart loading error:", error);
        return [];
    }
}

function saveCart() {
    localStorage.setItem("owoCart", JSON.stringify(cart));
}

function formatPrice(price) {
    return "₹" + Number(price).toLocaleString("en-IN");
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function getProductQuantity(productId) {
    return cart.reduce((total, item) => {
        return String(item.id) === String(productId)
            ? total + Number(item.quantity || 0)
            : total;
    }, 0);
}

function getStock(productId) {
    const item = cart.find(product =>
        String(product.id) === String(productId)
    );

    return Number(item?.stock_quantity) || 0;
}


// ===================================
// VERIFY LATEST STOCK FROM BACKEND
// ===================================

async function refreshCartStock() {

    try {
        const response = await fetch(PRODUCTS_API);

        if (!response.ok) {
            throw new Error("Unable to check product stock.");
        }

        const products = await response.json();

        cart.forEach(item => {

            const latestProduct = products.find(product =>
                String(product.id) === String(item.id)
            );

            if (latestProduct) {
                item.stock_quantity = Number(latestProduct.stock_quantity) || 0;
                item.available = latestProduct.is_active !== false;
                item.price = Number(latestProduct.price);
                item.name = latestProduct.name;
                item.image = latestProduct.image_url || item.image;
            } else {
                item.stock_quantity = 0;
                item.available = false;
            }
        });

        saveCart();

        stockVerified = true;

        displayCart();

    } catch (error) {

        console.error("Stock verification error:", error);

        stockVerified = false;

        displayCart();

        const message = document.getElementById("cart-stock-message");

        if (message) {
            message.textContent =
                "Unable to verify stock. Please refresh the page and try again.";
        }
    }
}


// ===================================
// DISPLAY CART PRODUCTS
// ===================================

function displayCart() {

    if (!cartProducts || !emptyCart) {
        console.error("Cart HTML elements are missing.");
        return;
    }

    cartProducts.innerHTML = "";

    const totalItems = cart.reduce(
        (total, product) => total + Number(product.quantity || 0),
        0
    );

    const itemCount = document.getElementById("cart-item-count");

    if (itemCount) {
        itemCount.textContent =
            totalItems +
            (totalItems === 1 ? " item in your bag" : " items in your bag");
    }

    if (cart.length === 0) {
        emptyCart.hidden = false;
        cartProducts.style.display = "none";
    } else {
        emptyCart.hidden = true;
        cartProducts.style.display = "block";
    }

    cart.forEach((product, index) => {

        const image = product.image ||
            productImages[product.name] ||
            "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80";

        const stock = Number(product.stock_quantity) || 0;
        const totalProductQuantity = getProductQuantity(product.id);

        const unavailable = product.available === false || stock <= 0;
        const exceedsStock = totalProductQuantity > stock;
        const cannotIncrease =
            unavailable || totalProductQuantity >= stock;

        let stockWarning = "";

        if (unavailable) {
            stockWarning = "This product is currently unavailable.";
        } else if (exceedsStock) {
            stockWarning = `Only ${stock} item(s) are currently available. Please reduce your quantity.`;
        } else if (cannotIncrease) {
            stockWarning = "Maximum available stock reached.";
        }

        const item = document.createElement("div");
        item.className = "cart-item";

        item.innerHTML = `
            <img
                class="cart-item-image"
                src="${escapeHTML(image)}"
                alt="${escapeHTML(product.name)}"
            >

            <div class="cart-item-info">
                <h3>${escapeHTML(product.name)}</h3>

                <p>OWO COLLECTION</p>

                ${product.size ? `
                    <p class="cart-item-size">
                        Size: <strong>${escapeHTML(product.size)}</strong>
                    </p>
                ` : ""}

                <div class="quantity-controls">

                    <button
                        data-action="decrease"
                        data-index="${index}"
                        aria-label="Decrease quantity"
                    >−</button>

                    <span>${Number(product.quantity)}</span>

                    <button
                        data-action="increase"
                        data-index="${index}"
                        aria-label="Increase quantity"
                        ${cannotIncrease ? "disabled" : ""}
                    >+</button>

                </div>

                ${stockWarning ? `
                    <p class="cart-stock-warning">
                        ${escapeHTML(stockWarning)}
                    </p>
                ` : ""}
            </div>

            <div class="cart-item-actions">
                <strong class="cart-item-price">
                    ${formatPrice(Number(product.price) * Number(product.quantity))}
                </strong>

                <button
                    class="remove-item"
                    data-action="remove"
                    data-index="${index}"
                >
                    Remove
                </button>
            </div>
        `;

        cartProducts.appendChild(item);
    });

    updateSummary();
}


// ===================================
// UPDATE PRICE SUMMARY
// ===================================

function updateSummary() {

    const subtotal = cart.reduce(
        (total, product) =>
            total + Number(product.price) * Number(product.quantity),
        0
    );

    const subtotalElement = document.getElementById("cart-subtotal");
    const totalElement = document.getElementById("cart-total");
    const shippingElement = document.getElementById("cart-shipping");
    const checkoutButton = document.getElementById("checkout-button");

    if (subtotalElement) {
        subtotalElement.textContent = formatPrice(subtotal);
    }

    if (totalElement) {
        totalElement.textContent = formatPrice(subtotal);
    }

    if (shippingElement) {
        shippingElement.textContent = "Calculated later";
    }

    const invalidStock = cart.some(product => {

        const stock = Number(product.stock_quantity) || 0;

        return (
            product.available === false ||
            stock <= 0 ||
            getProductQuantity(product.id) > stock
        );
    });

    if (checkoutButton) {
        checkoutButton.disabled =
            cart.length === 0 ||
            !stockVerified ||
            invalidStock;
    }

    const message = document.getElementById("cart-stock-message");

    if (message && stockVerified && invalidStock) {
        message.textContent =
            "Please correct unavailable or excessive quantities before checkout.";
    } else if (message && stockVerified) {
        message.textContent = "";
    }
}


// ===================================
// QUANTITY AND REMOVE BUTTONS
// ===================================

if (cartProducts) {

    cartProducts.addEventListener("click", event => {

        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const index = Number(button.dataset.index);
        const action = button.dataset.action;

        if (!cart[index]) return;

        if (action === "increase") {

            const product = cart[index];
            const stock = getStock(product.id);
            const totalQuantity = getProductQuantity(product.id);

            if (!stockVerified) {
                alert("Please wait while we verify product stock.");
                return;
            }

            if (totalQuantity >= stock) {
                alert(`Only ${stock} item(s) are available in stock.`);
                return;
            }

            product.quantity++;
        }

        else if (action === "decrease") {

            cart[index].quantity--;

            if (cart[index].quantity <= 0) {
                cart.splice(index, 1);
            }
        }

        else if (action === "remove") {
            cart.splice(index, 1);
        }

        saveCart();
        displayCart();
    });
}


// ===================================
// CHECKOUT BUTTON
// ===================================

const checkoutButton = document.getElementById("checkout-button");

if (checkoutButton) {

    checkoutButton.addEventListener("click", () => {

        if (cart.length === 0) {
            alert("Your shopping bag is empty.");
            return;
        }

        if (!stockVerified) {
            alert("Please wait while we verify product stock.");
            return;
        }

        const invalidStock = cart.some(product => {
            return (
                product.available === false ||
                getProductQuantity(product.id) >
                    Number(product.stock_quantity || 0)
            );
        });

        if (invalidStock) {
            alert("Please correct your product quantities before checkout.");
            return;
        }

        window.location.href = "checkout.html";
    });
}


// ===================================
// MOBILE MENU
// ===================================

const menuButton = document.querySelector(".menu-btn");
const navLinks = document.querySelector(".nav-links");

if (menuButton && navLinks) {

    menuButton.addEventListener("click", () => {

        navLinks.classList.toggle("active");

        const icon = menuButton.querySelector("i");

        if (icon) {
            icon.classList.toggle("fa-bars");
            icon.classList.toggle("fa-xmark");
        }
    });
}


// ===================================
// INITIALIZE CART
// ===================================

cart = loadCart();

displayCart();

refreshCartStock();

console.log("OWO Shopping Cart Loaded!");

})();
