require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();

pool.query(
  "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'nickname'"
)
  .then(r => {
    console.log('nickname column check:', r.rows);
    pool.end();
  })
  .catch(err => { console.error(err.message); pool.end(); });
