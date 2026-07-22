require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  // 1. Verify pgcrypto is installed
  const extCheck = await pool.query(
    "SELECT extname FROM pg_extension WHERE extname='pgcrypto';"
  );
  if (extCheck.rows.length === 0) {
    console.log('pgcrypto not found, installing...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    console.log('pgcrypto installed.');
  } else {
    console.log('pgcrypto already installed in:', extCheck.rows[0]);
  }

  // 2. Recreate uuid_generate_v7 function (now pgcrypto's gen_random_bytes is available)
  await pool.query(`
    CREATE OR REPLACE FUNCTION uuid_generate_v7()
    RETURNS UUID
    LANGUAGE plpgsql
    AS $$
    DECLARE
      unix_ms  BIGINT;
      hex_ms   TEXT;
      rand_a   TEXT;
      rand_b   TEXT;
    BEGIN
      unix_ms := EXTRACT(EPOCH FROM clock_timestamp())::BIGINT * 1000
                 + (EXTRACT(MILLISECONDS FROM clock_timestamp())::INTEGER % 1000);
      hex_ms  := LPAD(TO_HEX(unix_ms), 12, '0');
      rand_a  := LPAD(TO_HEX((('x' || ENCODE(gen_random_bytes(2), 'hex'))::BIT(16))::INTEGER), 3, '0');
      rand_b  := ENCODE(gen_random_bytes(8), 'hex');
      RETURN (
        SUBSTRING(hex_ms, 1, 8)  || '-' ||
        SUBSTRING(hex_ms, 9, 4)  || '-' ||
        '7' || SUBSTRING(rand_a, 1, 3) || '-' ||
        TO_HEX(((('x' || SUBSTRING(rand_b, 1, 2))::BIT(8)::INTEGER & 63) | 128)) ||
        SUBSTRING(rand_b, 3, 2)  || '-' ||
        SUBSTRING(rand_b, 5, 12)
      )::UUID;
    END;
    $$;
  `);
  console.log('uuid_generate_v7() function recreated.');

  // 3. Test it works
  const test = await pool.query('SELECT uuid_generate_v7() as id;');
  console.log('uuid_generate_v7() test result:', test.rows[0].id);

  console.log('All done! OTP login should work now.');
}

main().catch(e => console.error('Fatal error:', e.message)).finally(() => pool.end());
