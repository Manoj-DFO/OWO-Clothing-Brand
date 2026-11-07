
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const router = express.Router();

// Admin login
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (
            typeof username !== "string" ||
            typeof password !== "string" ||
            !username.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: "Please enter your username and password."
            });
        }

        const adminUsername = process.env.ADMIN_USERNAME;
        const passwordHash = process.env.ADMIN_PASSWORD_HASH;
        const jwtSecret = process.env.JWT_SECRET;

        if (!adminUsername || !passwordHash || !jwtSecret) {
            return res.status(503).json({
                message: "Admin authentication is not configured."
            });
        }

        const usernameMatches = username.trim() === adminUsername;
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
            { role: "admin", username: adminUsername },
            jwtSecret,
            { expiresIn: "8h" }
        );

        res.json({
            message: "Login successful.",
            token
        });

    } catch (error) {
        console.error("Admin login error:", error.message);

        res.status(500).json({
            message: "Unable to log in."
        });
    }
});

// Protect admin API routes
function requireAdmin(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Authentication required."
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (decoded.role !== "admin") {
            return res.status(403).json({
                message: "Admin access required."
            });
        }

        req.admin = decoded;
        next();

    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired login. Please log in again."
        });
    }
}

module.exports = {
    router,
    requireAdmin
};
