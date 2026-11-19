
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const helmet = require("helmet");
const pool = require("./db");

require("dotenv").config();

const { router: authRoutes, requireAdmin } = require("./auth");
const {
    router: customerAuthRoutes,
    requireCustomer
} = require("./customer-auth");

const app = express();
const PORT = process.env.PORT || 3000;


// ===================================
// MIDDLEWARE
// ===================================

app.use(helmet());

const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    ...(process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.split(",").map(origin => origin.trim())
        : [])
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests without an Origin header, such as server-to-server requests.
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Origin not allowed by CORS."));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "1mb" }));


// ===================================
// AUTHENTICATION
// ===================================

app.use("/api/admin", authRoutes);
app.use("/api/admin", requireAdmin);
app.use("/api/auth", customerAuthRoutes);


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

const CANCELLABLE_STATUSES = [
    "Pending",
    "Payment Pending",
    "Processing",
    "Packed"
];

const CANCELLATION_REASONS = [
    "Ordered by mistake",
    "Found a better price",
    "Delivery taking too long",
    "Want to change the order",
    "Other"
];

const RETURN_REASONS = [
    "Damaged item",
    "Defective item",
    "Wrong item received",
    "Size or fit issue",
    "Quality not as expected",
    "Missing parts or accessories",
    "Other"
];

const RETURN_STATUSES = [
    "Approved",
    "Rejected",
    "Received",
    "Refunded"
];


// ===================================
// SAFE ORDER VALIDATION ERRORS
// ===================================

class OrderRequestError extends Error {
    constructor(message) {
        super(message);
        this.name = "OrderRequestError";
    }
}


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
// CUSTOMER DATABASE SETUP
// ===================================

async function initializeCustomerDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            phone VARCHAR(20) NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    await pool.query(`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_orders_user_id
        ON orders(user_id)
    `);

    console.log("OWO customer database initialized.");
}


// ===================================
// DELIVERY DATABASE SETUP
// ===================================

