require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const p = createPool();

async function run() {
  // Check members constraints
  const cRes = await p.query(`
    SELECT conname, contype, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    WHERE conrelid = 'members'::regclass
    ORDER BY contype
  `);
  console.log('=== MEMBERS CONSTRAINTS ===');
  cRes.rows.forEach(c => console.log(c.contype + ': ' + c.conname + ' -> ' + c.def));
  
  // Check what IDs are in Supabase but NOT what was dumped - to understand the gap
  const mRes = await p.query('SELECT id, name, email FROM members ORDER BY id');
  console.log('\n=== ALL MEMBERS IN SUPABASE ===');
  mRes.rows.forEach(m => console.log(`  id=${m.id} name=${m.name} email=${m.email}`));

  // Check communities  
  const comRes = await p.query('SELECT id, name FROM communities ORDER BY id');
  console.log('\n=== ALL COMMUNITIES IN SUPABASE ===');
  comRes.rows.forEach(c => console.log(`  id=${c.id} name=${c.name}`));
  
  // Check events
  const evRes = await p.query('SELECT id, title, status FROM events ORDER BY id');
  console.log('\n=== ALL EVENTS IN SUPABASE ===');
  evRes.rows.forEach(e => console.log(`  id=${e.id} title=${e.title} status=${e.status}`));

  await p.end();
}
run().catch(e => { console.error(e.message); p.end(); });
