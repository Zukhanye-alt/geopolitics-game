import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

// Register a new user.
router.post("/register", async (req, res) => {

    try {

        const { username, email, password } = req.body;

        // Check that all fields were provided.
        if (
            typeof username !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !username.trim() ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: "Please provide a valid username, email and password."
            });
        } 

        // Validate username.
        if (username.trim().length < 3) {
            return res.status(400).json({
                message: "Username must contain at least 3 characters."
            });
        }

        // Validate email.
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {
            return res.status(400).json({
                message: "Please provide a valid email address."
            });
        }

        // Validate password.
        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must contain at least 8 characters."
            });
        }

        // Check whether the username or email already exists.
        const existingUser = await User.findOne({
            $or: [
                { username: username.trim() },
                { email: email.toLowerCase().trim() }
            ]
        });

        if (existingUser) {
            return res.status(409).json({
                message: "Username or email is already registered."
            });
        }

        // Hash the password.
        const passwordHash = await bcrypt.hash(password, 12);

        // Create the user.
        const user = await User.create({
            username: username.trim(),
            email: email.toLowerCase().trim(),
            passwordHash
        });

        res.status(201).json({
            message: "Account created successfully!",
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {

        console.error("Registration error:", error);

        res.status(500).json({
            message: "Could not register user."
        });

    }

});

// Log in an existing user.
router.post("/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Please provide your email and password."
            });
        }

        // Find the user and include their password hash.
        const user = await User.findOne({
            email: email.toLowerCase().trim()
        }).select("+passwordHash");

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        // Compare the supplied password with the stored hash.
        const passwordMatches = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        // Ensure the JWT secret exists.
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured.");
        }

        // Generate an authentication token.
        const token = jwt.sign(
            {
                userId: user._id.toString()
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.json({
            message: "Login successful!",
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {

        console.error("Login error:", error);

        res.status(500).json({
            message: "Could not log in."
        });

    }

});

export default router;
