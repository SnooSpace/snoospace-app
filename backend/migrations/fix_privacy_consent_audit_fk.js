/**
 * fix_privacy_consent_audit_fk.js
 *
 * Same fix as fix_privacy_consent_fk.js but for the audit table.
 * user_privacy_consent_audit.user_id also has a FK to `members` only,
 * which causes every community consent save to fail with FK violation
 * at the audit INSERT step (line ~142 in privacyController.js).
 *
 * Run: node backend/migrations/fix_privacy_consent_audit_fk.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');

const pool = createPool();

const runMigration = async () => {
  console.log('\n🔧 Privacy Consent Audit Table FK Migration\n');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop the members-only FK on the audit table
    console.log('  Dropping members-only FK on user_privacy_consent_audit...');
    await client.query(`
      ALTER TABLE user_privacy_consent_audit
        DROP CONSTRAINT IF EXISTS user_privacy_consent_audit_user_id_fkey
    `);
    console.log('  ✅ Old FK dropped');

    // Add user_type CHECK to audit table as well
    console.log('  Adding user_type CHECK constraint to audit table...');
    await client.query(`
      ALTER TABLE user_privacy_consent_audit
        DROP CONSTRAINT IF EXISTS user_privacy_consent_audit_user_type_check
    `);
    await client.query(`
      ALTER TABLE user_privacy_consent_audit
        ADD CONSTRAINT user_privacy_consent_audit_user_type_check
        CHECK (user_type IN ('member', 'community', 'sponsor', 'venue'))
    `);
    console.log('  ✅ user_type CHECK constraint added to audit table');

    await client.query('COMMIT');

    console.log('\n✅ Audit table migration complete');
    console.log('   Community consent saves will no longer fail at the audit INSERT step.\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed — rolled back:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

runMigration().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
