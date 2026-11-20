
const express = require("express");
const pool = require("./db");

const router = express.Router();
const adminRouter = express.Router();


// ===================================
// HELPERS
// ===================================

function validId(id) {
    return (
        /^[1-9]\d*$/.test(String(id)) &&
        Number.isSafeInteger(Number(id))
    );
}

function formatDesign(row) {
    return {
        ...row,

        // Keep database field names
        design_data: row.design_data,
        quoted_price: row.quoted_price,
        stock_quantity: row.stock_quantity,

        // Also provide frontend-friendly field names
        designData: row.design_data,
        quotedPrice: row.quoted_price,
        stockQuantity: row.stock_quantity,

        id: String(row.id)
    };
}

function validateDesign(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return "Invalid design information.";
    }

    const customization = data.customization;

    if (
        !customization ||
        typeof customization !== "object" ||
        Array.isArray(customization)
    ) {
        return "Customization details are required.";
    }

    const allowedGarments = [
        "tshirt",
        "shirt",
        "hoodie",
        "henley",
        "pants"
    ];

    if (!allowedGarments.includes(customization.garment)) {
        return "Invalid garment type.";
    }

    if (
        typeof customization.colour !== "string" ||
        !customization.colour.trim() ||
        customization.colour.length > 100
    ) {
        return "Please provide a valid garment colour.";
    }

    if (
        typeof data.size !== "string" ||
        !["S", "M", "L", "XL", "XXL"].includes(data.size)
    ) {
        return "Please select a valid size.";
    }

    if (
        customization.garment === "pants" &&
        !["straight", "bootcut"].includes(customization.fit)
    ) {
        return "Please select a valid pants fit.";
    }

    if (
        !customization.measurements ||
        typeof customization.measurements !== "object"
    ) {
        return "Body measurements are required.";
    }

    const measurementNames =
        customization.garment === "pants"
            ? ["pantsWaist", "hip", "bottomLeg"]
            : ["shoulder", "chest", "upperWaist", "sleeve"];

    for (const name of measurementNames) {
        const measurement = customization.measurements[name];

        if (
            !measurement ||
            !Number.isFinite(Number(measurement.value)) ||
            Number(measurement.value) <= 0 ||
            !["cm", "inch"].includes(measurement.unit)
        ) {
            return `Please provide a valid ${name} measurement.`;
        }
    }

    return null;
}


// ===================================
// DATABASE SETUP
// ===================================

async function initializeCustomDesignDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS custom_designs (
            id BIGSERIAL PRIMARY KEY,

            user_id BIGINT NOT NULL
                REFERENCES users(id) ON DELETE CASCADE,

            design_data JSONB NOT NULL,

            status VARCHAR(30) NOT NULL DEFAULT 'Pending Review'
                CHECK (
                    status IN (
                        'Pending Review',
                        'Price Confirmed',
                        'Rejected',
                        'Ordered'
                    )
                ),

            quoted_price NUMERIC(10,2),

            stock_quantity INTEGER NOT NULL DEFAULT 0
                CHECK (stock_quantity >= 0),

            admin_note TEXT,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_custom_designs_user_id
        ON custom_designs(user_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_custom_designs_status
        ON custom_designs(status)
    `);

    console.log("OWO custom design database initialized.");
}


// ===================================
// CUSTOMER: SUBMIT DESIGN
// ===================================

router.post("/", async (req, res) => {
    try {
        const validationError = validateDesign(req.body);

        if (validationError) {
            return res.status(400).json({
                message: validationError
            });
        }

        const dataSize = Buffer.byteLength(
            JSON.stringify(req.body),
            "utf8"
        );

        if (dataSize > 700000) {
            return res.status(413).json({
                message: "Design images are too large. Please reduce their size."
            });
        }

        const result = await pool.query(
            `INSERT INTO custom_designs (
                user_id,
                design_data
            )
            VALUES ($1, $2::jsonb)
            RETURNING
                id,
                design_data,
                status,
                quoted_price,
                stock_quantity,
                admin_note,
                created_at,
                updated_at`,
            [
                req.customer.id,
                JSON.stringify(req.body)
            ]
        );

        res.status(201).json({
            message: "Your custom design has been submitted for review.",
            design: formatDesign(result.rows[0])
        });

    } catch (error) {
        console.error("Custom design submission error:", error.message);

        res.status(500).json({
            message: "Unable to submit your custom design."
        });
    }
});


// ===================================
// CUSTOMER: GET MY DESIGNS
// ===================================

router.get("/mine", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                id,
                design_data,
                status,
                quoted_price,
                stock_quantity,
                admin_note,
                created_at,
                updated_at
             FROM custom_designs
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.customer.id]
        );

        const designs = result.rows.map(formatDesign);

        // Return an array for compatibility with the cart.
        res.json(designs);

    } catch (error) {
        console.error("Customer custom designs error:", error.message);

        res.status(500).json({
            message: "Unable to fetch your custom designs."
        });
    }
});


// ===================================
// CUSTOMER: GET ONE DESIGN
// ===================================

router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!validId(id)) {
            return res.status(400).json({
                message: "Invalid design ID."
            });
        }

        const result = await pool.query(
            `SELECT
                id,
                design_data,
                status,
                quoted_price,
                stock_quantity,
                admin_note,
                created_at,
                updated_at
             FROM custom_designs
             WHERE id = $1 AND user_id = $2`,
            [id, req.customer.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Custom design not found."
            });
        }

        res.json(formatDesign(result.rows[0]));

    } catch (error) {
        console.error("Fetch custom design error:", error.message);

        res.status(500).json({
            message: "Unable to fetch this custom design."
        });
    }
});


// ===================================
// ADMIN: GET ALL DESIGNS
// ===================================

adminRouter.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                cd.id,
                cd.user_id,
                cd.design_data,
                cd.status,
                cd.quoted_price,
                cd.stock_quantity,
                cd.admin_note,
                cd.created_at,
                cd.updated_at,
                u.name AS customer_name,
                u.email AS customer_email,
                u.phone AS customer_phone
             FROM custom_designs cd
             INNER JOIN users u ON u.id = cd.user_id
             ORDER BY
                CASE
                    WHEN cd.status = 'Pending Review' THEN 0
                    ELSE 1
                END,
                cd.created_at DESC`
        );

        res.json(result.rows.map(formatDesign));

    } catch (error) {
        console.error("Admin custom designs error:", error.message);

        res.status(500).json({
            message: "Unable to fetch custom design requests."
        });
    }
});