async function initializeDeliveryDatabase() {
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

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_order_tracking_events_order_id
        ON order_tracking_events(order_id)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS order_cancellation_requests (
            id BIGSERIAL PRIMARY KEY,
            order_id BIGINT NOT NULL UNIQUE
                REFERENCES orders(id) ON DELETE CASCADE,
            user_id BIGINT NOT NULL
                REFERENCES users(id) ON DELETE CASCADE,
            reason VARCHAR(150) NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS order_return_requests (
            id BIGSERIAL PRIMARY KEY,
            order_id BIGINT NOT NULL UNIQUE
                REFERENCES orders(id) ON DELETE CASCADE,
            user_id BIGINT NOT NULL
                REFERENCES users(id) ON DELETE CASCADE,
            reason VARCHAR(150) NOT NULL,
            description TEXT NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'Requested'
                CHECK (
                    status IN (
                        'Requested',
                        'Approved',
                        'Rejected',
                        'Received',
                        'Refunded'
                    )
                ),
            admin_note TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_order_return_requests_user_id
        ON order_return_requests(user_id)
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
        [orderId, status, description, location]
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
// DOES NOT EXPOSE DATABASE DETAILS
// ===================================

app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.json({
            status: "OK",
            message: "OWO Backend is running."
        });
    } catch (error) {
        console.error("Health check error:", error.message);

        res.status(503).json({
            status: "ERROR",
            message: "Service temporarily unavailable."
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
// COD ONLY
// LOGIN REQUIRED
// ===================================

app.post("/api/orders", requireCustomer, async (req, res) => {
    const {
        customer,
        products,
        payment
    } = req.body;

    const requiredFields = [
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
            message: "Please provide all shipping details."
        });
    }

    if (
        !/^[0-9]{6}$/.test(customer.pincode.trim()) ||
        customer.address.trim().length > 1000 ||
        customer.city.trim().length > 150 ||
        customer.state.trim().length > 150
    ) {
        return res.status(400).json({
            message: "Please provide valid shipping details."
        });
    }

    // ONLINE PAYMENT IS DISABLED UNTIL A PAYMENT GATEWAY IS CONFIGURED.

    if (payment !== "cod") {
        return res.status(400).json({
            message: "Online payment is coming soon. Please choose Cash on Delivery."
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
            !item ||
            !/^[1-9]\d*$/.test(String(item.id)) ||
            !Number.isSafeInteger(Number(item.id)) ||
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

        const customerResult = await client.query(
            `SELECT id, name, email, phone
             FROM users
             WHERE id = $1`,
            [req.customer.id]
        );

        if (customerResult.rows.length === 0) {
            throw new OrderRequestError(
                "Customer account not found. Please log in again."
            );
        }

        const account = customerResult.rows[0];

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
                throw new OrderRequestError(
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
                    throw new OrderRequestError(
                        `Please select a valid size for ${product.name}.`
                    );
                }
            }

            const requiredStock =
                (stockRequirements.get(String(item.id)) || 0) +
                quantity;

            stockRequirements.set(String(item.id), requiredStock);

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
                throw new OrderRequestError(
                    `${product.name} does not have enough stock.`
                );
            }
        }

        // Use 128 random bits to make order numbers much harder to guess.

        const orderNumber =
            "OWO-" +
            Date.now().toString() +
            crypto.randomBytes(16).toString("hex").toUpperCase();

        const orderStatus = "Pending";

        const orderResult = await client.query(
            `INSERT INTO orders (
                user_id,
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
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            RETURNING
                id,
                order_number,
                total_amount,
                order_status,
                created_at`,
            [
                account.id,
                orderNumber,
                account.name,
                account.email,
                account.phone,
                customer.address.trim(),
                customer.city.trim(),
                customer.state.trim(),
                customer.pincode.trim(),
                "cod",
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

        // Reduce stock for COD orders.

        for (const [id, required] of stockRequirements) {
            await client.query(
                `UPDATE products
                 SET stock_quantity = stock_quantity - $1
                 WHERE id = $2`,
                [required, id]
            );
        }

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
                paymentMethod: "cod",
                createdAt: savedOrder.created_at
            }
        });
    } catch (error) {
        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback error:", rollbackError.message);
            }
        }

        console.error("Order creation error:", error.message);

        if (error instanceof OrderRequestError) {
            return res.status(400).json({
                message: error.message
            });
        }

        res.status(500).json({
            message: "Unable to create your order right now. Please try again."
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});


// ===================================
// CUSTOMER CANCEL ORDER
// ONLY BEFORE SHIPPING
// ===================================

app.post("/api/orders/:id/cancel", requireCustomer, async (req, res) => {
    let client;

    try {
        const { id } = req.params;
        const { reason, description } = req.body;

        if (
            !/^[1-9]\d*$/.test(id) ||
            !Number.isSafeInteger(Number(id))
        ) {
            return res.status(400).json({
                message: "Invalid order ID."
            });
        }

        if (
            typeof reason !== "string" ||
            !CANCELLATION_REASONS.includes(reason)
        ) {
            return res.status(400).json({
                message: "Please select a valid cancellation reason."
            });
        }

        if (
            description != null &&
            (
                typeof description !== "string" ||
                description.trim().length > 1000
            )
        ) {
            return res.status(400).json({
                message: "Cancellation description must be 1000 characters or less."
            });
        }

        client = await pool.connect();
        await client.query("BEGIN");

        const orderResult = await client.query(
            `SELECT id, order_number, order_status, payment_method
             FROM orders
             WHERE id = $1 AND user_id = $2
             FOR UPDATE`,
            [id, req.customer.id]
        );

        if (orderResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Order not found."
            });
        }

        const order = orderResult.rows[0];

        if (!CANCELLABLE_STATUSES.includes(order.order_status)) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "This order can only be cancelled before it is shipped."
            });
        }

        const existingRequest = await client.query(
            `SELECT id
             FROM order_cancellation_requests
             WHERE order_id = $1`,
            [id]
        );

        if (existingRequest.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                message: "A cancellation request already exists for this order."
            });
        }

        await client.query(
            `INSERT INTO order_cancellation_requests (
                order_id,
                user_id,
                reason,
                description
            )
            VALUES ($1, $2, $3, $4)`,
            [
                id,
                req.customer.id,
                reason,
                description ? description.trim() : null
            ]
        );

        // Restore COD stock exactly once.

        if (order.payment_method === "cod") {
            await client.query(
                `UPDATE products p
                 SET stock_quantity = p.stock_quantity + item_totals.quantity
                 FROM (
                     SELECT
                        product_id,
                        SUM(quantity)::INTEGER AS quantity
                     FROM order_items
                     WHERE order_id = $1
                       AND product_id IS NOT NULL
                     GROUP BY product_id
                 ) AS item_totals
                 WHERE p.id = item_totals.product_id`,
                [id]
            );
        }

        await client.query(
            `UPDATE orders
             SET order_status = 'Cancelled'
             WHERE id = $1`,
            [id]
        );

        const trackingDescription =
            `Order cancelled by customer. Reason: ${reason}` +
            (description && description.trim()
                ? `. Details: ${description.trim()}`
                : "");

        await addTrackingEvent(
            client,
            id,
            "Cancelled",
            trackingDescription
        );

        await client.query("COMMIT");

        res.json({
            message: "Your order has been cancelled successfully.",
            order: {
                id: order.id,
                order_number: order.order_number,
                order_status: "Cancelled"
            }
        });
    } catch (error) {
        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback error:", rollbackError.message);
            }
        }

        console.error("Customer cancellation error:", error.message);

        if (error.code === "23505") {
            return res.status(409).json({
                message: "A cancellation request already exists for this order."
            });
        }

        res.status(500).json({
            message: "Unable to cancel this order right now."
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});


