require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();

pool.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_sessions' ORDER BY ordinal_position"
)
  .then(r => {
    console.log('user_sessions columns:', r.rows.map(r => r.column_name));
    pool.end();
  })
  .catch(err => { console.error(err.message); pool.end(); });
