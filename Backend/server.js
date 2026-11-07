
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const pool = require("./db");

require("dotenv").config();

const { router: authRoutes, requireAdmin } = require("./auth");

const app = express();
const PORT = process.env.PORT || 3000;


// ===================================
// MIDDLEWARE
// ===================================

app.use(cors({
    origin: [
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "1mb" }));


// ===================================
// AUTHENTICATION
// ===================================

// Login is public.
app.use("/api/admin", authRoutes);

// All remaining admin routes are protected.
app.use("/api/admin", requireAdmin);


// ===================================
// CONSTANTS
// ===================================

const ALLOWED_SIZES = ["S", "M", "L", "XL", "XXL"];

const CLOTHING_CATEGORIES = [
    "Men",
    "Women",
    "Streetwear",
    "Custom Clothing"
];

const ALLOWED_ORDER_STATUSES = [
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


// ===================================
// PRODUCT VALIDATION
// ===================================

function validateProduct(data) {

    const {
        name,
        description,
        price,
        category,
        image_url,
        stock_quantity,
        sizes
    } = data;

    if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 150
    ) {
        return "Please enter a valid product name.";
    }

    if (
        typeof category !== "string" ||
        !category.trim() ||
        category.trim().length > 100
    ) {
        return "Please enter a valid product category.";
    }

    if (
        description != null &&
        typeof description !== "string"
    ) {
        return "Invalid product description.";
    }

    const productPrice = Number(price);

    if (
        price === "" ||
        price === null ||
        price === undefined ||
        !Number.isFinite(productPrice) ||
        productPrice <= 0 ||
        productPrice > 99999999.99
    ) {
        return "Please enter a valid product price.";
    }

    const stock = Number(stock_quantity);

    if (
        stock_quantity === "" ||
        stock_quantity === null ||
        stock_quantity === undefined ||
        !Number.isSafeInteger(stock) ||
        stock < 0
    ) {
        return "Please enter a valid stock quantity.";
    }

    const productSizes = sizes ?? [];

    if (
        !Array.isArray(productSizes) ||
        productSizes.some(size =>
            typeof size !== "string" ||
            !ALLOWED_SIZES.includes(size)
        ) ||
        new Set(productSizes).size !== productSizes.length
    ) {
        return "Please select valid product sizes.";
    }

    if (
        CLOTHING_CATEGORIES.includes(category.trim()) &&
        productSizes.length === 0
    ) {
        return "Please select at least one clothing size.";
    }

    if (
        image_url != null &&
        typeof image_url !== "string"
    ) {
        return "Invalid image URL.";
    }

    if (image_url && image_url.trim()) {
        try {
            const parsedURL = new URL(image_url.trim());

            if (!["http:", "https:"].includes(parsedURL.protocol)) {
                return "Please enter a valid image URL.";
            }
        } catch {
            return "Please enter a valid image URL.";
        }
    }

    return null;
}


// ===================================
// DELIVERY DATABASE SETUP
// ===================================

async function initializeDeliveryDatabase() {

    // Add delivery information to existing orders table.
    await pool.query(`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS courier_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(150),
        ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE,
        ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS current_location VARCHAR(255),
        ADD COLUMN IF NOT EXISTS delivery_instructions TEXT
    `);


    // Create order tracking history table.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS order_tracking_events (

            id BIGSERIAL PRIMARY KEY,

            order_id BIGINT NOT NULL
                REFERENCES orders(id) ON DELETE CASCADE,

            status VARCHAR(100) NOT NULL,

            description TEXT,

            location VARCHAR(255),

            event_time TIMESTAMPTZ NOT NULL DEFAULT NOW()

        )
    `);


    // Index for faster tracking history lookup.
    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_order_tracking_events_order_id
        ON order_tracking_events(order_id)
    `);


    console.log("OWO delivery tracking database initialized.");
}


// ===================================
// TRACKING EVENT HELPER
// ===================================

async function addTrackingEvent(
    client,
    orderId,
    status,
    description,
    location = null
) {

    await client.query(
        `INSERT INTO order_tracking_events (
            order_id,
            status,
            description,
            location
        )
        VALUES ($1, $2, $3, $4)`,
        [
            orderId,
            status,
            description,
            location
        ]
    );

}


