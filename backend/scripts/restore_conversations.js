const fs = require('fs');
const readline = require('readline');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function restore() {
  const pool = createPool();
  try {
    console.log('🚀 Starting surgical database restoration...');

    // 1. Map old member ID 3 messages to new member ID 51 (Harshith S Gowda)
    console.log('\nStep 1: Mapping developer test messages (sender_id 3 -> 51)...');
    const updateResult = await pool.query(`
      UPDATE messages 
      SET sender_id = 51 
      WHERE sender_id = 3 AND sender_type = 'member'
    `);
    console.log(`Updated ${updateResult.rowCount} message records.`);

    // 2. Parse and insert conversations/participants from local_data.sql
    console.log('\nStep 2: Parsing local_data.sql and restoring tables...');
    const dumpPath = path.join(__dirname, '../local_data.sql');
    if (!fs.existsSync(dumpPath)) {
      throw new Error(`local_data.sql not found at ${dumpPath}`);
    }

    const fileStream = fs.createReadStream(dumpPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let convRestored = 0;
    let partRestored = 0;

    for await (const line of rl) {
      if (line.startsWith('INSERT INTO public.conversations ')) {
        // Rewrite insert statement to handle conflicts on id
        // e.g., INSERT INTO public.conversations ... VALUES (...) ON CONFLICT (id) DO NOTHING;
        let query = line.trim();
        if (query.endsWith(';')) {
          query = query.slice(0, -1);
        }
        query += ' ON CONFLICT (id) DO NOTHING;';
        await pool.query(query);
        convRestored++;
      } else if (line.startsWith('INSERT INTO public.conversation_participants ')) {
        let query = line.trim();
        if (query.endsWith(';')) {
          query = query.slice(0, -1);
        }
        query += ' ON CONFLICT (id) DO NOTHING;';
        await pool.query(query);
        partRestored++;
      }
    }
    console.log(`Restored ${convRestored} conversations and ${partRestored} participants records from SQL dump (idempotent).`);

    // 3. Merge conversation 57 messages into conversation 42 (matching participants 51 and 52)
    console.log('\nStep 3: Merging conversation 57 messages into existing conversation 42...');
    const mergeResult = await pool.query(`
      UPDATE messages 
      SET conversation_id = 42 
      WHERE conversation_id = 57
    `);
    console.log(`Merged ${mergeResult.rowCount} messages from conversation 57 into conversation 42.`);

    // 4. Verify that no messages are orphaned before recreating the foreign key
    console.log('\nStep 4: Verifying there are zero orphaned messages remaining...');
    const orphanCheck = await pool.query(`
      SELECT COUNT(*)::int as count 
      FROM messages m
      LEFT JOIN conversations c ON m.conversation_id = c.id
      WHERE c.id IS NULL
    `);
    
    const orphanCount = orphanCheck.rows[0].count;
    console.log(`Orphaned messages count: ${orphanCount}`);

    if (orphanCount > 0) {
      const orphans = await pool.query(`
        SELECT DISTINCT conversation_id FROM messages m
        LEFT JOIN conversations c ON m.conversation_id = c.id
        WHERE c.id IS NULL
      `);
      console.error('⚠️ Warning: Still found orphaned conversation IDs:', orphans.rows.map(r => r.conversation_id));
      throw new Error(`Cannot add foreign key constraint: ${orphanCount} orphaned messages remain.`);
    }

    // 5. Re-create the foreign key constraint
    console.log('\nStep 5: Restoring the foreign key constraint on the messages table...');
    
    // Check if the constraint already exists
    const constraintCheck = await pool.query(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conrelid = 'messages'::regclass 
        AND conname = 'messages_conversation_id_fkey'
    `);

    if (constraintCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE messages 
        ADD CONSTRAINT messages_conversation_id_fkey 
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) 
        ON DELETE CASCADE;
      `);
      console.log('✅ Foreign key constraint messages_conversation_id_fkey added successfully.');
    } else {
      console.log('ℹ️ Foreign key constraint messages_conversation_id_fkey already exists. Skipping.');
    }

    console.log('\n🎉 SURGICAL DATABASE RESTORATION COMPLETED SUCCESSFULLY!');

  } catch (err) {
    console.error('\n❌ Restoration failed:', err.message);
  } finally {
    await pool.end();
  }
}

restore();
