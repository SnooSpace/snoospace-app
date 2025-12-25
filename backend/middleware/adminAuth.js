const jwt = require("jsonwebtoken");
const { createPool } = require("../config/db");

const pool = createPool();
const JWT_SECRET =
  process.env.JWT_SECRET || "your-admin-jwt-secret-change-in-production";

/**
 * Admin authentication middleware
 * Validates JWT tokens for admin routes
 */
const adminAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if it's an admin token
    if (decoded.type !== "admin") {
      return res.status(403).json({ error: "Not an admin token" });
    }

    // Verify admin still exists and is active
    const result = await pool.query(
      "SELECT id, email, name, role, is_active FROM admins WHERE id = $1",
      [decoded.id]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res
        .status(401)
        .json({ error: "Admin account not found or inactive" });
    }

    // Attach admin to request
    req.admin = result.rows[0];
    next();
  } catch (error) {
    console.error("Admin auth error:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }

    res.status(401).json({ error: "Invalid or expired token" });
  }
};

module.exports = { adminAuthMiddleware };