// ===================================
// HOMEPAGE
// ===================================

app.get("/", (req, res) => {

    res.send("OWO Backend is running!");

});


// ===================================
// DATABASE HEALTH CHECK
// ===================================

app.get("/api/health", async (req, res) => {

    try {

        const dbInfo = await pool.query(
            "SELECT current_database()"
        );

        const orderCount = await pool.query(
            "SELECT COUNT(*) FROM orders"
        );

        const result = await pool.query("SELECT NOW()");

        console.log(
            "Backend database:",
            dbInfo.rows[0].current_database
        );

        console.log(
            "Backend order count:",
            orderCount.rows[0].count
        );

        res.json({

            message: "OWO Backend is running!",

            database: "PostgreSQL connected successfully!",

            time: result.rows[0].now

        });

    } catch (error) {

        console.error("Health check error:", error.message);

        res.status(500).json({
            message: "Database connection failed"
        });

    }

});


// ===================================
// GET ALL ACTIVE PRODUCTS
// ===================================

app.get("/api/products", async (req, res) => {

    try {

        const result = await pool.query(
            `SELECT *
             FROM products
             WHERE is_active = TRUE
             ORDER BY id DESC`
        );

        res.json(result.rows);

    } catch (error) {

        console.error("Fetch products error:", error.message);

        res.status(500).json({
            message: "Unable to fetch products."
        });

    }

});


// ===================================
// ADD PRODUCT (ADMIN)
// ===================================

app.post("/api/admin/products", async (req, res) => {

    try {

        const validationError = validateProduct(req.body);

        if (validationError) {
            return res.status(400).json({
                message: validationError
            });
        }

        const {
            name,
            description,
            price,
            category,
            image_url,
            stock_quantity,
            sizes
        } = req.body;

        const result = await pool.query(
            `INSERT INTO products (
                name,
                description,
                price,
                category,
                image_url,
                stock_quantity,
                sizes,
                is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
            RETURNING *`,
            [
                name.trim(),
                description ? description.trim() : null,
                Number(price),
                category.trim(),
                image_url ? image_url.trim() || null : null,
                Number(stock_quantity),
                sizes ?? []
            ]
        );

        res.status(201).json({

            message: "Product added successfully!",

            product: result.rows[0]

        });

    } catch (error) {

        console.error("Add product error:", error.message);

        res.status(500).json({
            message: "Unable to add product."
        });

    }

});


// ===================================
// UPDATE PRODUCT (ADMIN)
// ===================================

app.patch("/api/admin/products/:id", async (req, res) => {

    try {

        const { id } = req.params;

        if (
            !/^[1-9]\d*$/.test(id) ||
            !Number.isSafeInteger(Number(id))
        ) {
            return res.status(400).json({
                message: "Invalid product ID."
            });
        }

        const validationError = validateProduct(req.body);

        if (validationError) {
            return res.status(400).json({
                message: validationError
            });
        }

        const {
            name,
            description,
            price,
            category,
            image_url,
            stock_quantity,
            sizes
        } = req.body;

        const result = await pool.query(
            `UPDATE products
             SET
                name = $1,
                description = $2,
                price = $3,
                category = $4,
                image_url = $5,
                stock_quantity = $6,
                sizes = $7
             WHERE id = $8
             RETURNING *`,
            [
                name.trim(),
                description ? description.trim() : null,
                Number(price),
                category.trim(),
                image_url ? image_url.trim() || null : null,
                Number(stock_quantity),
                sizes ?? [],
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Product not found."
            });
        }

        res.json({

            message: "Product updated successfully!",

            product: result.rows[0]

        });

    } catch (error) {

        console.error("Update product error:", error.message);

        res.status(500).json({
            message: "Unable to update product."
        });

    }

});


// ===================================
// UPDATE PRODUCT STOCK (ADMIN)
// ===================================

