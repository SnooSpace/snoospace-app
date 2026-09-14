require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();

async function run() {
  const client = await pool.connect();
  try {
    console.log('=== 1. TICKET_TYPES SCHEMA ===');
    const ttCols = await client.query(`
      SELECT ordinal_position, column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'ticket_types' 
      ORDER BY ordinal_position;
    `);
    ttCols.rows.forEach(r => console.log(`${r.ordinal_position}. ${r.column_name} | ${r.data_type} | default: ${r.column_default} | nullable: ${r.is_nullable}`));

    console.log('\n=== 2. EVENTS SCHEMA (LOCATION & VIRTUAL RELATED COLUMNS) ===');
    const evCols = await client.query(`
      SELECT column_name, data_type, udt_name, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'events'
      AND (
        column_name LIKE '%event_type%'
        OR column_name LIKE '%access%'
        OR column_name LIKE '%virtual%'
        OR column_name LIKE '%meeting%'
        OR column_name LIKE '%venue%'
        OR column_name LIKE '%location%'
        OR column_name LIKE '%address%'
        OR column_name LIKE '%city%'
        OR column_name LIKE '%state%'
        OR column_name LIKE '%postal%'
        OR column_name LIKE '%country%'
        OR column_name LIKE '%latitude%'
        OR column_name LIKE '%longitude%'
        OR column_name LIKE '%hide_address%'
      )
      ORDER BY ordinal_position;
    `);
    console.log(JSON.stringify(evCols.rows, null, 2));

    console.log('\n=== 3. CHECK CONSTRAINTS ON events AND ticket_types ===');
    const constraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid IN ('events'::regclass, 'ticket_types'::regclass);
    `);
    console.log(JSON.stringify(constraints.rows, null, 2));

    console.log('\n=== 4. DISTINCT event_type VALUES IN events ===');
    const distinctTypes = await client.query(`
      SELECT event_type, access_type, COUNT(*) 
      FROM events 
      GROUP BY event_type, access_type;
    `);
    console.log(JSON.stringify(distinctTypes.rows, null, 2));

    console.log('\n=== HYBRID EVENTS IN DB ===');
    const hybridEvents = await client.query(`
      SELECT id, title, event_type, access_type, venue_name, location_name, location, location_url,
             address_line1, city, meeting_platform, meeting_link, meeting_password, virtual_link
      FROM events
      WHERE event_type = 'hybrid';
    `);
    console.log(JSON.stringify(hybridEvents.rows, null, 2));

    if (hybridEvents.rows.length > 0) {
      const eventIds = hybridEvents.rows.map(e => e.id);
      console.log('\n=== TICKETS FOR HYBRID EVENTS ===');
      const tickets = await client.query(`
        SELECT * FROM ticket_types WHERE event_id = ANY($1)
      `, [eventIds]);
      console.log(JSON.stringify(tickets.rows, null, 2));
    }

  } finally {
    client.release();
    pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
