/**
 * fix_sequence.js
 * Script to fix sequence out-of-sync issues for PostgreSQL tables.
 */
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

async function run() {
  const client = await pool.connect();
  try {
    console.log('Checking and fixing database sequences...');
    
    // Fix posts sequence
    const maxPostRes = await client.query('SELECT MAX(id) FROM posts');
    const maxPostId = maxPostRes.rows[0].max;
    console.log(`Max post ID currently in database: ${maxPostId}`);
    
    if (maxPostId) {
      await client.query(`SELECT setval('posts_id_seq', $1)`, [parseInt(maxPostId, 10)]);
      console.log(`✅ Reset posts_id_seq to ${maxPostId}`);
    }

    // Fix promote_quotas sequence
    const maxQuotaRes = await client.query('SELECT MAX(id) FROM promote_quotas');
    const maxQuotaId = maxQuotaRes.rows[0].max;
    console.log(`Max quota ID currently in database: ${maxQuotaId}`);
    if (maxQuotaId) {
      await client.query(`SELECT setval('promote_quotas_id_seq', $1)`, [parseInt(maxQuotaId, 10)]);
      console.log(`✅ Reset promote_quotas_id_seq to ${maxQuotaId}`);
    }

    console.log('✅ Sequences successfully synchronised.');
  } catch (err) {
    console.error('❌ Failed to sync sequences:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
