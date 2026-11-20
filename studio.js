
/* =====================================
   OWO CUSTOM STUDIO
   Connected to PostgreSQL Backend
===================================== */

const API_URL = "http://localhost:3000";

const canvas = document.getElementById("garmentCanvas");
const ctx = canvas.getContext("2d");
// Force a clean white preview background
canvas.style.backgroundColor = "#ffffff";
canvas.style.backgroundImage = "none";

if (canvas.parentElement) {
    canvas.parentElement.style.backgroundColor = "#ffffff";
    canvas.parentElement.style.backgroundImage = "none";
}
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
   MEASUREMENT FIELD DEFINITIONS
===================================== */

const upperMeasurementFields = [
    {
        name: "Shoulder",
        key: "shoulder",
        input: "shoulderMeasurement",
        unit: "shoulderUnit"
    },
    {
        name: "Chest",
        key: "chest",
        input: "chestMeasurement",
        unit: "chestUnit"
    },
    {
        name: "Waist",
        key: "upperWaist",
        input: "upperWaistMeasurement",
        unit: "upperWaistUnit"
    },
    {
        name: "Sleeve Length",
        key: "sleeve",
        input: "sleeveMeasurement",
        unit: "sleeveUnit"
    }
];

const pantsMeasurementFields = [
    {
        name: "Waist",
        key: "pantsWaist",
        input: "pantsWaistMeasurement",
        unit: "pantsWaistUnit"
    },
    {
        name: "Hip",
        key: "hip",
        input: "hipMeasurement",
        unit: "hipUnit"
    },
    {
        name: "Bottom Leg Opening Width",
        key: "bottomLeg",
        input: "bottomLegMeasurement",
        unit: "bottomLegUnit"
    }
];

/* =====================================
   GET MEASUREMENTS
===================================== */

function getMeasurements() {
    const fields = state.garment === "pants"
        ? pantsMeasurementFields
        : upperMeasurementFields;

    const measurements = {};

    fields.forEach(field => {
        const input = document.getElementById(field.input);
        const unit = document.getElementById(field.unit);

        measurements[field.key] = {
            value: input.value.trim(),
            unit: unit.value
        };
    });

    return measurements;
}

/* =====================================
   VALIDATE MEASUREMENTS
===================================== */

function validateMeasurements() {
    const measurements = getMeasurements();

    const fields = state.garment === "pants"
        ? pantsMeasurementFields
        : upperMeasurementFields;

    for (const field of fields) {
        const measurement = measurements[field.key];
        const value = Number(measurement.value);

        if (
            measurement.value === "" ||
            !Number.isFinite(value) ||
            value <= 0
        ) {
            alert(`Please enter a valid ${field.name} measurement.`);
            return false;
        }

        if (!["cm", "inch"].includes(measurement.unit)) {
            alert(`Please select a valid unit for ${field.name}.`);
            return false;
        }
    }

    return true;
}

/* =====================================
   UPDATE MEASUREMENT SUMMARY
===================================== */

function updateMeasurementSummary() {
    const measurements = getMeasurements();

    const summary = Object.values(measurements).filter(item =>
        item.value !== ""
    ).length;

    const total = state.garment === "pants" ? 3 : 4;

    document.getElementById("summaryMeasurements").textContent =
        `${summary}/${total} entered`;
}

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

    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(image, x, y, width, height);

    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = state.colour;
    ctx.fillRect(x, y, width, height);

    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(image, x, y, width, height);

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

        const fitSection = document.getElementById("fitSection");
        const fitSummary = document.getElementById("summaryFitRow");

        fitSection.style.display = isPants ? "" : "none";
        fitSummary.style.display = isPants ? "" : "none";

        document.getElementById("upperMeasurements").style.display =
            isPants ? "none" : "block";

        document.getElementById("pantsMeasurements").style.display =
            isPants ? "block" : "none";

        document.getElementById("previewTitle").textContent =
            isPants
                ? "Custom Pants"
                : `Custom ${garmentNames[state.garment]}`;

        updateSummary();
        updateMeasurementSummary();
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

