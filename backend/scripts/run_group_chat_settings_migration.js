/**
 * Migration: add community_owner_id + community_auto_join to conversations
 * Run: node scripts/run_group_chat_settings_migration.js
 */

const { createPool } = require('../config/db');
const pool = createPool();

async function run() {
  try {
    console.log('Starting migration: group_chat_settings');

    console.log('Step 1: Adding community_owner_id column...');
    await pool.query(`
      ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS community_owner_id INTEGER REFERENCES communities(id) ON DELETE SET NULL;
    `);
    console.log('✓ community_owner_id column added');

    console.log('Step 2: Ensuring community_auto_join column exists...');
    await pool.query(`
      ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS community_auto_join BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    console.log('✓ community_auto_join column ready');

    console.log('Step 3: Backfilling community_owner_id from existing admins...');
    const backfill = await pool.query(`
      UPDATE conversations c
      SET community_owner_id = cp.participant_id
      FROM conversation_participants cp
      WHERE cp.conversation_id = c.id
        AND cp.participant_type = 'community'
        AND cp.role = 'admin'
        AND c.is_group = TRUE
        AND c.community_owner_id IS NULL
      RETURNING c.id
    `);
    console.log(`✓ Backfilled ${backfill.rowCount} group conversations`);

    console.log('Step 4: Creating index on community_owner_id...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_community_owner_id
        ON conversations(community_owner_id)
        WHERE community_owner_id IS NOT NULL;
    `);
    console.log('✓ Index created');

    // Also make sure createGroupConversation sets community_owner_id going forward.
    // (That is handled in the controller code — this is just a DB schema migration.)

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

run();
