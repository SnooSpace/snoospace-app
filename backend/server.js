const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { createPool, ensureTables } = require("./config/db");
const routes = require("./routes/index");

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = createPool();
pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
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
