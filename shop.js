
// ============================================
// OWO - SHOP PAGE JAVASCRIPT
// ============================================

const SHOP_API = "http://localhost:3000/api";

const SHOP_CART_KEY = "owoCart";

let shopProducts = [];
let filteredShopProducts = [];


// ============================================
// DOM ELEMENTS
// ============================================

const shopGrid = document.getElementById("shop-product-grid");
const shopSearch = document.getElementById("shop-search");
const shopCategory = document.getElementById("shop-category");
const shopSort = document.getElementById("shop-sort");

const shopResultCount = document.getElementById("shop-result-count");
const shopFilterMessage = document.getElementById("shop-filter-message");

const shopEmptyState = document.getElementById("shop-empty-state");

const clearFiltersButton = document.getElementById("clear-shop-filters");
const resetSearchButton = document.getElementById("reset-shop-search");


// ============================================
// CART FUNCTIONS
// ============================================

function getShopCart() {

    try {

        const cart = JSON.parse(
            localStorage.getItem(SHOP_CART_KEY) || "[]"
        );

        return Array.isArray(cart) ? cart : [];

    } catch (error) {

        console.error("Unable to read cart:", error);

        return [];

    }

}


function saveShopCart(cart) {

    localStorage.setItem(SHOP_CART_KEY, JSON.stringify(cart));

    updateShopCartCount();

}


function updateShopCartCount() {

    const cart = getShopCart();

    const totalItems = cart.reduce((total, item) => {

        return total + Number(item.quantity || 0);

    }, 0);

    const cartLink = document.querySelector(
        '.nav-icons a[aria-label="Shopping bag"]'
    );

    if (!cartLink) return;

    let badge = cartLink.querySelector(".cart-count");

    if (!badge) {

        badge = document.createElement("span");

        badge.className = "cart-count";

        cartLink.appendChild(badge);

    }

    badge.textContent = totalItems;

}


function addShopToCart(product) {

    const cart = getShopCart();

    const existingItem = cart.find(item => {

        return Number(item.id) === Number(product.id) &&
            (item.size || "") === "";

    });

    if (existingItem) {

        existingItem.quantity =
            Number(existingItem.quantity || 0) + 1;

    } else {

        cart.push({

            id: product.id,
            name: product.name,
            price: Number(product.price),
            image: product.image_url || "",
            quantity: 1

        });

    }

    saveShopCart(cart);

    alert(`${product.name} added to your cart!`);

}


// ============================================
// HTML SECURITY
// ============================================

function shopEscapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => {

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


// ============================================
// LOAD PRODUCTS FROM BACKEND
// ============================================

async function loadShopProducts() {

    if (!shopGrid) return;

    shopGrid.innerHTML = `
        <p class="shop-loading">Loading OWO products...</p>
    `;

    try {

        const response = await fetch(`${SHOP_API}/products`);

        if (!response.ok) {

            throw new Error("Unable to load products.");

        }

        const data = await response.json();

        if (!Array.isArray(data)) {

            throw new Error("Invalid product data received.");

        }

        shopProducts = data.filter(product => {

            return product.is_active !== false;

        });

        populateShopCategories();

        applyShopURLFilters();

        filterAndDisplayProducts();

    } catch (error) {

        console.error("Shop loading error:", error);

        shopGrid.innerHTML = `
            <p class="shop-error">
                Unable to load products. Please check your backend server.
            </p>
        `;

        if (shopResultCount) {

            shopResultCount.textContent = "Products unavailable";

        }

    }

}


// ============================================
// CATEGORY FILTER OPTIONS
// ============================================

function populateShopCategories() {

    if (!shopCategory) return;

    const categories = [

        ...new Set(

            shopProducts
                .map(product => String(product.category || "").trim())
                .filter(Boolean)

        )

    ].sort();

    shopCategory.innerHTML = `
        <option value="all">All Categories</option>
    `;

    categories.forEach(category => {

        const option = document.createElement("option");

        option.value = category;

        option.textContent = category;

        shopCategory.appendChild(option);

    });

}


// ============================================
// READ CATEGORY FROM URL
// ============================================

function applyShopURLFilters() {

    const params = new URLSearchParams(window.location.search);

    const category = params.get("category");

    const search = params.get("search");

    const focus = params.get("focus");


    // CATEGORY FILTER

    if (category && shopCategory) {

        const normalizedCategory = category.trim().toLowerCase();

        let matchingCategory = [...shopCategory.options].find(option => {

            return option.value.trim().toLowerCase() === normalizedCategory;

        });


        // Add category option if it does not exist.
        // This prevents the filter from silently selecting All Categories.

        if (!matchingCategory) {

            matchingCategory = document.createElement("option");

            matchingCategory.value = category.trim();

            matchingCategory.textContent = category.trim();

            shopCategory.appendChild(matchingCategory);

        }

        shopCategory.value = matchingCategory.value;

    }


    // SEARCH FILTER

    if (search && shopSearch) {

        shopSearch.value = search;

    }


    // SEARCH FOCUS

    if (focus === "search" && shopSearch) {

        shopSearch.focus();

        window.setTimeout(() => {

            shopSearch.scrollIntoView({

                behavior: "smooth",

                block: "center"

            });

        }, 300);

    }

}


// ============================================
// FILTER AND SORT PRODUCTS
// ============================================

function filterAndDisplayProducts() {

    if (!shopSearch || !shopCategory || !shopSort) return;

    const searchText = shopSearch.value.trim().toLowerCase();

    const selectedCategory = shopCategory.value.trim().toLowerCase();

    const selectedSort = shopSort.value;


    // FILTER PRODUCTS

    filteredShopProducts = shopProducts.filter(product => {

        const matchesSearch = [

            product.name,
            product.description,
            product.category

        ].some(value => {

            return String(value || "")
                .toLowerCase()
                .includes(searchText);

        });


        const productCategory = String(product.category || "")
            .trim()
            .toLowerCase();


        const matchesCategory =

            selectedCategory === "all" ||

            productCategory === selectedCategory;


        return matchesSearch && matchesCategory;

    });


    // SORT PRODUCTS

    switch (selectedSort) {

        case "price-low":

            filteredShopProducts.sort((a, b) => {

                return Number(a.price) - Number(b.price);

            });

            break;


        case "price-high":

            filteredShopProducts.sort((a, b) => {

                return Number(b.price) - Number(a.price);

            });

            break;


        case "name-az":

            filteredShopProducts.sort((a, b) => {

                return String(a.name).localeCompare(String(b.name));

            });

            break;


        case "name-za":

            filteredShopProducts.sort((a, b) => {

                return String(b.name).localeCompare(String(a.name));

            });

            break;


        case "newest":

            filteredShopProducts.sort((a, b) => {

                return new Date(b.created_at || 0) -
                    new Date(a.created_at || 0);

            });

            break;

    }


    renderShopProducts();

    updateShopResults();

}


// ============================================
// DISPLAY PRODUCTS
// ============================================

function renderShopProducts() {

    if (!shopGrid || !shopEmptyState) return;

    shopGrid.innerHTML = "";

    if (filteredShopProducts.length === 0) {

        shopEmptyState.hidden = false;

        return;

    }

    shopEmptyState.hidden = true;


    filteredShopProducts.forEach(product => {

        const card = document.createElement("article");

        card.className = "product-card";

        card.dataset.id = product.id;


        const productName = shopEscapeHTML(product.name);

        const productCategory = shopEscapeHTML(
            product.category || "OWO"
        );

        const productImage = shopEscapeHTML(
            product.image_url || ""
        );

        const productPrice = Number(product.price || 0)
            .toLocaleString("en-IN");

        const stock = Number(product.stock_quantity || 0);


        card.innerHTML = `

            <div class="product-image">

                <img
                    src="${productImage}"
                    alt="${productName}"
                    loading="lazy"
                >

                <span class="product-badge">
                    OWO COLLECTION
                </span>

                <button
                    class="wishlist"
                    type="button"
                    aria-label="Add to wishlist"
                >
                    <i class="fa-regular fa-heart"></i>
                </button>

                <button
                    class="quick-add"
                    type="button"
                    data-add-to-cart="${product.id}"
                    ${stock <= 0 ? "disabled" : ""}
                >
                    ${stock <= 0
                        ? "OUT OF STOCK"
                        : 'ADD TO CART <i class="fa-solid fa-plus"></i>'}
                </button>

            </div>


            <div class="product-info">

                <div>

                    <h3>${productName}</h3>

                    <p>${productCategory}</p>

                </div>

                <strong>₹${productPrice}</strong>

            </div>

        `;


        const image = card.querySelector("img");

        image.addEventListener("error", () => {

            image.style.display = "none";

        });


        shopGrid.appendChild(card);

    });

}


// ============================================
// UPDATE RESULT INFORMATION
// ============================================

function updateShopResults() {

    if (!shopResultCount || !shopFilterMessage) return;

    const count = filteredShopProducts.length;

    shopResultCount.textContent =

        `${count} ${count === 1 ? "product" : "products"} found`;


    const category = shopCategory.value;

    const search = shopSearch.value.trim();


    if (search && category !== "all") {

        shopFilterMessage.textContent =

            `Search: "${search}" | Category: ${category}`;

    } else if (search) {

        shopFilterMessage.textContent =

            `Search results for "${search}"`;

    } else if (category !== "all") {

        shopFilterMessage.textContent =

            `Showing ${category} products`;

    } else {

        shopFilterMessage.textContent =

            "Showing all products";

    }

}


// ============================================
// SEARCH
// ============================================

if (shopSearch) {

    shopSearch.addEventListener("input", () => {

        filterAndDisplayProducts();

    });

}


// ============================================
// CATEGORY FILTER
// ============================================

if (shopCategory) {

    shopCategory.addEventListener("change", () => {

        filterAndDisplayProducts();

    });

}


// ============================================
// SORT PRODUCTS
// ============================================

if (shopSort) {

    shopSort.addEventListener("change", () => {

        filterAndDisplayProducts();

    });

}


// ============================================
// ADD TO CART AND PRODUCT NAVIGATION
// ============================================

if (shopGrid) {

    shopGrid.addEventListener("click", event => {

        const addButton = event.target.closest("[data-add-to-cart]");

        if (addButton) {

            event.stopPropagation();

            if (addButton.disabled) return;

            const productId = Number(addButton.dataset.addToCart);

            const product = shopProducts.find(item => {

                return Number(item.id) === productId;

            });

            if (product) {

                if (Number(product.stock_quantity) <= 0) {

                    alert("Sorry, this product is currently out of stock.");

                    return;

                }

                addShopToCart(product);

            }

            return;

        }


        const wishlistButton = event.target.closest(".wishlist");

        if (wishlistButton) {

            event.stopPropagation();

            const icon = wishlistButton.querySelector("i");

            if (!icon) return;

            icon.classList.toggle("fa-regular");

            icon.classList.toggle("fa-solid");

            wishlistButton.style.color =

                icon.classList.contains("fa-solid") ? "#b69a76" : "";

            return;

        }


        const productCard = event.target.closest(".product-card");

        if (productCard) {

            const productId = productCard.dataset.id;

            window.location.href =

                `product.html?id=${encodeURIComponent(productId)}`;

        }

    });

}


// ============================================
// CLEAR FILTERS
// ============================================

function resetShopFilters() {

    if (shopSearch) shopSearch.value = "";

    if (shopCategory) shopCategory.value = "all";

    if (shopSort) shopSort.value = "default";


    window.history.replaceState(

        {},

        "",

        window.location.pathname

    );


    filterAndDisplayProducts();

}


if (clearFiltersButton) {

    clearFiltersButton.addEventListener("click", resetShopFilters);

}

if (resetSearchButton) {

    resetSearchButton.addEventListener("click", resetShopFilters);

}


// ============================================
// MOBILE MENU
// ============================================

const shopMenuButton = document.querySelector(".menu-btn");

const shopNavigation = document.querySelector(".nav-links");

if (shopMenuButton && shopNavigation) {

    shopMenuButton.addEventListener("click", () => {

        shopNavigation.classList.toggle("active");

        const icon = shopMenuButton.querySelector("i");

        if (icon) {

            icon.classList.toggle("fa-bars");

            icon.classList.toggle("fa-xmark");

        }

    });

}


// ============================================
// INITIALIZE SHOP
// ============================================

updateShopCartCount();

loadShopProducts();

console.log("OWO Shop Page Initialized");
