
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const router = express.Router();

const TOKEN_EXPIRY = "8h";

// ===================================
// JWT CONFIGURATION
// ===================================

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
        throw new Error(
            "JWT_SECRET must contain at least 32 characters."
        );
    }

    return secret;
}

// ===================================
// ADMIN LOGIN
// ===================================

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (
            typeof username !== "string" ||
            typeof password !== "string" ||
            !username.trim() ||
            !password ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                message: "Please enter a valid username and password."
            });
        }

        const adminUsername = process.env.ADMIN_USERNAME;
        const passwordHash = process.env.ADMIN_PASSWORD_HASH;

        if (!adminUsername || !passwordHash) {
            return res.status(503).json({
                message: "Admin authentication is not configured."
            });
        }

        const secret = getJwtSecret();

        const usernameMatches =
            username.trim() === adminUsername;

        const passwordMatches = await bcrypt.compare(
            password,
            passwordHash
        );

        if (!usernameMatches || !passwordMatches) {
            return res.status(401).json({
                message: "Invalid username or password."
            });
        }

        const token = jwt.sign(
            {
                role: "admin",
                username: adminUsername
            },
            secret,
            {
                expiresIn: TOKEN_EXPIRY,
                algorithm: "HS256"
            }
        );

        return res.json({
            message: "Login successful.",
            token
        });

    } catch (error) {
        console.error("Admin login error:", error);

        return res.status(500).json({
            message: "Unable to log in."
        });
    }
});

// ===================================
// ADMIN AUTHENTICATION MIDDLEWARE
// ===================================

function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;

    if (typeof authHeader !== "string") {
        return res.status(401).json({
            message: "Authentication required."
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

        if (
            decoded.role !== "admin" ||
            typeof decoded.username !== "string" ||
            decoded.username !== process.env.ADMIN_USERNAME
        ) {
            return res.status(403).json({
                message: "Admin access required."
            });
        }

        req.admin = decoded;

        return next();

    } catch (error) {
        if (error.message.startsWith("JWT_SECRET")) {
            console.error("Admin JWT configuration error:", error);

            return res.status(500).json({
                message: "Authentication service is not configured."
            });
        }

        return res.status(401).json({
            message: "Invalid or expired login. Please log in again."
        });
    }
}

// ===================================
// EXPORT
// ===================================

module.exports = {
    router,
    requireAdmin
};
