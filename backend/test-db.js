require('dotenv').config();
const { Pool } = require('pg');

const host = "aws-1-ap-south-1.pooler.supabase.com";
const password = process.env.DB_PASS;

const combinations = [
  { user: "postgres", port: 5432, label: "user=postgres, port=5432" },
  { user: "postgres", port: 6543, label: "user=postgres, port=6543" },
  { user: "postgres.ujtoywnkodshtprqojap", port: 5432, label: "user=postgres.ujtoywnkodshtprqojap, port=5432" },
  { user: "postgres.ujtoywnkodshtprqojap", port: 6543, label: "user=postgres.ujtoywnkodshtprqojap, port=6543" },
];

async function runTests() {
  console.log("Starting systematic pooler tests...");
  console.log(`Using password: ${password ? password[0] + "..." + password[password.length - 1] : "none"}`);
  
  for (const combo of combinations) {
    console.log(`\nTesting: ${combo.label}...`);
    const pool = new Pool({
      host: host,
      port: combo.port,
      user: combo.user,
      database: "postgres",
      password: password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    
    try {
      const res = await pool.query("SELECT NOW()");
      console.log(`✅ SUCCESS for ${combo.label}! Server time: ${res.rows[0].now}`);
    } catch (err) {
      console.log(`❌ FAILED for ${combo.label}. Error: ${err.message}`);
    } finally {
      await pool.end();
    }
  }
  process.exit();
}

runTests();
