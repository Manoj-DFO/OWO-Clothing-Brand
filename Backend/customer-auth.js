
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { rateLimit } = require("express-rate-limit");
const { OAuth2Client } = require("google-auth-library");
const pool = require("./db");

const router = express.Router();

const TOKEN_EXPIRY = "7d";

const customerLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Too many login attempts. Please try again after 15 minutes."
    }
});

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
// GOOGLE OAUTH CONFIGURATION
// ===================================

function getGoogleClient() {
    const {
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL
    } = process.env;

    if (
        !GOOGLE_CLIENT_ID ||
        !GOOGLE_CLIENT_SECRET ||
        !GOOGLE_CALLBACK_URL
    ) {
        throw new Error("Google OAuth environment variables are missing.");
    }

    return new OAuth2Client(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL
    );
}

function getFrontendLoginUrl() {
    return process.env.GOOGLE_SUCCESS_REDIRECT_URL ||
        "http://127.0.0.1:5500/login.html";
}

function redirectGoogleResult(res, values) {
    const url = new URL(getFrontendLoginUrl());

    url.hash = new URLSearchParams(values).toString();

    return res.redirect(url.toString());
}

// ===================================
// GOOGLE LOGIN START
// ===================================

router.get("/google", (req, res) => {
    try {
        const googleClient = getGoogleClient();

        const state = crypto.randomBytes(32).toString("hex");

        res.setHeader(
            "Set-Cookie",
            `owo_google_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=600`
        );

        const authorizationUrl = googleClient.generateAuthUrl({
            access_type: "online",
            prompt: "select_account",
            scope: [
                "openid",
                "email",
                "profile"
            ],
            state
        });

        return res.redirect(authorizationUrl);

    } catch (error) {
        console.error("Google login start error:", error);

        return res.status(500).send(
            "Google login is not configured correctly."
        );
    }
});

// ===================================
// GOOGLE LOGIN CALLBACK
// ===================================

router.get("/google/callback", async (req, res) => {
    const stateCookie = (req.headers.cookie || "")
        .split(";")
        .map(item => item.trim())
        .find(item => item.startsWith("owo_google_oauth_state="));

    const savedState = stateCookie
        ? stateCookie.substring("owo_google_oauth_state=".length)
        : "";

    res.setHeader(
        "Set-Cookie",
        "owo_google_oauth_state=; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=0"
    );

    try {
        if (req.query.error) {
            return redirectGoogleResult(res, {
                google_error: "Google sign-in was cancelled."
            });
        }

        if (
            typeof req.query.state !== "string" ||
            !savedState ||
            req.query.state !== savedState
        ) {
            return redirectGoogleResult(res, {
                google_error: "Google sign-in verification failed."
            });
        }

        if (typeof req.query.code !== "string") {
            return redirectGoogleResult(res, {
                google_error: "Google authorization code is missing."
            });
        }

        const googleClient = getGoogleClient();

        const { tokens } = await googleClient.getToken(
            req.query.code
        );

        if (!tokens.id_token) {
            throw new Error("Google ID token was not returned.");
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const googleUser = ticket.getPayload();

        if (
            !googleUser ||
            !googleUser.sub ||
            !googleUser.email ||
            !googleUser.email_verified ||
            !googleUser.name
        ) {
            return redirectGoogleResult(res, {
                google_error: "Your Google account could not be verified."
            });
        }

        const googleId = googleUser.sub;
        const email = googleUser.email.trim().toLowerCase();
        const name = googleUser.name.trim();

        if (!email || !name || name.length > 150) {
            return redirectGoogleResult(res, {
                google_error: "Invalid Google account details."
            });
        }

        // Check whether this Google account already exists.
        let result = await pool.query(
            `SELECT id, name, email, phone, google_id
             FROM users
             WHERE google_id = $1
             LIMIT 1`,
            [googleId]
        );

        let customer;

        if (result.rows.length > 0) {
            customer = result.rows[0];

            if (customer.email.toLowerCase() !== email) {
                return redirectGoogleResult(res, {
                    google_error: "Google account email does not match."
                });
            }

        } else {
            // Check whether an OWO account already uses this email.
            result = await pool.query(
                `SELECT id, name, email, phone, google_id
                 FROM users
                 WHERE LOWER(email) = LOWER($1)
                 LIMIT 1`,
                [email]
            );

            if (result.rows.length > 0) {
                customer = result.rows[0];

                if (
                    customer.google_id &&
                    customer.google_id !== googleId
                ) {
                    return redirectGoogleResult(res, {
                        google_error: "This email is linked to another Google account."
                    });
                }

                // Link the verified Google account to the existing user.
                await pool.query(
                    `UPDATE users
                     SET google_id = $1,
                         updated_at = NOW()
                     WHERE id = $2`,
                    [googleId, customer.id]
                );

            } else {
                // Create a new OWO customer account.
                const randomPassword = crypto.randomBytes(48).toString("hex");
                const passwordHash = await bcrypt.hash(randomPassword, 12);

                const newCustomer = await pool.query(
                    `INSERT INTO users
                        (name, email, phone, password_hash, google_id)
                     VALUES ($1, $2, NULL, $3, $4)
                     RETURNING id, name, email, phone, google_id`,
                    [name, email, passwordHash, googleId]
                );

                customer = newCustomer.rows[0];
            }
        }

        const token = generateCustomerToken(customer.id);

        return redirectGoogleResult(res, {
            google_token: token
        });

    } catch (error) {
        console.error("Google authentication error:", error);

        return redirectGoogleResult(res, {
            google_error: "Google sign-in failed. Please try again."
        });
    }
});

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

router.post("/login", customerLoginLimiter, async (req, res) => {
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
