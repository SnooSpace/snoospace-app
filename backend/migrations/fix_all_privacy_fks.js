/**
 * fix_all_privacy_fks.js
 *
 * Fixes ALL privacy-related tables that have user_id FK → members only.
 * Applies to:
 *   ✅ user_privacy_consent         (already fixed)
 *   ✅ user_privacy_consent_audit   (already fixed in fix_privacy_consent_audit_fk.js)
 *   🔧 data_deletion_requests       (this migration)
 *
 * Also performs a discovery scan for any other tables in the privacy flow
 * that might have the same problem.
 *
 * Run: node backend/migrations/fix_all_privacy_fks.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');

const pool = createPool();

// Tables to fix — add any new ones discovered below
const TABLES_TO_FIX = [
  'data_deletion_requests',
];

const runMigration = async () => {
  console.log('\n🔧 Privacy FK Comprehensive Fix\n');

  // Discovery scan — find any table in the DB that has a members-only FK
  // and is related to privacy/consent
  const discoveryResult = await pool.query(`
    SELECT
      c.conrelid::regclass as table_name,
      c.conname,
      c.confrelid::regclass as target_table
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'members'::regclass
      AND c.conrelid::regclass::text ILIKE ANY (
        ARRAY['%privacy%', '%consent%', '%deletion%', '%audit%']
      )
    ORDER BY c.conrelid::regclass::text
  `);

  console.log('  Privacy-related tables with FK → members:');
  discoveryResult.rows.forEach(r => {
    console.log(`    ${r.table_name}.${r.conname} → ${r.target_table}`);
  });
  console.log('');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const tableName of TABLES_TO_FIX) {
      // Get the FK constraint name
      const fkResult = await client.query(`
        SELECT conname FROM pg_constraint
        WHERE conrelid = $1::regclass AND contype = 'f'
          AND confrelid = 'members'::regclass
      `, [tableName]);

      if (fkResult.rows.length === 0) {
        console.log(`  ⏭️  ${tableName} — no members FK found (already fixed or not applicable)`);
        continue;
      }

      for (const { conname } of fkResult.rows) {
        console.log(`  Dropping ${tableName}.${conname}...`);
        await client.query(`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS "${conname}"`);
        console.log(`  ✅ Dropped`);
      }

      // Add user_type CHECK if the table has a user_type column
      const colCheck = await client.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = $1 AND column_name = 'user_type'
      `, [tableName]);

      if (colCheck.rows.length > 0) {
        const checkName = `${tableName}_user_type_check`.substring(0, 63); // PG name limit
        await client.query(`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS "${checkName}"`);
        await client.query(`
          ALTER TABLE ${tableName}
            ADD CONSTRAINT "${checkName}"
            CHECK (user_type IN ('member', 'community', 'sponsor', 'venue'))
        `);
        console.log(`  ✅ user_type CHECK added to ${tableName}`);
      } else {
        console.log(`  ℹ️  ${tableName} has no user_type column — FK dropped only`);
      }
    }

    await client.query('COMMIT');

    // Final verification
    const afterResult = await pool.query(`
      SELECT
        c.conrelid::regclass as table_name,
        c.conname,
        c.confrelid::regclass as target_table
      FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.confrelid = 'members'::regclass
        AND c.conrelid::regclass::text ILIKE ANY (
          ARRAY['%privacy%', '%consent%', '%deletion%', '%audit%']
        )
      ORDER BY c.conrelid::regclass::text
    `);

    if (afterResult.rows.length === 0) {
      console.log('\n✅ All privacy tables now have no members-only FK constraint.');
    } else {
      console.log('\n⚠️  Remaining FK constraints on privacy tables:');
      afterResult.rows.forEach(r => console.log(`    ${r.table_name} → ${r.target_table}`));
    }

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
