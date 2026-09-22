require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();

async function run() {
  const ev = await pool.query("SELECT * FROM events WHERE id = 180");
  console.log('Event 180:', JSON.stringify(ev.rows[0], null, 2));
  const tt = await pool.query("SELECT * FROM ticket_types WHERE event_id = 180");
  console.log('Tickets 180:', JSON.stringify(tt.rows, null, 2));
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
