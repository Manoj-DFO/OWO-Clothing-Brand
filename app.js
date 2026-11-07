
// ===================================
// OWO - WEBSITE JAVASCRIPT
// ===================================


// 1. LOAD CART DATA

let cart = JSON.parse(localStorage.getItem("owoCart")) || [];


// 2. MOBILE MENU

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


// 3. WISHLIST

document.addEventListener("click", event => {
    const button = event.target.closest(".wishlist");

    if (!button) return;

    const icon = button.querySelector("i");

    if (!icon) return;

    icon.classList.toggle("fa-regular");
    icon.classList.toggle("fa-solid");

    button.style.color =
        icon.classList.contains("fa-solid") ? "#c0392b" : "#111";
});


// 4. CART COUNTER

const cartIcon = document.querySelector(
    '.nav-icons a[aria-label="Shopping bag"]'
);

let cartBadge = null;

if (cartIcon) {
    cartBadge = document.createElement("span");
    cartBadge.className = "cart-count";
    cartIcon.appendChild(cartBadge);
}

function saveCart() {
    localStorage.setItem("owoCart", JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const totalItems = cart.reduce(
        (total, product) => total + Number(product.quantity || 1),
        0
    );

    if (cartBadge) {
        cartBadge.textContent = totalItems;
    }
}

updateCartCount();


// 5. ADD PRODUCTS TO CART

document.addEventListener("click", event => {
    const button = event.target.closest(".quick-add");

    if (!button || button.disabled) return;

    const productCard = button.closest(".product-card");

    if (!productCard) return;

    const id = productCard.dataset.id;
    const name = productCard.dataset.name;
    const price = Number(productCard.dataset.price);

    if (!name || !Number.isFinite(price) || price <= 0) {
        alert("Product information is missing.");
        return;
    }

    const existingProduct = cart.find(product =>
        String(product.id || "") === String(id || "") &&
        (product.size || "") === ""
    );

    if (existingProduct) {
        existingProduct.quantity++;
    } else {
        cart.push({
            id: id,
            name: name,
            price: price,
            quantity: 1
        });
    }

    saveCart();

    button.textContent = "ADDED TO BAG ✓";

    setTimeout(() => {
        button.textContent = "QUICK ADD +";
    }, 1200);
});


// 6. ESCAPE HTML

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}


// 7. LOAD PRODUCTS FROM POSTGRESQL
// Only runs on pages containing #product-grid.

async function loadProducts() {

    const productGrid = document.getElementById("product-grid");

    // Homepage no longer has a featured products section.
    // Shop products are loaded separately through shop.js.
    if (!productGrid) return;

    try {

        productGrid.innerHTML = "<p>Loading OWO products...</p>";

        const response = await fetch(
            "http://localhost:3000/api/products"
        );

        if (!response.ok) {
            throw new Error("Unable to fetch products");
        }

        const products = await response.json();

        const activeProducts = products.filter(
            product => product.is_active !== false
        );

        if (activeProducts.length === 0) {
            productGrid.innerHTML = "<p>No products available yet.</p>";
            return;
        }

        productGrid.innerHTML = "";

        activeProducts.forEach(product => {

            const card = document.createElement("div");

            card.className = "product-card";

            const name = escapeHTML(product.name);
            const category = escapeHTML(product.category);
            const image = escapeHTML(product.image_url || "");

            const price = Number(product.price);
            const stock = Number(product.stock_quantity);

            card.dataset.id = product.id;
            card.dataset.name = product.name;
            card.dataset.price = price;

            card.style.cursor = "pointer";

            card.innerHTML = `

                <div class="product-image">

                    <img
                        src="${image}"
                        alt="${name}"
                    >

                    <button
                        class="wishlist"
                        aria-label="Add to wishlist"
                    >
                        <i class="fa-regular fa-heart"></i>
                    </button>

                    <button
                        class="quick-add"
                        ${stock <= 0 ? "disabled" : ""}
                    >
                        ${stock <= 0 ? "OUT OF STOCK" : "QUICK ADD +"}
                    </button>

                </div>

                <div class="product-info">

                    <div>
                        <h3>${name}</h3>
                        <p>${category}</p>
                    </div>

                    <strong>
                        ₹${price.toLocaleString("en-IN")}
                    </strong>

                </div>

            `;

            const productImage = card.querySelector("img");

            productImage.addEventListener("error", () => {
                productImage.style.display = "none";
            });

            productGrid.appendChild(card);

        });

    } catch (error) {

        console.error("Product loading error:", error);

        productGrid.innerHTML = `
            <p>Unable to load products. Please try again later.</p>
        `;
    }
}


