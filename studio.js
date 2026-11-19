
/* =====================================
   OWO CUSTOM STUDIO
===================================== */

const canvas = document.getElementById("garmentCanvas");
const ctx = canvas.getContext("2d");

const previewMessage = document.getElementById("previewMessage");
const logoUpload = document.getElementById("logoUpload");
const logoSizeInput = document.getElementById("logoSize");
const logoTools = document.getElementById("logoTools");

const garmentNames = {
    tshirt: "T-Shirt",
    shirt: "Shirt",
    hoodie: "Hoodie",
    henley: "Henley",
    pants: "Pants"
};

const colourNames = {
    "#F5F3EE": "White",
    "#171717": "Black",
    "#172B4D": "Navy Blue",
    "#641F32": "Maroon",
    "#244936": "Forest Green",
    "#76533F": "Mocha",
    "#C8B99F": "Beige",
    "#454545": "Charcoal",
    "#66839B": "Slate Blue"
};

const state = {
    garment: "tshirt",
    fit: "straight",
    colour: "#F5F3EE",
    size: "M",
    logo: null,
    logoData: null,
    logoX: 0.5,
    logoY: 0.42,
    logoWidth: 0.20,
    garmentImage: null,
    garmentRect: null,
    dragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0
};

/* =====================================
   LOAD GARMENT IMAGE
===================================== */

function getGarmentImagePath() {
    if (state.garment === "pants") {
        return `assets/studio/pants-${state.fit}-front.png`;
    }

    return `assets/studio/${state.garment}-front.png`;
}

function loadGarment() {
    const image = new Image();

    previewMessage.textContent = "Loading garment image...";
    previewMessage.hidden = false;

    image.onload = function () {
        state.garmentImage = image;
        previewMessage.hidden = true;
        renderPreview();
    };

    image.onerror = function () {
        state.garmentImage = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        previewMessage.textContent =
            `Image not found. Please check: ${getGarmentImagePath()}`;

        previewMessage.hidden = false;
    };

    image.src = getGarmentImagePath();
}

/* =====================================
   DRAW GARMENT AND LOGO
===================================== */

function renderPreview() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!state.garmentImage) {
        return;
    }

    const image = state.garmentImage;

    const maxWidth = 740;
    const maxHeight = 840;

    const scale = Math.min(
        maxWidth / image.naturalWidth,
        maxHeight / image.naturalHeight
    );

    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;

    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;

    state.garmentRect = { x, y, width, height };

    // Draw original white garment.
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(image, x, y, width, height);

    // Recolour the garment while retaining its fabric shading.
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = state.colour;
    ctx.fillRect(x, y, width, height);

    // Keep the recolouring inside the transparent garment shape.
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(image, x, y, width, height);

    // Draw the uploaded logo separately, so its colours stay unchanged.
    ctx.globalCompositeOperation = "source-over";

    if (state.logo) {
        drawLogo();
    }
}

/* =====================================
   DRAW UPLOADED LOGO
===================================== */

function getLogoBounds() {
    if (!state.logo) return null;

    const width = canvas.width * state.logoWidth;
    const height = width * (
        state.logo.naturalHeight / state.logo.naturalWidth
    );

    const centerX = canvas.width * state.logoX;
    const centerY = canvas.height * state.logoY;

    return {
        x: centerX - width / 2,
        y: centerY - height / 2,
        width,
        height
    };
}

function drawLogo() {
    const bounds = getLogoBounds();

    if (!bounds) return;

    ctx.drawImage(
        state.logo,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height
    );
}

/* =====================================
   GARMENT SELECTION
===================================== */

document.querySelectorAll(".garment-option").forEach(button => {
    button.addEventListener("click", () => {
        state.garment = button.dataset.garment;

        document.querySelectorAll(".garment-option").forEach(option => {
            option.classList.remove("active");
        });

        button.classList.add("active");

        const isPants = state.garment === "pants";

        document.getElementById("fitSection").hidden = !isPants;
        document.getElementById("summaryFitRow").hidden = !isPants;

        document.getElementById("previewTitle").textContent =
            state.garment === "tshirt"
                ? "Classic T-Shirt"
                : state.garment === "pants"
                    ? "Custom Pants"
                    : `Custom ${garmentNames[state.garment]}`;

        updateSummary();
        loadGarment();
    });
});

/* =====================================
   PANTS FIT
===================================== */

document.querySelectorAll(".fit-option").forEach(button => {
    button.addEventListener("click", () => {
        state.fit = button.dataset.fit;

        document.querySelectorAll(".fit-option").forEach(option => {
            option.classList.remove("active");
        });

        button.classList.add("active");

        updateSummary();
        loadGarment();
    });
});

/* =====================================
   COLOUR SELECTION
===================================== */

document.querySelectorAll(".colour-option").forEach(button => {
    button.addEventListener("click", () => {
        state.colour = button.dataset.colour;

        document.querySelectorAll(".colour-option").forEach(option => {
            option.classList.remove("active");
        });

        button.classList.add("active");

        document.getElementById("selectedColour").textContent =
            colourNames[state.colour];

        updateSummary();
        renderPreview();
    });
});

/* =====================================
   SIZE SELECTION
===================================== */

document.querySelectorAll(".size-option").forEach(button => {
    button.addEventListener("click", () => {
        state.size = button.dataset.size;

        document.querySelectorAll(".size-option").forEach(option => {
            option.classList.remove("active");
        });

        button.classList.add("active");

        updateSummary();
    });
});

/* =====================================
   UPLOAD LOGO
===================================== */