document.querySelectorAll(".colour-swatch").forEach(button => {
    button.addEventListener("click", () => {
        state.colour = button.dataset.colour;

        document.querySelectorAll(".colour-swatch").forEach(option => {
            option.classList.remove("active");
        });

        button.classList.add("active");

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
   MEASUREMENT INPUT EVENTS
===================================== */

[
    ...upperMeasurementFields,
    ...pantsMeasurementFields
].forEach(field => {
    const input = document.getElementById(field.input);
    const unit = document.getElementById(field.unit);

    if (input) {
        input.addEventListener("input", updateMeasurementSummary);
    }

    if (unit) {
        unit.addEventListener("change", updateMeasurementSummary);
    }
});

/* =====================================
   COMPRESS LOGO IMAGE
===================================== */

function compressLogo(image) {
    const maxDimension = 400;

    let width = image.naturalWidth;
    let height = image.naturalHeight;

    const scale = Math.min(
        1,
        maxDimension / Math.max(width, height)
    );

    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const logoCanvas = document.createElement("canvas");

    logoCanvas.width = width;
    logoCanvas.height = height;

    const logoContext = logoCanvas.getContext("2d");

    logoContext.drawImage(image, 0, 0, width, height);

    return logoCanvas.toDataURL("image/webp", 0.82);
}

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

            try {
                state.logoData = compressLogo(image);
            } catch (error) {
                state.logo = null;
                state.logoData = null;

                alert("Could not process this logo. Please try another image.");
                logoUpload.value = "";
                return;
            }

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

    reader.onerror = function () {
        alert("Could not read this image. Please try again.");
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

    state.dragOffsetX =
        pointer.x - canvas.width * state.logoX;

    state.dragOffsetY =
        pointer.y - canvas.height * state.logoY;

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
        Math.min(
            0.95,
            (pointer.x - state.dragOffsetX) / canvas.width
        )
    );

    state.logoY = Math.max(
        0.05,
        Math.min(
            0.95,
            (pointer.y - state.dragOffsetY) / canvas.height
        )
    );

    renderPreview();
});

function stopDragging() {
    state.dragging = false;
    canvas.style.cursor = state.logo ? "grab" : "default";
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

    document.getElementById("summarySize").textContent =
        state.size;

    document.getElementById("summaryLogo").textContent =
        state.logo ? "Uploaded" : "Not added";

    document.getElementById("summaryFit").textContent =
        state.fit === "straight"
            ? "Straight Fit"
            : "Bootcut Fit";
}

/* =====================================
   CREATE COMPRESSED PREVIEW
===================================== */


function createDesignPreview() {

    // Create a separate canvas for the preview
    const previewCanvas = document.createElement("canvas");

    previewCanvas.width = canvas.width;
    previewCanvas.height = canvas.height;

    const previewContext = previewCanvas.getContext("2d");

    // Add a clean white background
    previewContext.fillStyle = "#ffffff";
    previewContext.fillRect(
        0,
        0,
        previewCanvas.width,
        previewCanvas.height
    );

    // Draw the original custom design over the white background
    previewContext.drawImage(
        canvas,
        0,
        0,
        previewCanvas.width,
        previewCanvas.height
    );

    // Save the preview
    return previewCanvas.toDataURL("image/jpeg", 0.85);
}

/* =====================================
   SAVE DESIGN TO BACKEND
===================================== */

async function saveDesignToBackend(customization) {
    const token = localStorage.getItem("owoCustomerToken");

    if (!token) {
        alert("Please log in to your OWO account before saving a custom design.");
        return null;
    }

    const payload = {
        size: state.size,

        customization: customization
    };

    const requestBody = JSON.stringify(payload);

    // Backend accepts a maximum of 700,000 bytes.
    const requestSize = new Blob([requestBody]).size;

    if (requestSize > 680000) {
        alert(
            "Your design data is too large. Please remove the logo or upload a smaller image."
        );
        return null;
    }

    const response = await fetch(`${API_URL}/api/custom-designs`, {
        method: "POST",

        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },

        body: requestBody
    });

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (response.status === 401 || response.status === 403) {
        alert("Your login session has expired. Please log in again.");
        return null;
    }

    if (!response.ok) {
        throw new Error(
            result.message || "Could not save your custom design."
        );
    }

    return result;
}

/* =====================================
   ADD CUSTOM DESIGN TO CART
===================================== */

document.getElementById("addToCart").addEventListener("click", async () => {
    const cartButton = document.getElementById("addToCart");
    const cartMessage = document.getElementById("cartMessage");

    if (!state.garmentImage) {
        alert("The garment image has not loaded. Please check your image files.");
        return;
    }

    if (!validateMeasurements()) {
        return;
    }

    if (!localStorage.getItem("owoCustomerToken")) {
        alert("Please log in to your OWO account before saving a custom design.");
        return;
    }

    let cart = [];

    try {
        cart = JSON.parse(localStorage.getItem("owoCart")) || [];

        if (!Array.isArray(cart)) {
            cart = [];
        }
    } catch {
        cart = [];
    }

    const customization = {
        garment: state.garment,

        colour: colourNames[state.colour],
        colourCode: state.colour,

        fit: state.garment === "pants"
            ? state.fit
            : null,

        measurements: getMeasurements(),

        logo: state.logoData,

        logoPosition: {
            x: state.logoX,
            y: state.logoY
        },

        logoWidth: state.logoWidth,

        side: "front"
    };

    cartButton.disabled = true;
    cartButton.textContent = "SAVING DESIGN...";

    cartMessage.textContent = "Saving your design to OWO...";

    try {
        // First save the design in PostgreSQL.
        const result = await saveDesignToBackend(customization);

        if (!result || !result.design || !result.design.id) {
            cartButton.disabled = false;
            cartButton.textContent = "ADD TO CART";

            cartMessage.textContent = "";
            return;
        }

        const design = result.design;

        // Add the successfully saved design to the local cart.
        const customItem = {
            id: "custom-" + design.id,

            customDesignId: design.id,

            name: `Custom ${garmentNames[state.garment]}`,

            // Admin will confirm the price later.
            price: null,
            priceStatus: "pending",

            quantity: 1,
            size: state.size,

            image: createDesignPreview(),

            isCustom: true,

            stockVerified: false,
            stockStatus: "pending",

            customization: customization
        };

        cart.push(customItem);

        try {
            localStorage.setItem("owoCart", JSON.stringify(cart));
        } catch (error) {
            throw new Error(
                "Your design was saved on the server, but the browser could not save it to the cart. Please contact OWO support before submitting it again."
            );
        }

        cartMessage.textContent =
            "Design saved successfully! Waiting for OWO Admin to confirm price and stock.";

        cartButton.textContent = "DESIGN SAVED ✓";

    } catch (error) {
        console.error("Custom design error:", error);

        cartMessage.textContent = "";

        alert(error.message || "Something went wrong while saving your design.");

        cartButton.disabled = false;
        cartButton.textContent = "ADD TO CART";
    }
});

/* =====================================
   INITIALIZE STUDIO
===================================== */

updateSummary();
updateMeasurementSummary();
loadGarment();