// 8. OPEN PRODUCT DETAILS PAGE

document.addEventListener("click", event => {

    const productCard = event.target.closest(".product-card");

    if (!productCard) return;

    // Don't open details when clicking buttons.
    if (event.target.closest("button")) return;

    const productId = productCard.dataset.id;

    if (productId) {
        window.location.href =
            `product.html?id=${encodeURIComponent(productId)}`;
    }

});


// 9. DISPLAY CART PRODUCTS

function renderCart() {

    const cartContainer = document.getElementById("cart-items");

    if (!cartContainer) return;

    cartContainer.innerHTML = "";

    if (cart.length === 0) {

        cartContainer.innerHTML = `
            <div class="empty-cart">
                <i class="fa-solid fa-bag-shopping"></i>
                <h2>Your bag is empty</h2>
                <p>Discover something you love at OWO.</p>
            </div>
        `;

    } else {

        cart.forEach((product, index) => {

            const item = document.createElement("div");

            item.className = "cart-item";

            item.innerHTML = `

                <div class="cart-item-details">

                    <h3>${escapeHTML(product.name)}</h3>

                    <p>₹${Number(product.price).toLocaleString("en-IN")}</p>

                    ${product.size ? `<p>Size: ${escapeHTML(product.size)}</p>` : ""}

                    <div class="quantity-controls">

                        <button data-action="decrease" data-index="${index}">−</button>

                        <span>${product.quantity}</span>

                        <button data-action="increase" data-index="${index}">+</button>

                    </div>

                    <button class="remove-item" data-action="remove" data-index="${index}">
                        REMOVE
                    </button>

                </div>

                <strong>
                    ₹${(Number(product.price) * product.quantity).toLocaleString("en-IN")}
                </strong>

            `;

            cartContainer.appendChild(item);

        });

    }

    const subtotal = cart.reduce(
        (total, product) =>
            total + Number(product.price) * product.quantity,
        0
    );

    const subtotalElement = document.getElementById("cart-subtotal");
    const totalElement = document.getElementById("cart-total");
    const shippingElement = document.getElementById("cart-shipping");
    const checkoutButton = document.getElementById("checkout-btn");

    if (subtotalElement) {
        subtotalElement.textContent =
            "₹" + subtotal.toLocaleString("en-IN");
    }

    if (totalElement) {
        totalElement.textContent =
            "₹" + subtotal.toLocaleString("en-IN");
    }

    if (shippingElement) {
        shippingElement.textContent = "FREE";
    }

    if (checkoutButton) {
        checkoutButton.disabled = cart.length === 0;
    }
}


// 10. INCREASE, DECREASE AND REMOVE PRODUCTS

const cartContainer = document.getElementById("cart-items");

if (cartContainer) {

    cartContainer.addEventListener("click", event => {

        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const index = Number(button.dataset.index);
        const action = button.dataset.action;

        if (!cart[index]) return;

        if (action === "increase") {
            cart[index].quantity++;
        }

        if (action === "decrease") {
            cart[index].quantity--;

            if (cart[index].quantity <= 0) {
                cart.splice(index, 1);
            }
        }

        if (action === "remove") {
            cart.splice(index, 1);
        }

        saveCart();
        renderCart();

    });
}


// 11. CHECKOUT BUTTON

const checkoutButton = document.getElementById("checkout-btn");

if (checkoutButton) {

    checkoutButton.addEventListener("click", () => {

        if (cart.length > 0) {
            alert("Your cart is ready! We will build the checkout system next.");
        }

    });

}


// 12. NEWSLETTER

const newsletterForm = document.querySelector(".newsletter-form");

if (newsletterForm) {

    newsletterForm.addEventListener("submit", event => {

        event.preventDefault();

        const email = newsletterForm.querySelector("input").value;

        alert("Thank you for joining OWO! Your email: " + email);

        newsletterForm.reset();

    });

}


// 13. INITIALIZE WEBSITE

renderCart();

// Load products only when this page has a product grid.
// The separate shop.js handles the Shop page.
if (document.getElementById("product-grid")) {
    loadProducts();
}

console.log("OWO Website Successfully Loaded!");