app.patch("/api/admin/products/:id/stock", async (req, res) => {

    try {

        const { id } = req.params;

        const { stock_quantity } = req.body;

        if (
            !/^[1-9]\d*$/.test(id) ||
            !Number.isSafeInteger(Number(id))
        ) {
            return res.status(400).json({
                message: "Invalid product ID."
            });
        }

        const stock = Number(stock_quantity);

        if (
            stock_quantity === "" ||
            stock_quantity === null ||
            stock_quantity === undefined ||
            !Number.isSafeInteger(stock) ||
            stock < 0
        ) {
            return res.status(400).json({
                message: "Stock quantity must be a valid whole number greater than or equal to zero."
            });
        }

        const result = await pool.query(
            `UPDATE products
             SET stock_quantity = $1
             WHERE id = $2 AND is_active = TRUE
             RETURNING id, name, stock_quantity`,
            [stock, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Product not found or already archived."
            });
        }

        res.json({

            message: "Product stock updated successfully!",

            product: result.rows[0]

        });

    } catch (error) {

        console.error("Update product stock error:", error.message);

        res.status(500).json({
            message: "Unable to update product stock."
        });

    }

});


// ===================================
// ARCHIVE PRODUCT (ADMIN)
// ===================================

app.delete("/api/admin/products/:id", async (req, res) => {

    try {

        const { id } = req.params;

        if (
            !/^[1-9]\d*$/.test(id) ||
            !Number.isSafeInteger(Number(id))
        ) {
            return res.status(400).json({
                message: "Invalid product ID."
            });
        }

        const result = await pool.query(
            `UPDATE products
             SET is_active = FALSE
             WHERE id = $1 AND is_active = TRUE
             RETURNING id, name, is_active`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Product not found or already archived."
            });
        }

        res.json({

            message: "Product removed from the store successfully!",

            product: result.rows[0]

        });

    } catch (error) {

        console.error("Archive product error:", error.message);

        res.status(500).json({
            message: "Unable to remove product."
        });

    }

});


// ===================================
// CREATE CUSTOMER ORDER
// ===================================

