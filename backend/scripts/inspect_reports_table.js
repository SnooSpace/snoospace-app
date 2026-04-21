require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const pool = createPool();

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fix status CHECK: drop old, add new with 'resolved'
    await client.query(`ALTER TABLE conversation_reports DROP CONSTRAINT IF EXISTS conversation_reports_status_check`);
    await client.query(`
      ALTER TABLE conversation_reports
      ADD CONSTRAINT conversation_reports_status_check
      CHECK (status IN ('pending', 'resolved', 'dismissed'))
    `);
    console.log('✓ Fixed status CHECK (now includes resolved)');

    // 2. Add reason CHECK
    await client.query(`ALTER TABLE conversation_reports DROP CONSTRAINT IF EXISTS conversation_reports_reason_check`);
    await client.query(`
      ALTER TABLE conversation_reports
      ADD CONSTRAINT conversation_reports_reason_check
      CHECK (reason IN ('spam','harassment','hate_speech','threats','inappropriate_content','other'))
    `);
    console.log('✓ Added reason CHECK');

    // 3. Add admin resolution columns if missing
    await client.query(`ALTER TABLE conversation_reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ`);
    await client.query(`ALTER TABLE conversation_reports ADD COLUMN IF NOT EXISTS resolved_by TEXT`);
    await client.query(`ALTER TABLE conversation_reports ADD COLUMN IF NOT EXISTS resolution_note TEXT`);
    console.log('✓ Ensured resolution columns exist');

    // 4. Unique index
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_reports_unique
      ON conversation_reports(conversation_id, reporter_id, reporter_type)
    `);
    console.log('✓ Unique index ensured');

    await client.query('COMMIT');
    console.log('\n✅ Migration applied successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}
main();