// ===================================
// ADMIN: CONFIRM PRICE AND STOCK
// ===================================

adminRouter.patch("/:id/quote", async (req, res) => {
    try {
        const { id } = req.params;

        if (!validId(id)) {
            return res.status(400).json({
                message: "Invalid design ID."
            });
        }

        // Accept both snake_case and camelCase fields.
        const price = req.body.price;

        const stockQuantity =
            req.body.stock_quantity ??
            req.body.stockQuantity ??
            req.body.stock;

        const adminNote =
            req.body.admin_note ??
            req.body.adminNote ??
            null;

        const quotedPrice = Number(price);
        const stock = Number(stockQuantity);

        if (
            price === "" ||
            price === null ||
            price === undefined ||
            !Number.isFinite(quotedPrice) ||
            quotedPrice <= 0 ||
            quotedPrice > 99999999.99
        ) {
            return res.status(400).json({
                message: "Please enter a valid custom design price."
            });
        }

        // A design cannot be approved without available stock.
        if (
            stockQuantity === "" ||
            stockQuantity === null ||
            stockQuantity === undefined ||
            !Number.isSafeInteger(stock) ||
            stock < 1
        ) {
            return res.status(400).json({
                message: "Please enter a stock quantity of at least 1."
            });
        }

        if (
            adminNote !== null &&
            (
                typeof adminNote !== "string" ||
                adminNote.length > 2000
            )
        ) {
            return res.status(400).json({
                message: "Admin note must be 2000 characters or less."
            });
        }

        const result = await pool.query(
            `UPDATE custom_designs
             SET
                quoted_price = $1,
                stock_quantity = $2,
                status = 'Price Confirmed',
                admin_note = $3,
                updated_at = NOW()
             WHERE id = $4
               AND status != 'Ordered'
             RETURNING
                id,
                design_data,
                status,
                quoted_price,
                stock_quantity,
                admin_note,
                created_at,
                updated_at`,
            [
                quotedPrice,
                stock,
                adminNote ? adminNote.trim() : null,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Design not found or it has already been ordered."
            });
        }

        res.json({
            message: "Custom design price and stock confirmed successfully.",
            design: formatDesign(result.rows[0])
        });

    } catch (error) {
        console.error("Custom design quote error:", error.message);

        res.status(500).json({
            message: "Unable to confirm the custom design price."
        });
    }
});


// ===================================
// ADMIN: REJECT DESIGN
// ===================================

adminRouter.patch("/:id/reject", async (req, res) => {
    try {
        const { id } = req.params;

        if (!validId(id)) {
            return res.status(400).json({
                message: "Invalid design ID."
            });
        }

        const adminNote =
            req.body.admin_note ??
            req.body.adminNote;

        if (
            typeof adminNote !== "string" ||
            !adminNote.trim() ||
            adminNote.trim().length > 2000
        ) {
            return res.status(400).json({
                message: "Please provide a rejection reason."
            });
        }

        const result = await pool.query(
            `UPDATE custom_designs
             SET
                status = 'Rejected',
                admin_note = $1,
                updated_at = NOW()
             WHERE id = $2
               AND status != 'Ordered'
             RETURNING
                id,
                design_data,
                status,
                quoted_price,
                stock_quantity,
                admin_note,
                created_at,
                updated_at`,
            [adminNote.trim(), id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Design not found or it has already been ordered."
            });
        }

        res.json({
            message: "Custom design rejected.",
            design: formatDesign(result.rows[0])
        });

    } catch (error) {
        console.error("Reject custom design error:", error.message);

        res.status(500).json({
            message: "Unable to reject this design."
        });
    }
});


// ===================================
// EXPORT
// ===================================

module.exports = {
    router,
    adminRouter,
    initializeCustomDesignDatabase
};