app.post("/api/orders", async (req, res) => {

    const {
        customer,
        products,
        payment
    } = req.body;

    const requiredFields = [
        "name",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "pincode"
    ];

    if (
        !customer ||
        requiredFields.some(field =>
            typeof customer[field] !== "string" ||
            !customer[field].trim()
        )
    ) {
        return res.status(400).json({
            message: "Please provide all customer details."
        });
    }

    if (
        !/^[0-9]{10}$/.test(customer.phone) ||
        !/^[0-9]{6}$/.test(customer.pincode)
    ) {
        return res.status(400).json({
            message: "Invalid phone number or PIN code."
        });
    }

    if (!["cod", "online"].includes(payment)) {
        return res.status(400).json({
            message: "Invalid payment method."
        });
    }

    if (
        !Array.isArray(products) ||
        products.length === 0 ||
        products.length > 50
    ) {
        return res.status(400).json({
            message: "Your shopping bag is empty or invalid."
        });
    }

    for (const item of products) {

        if (
            !Number.isSafeInteger(Number(item.id)) ||
            Number(item.id) <= 0 ||
            !Number.isInteger(Number(item.quantity)) ||
            Number(item.quantity) < 1 ||
            Number(item.quantity) > 100
        ) {
            return res.status(400).json({
                message: "Invalid product or quantity."
            });
        }

        if (
            item.size != null &&
            (
                typeof item.size !== "string" ||
                !ALLOWED_SIZES.includes(item.size)
            )
        ) {
            return res.status(400).json({
                message: "Invalid product size."
            });
        }

    }

    let client;

    try {

        client = await pool.connect();

        await client.query("BEGIN");

        const productIds = [
            ...new Set(products.map(item => Number(item.id)))
        ];

        const productResult = await client.query(
            `SELECT
                id,
                name,
                price,
                stock_quantity,
                is_active,
                sizes
             FROM products
             WHERE id = ANY($1::bigint[])
             FOR UPDATE`,
            [productIds]
        );

        const productMap = new Map(
            productResult.rows.map(product => [
                String(product.id),
                product
            ])
        );

        let total = 0;

        const orderItems = [];

        const stockRequirements = new Map();

        for (const item of products) {

            const product = productMap.get(String(item.id));

            if (!product || !product.is_active) {
                throw new Error(
                    "A selected product is unavailable."
                );
            }

            const quantity = Number(item.quantity);

            const price = Number(product.price);

            const availableSizes = product.sizes || [];

            if (availableSizes.length > 0) {

                if (
                    !item.size ||
                    !availableSizes.includes(item.size)
                ) {
                    throw new Error(
                        `Please select a valid size for ${product.name}.`
                    );
                }

            }

            const requiredStock =
                (stockRequirements.get(String(item.id)) || 0) +
                quantity;

            stockRequirements.set(
                String(item.id),
                requiredStock
            );

            orderItems.push({

                id: product.id,
                name: product.name,
                size: item.size || null,
                quantity,
                price

            });

            total += price * quantity;

        }

        for (const [id, required] of stockRequirements) {

            const product = productMap.get(id);

            if (Number(product.stock_quantity) < required) {
                throw new Error(
                    `${product.name} does not have enough stock.`
                );
            }

        }

        const orderNumber =
            "OWO-" +
            Date.now().toString() +
            crypto.randomBytes(3).toString("hex").toUpperCase();

        const orderStatus =
            payment === "cod" ? "Pending" : "Payment Pending";

        const orderResult = await client.query(
            `INSERT INTO orders (
                order_number,
                customer_name,
                email,
                phone,
                address,
                city,
                state,
                pincode,
                payment_method,
                total_amount,
                order_status
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            RETURNING id, order_number, total_amount, order_status, created_at`,
            [
                orderNumber,
                customer.name.trim(),
                customer.email.trim(),
                customer.phone.trim(),
                customer.address.trim(),
                customer.city.trim(),
                customer.state.trim(),
                customer.pincode.trim(),
                payment,
                total,
                orderStatus
            ]
        );

        const savedOrder = orderResult.rows[0];

        for (const item of orderItems) {

            await client.query(
                `INSERT INTO order_items (
                    order_id,
                    product_id,
                    product_name,
                    product_size,
                    quantity,
                    unit_price
                )
                VALUES ($1,$2,$3,$4,$5,$6)`,
                [
                    savedOrder.id,
                    item.id,
                    item.name,
                    item.size,
                    item.quantity,
                    item.price
                ]
            );

        }

        if (payment === "cod") {

            for (const [id, required] of stockRequirements) {

                await client.query(
                    `UPDATE products
                     SET stock_quantity = stock_quantity - $1
                     WHERE id = $2`,
                    [required, id]
                );

            }

        }

        // Add first tracking event.
        await addTrackingEvent(
            client,
            savedOrder.id,
            orderStatus,
            "Your OWO order has been successfully placed."
        );

        await client.query("COMMIT");

        res.status(201).json({

            message: "OWO order created successfully!",

            order: {

                orderNumber: savedOrder.order_number,

                total: Number(savedOrder.total_amount),

                status: savedOrder.order_status,

                paymentMethod: payment,

                createdAt: savedOrder.created_at

            }

        });

    } catch (error) {

        if (client) {

            try {

                await client.query("ROLLBACK");

            } catch (rollbackError) {

                console.error(
                    "Rollback error:",
                    rollbackError.message
                );

            }

        }

        console.error("Order creation error:", error.message);

        res.status(400).json({
            message: error.message || "Unable to create order."
        });

    } finally {

        if (client) {
            client.release();
        }

    }

});


// ===================================
// CUSTOMER ORDER TRACKING
// ===================================

// Customers verify using their order number
// and registered email address OR phone number.

