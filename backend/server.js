const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { createPool, ensureTables } = require("./config/db");
const routes = require("./routes/index");
const schedulerService = require("./services/schedulerService");
const { verifyRazorpaySignature, handleRazorpayWebhook } = require("./routes/webhooks");

const app = express();
app.use(cors());

// ⚠️ Razorpay webhook MUST be registered before express.json()
// Razorpay signs the raw request body — parsing it first breaks signature verification
app.post(
  "/webhooks/razorpay",
  express.raw({ type: "application/json" }),
  verifyRazorpaySignature,
  handleRazorpayWebhook,
);

app.use(express.json());

// PostgreSQL connection
const pool = createPool();
pool
  .connect()
  .then(() => {
    console.log("✅ Connected to PostgreSQL");
    // Initialize scheduler service after DB connection
    schedulerService.init(pool);
  })
  .catch((err) => console.error("❌ DB Connection Error", err));

// Expose pool to routes
app.locals.pool = pool;

// Ensure required tables exist
ensureTables(pool);

// Load routes
app.use("/", routes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
