require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();

async function inspect() {
  const client = await pool.connect();
  try {
    // Events table columns
    const ev = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'events' ORDER BY ordinal_position`
    );
    console.log('=== events columns ===');
    ev.rows.forEach(r => console.log(` ${r.column_name} (${r.data_type})`));

    // event_registrations columns
    const er = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'event_registrations' ORDER BY ordinal_position`
    );
    console.log('\n=== event_registrations columns ===');
    er.rows.forEach(r => console.log(` ${r.column_name} (${r.data_type})`));

    // user_aqi_signals columns relevant to scoring
    const aqi = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'user_aqi_signals' ORDER BY ordinal_position`
    );
    console.log('\n=== user_aqi_signals columns ===');
    aqi.rows.forEach(r => console.log(` ${r.column_name}`));

    // follow_events table check
    const fe = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'follow_events' ORDER BY ordinal_position`
    );
    console.log('\n=== follow_events columns ===');
    fe.rows.forEach(r => console.log(` ${r.column_name}`));

    // posts table — how does it link to events?
    const po = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'posts' AND column_name LIKE '%event%' ORDER BY ordinal_position`
    );
    console.log('\n=== posts event-related columns ===');
    po.rows.forEach(r => console.log(` ${r.column_name}`));

    // user_behavior_events - check event_type values for post_event_echo
    const ube = await client.query(
      `SELECT DISTINCT event_type FROM user_behavior_events LIMIT 30`
    );
    console.log('\n=== user_behavior_events - event_type values ===');
    ube.rows.forEach(r => console.log(` ${r.event_type}`));

  } finally {
    client.release();
    pool.end();
  }
}

inspect().catch(e => { console.error(e.message); process.exit(1); });
