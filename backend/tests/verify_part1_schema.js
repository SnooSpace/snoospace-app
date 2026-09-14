require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool, ensureTables } = require('../config/db');

async function testPart1() {
  const pool = createPool();
  try {
    console.log('--- Running ensureTables() ---');
    await ensureTables(pool);

    console.log('\n--- Checking ticket_types columns ---');
    const ttRes = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'ticket_types' AND column_name = 'access_mode';
    `);
    console.log('ticket_types.access_mode:', ttRes.rows[0]);

    console.log('\n--- Checking ticket_types CHECK constraints ---');
    const ttCheck = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'ticket_types'::regclass AND contype = 'c';
    `);
    console.log('ticket_types CHECKs:', ttCheck.rows);

    console.log('\n--- Checking events columns ---');
    const evRes = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'events' AND column_name IN ('allow_tier_switching', 'allow_downgrade_refunds');
    `);
    console.log('events columns:', evRes.rows);

    console.log('\n--- Testing CHECK constraint rejection on invalid access_mode ---');
    let threw = false;
    try {
      await pool.query(`
        INSERT INTO ticket_types (event_id, name, access_mode)
        VALUES (1, '__invalid_test__', 'invalid_mode');
      `);
    } catch (err) {
      threw = true;
      console.log('Expected error caught:', err.message);
    }
    if (!threw) {
      throw new Error('Expected invalid access_mode to be rejected by CHECK constraint!');
    }

    console.log('\n✅ PART 1 SCHEMA MIGRATION VERIFIED SUCCESSFULLY');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testPart1();