logoUpload.addEventListener("change", event => {
    const file = event.target.files[0];

    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        alert("Please upload an image smaller than 5 MB.");
        logoUpload.value = "";
        return;
    }

    if (!file.type.startsWith("image/")) {
        alert("Please select a valid image.");
        logoUpload.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
        const image = new Image();

        image.onload = function () {
            state.logo = image;
            state.logoData = e.target.result;

            state.logoX = 0.5;
            state.logoY = 0.42;
            state.logoWidth = Number(logoSizeInput.value) / 100;

            logoTools.hidden = false;

            updateSummary();
            renderPreview();
        };

        image.onerror = function () {
            alert("This image could not be opened. Try another image.");
        };

        image.src = e.target.result;
    };

    reader.readAsDataURL(file);
});

/* =====================================
   RESIZE LOGO
===================================== */

logoSizeInput.addEventListener("input", () => {
    state.logoWidth = Number(logoSizeInput.value) / 100;
    renderPreview();
});

/* =====================================
   CENTER LOGO
===================================== */

document.getElementById("centerLogo").addEventListener("click", () => {
    if (!state.logo) return;

    state.logoX = 0.5;
    state.logoY = 0.42;

    renderPreview();
});

/* =====================================
   REMOVE LOGO
===================================== */

document.getElementById("removeLogo").addEventListener("click", () => {
    state.logo = null;
    state.logoData = null;

    logoUpload.value = "";
    logoTools.hidden = true;

    updateSummary();
    renderPreview();
});

/* =====================================
   DRAG LOGO WITH MOUSE OR TOUCH
===================================== */

function getCanvasPosition(event) {
    const rect = canvas.getBoundingClientRect();

    return {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
}

canvas.addEventListener("pointerdown", event => {
    if (!state.logo) return;

    const pointer = getCanvasPosition(event);
    const bounds = getLogoBounds();

    const insideLogo =
        pointer.x >= bounds.x &&
        pointer.x <= bounds.x + bounds.width &&
        pointer.y >= bounds.y &&
        pointer.y <= bounds.y + bounds.height;

    if (!insideLogo) return;

    state.dragging = true;

    state.dragOffsetX = pointer.x - (canvas.width * state.logoX);
    state.dragOffsetY = pointer.y - (canvas.height * state.logoY);

    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
});

canvas.addEventListener("pointermove", event => {
    if (!state.dragging) {
        if (!state.logo) {
            canvas.style.cursor = "default";
            return;
        }

        const pointer = getCanvasPosition(event);
        const bounds = getLogoBounds();

        const overLogo =
            pointer.x >= bounds.x &&
            pointer.x <= bounds.x + bounds.width &&
            pointer.y >= bounds.y &&
            pointer.y <= bounds.y + bounds.height;

        canvas.style.cursor = overLogo ? "grab" : "default";
        return;
    }

    const pointer = getCanvasPosition(event);

    state.logoX = Math.max(
        0.05,
        Math.min(0.95, (pointer.x - state.dragOffsetX) / canvas.width)
    );

    state.logoY = Math.max(
        0.05,
        Math.min(0.95, (pointer.y - state.dragOffsetY) / canvas.height)
    );

    renderPreview();
});

function stopDragging() {
    state.dragging = false;
    canvas.style.cursor = "grab";
}

canvas.addEventListener("pointerup", stopDragging);
canvas.addEventListener("pointercancel", stopDragging);
canvas.addEventListener("lostpointercapture", stopDragging);

/* =====================================
   UPDATE SUMMARY
===================================== */

function updateSummary() {
    document.getElementById("summaryGarment").textContent =
        garmentNames[state.garment];

    document.getElementById("summaryColour").textContent =
        colourNames[state.colour];

    document.getElementById("summarySize").textContent = state.size;

    document.getElementById("summaryLogo").textContent =
        state.logo ? "Uploaded" : "Not added";

    document.getElementById("summaryFit").textContent =
        state.fit === "straight" ? "Straight Fit" : "Bootcut Fit";
}

/* =====================================
   ADD CUSTOM ITEM TO CART
===================================== */

document.getElementById("addToCart").addEventListener("click", () => {
    if (!state.garmentImage) {
        alert("The garment image has not loaded. Please check your image files.");
        return;
    }

    const cartButton = document.getElementById("addToCart");
    const cartMessage = document.getElementById("cartMessage");

    let cart = [];

    try {
        cart = JSON.parse(localStorage.getItem("owoCart")) || [];

        if (!Array.isArray(cart)) {
            cart = [];
        }
    } catch {
        cart = [];
    }

    const itemName =
        `Custom ${garmentNames[state.garment]}`;

    const customItem = {
        id: "custom-" + Date.now(),
        name: itemName,
        price: 0,
        quantity: 1,
        size: state.size,
        image: canvas.toDataURL("image/png"),
        isCustom: true,

        customization: {
            garment: state.garment,
            colour: colourNames[state.colour],
            colourCode: state.colour,
            fit: state.garment === "pants" ? state.fit : null,
            logo: state.logoData,
            logoPosition: {
                x: state.logoX,
                y: state.logoY
            },
            logoWidth: state.logoWidth,
            side: "front"
        }
    };

    cart.push(customItem);

    try {
        localStorage.setItem("owoCart", JSON.stringify(cart));
    } catch (error) {
        alert("Could not save this design. The image may be too large. Try a smaller logo.");
        return;
    }

    cartMessage.textContent =
        "Your customized item has been added to the cart.";

    cartButton.textContent = "ADDED TO CART ✓";
});

/* =====================================
   INITIALIZE STUDIO
===================================== */

updateSummary();
loadGarment();
