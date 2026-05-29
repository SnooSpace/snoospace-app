require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();

async function verify() {
  const client = await pool.connect();
  try {
    // Check aqi_sessions table
    const s1 = await client.query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'aqi_sessions'"
    );
    console.log('aqi_sessions exists:', s1.rows[0].count === '1' ? 'YES' : 'NO');

    // Check aqi_session_stats table
    const s2 = await client.query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'aqi_session_stats'"
    );
    console.log('aqi_session_stats exists:', s2.rows[0].count === '1' ? 'YES' : 'NO');

    // Check new columns in user_aqi_signals
    const s3 = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_aqi_signals' AND column_name IN ('return_frequency_score', 'session_depth_score') ORDER BY column_name"
    );
    console.log('New AQI columns:', s3.rows.map(r => r.column_name));

    console.log('\nVerification complete!');
  } finally {
    client.release();
    pool.end();
  }
}

verify().catch(err => { console.error(err.message); process.exit(1); });
