import jwt from "jsonwebtoken";

export function authenticateUser(req, res, next) {
    const authHeader = req.headers.authorization;

    // Check whether an authorization token was provided.
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "You must be logged in to perform this action."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured.");
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // Attach the authenticated user's ID to the request.
        req.userId = decoded.userId;

        next();

    } catch (error) {
        return res.status(401).json({
            message: "Your login session is invalid or has expired."
        });
    }
} 