app.post("/api/orders/track", async (req, res) => {

    try {

        const { order_number, contact } = req.body;

        if (
            typeof order_number !== "string" ||
            !order_number.trim() ||
            typeof contact !== "string" ||
            !contact.trim()
        ) {
            return res.status(400).json({
                message: "Please enter your order number and registered email or phone number."
            });
        }

        const cleanOrderNumber = order_number.trim();

        const cleanContact = contact.trim();

        if (
            cleanOrderNumber.length > 100 ||
            cleanContact.length > 255
        ) {
            return res.status(400).json({
                message: "Invalid tracking details."
            });
        }

        // Verify both order number and customer contact.
        const orderResult = await pool.query(
            `SELECT
                id,
                order_number,
                customer_name,
                address,
                city,
                state,
                pincode,
                payment_method,
                total_amount,
                order_status,
                created_at,
                courier_name,
                tracking_number,
                estimated_delivery_date,
                shipped_at,
                delivered_at,
                current_location,
                delivery_instructions
             FROM orders
             WHERE order_number = $1
             AND (
                LOWER(email) = LOWER($2)
                OR phone = $2
             )
             LIMIT 1`,
            [
                cleanOrderNumber,
                cleanContact
            ]
        );

        // Generic error prevents revealing whether
        // an order number or customer contact exists.
        if (orderResult.rows.length === 0) {

            return res.status(404).json({
                message: "We couldn't find an order with those details. Please check and try again."
            });

        }

        const order = orderResult.rows[0];

        // Fetch purchased products.
        const itemsResult = await pool.query(
            `SELECT
                product_name,
                product_size,
                quantity,
                unit_price
             FROM order_items
             WHERE order_id = $1
             ORDER BY id ASC`,
            [order.id]
        );

        // Fetch complete tracking history.
        const eventsResult = await pool.query(
            `SELECT
                status,
                description,
                location,
                event_time
             FROM order_tracking_events
             WHERE order_id = $1
             ORDER BY event_time ASC, id ASC`,
            [order.id]
        );

        res.json({

            message: "Order found successfully!",

            order: {

                order_number: order.order_number,

                customer_name: order.customer_name,

                address: order.address,

                city: order.city,

                state: order.state,

                pincode: order.pincode,

                payment_method: order.payment_method,

                total_amount: Number(order.total_amount),

                order_status: order.order_status,

                created_at: order.created_at,

                courier_name: order.courier_name,

                tracking_number: order.tracking_number,

                estimated_delivery_date:
                    order.estimated_delivery_date,

                shipped_at: order.shipped_at,

                delivered_at: order.delivered_at,

                current_location: order.current_location,

                delivery_instructions:
                    order.delivery_instructions,

                items: itemsResult.rows.map(item => ({

                    product_name: item.product_name,

                    size: item.product_size,

                    quantity: Number(item.quantity),

                    price: Number(item.unit_price)

                })),

                tracking_history: eventsResult.rows

            }

        });

    } catch (error) {

        console.error("Order tracking error:", error.message);

        res.status(500).json({
            message: "Unable to track your order right now."
        });

    }

});


// ===================================
// GET ALL CUSTOMER ORDERS (ADMIN)
// ===================================

app.get("/api/admin/orders", async (req, res) => {

    try {

        const ordersResult = await pool.query(
            `SELECT
                id,
                order_number,
                customer_name,
                email,
                phone,
                address,
                city,
                state,
                pincode,
                payment_method,
                total_amount,
                order_status,
                created_at,
                courier_name,
                tracking_number,
                estimated_delivery_date,
                shipped_at,
                delivered_at,
                current_location,
                delivery_instructions
             FROM orders
             ORDER BY created_at DESC`
        );

        const orders = ordersResult.rows;

        if (orders.length === 0) {
            return res.json([]);
        }

        const orderIds = orders.map(order => order.id);

        const itemsResult = await pool.query(
            `SELECT
                order_id,
                product_name,
                product_size,
                quantity,
                unit_price
             FROM order_items
             WHERE order_id = ANY($1::bigint[])
             ORDER BY id ASC`,
            [orderIds]
        );

        const eventsResult = await pool.query(
            `SELECT
                order_id,
                status,
                description,
                location,
                event_time
             FROM order_tracking_events
             WHERE order_id = ANY($1::bigint[])
             ORDER BY event_time ASC, id ASC`,
            [orderIds]
        );

        const itemsByOrder = new Map();

        for (const item of itemsResult.rows) {

            const orderId = String(item.order_id);

            if (!itemsByOrder.has(orderId)) {
                itemsByOrder.set(orderId, []);
            }

            itemsByOrder.get(orderId).push({

                product_name: item.product_name,

                size: item.product_size,

                quantity: Number(item.quantity),

                price: Number(item.unit_price)

            });

        }

        const eventsByOrder = new Map();

        for (const event of eventsResult.rows) {

            const orderId = String(event.order_id);

            if (!eventsByOrder.has(orderId)) {
                eventsByOrder.set(orderId, []);
            }

            eventsByOrder.get(orderId).push({

                status: event.status,

                description: event.description,

                location: event.location,

                event_time: event.event_time

            });

        }

        const completeOrders = orders.map(order => ({

            ...order,

            total_amount: Number(order.total_amount),

            items: itemsByOrder.get(String(order.id)) || [],

            tracking_history:
                eventsByOrder.get(String(order.id)) || []

        }));

        console.log(
            `Admin orders fetched: ${completeOrders.length}`
        );

        res.json(completeOrders);

    } catch (error) {

        console.error("Admin orders error:", error.message);

        res.status(500).json({
            message: "Unable to fetch customer orders."
        });

    }

});


