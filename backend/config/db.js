const { Pool } = require("pg");

function createPool() {
  return new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
  });
}

async function ensureTables(pool) {
  try {
    await pool.query(`
      -- Members table
      CREATE TABLE IF NOT EXISTS members (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        dob DATE NOT NULL,
        gender TEXT NOT NULL,
        city TEXT NOT NULL,
        interests JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      -- Communities table
      CREATE TABLE IF NOT EXISTS communities (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        logo_url TEXT,
        bio TEXT,
        category TEXT NOT NULL,
        location TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        sponsor_types JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      -- Community heads (private info)
      CREATE TABLE IF NOT EXISTS community_heads (
        id BIGSERIAL PRIMARY KEY,
        community_id BIGINT REFERENCES communities(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        profile_pic_url TEXT,
        is_primary BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      -- Sponsors table
      CREATE TABLE IF NOT EXISTS sponsors (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT,
        brand_name TEXT NOT NULL,
        logo_url TEXT,
        bio TEXT,
        category TEXT,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        requirements TEXT,
        interests JSONB,
        cities JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      -- Drop and recreate venues table to ensure correct schema
      DROP TABLE IF EXISTS venues CASCADE;
      
      -- Venues table
      CREATE TABLE venues (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        contact_email TEXT NOT NULL UNIQUE,
        contact_phone TEXT NOT NULL,
        capacity_min INTEGER NOT NULL DEFAULT 0,
        capacity_max INTEGER NOT NULL,
        price_per_head DECIMAL(10,2) DEFAULT 0,
        hourly_price DECIMAL(10,2) DEFAULT 0,
        daily_price DECIMAL(10,2) DEFAULT 0,
        conditions TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      -- Interests and cities lookup tables
      CREATE TABLE IF NOT EXISTS interests (
        id BIGSERIAL PRIMARY KEY,
        label TEXT UNIQUE NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS cities (
        id BIGSERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      );
      
      -- Drop deprecated lookups if exist (optional no-op if absent)
      -- Keeping tables if already used; not dropping automatically
      
      CREATE TABLE IF NOT EXISTS sponsor_interests (
        sponsor_id BIGINT REFERENCES sponsors(id) ON DELETE CASCADE,
        interest_id BIGINT REFERENCES interests(id) ON DELETE CASCADE,
        PRIMARY KEY (sponsor_id, interest_id)
      );
      
      CREATE TABLE IF NOT EXISTS sponsor_cities (
        sponsor_id BIGINT REFERENCES sponsors(id) ON DELETE CASCADE,
        city_id BIGINT REFERENCES cities(id) ON DELETE CASCADE,
        PRIMARY KEY (sponsor_id, city_id)
      );
      
      -- Add constraints
      DO $$ BEGIN
        ALTER TABLE members ADD CONSTRAINT phone_10_digits CHECK (phone ~ '^\\d{10}$');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE members ADD CONSTRAINT gender_allowed CHECK (gender IN ('Male','Female','Non-binary'));
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE members ADD CONSTRAINT interests_len CHECK (
          jsonb_typeof(interests) = 'array' AND jsonb_array_length(interests) BETWEEN 3 AND 7
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      -- Add missing columns to communities table if they don't exist
      DO $$ BEGIN
        ALTER TABLE communities ADD COLUMN IF NOT EXISTS email TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE communities ADD COLUMN IF NOT EXISTS phone TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE communities ADD COLUMN IF NOT EXISTS category TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE communities ADD COLUMN IF NOT EXISTS location TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE communities ADD COLUMN IF NOT EXISTS bio TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE communities ADD COLUMN IF NOT EXISTS sponsor_types JSONB;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;

      -- Add missing columns to community_heads table if they don't exist
      DO $$ BEGIN
        ALTER TABLE community_heads ADD COLUMN IF NOT EXISTS email TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE community_heads ADD COLUMN IF NOT EXISTS phone TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE community_heads ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE community_heads ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      
      -- Make email and phone nullable if they have NOT NULL constraints
      DO $$ BEGIN
        ALTER TABLE community_heads ALTER COLUMN email DROP NOT NULL;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE community_heads ALTER COLUMN phone DROP NOT NULL;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;

      -- Constraints for communities
      DO $$ BEGIN
        ALTER TABLE communities ADD CONSTRAINT phone_10_digits_comm CHECK (phone ~ '^\\d{10}$');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_unique_comm') THEN
          ALTER TABLE communities ADD CONSTRAINT email_unique_comm UNIQUE (email);
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        -- Drop existing constraint if it exists
        ALTER TABLE communities DROP CONSTRAINT IF EXISTS sponsor_types_len;
        -- Add new constraint that allows "Open to All" or minimum 3 items (no maximum)
        ALTER TABLE communities ADD CONSTRAINT sponsor_types_len CHECK (
          jsonb_typeof(sponsor_types) = 'array' AND (
            (jsonb_array_length(sponsor_types) = 1 AND sponsor_types->0 = '"Open to All"') OR
            jsonb_array_length(sponsor_types) >= 3
          )
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE UNIQUE INDEX IF NOT EXISTS one_primary_head_per_community 
        ON community_heads (community_id) WHERE (is_primary = true);
      EXCEPTION WHEN duplicate_table THEN NULL; END $$;
      
      -- Add missing columns to sponsors table
      DO $$ BEGIN
        ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS user_id BIGINT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS email TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS phone TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS category TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS logo_url TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS bio TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS interests JSONB;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      
      -- Add pricing columns to venues table
      DO $$ BEGIN
        ALTER TABLE venues ADD COLUMN IF NOT EXISTS hourly_price DECIMAL(10,2) DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE venues ADD COLUMN IF NOT EXISTS daily_price DECIMAL(10,2) DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      
      -- Update existing venues table constraints
      DO $$ BEGIN
        -- Make capacity_min default to 0 if not set
        ALTER TABLE venues ALTER COLUMN capacity_min SET DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        -- Make price_per_head default to 0 if not set
        ALTER TABLE venues ALTER COLUMN price_per_head SET DEFAULT 0;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      
      -- Add constraints for sponsors (only if table exists)
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sponsors') THEN
          ALTER TABLE sponsors ADD CONSTRAINT phone_10_digits_sponsor CHECK (phone ~ '^\\d{10}$');
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sponsors') AND
           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsors' AND column_name = 'email') THEN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_unique_sponsor') THEN
            ALTER TABLE sponsors ADD CONSTRAINT email_unique_sponsor UNIQUE (email);
          END IF;
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sponsors') AND
           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsors' AND column_name = 'interests') THEN
          -- Drop existing constraint if it exists
          ALTER TABLE sponsors DROP CONSTRAINT IF EXISTS interests_len;
          -- Add new constraint that allows "Open to All" or minimum 3 items (no maximum)
          ALTER TABLE sponsors ADD CONSTRAINT interests_len CHECK (
            jsonb_typeof(interests) = 'array' AND (
              (jsonb_array_length(interests) = 1 AND interests->0 = '"Open to All"') OR
              jsonb_array_length(interests) >= 3
            )
          );
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    console.log("✅ Ensured all tables");
  } catch (err) {
    console.error("❌ Failed ensuring tables", err);
  }
}

module.exports = { createPool, ensureTables };