// ===================================
// CUSTOMER RETURN ORDER
// RETURN AVAILABLE FOR 5 DAYS
// ===================================

app.post("/api/orders/:id/return", requireCustomer, async (req, res) => {
    let client;

    try {
        const { id } = req.params;
        const { reason, description } = req.body;

        if (
            !/^[1-9]\d*$/.test(id) ||
            !Number.isSafeInteger(Number(id))
        ) {
            return res.status(400).json({
                message: "Invalid order ID."
            });
        }

        if (
            typeof reason !== "string" ||
            !RETURN_REASONS.includes(reason)
        ) {
            return res.status(400).json({
                message: "Please select a valid return reason."
            });
        }

        if (
            typeof description !== "string" ||
            !description.trim() ||
            description.trim().length > 2000
        ) {
            return res.status(400).json({
                message: "Please provide return details. Maximum 2000 characters."
            });
        }

        client = await pool.connect();
        await client.query("BEGIN");

        const orderResult = await client.query(
            `SELECT
                id,
                order_number,
                order_status,
                delivered_at
             FROM orders
             WHERE id = $1 AND user_id = $2
             FOR UPDATE`,
            [id, req.customer.id]
        );

        if (orderResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Order not found."
            });
        }

        const order = orderResult.rows[0];

        if (
            order.order_status !== "Delivered" ||
            !order.delivered_at
        ) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "You can request a return only after the order is delivered."
            });
        }

        const eligibilityResult = await client.query(
            `SELECT
                NOW() <= $1::timestamptz + INTERVAL '5 days'
                AS is_eligible`,
            [order.delivered_at]
        );

        if (!eligibilityResult.rows[0].is_eligible) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "The 5-day return period has expired."
            });
        }

        const existingRequest = await client.query(
            `SELECT id
             FROM order_return_requests
             WHERE order_id = $1`,
            [id]
        );

        if (existingRequest.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                message: "A return request has already been submitted for this order."
            });
        }

        const returnResult = await client.query(
            `INSERT INTO order_return_requests (
                order_id,
                user_id,
                reason,
                description
            )
            VALUES ($1, $2, $3, $4)
            RETURNING
                id,
                reason,
                description,
                status,
                created_at`,
            [
                id,
                req.customer.id,
                reason,
                description.trim()
            ]
        );

        await addTrackingEvent(
            client,
            id,
            "Return Requested",
            `Customer requested a return. Reason: ${reason}. Details: ${description.trim()}`
        );

        await client.query("COMMIT");

        res.status(201).json({
            message: "Your return request has been submitted successfully.",
            return_request: returnResult.rows[0]
        });
    } catch (error) {
        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback error:", rollbackError.message);
            }
        }

        console.error("Customer return error:", error.message);

        if (error.code === "23505") {
            return res.status(409).json({
                message: "A return request already exists for this order."
            });
        }

        res.status(500).json({
            message: "Unable to submit your return request right now."
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});


// ===================================
// CUSTOMER MY ORDERS
// ===================================

