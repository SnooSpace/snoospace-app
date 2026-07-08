require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createPool } = require('../config/db');

const pool = createPool();

async function run() {
  console.log("Updating discover (event) categories in database...");
  const sqlPath = path.join(__dirname, 'discover_categories_migration.sql');
  
  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found at ${sqlPath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  try {
    await pool.query(sqlContent);
    console.log("✅ Discover (event) categories successfully updated in database!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to update discover categories in database:", err.message);
    process.exit(1);
  }
}

run();
