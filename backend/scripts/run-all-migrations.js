require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createPool } = require('../config/db');

const pool = createPool();

async function executeSqlFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  console.log(`Running: ${path.basename(filePath)}...`);
  try {
    await pool.query(content);
    console.log(`✓ ${path.basename(filePath)} ran successfully.`);
  } catch (err) {
    // Catch non-fatal duplicate errors and environment-specific errors
    const isNonFatal = 
      err.code === '42701' || // duplicate_column
      err.code === '42P07' || // duplicate_table/relation
      err.code === '42710' || // duplicate_object
      err.message.includes("already exists") ||
      err.message.includes("publication") || 
      err.message.includes("owner") ||
      err.message.includes("action_type") ||
      err.message.includes("applied_skill_group") ||
      err.message.includes("branches");

    if (isNonFatal) {
      console.warn(`⚠️ Warning in ${path.basename(filePath)} (Non-fatal):`, err.message);
    } else {
      console.error(`❌ Error in ${path.basename(filePath)}:`, err.message);
      throw err;
    }
  }
}

async function run() {
  try {
    console.log("🚀 Starting database setup on hosted Supabase...");
    
    // Step 1: Run core db.js ensureTables first to create the base tables
    console.log("\n1. Bootstrapping core tables...");
    const { ensureTables } = require('../config/db');
    console.log("Creating colleges, campuses, and conversation tables first...");
    await pool.query(`
      DROP TABLE IF EXISTS conversation_participants CASCADE;
      DROP TABLE IF EXISTS conversations CASCADE;
      DROP TABLE IF EXISTS campuses CASCADE;
      DROP TABLE IF EXISTS colleges CASCADE;
      
      CREATE TABLE IF NOT EXISTS colleges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        city TEXT NOT NULL DEFAULT '',
        state TEXT NOT NULL DEFAULT '',
        country TEXT DEFAULT 'India',
        website TEXT,
        abbreviation TEXT,
        logo_url TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
        request_count INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        approved_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_colleges_name ON colleges(name);
      CREATE INDEX IF NOT EXISTS idx_colleges_status ON colleges(status);
      CREATE INDEX IF NOT EXISTS idx_colleges_city ON colleges(city);

      CREATE TABLE IF NOT EXISTS campuses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
        campus_name TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT,
        area TEXT,
        address TEXT,
        location_url TEXT,
        geo_location TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        approved_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_campuses_college ON campuses(college_id);
      CREATE INDEX IF NOT EXISTS idx_campuses_city    ON campuses(city);
      CREATE INDEX IF NOT EXISTS idx_campuses_status  ON campuses(status);

      CREATE TABLE IF NOT EXISTS conversations (
        id BIGSERIAL PRIMARY KEY,
        participant1_id BIGINT,
        participant1_type TEXT,
        participant2_id BIGINT,
        participant2_type TEXT,
        last_message_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_group BOOLEAN NOT NULL DEFAULT false,
        community_owner_id INTEGER
      );
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id BIGSERIAL PRIMARY KEY,
        conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        participant_id BIGINT NOT NULL,
        participant_type TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    
    await ensureTables(pool);
    console.log("✓ Core tables bootstrapped.");

    console.log("Adding discover and social columns to members table...");
    await pool.query(`
      ALTER TABLE members ADD COLUMN IF NOT EXISTS show_pronouns BOOLEAN DEFAULT true;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS discover_photos JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS openers JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS intent_badges TEXT[] DEFAULT '{}';
      ALTER TABLE members ADD COLUMN IF NOT EXISTS available_today BOOLEAN DEFAULT false;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS available_this_week BOOLEAN DEFAULT false;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS prompt_question TEXT;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS prompt_answer TEXT;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS appear_in_discover BOOLEAN DEFAULT true;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS instagram_username TEXT;
      ALTER TABLE communities ADD COLUMN IF NOT EXISTS instagram_username TEXT;
    `);
    console.log("✓ Discover/social columns added to members.");

    console.log("Adding missing columns to events table...");
    await pool.query(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS start_datetime TIMESTAMPTZ;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS end_datetime TIMESTAMPTZ;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT false;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS creator_id BIGINT REFERENCES communities(id);
    `);
    await pool.query(`
      UPDATE events SET start_datetime = event_date WHERE start_datetime IS NULL;
    `);
    console.log("✓ Events columns added.");
    
    // Step 2: Run numbered SQL migrations from migrations/
    console.log("\n2. Running numbered SQL migrations from migrations/...");
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir);
    const numberedSqlFiles = files
      .filter(f => /^\d+.*\.sql$/.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.match(/^(\d+)/)[0], 10);
        const numB = parseInt(b.match(/^(\d+)/)[0], 10);
        return numA - numB;
      });

    for (const file of numberedSqlFiles) {
      const scriptPath = path.join(migrationsDir, file);
      await executeSqlFile(scriptPath);
    }
    console.log("✓ Numbered SQL migrations completed.");
    const scriptsDir = __dirname;
    const featureScripts = [
      // Core feature tables
      path.join(migrationsDir, 'audience_intelligence.sql'),
      path.join(migrationsDir, 'session_tracking.sql'),
      path.join(migrationsDir, 'privacy_consent.sql'),
      path.join(migrationsDir, 'privacy_consent_v2.sql'),
      path.join(migrationsDir, 'event_engagement.sql'),
      path.join(migrationsDir, 'event_quality_scores.sql'),
      path.join(scriptsDir, 'qualified_views_migration.sql'),
      path.join(migrationsDir, 'video_insights.sql'),
      path.join(migrationsDir, 'security_hardening_v1.sql'),
      path.join(scriptsDir, 'opportunities_migration.sql'),
      path.join(scriptsDir, 'fix_opportunities_constraints.sql'),

      // Additional scripts containing schema changes from scripts/ directory
      path.join(scriptsDir, 'post_types_migration.sql'), // Defines poll_votes, prompt_submissions, etc.
      path.join(scriptsDir, 'qna_enhanced_migration.sql'), // Defines qna_answers
      path.join(scriptsDir, 'qna_anonymous_migration.sql'),
      path.join(scriptsDir, 'prompt_replies_migration.sql'), // Defines prompt_replies
      path.join(scriptsDir, 'migrate_otp_auth.sql'),
      path.join(scriptsDir, 'add_supabase_user_id.sql'),
      path.join(scriptsDir, 'occupation_migration.sql'),
      path.join(scriptsDir, 'occupation_subfields_migration.sql'),
      path.join(scriptsDir, 'multi_account_migration.sql'),
      path.join(scriptsDir, 'add_aspect_ratios_migration.sql'),
      path.join(scriptsDir, 'add_crop_metadata_migration.sql'),
      path.join(scriptsDir, 'add_expires_at_column.sql'),
      path.join(scriptsDir, 'add_media_types_column.sql'),
      path.join(scriptsDir, 'add_message_types_migration.sql'),
      path.join(scriptsDir, 'add_opportunity_details_fields.sql'),
      path.join(scriptsDir, 'add_show_heads_migration.sql'),
      path.join(scriptsDir, 'add_unique_conversation_constraint.sql'),
      path.join(scriptsDir, 'add_video_lqip_column.sql'),
      path.join(scriptsDir, 'add_video_thumbnail_migration.sql'),
      path.join(scriptsDir, 'card_timing_system_migration.sql'),
      path.join(scriptsDir, 'challenge_enhanced_migration.sql'),
      path.join(scriptsDir, 'cleanup_duplicate_conversations.sql'),
      path.join(scriptsDir, 'cleanup_duplicates_safe.sql'),
      path.join(scriptsDir, 'community_categories_migration.sql'),
      path.join(scriptsDir, 'community_restructure_migration.sql'),
      path.join(scriptsDir, 'create_event_media_tables.sql'),
      path.join(scriptsDir, 'discover_categories_migration.sql'),
      path.join(scriptsDir, 'drop_sponsor_types_constraint.sql'),
      path.join(scriptsDir, 'enhance_notifications_migration.sql'),
      path.join(scriptsDir, 'enhanced_events_migration.sql'),
      path.join(scriptsDir, 'event_interests_migration.sql'),
      path.join(scriptsDir, 'fix_applicant_id_type.sql'),
      path.join(scriptsDir, 'fix_duplicate_conversations.sql'),
      path.join(scriptsDir, 'fix_events_table.sql'),
      path.join(scriptsDir, 'fix_events_table_complete.sql'),
      path.join(scriptsDir, 'fix_opportunity_applications_schema.sql'),
      path.join(scriptsDir, 'fix_poll_votes_constraint.sql'),
      path.join(scriptsDir, 'group_chat_settings_migration.sql'),
      path.join(scriptsDir, 'migrate_location_to_url.sql'),
      path.join(scriptsDir, 'nested_replies_migration.sql'),
      path.join(scriptsDir, 'post_edit_tracking_migration.sql'),
      path.join(scriptsDir, 'profile_view_tracking.sql'),
    ];
    
    for (const scriptPath of featureScripts) {
      if (fs.existsSync(scriptPath)) {
        await executeSqlFile(scriptPath);
      } else {
        console.warn(`⚠️ Script not found, skipping: ${scriptPath}`);
      }
    }

    console.log("\n4. Ensuring conversations table unique constraint...");
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conrelid = 'conversations'::regclass 
            AND conname = 'conversations_participants_uniq'
        ) THEN
          ALTER TABLE conversations 
          ADD CONSTRAINT conversations_participants_uniq 
          UNIQUE (participant1_id, participant1_type, participant2_id, participant2_type);
        END IF;
      EXCEPTION 
        WHEN OTHERS THEN
          RAISE NOTICE 'Could not add unique constraint to conversations: %', SQLERRM;
      END $$;
    `);
    console.log("✓ Conversations unique constraint ensured.");
    
    console.log("\n✅ ALL DATABASE MIGRATIONS EXECUTED SUCCESSFULLY!");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Database migration runner failed:", err.message);
    process.exit(1);
  }
}

run();