// ===================================
// UPDATE ORDER DELIVERY DETAILS (ADMIN)
// ===================================

// Admin can update courier, tracking number,
// estimated delivery date and current location.

app.patch("/api/admin/orders/:id/delivery", async (req, res) => {

    let client;

    try {

        const { id } = req.params;

        if (
            !/^[1-9]\d*$/.test(id) ||
            !Number.isSafeInteger(Number(id))
        ) {
            return res.status(400).json({
                message: "Invalid order ID."
            });
        }

        const allowedFields = [

            "courier_name",
            "tracking_number",
            "estimated_delivery_date",
            "current_location",
            "delivery_instructions"

        ];

        const updates = [];

        const values = [];

        for (const field of allowedFields) {

            if (!Object.prototype.hasOwnProperty.call(req.body, field)) {
                continue;
            }

            const value = req.body[field];

            if (value !== null && typeof value !== "string") {
                return res.status(400).json({
                    message: `Invalid ${field}.`
                });
            }

            if (typeof value === "string" && value.length > 1000) {
                return res.status(400).json({
                    message: `${field} is too long.`
                });
            }

            if (
                field === "estimated_delivery_date" &&
                value !== null &&
                value !== ""
            ) {

                if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    return res.status(400).json({
                        message: "Estimated delivery date must use YYYY-MM-DD format."
                    });
                }

                const parsedDate = new Date(`${value}T00:00:00Z`);

                if (
                    Number.isNaN(parsedDate.getTime()) ||
                    parsedDate.toISOString().slice(0, 10) !== value
                ) {
                    return res.status(400).json({
                        message: "Please enter a valid delivery date."
                    });
                }

            }

            values.push(value === "" ? null : value);

            updates.push(`${field} = $${values.length}`);

        }

        const eventDescription = req.body.event_description;

        const eventLocation = req.body.event_location;

        if (
            eventDescription != null &&
            (
                typeof eventDescription !== "string" ||
                eventDescription.length > 1000
            )
        ) {
            return res.status(400).json({
                message: "Invalid tracking event description."
            });
        }

        if (
            eventLocation != null &&
            (
                typeof eventLocation !== "string" ||
                eventLocation.length > 255
            )
        ) {
            return res.status(400).json({
                message: "Invalid tracking event location."
            });
        }

        if (
            updates.length === 0 &&
            !eventDescription &&
            !eventLocation
        ) {
            return res.status(400).json({
                message: "Please provide at least one delivery detail to update."
            });
        }

        client = await pool.connect();

        await client.query("BEGIN");

        let updatedOrder;

        if (updates.length > 0) {

            values.push(id);

            const result = await client.query(
                `UPDATE orders
                 SET ${updates.join(", ")}
                 WHERE id = $${values.length}
                 RETURNING
                    id,
                    order_number,
                    courier_name,
                    tracking_number,
                    estimated_delivery_date,
                    current_location,
                    delivery_instructions`,
                values
            );

            if (result.rows.length === 0) {

                await client.query("ROLLBACK");

                return res.status(404).json({
                    message: "Order not found."
                });

            }

            updatedOrder = result.rows[0];

        } else {

            const result = await client.query(
                `SELECT id, order_number
                 FROM orders
                 WHERE id = $1`,
                [id]
            );

            if (result.rows.length === 0) {

                await client.query("ROLLBACK");

                return res.status(404).json({
                    message: "Order not found."
                });

            }

            updatedOrder = result.rows[0];

        }


        // Add an event to tracking history if the admin
        // supplies an event description or event location.

        if (eventDescription || eventLocation) {

            const currentOrder = await client.query(
                `SELECT order_status
                 FROM orders
                 WHERE id = $1`,
                [id]
            );

            await addTrackingEvent(
                client,
                id,
                currentOrder.rows[0].order_status,
                eventDescription || "Delivery location updated.",
                eventLocation || null
            );

        }

        await client.query("COMMIT");

        res.json({

            message: "Delivery details updated successfully!",

            delivery: updatedOrder

        });

    } catch (error) {

        if (client) {

            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback error:", rollbackError.message);
            }

        }

        console.error(
            "Delivery update error:",
            error.message
        );

        res.status(500).json({
            message: "Unable to update delivery details."
        });

    } finally {

        if (client) {
            client.release();
        }

    }

});


