
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./db");

const router = express.Router();

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
            password.length < 8 ||
            password.length > 72
        ) {
            return res.status(400).json({
                message: "Enter valid details. Password must be at least 8 characters."
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

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured.");
        }

        const existingUser = await pool.query(
            `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
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

        // GENERATE CUSTOMER TOKEN

        const token = jwt.sign(
            {
                id: customer.id,
                role: "customer"
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // SEND TOKEN AND CUSTOMER DETAILS

        res.status(201).json({
            message: "Account created successfully!",
            token,
            customer: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone
            }
        });

    } catch (error) {
        console.error("Customer registration error:", error.message);

        if (error.code === "23505") {
            return res.status(409).json({
                message: "An account with this email already exists."
            });
        }

        res.status(500).json({
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
            !password
        ) {
            return res.status(400).json({
                message: "Enter your email and password."
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

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured.");
        }

        const token = jwt.sign(
            {
                id: user.id,
                role: "customer"
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            message: "Login successful!",
            token,
            customer: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone
            }
        });

    } catch (error) {
        console.error("Customer login error:", error.message);

        res.status(500).json({
            message: "Unable to log in right now."
        });
    }
});


// ===================================
// CUSTOMER AUTHENTICATION MIDDLEWARE
// ===================================

function requireCustomer(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Please log in to continue."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (decoded.role !== "customer" || !decoded.id) {
            return res.status(403).json({
                message: "Customer access only."
            });
        }

        req.customer = {
            id: decoded.id
        };

        next();

    } catch (error) {
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

        res.json({
            customer: result.rows[0]
        });

    } catch (error) {
        console.error("Customer profile error:", error.message);

        res.status(500).json({
            message: "Unable to fetch customer profile."
        });
    }
});


module.exports = {
    router,
    requireCustomer
};
