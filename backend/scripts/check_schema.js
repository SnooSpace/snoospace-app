require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const pool = createPool();

pool.query(`
  SELECT conname, confrelid::regclass as target_table
  FROM pg_constraint
  WHERE conrelid = 'data_deletion_requests'::regclass
  AND contype = 'f'
`).then(r => {
  console.log('FKs on data_deletion_requests:', JSON.stringify(r.rows));
}).catch(e => {
  if (e.message.includes('does not exist')) {
    console.log('data_deletion_requests table does not exist yet');
  } else {
    console.error(e.message);
  }
}).finally(() => pool.end());