// ===================================
// UPDATE CUSTOMER ORDER STATUS (ADMIN)
// ===================================


// ===================================
// UPDATE CUSTOMER ORDER STATUS (ADMIN)
// ===================================

app.patch("/api/admin/orders/:id/status", async (req, res) => {

    let client;

    try {

        const { id } = req.params;

        const status =
            req.body.order_status || req.body.status;

        const description = req.body.description || null;

        const location = req.body.location || null;

        if (
            !/^[1-9]\d*$/.test(id) ||
            !Number.isSafeInteger(Number(id))
        ) {
            return res.status(400).json({
                message: "Invalid order ID."
            });
        }

        if (!ALLOWED_ORDER_STATUSES.includes(status)) {
            return res.status(400).json({
                message: "Invalid order status."
            });
        }

        if (
            description !== null &&
            (
                typeof description !== "string" ||
                description.length > 1000
            )
        ) {
            return res.status(400).json({
                message: "Invalid status description."
            });
        }

        if (
            location !== null &&
            (
                typeof location !== "string" ||
                location.length > 255
            )
        ) {
            return res.status(400).json({
                message: "Invalid delivery location."
            });
        }

        client = await pool.connect();

        await client.query("BEGIN");

        const result = await client.query(
            `UPDATE orders
             SET
                order_status = $1,

                shipped_at = CASE
                    WHEN $4::text IN (
                        'Shipped',
                        'In Transit',
                        'Out for Delivery',
                        'Delivered'
                    )
                    THEN COALESCE(shipped_at, NOW())
                    ELSE shipped_at
                END,

                delivered_at = CASE
                    WHEN $4::text = 'Delivered'
                    THEN COALESCE(delivered_at, NOW())
                    ELSE delivered_at
                END,

                current_location = CASE
                    WHEN $2::text IS NOT NULL
                    THEN $2
                    ELSE current_location
                END

             WHERE id = $3

             RETURNING
                id,
                order_number,
                order_status,
                shipped_at,
                delivered_at,
                current_location`,
            [
                status,
                location,
                id,
                status
            ]
        );

        if (result.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Order not found."
            });

        }

        const eventDescriptions = {

            "Pending": "Your order has been received.",

            "Processing": "Your order is being processed.",

            "Packed": "Your order has been packed and is ready for dispatch.",

            "Shipped": "Your order has been handed over to the courier.",

            "In Transit": "Your order is moving through the courier network.",

            "Out for Delivery": "Your order is out for delivery.",

            "Delivered": "Your order has been successfully delivered.",

            "Cancelled": "Your order has been cancelled.",

            "Delivery Failed": "The delivery attempt was unsuccessful."

        };

        await addTrackingEvent(
            client,
            id,
            status,
            description || eventDescriptions[status],
            location
        );

        await client.query("COMMIT");

        res.json({

            message: "Order status updated successfully!",

            order: result.rows[0]

        });

    } catch (error) {

        if (client) {

            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback error:", rollbackError.message);
            }

        }

        console.error(
            "Order status update error:",
            error.message
        );

        res.status(500).json({
            message: "Unable to update order status."
        });

    } finally {

        if (client) {
            client.release();
        }

    }

});



// ===================================
// GLOBAL ERROR HANDLER
// ===================================

app.use((error, req, res, next) => {

    console.error(
        "Unexpected server error:",
        error.message
    );

    res.status(500).json({
        message: "An unexpected server error occurred."
    });

});


// ===================================
// START SERVER
// ===================================

async function startServer() {

    try {

        await initializeDeliveryDatabase();

        app.listen(PORT, () => {

            console.log(
                `OWO Backend running at http://localhost:${PORT}`
            );

            console.log(
                "OWO Order Tracking API is ready."
            );

        });

    } catch (error) {

        console.error(
            "Unable to initialize OWO database:",
            error.message
        );

        process.exit(1);

    }

}

startServer();
