const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Pool } = require('pg');

// Use port 6543 Transaction Pooler from .env
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '6543', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function run() {
  try {
    const sqlPath = path.join(__dirname, 'local_data_import_ready.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error('❌ local_data_import_ready.sql not found! Please run wrap_dump.js or pg_dump first.');
      process.exit(1);
    }
    
    console.log('📖 Reading local_data_import_ready.sql...');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🔌 Connecting to hosted Supabase...');
    const client = await pool.connect();
    
    let cleanedSql = '';
    try {
      // Query existing sequences in the public schema
      const seqResult = await client.query(`
        SELECT c.relname AS seq_name 
        FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE c.relkind = 'S' AND n.nspname = 'public'
      `);
      const existingSequences = new Set(seqResult.rows.map(r => r.seq_name));
      console.log(`Found ${existingSequences.size} sequences in public schema.`);

      // Clean the SQL content
      cleanedSql = sql.split('\n').map(line => {
        const match = line.match(/SELECT pg_catalog\.setval\('(?:public\.)?([^']+)'/i);
        if (match) {
          const seqName = match[1];
          if (!existingSequences.has(seqName)) {
            return `-- Ignored missing sequence: ${seqName}`;
          }
        }
        return line;
      }).join('\n');

      console.log('Ensure communities columns exist and drop legacy NOT NULL constraints...');
      await client.query(`
        ALTER TABLE communities
          ADD COLUMN IF NOT EXISTS user_id BIGINT,
          ALTER COLUMN email DROP NOT NULL,
          ALTER COLUMN phone DROP NOT NULL,
          ALTER COLUMN location DROP NOT NULL,
          ALTER COLUMN sponsor_types DROP NOT NULL
      `);

      console.log('Fix communities phone constraint...');
      await client.query(`
        ALTER TABLE communities DROP CONSTRAINT IF EXISTS phone_10_digits_comm;
        ALTER TABLE communities ADD CONSTRAINT phone_10_digits_comm CHECK (phone IS NULL OR phone ~ '^\\d{10}$');
      `);

      console.log('Ensure community_heads columns exist...');
      await client.query(`
        ALTER TABLE community_heads
          ADD COLUMN IF NOT EXISTS title TEXT,
          ADD COLUMN IF NOT EXISTS description TEXT,
          ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS show_on_profile BOOLEAN DEFAULT true
      `);

      console.log('Ensure events columns exist...');
      await client.query(`
        ALTER TABLE events 
          ADD COLUMN IF NOT EXISTS slug TEXT,
          ADD COLUMN IF NOT EXISTS sub_category TEXT,
          ADD COLUMN IF NOT EXISTS timezone TEXT,
          ADD COLUMN IF NOT EXISTS venue_name TEXT,
          ADD COLUMN IF NOT EXISTS address_line1 TEXT,
          ADD COLUMN IF NOT EXISTS address_line2 TEXT,
          ADD COLUMN IF NOT EXISTS city TEXT,
          ADD COLUMN IF NOT EXISTS state TEXT,
          ADD COLUMN IF NOT EXISTS postal_code TEXT,
          ADD COLUMN IF NOT EXISTS country TEXT,
          ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
          ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
          ADD COLUMN IF NOT EXISTS hide_address_until_rsvp BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS meeting_platform TEXT,
          ADD COLUMN IF NOT EXISTS meeting_link TEXT,
          ADD COLUMN IF NOT EXISTS meeting_password TEXT,
          ADD COLUMN IF NOT EXISTS banner_images JSONB,
          ADD COLUMN IF NOT EXISTS min_age INTEGER,
          ADD COLUMN IF NOT EXISTS max_age INTEGER,
          ADD COLUMN IF NOT EXISTS guest_list_visibility TEXT,
          ADD COLUMN IF NOT EXISTS allow_queries BOOLEAN DEFAULT true,
          ADD COLUMN IF NOT EXISTS status TEXT,
          ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS creator_type TEXT,
          ADD COLUMN IF NOT EXISTS category TEXT
      `);

      console.log('Ensure challenge_submissions columns exist...');
      await client.query(`
        ALTER TABLE challenge_submissions
          ADD COLUMN IF NOT EXISTS view_count  INT NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS share_count INT NOT NULL DEFAULT 0
      `);

      console.log('Drop NOT NULL constraint on prompt_submissions content column...');
      await client.query(`
        ALTER TABLE prompt_submissions ALTER COLUMN content DROP NOT NULL
      `);

      console.log('Ensure conversation_reports legacy and renamed columns exist...');
      await client.query(`
        ALTER TABLE conversation_reports
          ADD COLUMN IF NOT EXISTS admin_note TEXT,
          ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS resolution_note TEXT,
          ADD COLUMN IF NOT EXISTS resolved_by TEXT
      `);

      console.log('Ensure opportunities columns exist...');
      await client.query(`
        ALTER TABLE opportunities
          ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS save_count INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS requires_resume BOOLEAN DEFAULT false
      `);

      console.log('Ensure user_aqi_signals device columns exist...');
      await client.query(`
        ALTER TABLE user_aqi_signals
          ADD COLUMN IF NOT EXISTS device_platform TEXT,
          ADD COLUMN IF NOT EXISTS device_brand TEXT,
          ADD COLUMN IF NOT EXISTS device_model_raw TEXT,
          ADD COLUMN IF NOT EXISTS device_tier TEXT
      `);

      console.log('Ensure sessions device columns exist...');
      await client.query(`
        ALTER TABLE sessions
          ADD COLUMN IF NOT EXISTS platform TEXT,
          ADD COLUMN IF NOT EXISTS os_version TEXT,
          ADD COLUMN IF NOT EXISTS device_model TEXT,
          ADD COLUMN IF NOT EXISTS device_brand TEXT,
          ADD COLUMN IF NOT EXISTS device_tier TEXT
      `);

      console.log('Ensure challenge_submission_views table exists...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS challenge_submission_views (
          id            BIGSERIAL PRIMARY KEY,
          submission_id BIGINT NOT NULL REFERENCES challenge_submissions(id) ON DELETE CASCADE,
          viewer_id     BIGINT NOT NULL,
          viewer_type   TEXT   NOT NULL,
          viewed_at     TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(submission_id, viewer_id, viewer_type)
        )
      `);

      console.log('Ensure comment_likes table exists...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS comment_likes (
          id SERIAL PRIMARY KEY,
          comment_id INTEGER NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
          liker_id INTEGER NOT NULL,
          liker_type VARCHAR(20) NOT NULL CHECK (liker_type IN ('member', 'community', 'sponsor', 'venue')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(comment_id, liker_id, liker_type)
        )
      `);

      console.log('Ensure challenge_submission_comments table exists...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS challenge_submission_comments (
          id          BIGSERIAL PRIMARY KEY,
          submission_id BIGINT NOT NULL REFERENCES challenge_submissions(id) ON DELETE CASCADE,
          author_id   BIGINT NOT NULL,
          author_type TEXT NOT NULL CHECK (author_type IN ('member', 'community')),
          comment_text TEXT NOT NULL,
          created_at  TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      console.log('Ensure event_cohosts table exists...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS event_cohosts (
          id          BIGSERIAL PRIMARY KEY,
          event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          cohost_id   BIGINT NOT NULL,
          cohost_type TEXT NOT NULL CHECK (cohost_type IN ('member', 'community')),
          status      TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'declined')),
          invited_by  BIGINT,
          message     TEXT,
          created_at  TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(event_id, cohost_id, cohost_type)
        )
      `);

      console.log('Ensure opportunity engagement and comments tables exist...');

      await client.query(`
        CREATE TABLE IF NOT EXISTS opportunity_comments (
          id            SERIAL PRIMARY KEY,
          opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
          commenter_id   INTEGER NOT NULL,
          commenter_type VARCHAR(20) NOT NULL CHECK (commenter_type IN ('member','community','sponsor','venue')),
          comment_text   TEXT NOT NULL,
          parent_comment_id INTEGER REFERENCES opportunity_comments(id) ON DELETE CASCADE,
          tagged_entities   JSONB,
          created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS opportunity_likes (
          id SERIAL PRIMARY KEY,
          opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
          liker_id INTEGER NOT NULL,
          liker_type TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(opportunity_id, liker_id, liker_type)
        );

        CREATE TABLE IF NOT EXISTS opportunity_saves (
          id SERIAL PRIMARY KEY,
          opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
          saver_id INTEGER NOT NULL,
          saver_type TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(opportunity_id, saver_id, saver_type)
        );

        CREATE TABLE IF NOT EXISTS opportunity_views (
          id SERIAL PRIMARY KEY,
          opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
          viewer_id INTEGER NOT NULL,
          viewer_type TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(opportunity_id, viewer_id, viewer_type)
        );

        CREATE TABLE IF NOT EXISTS opportunity_comment_likes (
          id SERIAL PRIMARY KEY,
          opportunity_comment_id INTEGER NOT NULL REFERENCES opportunity_comments(id) ON DELETE CASCADE,
          liker_id INTEGER NOT NULL,
          liker_type TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(opportunity_comment_id, liker_id, liker_type)
        );
      `);

      console.log('🚀 Executing database import transaction (this may take a few seconds)...');
      await client.query(cleanedSql);
      console.log('✅ DATABASE IMPORT COMPLETED SUCCESSFULLY!');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Import failed:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
  } finally {
    await pool.end();
  }
}

run();
