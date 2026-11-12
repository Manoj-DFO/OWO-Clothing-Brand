
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./db");

const router = express.Router();

const TOKEN_EXPIRY = "7d";

// ===================================
// JWT CONFIGURATION
// ===================================

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
        throw new Error(
            "JWT_SECRET must be configured with at least 32 characters."
        );
    }

    return secret;
}

// ===================================
// GENERATE CUSTOMER TOKEN
// ===================================

function generateCustomerToken(customerId) {
    return jwt.sign(
        {
            id: String(customerId),
            role: "customer"
        },
        getJwtSecret(),
        {
            expiresIn: TOKEN_EXPIRY,
            algorithm: "HS256"
        }
    );
}

// ===================================
// CUSTOMER REGISTRATION
// ===================================

router.post("/register", async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof phone !== "string" ||
            typeof password !== "string" ||
            !name.trim() ||
            !email.trim() ||
            !phone.trim() ||
            Buffer.byteLength(password, "utf8") < 8 ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                message: "Enter valid details. Password must be 8–72 bytes."
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone.trim();

        if (cleanName.length > 150 || cleanEmail.length > 255) {
            return res.status(400).json({
                message: "Name or email is too long."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({
                message: "Enter a valid email address."
            });
        }

        if (!/^[0-9]{10}$/.test(cleanPhone)) {
            return res.status(400).json({
                message: "Enter a valid 10-digit phone number."
            });
        }

        const existingUser = await pool.query(
            `SELECT id
             FROM users
             WHERE LOWER(email) = LOWER($1)
             LIMIT 1`,
            [cleanEmail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "An account with this email already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users (name, email, phone, password_hash)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, email, phone, created_at`,
            [cleanName, cleanEmail, cleanPhone, passwordHash]
        );

        const customer = result.rows[0];

        const token = generateCustomerToken(customer.id);

        return res.status(201).json({
            message: "Account created successfully!",
            token,
            customer: {
                id: String(customer.id),
                name: customer.name,
                email: customer.email,
                phone: customer.phone
            }
        });

    } catch (error) {
        console.error("Customer registration error:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                message: "An account with this email already exists."
            });
        }

        return res.status(500).json({
            message: "Unable to create your account."
        });
    }
});

// ===================================
// CUSTOMER LOGIN
// ===================================

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password ||
            email.trim().length > 255 ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                message: "Enter a valid email and password."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const result = await pool.query(
            `SELECT id, name, email, phone, password_hash
             FROM users
             WHERE LOWER(email) = LOWER($1)
             LIMIT 1`,
            [cleanEmail]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const user = result.rows[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const token = generateCustomerToken(user.id);

        return res.json({
            message: "Login successful!",
            token,
            customer: {
                id: String(user.id),
                name: user.name,
                email: user.email,
                phone: user.phone
            }
        });

    } catch (error) {
        console.error("Customer login error:", error);

        return res.status(500).json({
            message: "Unable to log in right now."
        });
    }
});

// ===================================
// CUSTOMER AUTHENTICATION MIDDLEWARE
// ===================================

function requireCustomer(req, res, next) {
    const authHeader = req.headers.authorization;

    if (typeof authHeader !== "string") {
        return res.status(401).json({
            message: "Please log in to continue."
        });
    }

    const match = authHeader.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
        return res.status(401).json({
            message: "Invalid authorization format."
        });
    }

    try {
        const decoded = jwt.verify(
            match[1],
            getJwtSecret(),
            {
                algorithms: ["HS256"]
            }
        );

        const customerId = decoded.id;

        const validId =
            (
                typeof customerId === "string" &&
                /^[1-9][0-9]*$/.test(customerId)
            ) ||
            (
                typeof customerId === "number" &&
                Number.isSafeInteger(customerId) &&
                customerId > 0
            );

        if (decoded.role !== "customer" || !validId) {
            return res.status(403).json({
                message: "Customer access only."
            });
        }

        req.customer = {
            id: String(customerId)
        };

        return next();

    } catch (error) {
        if (error.message.startsWith("JWT_SECRET")) {
            console.error("Customer JWT configuration error:", error);

            return res.status(500).json({
                message: "Authentication service is not configured."
            });
        }

        return res.status(401).json({
            message: "Your session is invalid or expired. Please log in again."
        });
    }
}

// ===================================
// GET LOGGED-IN CUSTOMER
// ===================================

router.get("/me", requireCustomer, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, phone, created_at
             FROM users
             WHERE id = $1`,
            [req.customer.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Customer account not found."
            });
        }

        const customer = result.rows[0];

        return res.json({
            customer: {
                id: String(customer.id),
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                created_at: customer.created_at
            }
        });

    } catch (error) {
        console.error("Customer profile error:", error);

        return res.status(500).json({
            message: "Unable to fetch customer profile."
        });
    }
});

// ===================================
// EXPORT
// ===================================

module.exports = {
    router,
    requireCustomer
};
