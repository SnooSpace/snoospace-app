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

// ── DEV ONLY: Network latency simulation ─────────────────────────────────────
// Set SIMULATE_LATENCY_MS=2000 in .env to add artificial delay to every response.
// This lets you test scroll performance, loading states, and polling behaviour
// under "bad network" conditions without needing a real slow connection.
// Set to 0 or remove the variable to disable completely.
const SIMULATE_LATENCY_MS = parseInt(process.env.SIMULATE_LATENCY_MS || "0", 10);
if (SIMULATE_LATENCY_MS > 0) {
  console.log(`⚠️  [DEV] Latency simulation active: +${SIMULATE_LATENCY_MS}ms on every response`);
  app.use((_req, _res, next) => setTimeout(next, SIMULATE_LATENCY_MS));
}


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
