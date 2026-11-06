import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import countryRoutes from "./routes/countryRoutes.js";
import gameRoutes from "./routes/gameRoutes.js";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();

const app = express();

// Middleware
const allowedOrigins = [
    "http://localhost:5173",
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {

        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }

    }
}));
app.use(express.json());

// Routes
app.use("/api/countries", countryRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/auth", authRoutes);

// Test route
app.get("/", (req, res) => {
    res.json({
        message: "Geopolitics Game API is running!"
    });
});

// Check database connection status
app.get("/api/health", (req, res) => {
    res.json({
        server: "Running",
        database: mongoose.connection.readyState === 1
            ? "Connected"
            : "Disconnected"
    });
});

// Start the server independently of MongoDB
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});

// Attempt MongoDB connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully!");
    })
    .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    console.error("Error name:", error.name);
    console.error("Error code:", error.code);

    if (error.reason) {
        console.error("Error reason:", error.reason);
    }

    console.log("Continuing without database connection for now.");
});
    