app.get("/api/orders/my-orders", requireCustomer, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                id,
                order_number,
                total_amount,
                payment_method,
                order_status,
                created_at,
                estimated_delivery_date,
                courier_name,
                tracking_number,
                shipped_at,
                delivered_at,
                current_location,
                CASE
                    WHEN delivered_at IS NOT NULL
                    THEN delivered_at + INTERVAL '5 days'
                    ELSE NULL
                END AS return_eligible_until,
                CASE
                    WHEN delivered_at IS NOT NULL
                         AND order_status = 'Delivered'
                         AND NOW() <= delivered_at + INTERVAL '5 days'
                    THEN TRUE
                    ELSE FALSE
                END AS is_return_eligible
             FROM orders
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.customer.id]
        );

        const orders = result.rows;

        if (orders.length === 0) {
            return res.json({
                totalOrders: 0,
                processing: 0,
                shipping: 0,
                delivered: 0,
                cancelled: 0,
                orders: []
            });
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

        const cancellationResult = await pool.query(
            `SELECT
                order_id,
                reason,
                description,
                created_at
             FROM order_cancellation_requests
             WHERE order_id = ANY($1::bigint[])`,
            [orderIds]
        );

        const returnResult = await pool.query(
            `SELECT
                order_id,
                reason,
                description,
                status,
                admin_note,
                created_at,
                updated_at
             FROM order_return_requests
             WHERE order_id = ANY($1::bigint[])`,
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

        const cancellationsByOrder = new Map();

        for (const cancellation of cancellationResult.rows) {
            cancellationsByOrder.set(
                String(cancellation.order_id),
                {
                    reason: cancellation.reason,
                    description: cancellation.description,
                    created_at: cancellation.created_at
                }
            );
        }

        const returnsByOrder = new Map();

        for (const returnRequest of returnResult.rows) {
            returnsByOrder.set(
                String(returnRequest.order_id),
                {
                    reason: returnRequest.reason,
                    description: returnRequest.description,
                    status: returnRequest.status,
                    admin_note: returnRequest.admin_note,
                    created_at: returnRequest.created_at,
                    updated_at: returnRequest.updated_at
                }
            );
        }

        const completeOrders = orders.map(order => ({
            ...order,
            total_amount: Number(order.total_amount),
            items: itemsByOrder.get(String(order.id)) || [],
            tracking_history: eventsByOrder.get(String(order.id)) || [],
            cancellation: cancellationsByOrder.get(String(order.id)) || null,
            return_request: returnsByOrder.get(String(order.id)) || null,
            is_return_eligible: order.is_return_eligible === true
        }));

        res.json({
            totalOrders: completeOrders.length,

            processing: completeOrders.filter(order =>
                [
                    "Pending",
                    "Processing",
                    "Packed",
                    "Payment Pending"
                ].includes(order.order_status)
            ).length,

            shipping: completeOrders.filter(order =>
                [
                    "Shipped",
                    "In Transit",
                    "Out for Delivery"
                ].includes(order.order_status)
            ).length,

            delivered: completeOrders.filter(order =>
                order.order_status === "Delivered"
            ).length,

            cancelled: completeOrders.filter(order =>
                ["Cancelled", "Delivery Failed"].includes(order.order_status)
            ).length,

            orders: completeOrders
        });
    } catch (error) {
        console.error("My orders error:", error.message);

        res.status(500).json({
            message: "Unable to fetch your orders."
        });
    }
});


// ===================================
// CUSTOMER ORDER TRACKING
// ===================================

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
            [cleanOrderNumber, cleanContact]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                message: "We couldn't find an order with those details. Please check and try again."
            });
        }

        const order = orderResult.rows[0];

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
                estimated_delivery_date: order.estimated_delivery_date,
                shipped_at: order.shipped_at,
                delivered_at: order.delivered_at,
                current_location: order.current_location,
                delivery_instructions: order.delivery_instructions,

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
            tracking_history: eventsByOrder.get(String(order.id)) || []
        }));

        console.log(`Admin orders fetched: ${completeOrders.length}`);

        res.json(completeOrders);
    } catch (error) {
        console.error("Admin orders error:", error.message);

        res.status(500).json({
            message: "Unable to fetch customer orders."
        });
    }
});


// ===================================
// GET ALL RETURN REQUESTS (ADMIN)
// ===================================

