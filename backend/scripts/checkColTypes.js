require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const p = createPool();
async function run() {
  const { rows } = await p.query(`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'user_aqi_signals'
      AND is_nullable = 'NO'
    ORDER BY ordinal_position
  `);
  console.log('NOT NULL columns in user_aqi_signals (no default or null default):');
  rows.filter(r => !r.column_default || r.column_default === 'null').forEach(r =>
    console.log(`  ${r.column_name} | default=${r.column_default}`)
  );
  console.log('\nAll NOT NULL:');
  rows.forEach(r => console.log(`  ${r.column_name} | default=${r.column_default}`));
  await p.end();
}
run().catch(e => { console.error(e.message); p.end(); });