app.get("/api/admin/returns", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                rr.id,
                rr.order_id,
                rr.user_id,
                rr.reason,
                rr.description,
                rr.status,
                rr.admin_note,
                rr.created_at,
                rr.updated_at,
                o.order_number,
                o.total_amount,
                o.payment_method,
                o.order_status,
                o.delivered_at,
                o.customer_name,
                o.email,
                o.phone
             FROM order_return_requests rr
             INNER JOIN orders o ON o.id = rr.order_id
             ORDER BY rr.created_at DESC`
        );

        res.json(result.rows.map(item => ({
            ...item,
            total_amount: Number(item.total_amount)
        })));
    } catch (error) {
        console.error("Admin returns fetch error:", error.message);

        res.status(500).json({
            message: "Unable to fetch return requests."
        });
    }
});


// ===================================
// UPDATE RETURN REQUEST (ADMIN)
// ===================================

app.patch("/api/admin/returns/:id", async (req, res) => {
    let client;

    try {
        const { id } = req.params;
        const { status, admin_note } = req.body;

        if (
            !/^[1-9]\d*$/.test(id) ||
            !Number.isSafeInteger(Number(id))
        ) {
            return res.status(400).json({
                message: "Invalid return request ID."
            });
        }

        if (!RETURN_STATUSES.includes(status)) {
            return res.status(400).json({
                message: "Invalid return request status."
            });
        }

        if (
            admin_note != null &&
            (
                typeof admin_note !== "string" ||
                admin_note.trim().length > 2000
            )
        ) {
            return res.status(400).json({
                message: "Admin note must be 2000 characters or less."
            });
        }

        client = await pool.connect();
        await client.query("BEGIN");

        const result = await client.query(
            `UPDATE order_return_requests
             SET
                status = $1,
                admin_note = $2,
                updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [
                status,
                admin_note ? admin_note.trim() : null,
                id
            ]
        );

        if (result.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Return request not found."
            });
        }

        const returnRequest = result.rows[0];

        await addTrackingEvent(
            client,
            returnRequest.order_id,
            `Return ${status}`,
            admin_note && admin_note.trim()
                ? `Return request ${status.toLowerCase()}. Admin note: ${admin_note.trim()}`
                : `Your return request has been ${status.toLowerCase()}.`
        );

        await client.query("COMMIT");

        res.json({
            message: "Return request updated successfully.",
            return_request: returnRequest
        });
    } catch (error) {
        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback error:", rollbackError.message);
            }
        }

        console.error("Admin return update error:", error.message);

        res.status(500).json({
            message: "Unable to update return request."
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});


// ===================================
// UPDATE ORDER DELIVERY DETAILS (ADMIN)
// ===================================

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

        console.error("Delivery update error:", error.message);

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
// SAFE CANCELLATION + STOCK RESTORATION
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

        // Lock the order so two cancellation requests cannot restore stock twice.

        const orderResult = await client.query(
            `SELECT
                id,
                order_number,
                order_status,
                payment_method
             FROM orders
             WHERE id = $1
             FOR UPDATE`,
            [id]
        );

        if (orderResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Order not found."
            });
        }

        const currentOrder = orderResult.rows[0];

        // Do not allow changing an already cancelled order.

        if (currentOrder.order_status === "Cancelled") {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "This order has already been cancelled."
            });
        }

        // Admin can cancel only before shipping.

        if (
            status === "Cancelled" &&
            !CANCELLABLE_STATUSES.includes(currentOrder.order_status)
        ) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "An order can only be cancelled before it is shipped."
            });
        }

        // Restore COD stock only when changing an active order to Cancelled.

        if (
            status === "Cancelled" &&
            currentOrder.payment_method === "cod"
        ) {
            await client.query(
                `UPDATE products p
                 SET stock_quantity = p.stock_quantity + item_totals.quantity
                 FROM (
                     SELECT
                        product_id,
                        SUM(quantity)::INTEGER AS quantity
                     FROM order_items
                     WHERE order_id = $1
                       AND product_id IS NOT NULL
                     GROUP BY product_id
                 ) AS item_totals
                 WHERE p.id = item_totals.product_id`,
                [id]
            );
        }

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
            [status, location, id, status]
        );

        const eventDescriptions = {
            "Pending": "Your order has been received.",
            "Processing": "Your order is being processed.",
            "Packed": "Your order has been packed and is ready for dispatch.",
            "Shipped": "Your order has been handed over to the courier.",
            "In Transit": "Your order is moving through the courier network.",
            "Out for Delivery": "Your order is out for delivery.",
            "Delivered": "Your order has been successfully delivered.",
            "Cancelled": "Your order has been cancelled by the store.",
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
            message: status === "Cancelled"
                ? "Order cancelled successfully. Stock has been restored."
                : "Order status updated successfully!",
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

        console.error("Order status update error:", error.message);

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
    console.error("Unexpected server error:", error.message);

    if (res.headersSent) {
        return next(error);
    }

    // CORS rejection
    if (error.message === "Origin not allowed by CORS.") {
        return res.status(403).json({
            message: "This website is not allowed to access the server."
        });
    }

    // Request body too large
    if (error.type === "entity.too.large") {
        return res.status(413).json({
            message: "Request body is too large."
        });
    }

    // Invalid JSON
    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
        return res.status(400).json({
            message: "Invalid JSON request."
        });
    }

    res.status(500).json({
        message: "An unexpected server error occurred."
    });
});


// ===================================
// START SERVER
// ===================================

async function startServer() {
    try {
        await initializeCustomerDatabase();
        await initializeDeliveryDatabase();

        app.listen(PORT, () => {
            console.log(
                `OWO Backend running at http://localhost:${PORT}`
            );

            console.log("OWO Order Tracking API is ready.");
            console.log("OWO Customer Account API is ready.");
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
