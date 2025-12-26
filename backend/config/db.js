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
        interests JSONB NOT NULL,
        username TEXT UNIQUE,
        bio TEXT,
        profile_photo_url TEXT,
        pronouns TEXT,
        location JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      -- Communities table
      CREATE TABLE IF NOT EXISTS communities (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        logo_url TEXT,
        bio TEXT,
        category TEXT,
        categories JSONB NOT NULL DEFAULT '[]'::jsonb,
        location TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        sponsor_types JSONB NOT NULL,
        username TEXT UNIQUE,
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
        username TEXT UNIQUE,
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
        logo_url TEXT,
        username TEXT UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      -- Interests lookup table
      CREATE TABLE IF NOT EXISTS interests (
        id BIGSERIAL PRIMARY KEY,
        label TEXT UNIQUE NOT NULL
      );
      
      -- Drop deprecated lookups if exist (optional no-op if absent)
      -- Keeping tables if already used; not dropping automatically
      
      CREATE TABLE IF NOT EXISTS sponsor_interests (
        sponsor_id BIGINT REFERENCES sponsors(id) ON DELETE CASCADE,
        interest_id BIGINT REFERENCES interests(id) ON DELETE CASCADE,
        PRIMARY KEY (sponsor_id, interest_id)
      );

      -- Signup interests for member/sponsor registration
      CREATE TABLE IF NOT EXISTS signup_interests (
        id BIGSERIAL PRIMARY KEY,
        label TEXT UNIQUE NOT NULL,
        icon_name TEXT,
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        user_type TEXT DEFAULT 'all', -- 'member', 'sponsor', or 'all'
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_signup_interests_active ON signup_interests(is_active, user_type, display_order);

      -- Seed default signup interests for members
      INSERT INTO signup_interests (label, display_order, is_active, user_type) VALUES
        ('Sports', 1, true, 'all'),
        ('Music', 2, true, 'all'),
        ('Technology', 3, true, 'all'),
        ('Travel', 4, true, 'all'),
        ('Food & Drink', 5, true, 'all'),
        ('Art & Culture', 6, true, 'all'),
        ('Fitness', 7, true, 'all'),
        ('Gaming', 8, true, 'all'),
        ('Movies', 9, true, 'all'),
        ('Books', 10, true, 'all'),
        ('Fashion', 11, true, 'all'),
        ('Photography', 12, true, 'all'),
        ('Outdoors', 13, true, 'all'),
        ('Volunteering', 14, true, 'all'),
        ('Networking', 15, true, 'all')
      ON CONFLICT (label) DO NOTHING;
      
      
      -- Posts table
      CREATE TABLE IF NOT EXISTS posts (
        id BIGSERIAL PRIMARY KEY,
        author_id BIGINT NOT NULL, -- ID of the creator
        author_type TEXT NOT NULL, -- 'member', 'community', 'sponsor', 'venue'
        caption TEXT,
        image_urls JSONB NOT NULL, -- array of image URLs
        tagged_entities JSONB, -- array of {id, type} objects for members/communities/sponsors/venues
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Post likes table
      CREATE TABLE IF NOT EXISTS post_likes (
        id BIGSERIAL PRIMARY KEY,
        post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
        liker_id BIGINT NOT NULL,
        liker_type TEXT NOT NULL, -- 'member', 'community', 'sponsor', 'venue'
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(post_id, liker_id, liker_type)
      );
      
      -- Post comments table
      CREATE TABLE IF NOT EXISTS post_comments (
        id BIGSERIAL PRIMARY KEY,
        post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
        commenter_id BIGINT NOT NULL,
        commenter_type TEXT NOT NULL, -- 'member', 'community', 'sponsor', 'venue'
        parent_comment_id BIGINT REFERENCES post_comments(id) ON DELETE CASCADE, -- NULL for top-level comments
        comment_text TEXT NOT NULL,
        tagged_entities JSONB, -- array of {id, type, username} objects for tagged users
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Add tagged_entities column if it doesn't exist (for existing databases)
      DO $$ BEGIN
        ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS tagged_entities JSONB;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      
      -- Follows table
      CREATE TABLE IF NOT EXISTS follows (
        id BIGSERIAL PRIMARY KEY,
        follower_id BIGINT NOT NULL, -- member who is following
        follower_type TEXT NOT NULL, -- 'member'
        following_id BIGINT NOT NULL, -- entity being followed
        following_type TEXT NOT NULL, -- 'member', 'community', 'sponsor', 'venue'
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(follower_id, follower_type, following_id, following_type)
      );
      
      -- Events table
      CREATE TABLE IF NOT EXISTS events (
        id BIGSERIAL PRIMARY KEY,
        community_id BIGINT REFERENCES communities(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        event_date TIMESTAMPTZ NOT NULL,
        venue_id BIGINT REFERENCES venues(id),
        location TEXT,
        max_attendees INTEGER,
        is_past BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Add missing columns to events table
      DO $$ BEGIN
        ALTER TABLE events ADD COLUMN IF NOT EXISTS banner_url TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE events ADD COLUMN IF NOT EXISTS layout_data JSONB;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE events ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'in-person';
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE events ADD COLUMN IF NOT EXISTS virtual_link TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES communities(id);
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_price DECIMAL(10,2);
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      
      -- Add constraint for event_type
      DO $$ BEGIN
        ALTER TABLE events DROP CONSTRAINT IF EXISTS event_type_check;
        ALTER TABLE events ADD CONSTRAINT event_type_check CHECK (event_type IN ('in-person', 'virtual', 'hybrid'));
      EXCEPTION WHEN OTHERS THEN NULL; END $$;

      -- Event banners table (for banner carousel)
      CREATE TABLE IF NOT EXISTS event_banners (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        cloudinary_public_id TEXT,
        image_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_event_banners_event_id ON event_banners(event_id);

      -- Event gallery table (for additional event photos)
      CREATE TABLE IF NOT EXISTS event_gallery (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        cloudinary_public_id TEXT,
        image_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_event_gallery_event_id ON event_gallery(event_id);

      
      -- Event registrations
      CREATE TABLE IF NOT EXISTS event_registrations (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
        member_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
        registration_status TEXT DEFAULT 'registered', -- registered, attended, cancelled
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(event_id, member_id)
      );
      
      -- Ticket types for events (multi-tier pricing)
      CREATE TABLE IF NOT EXISTS ticket_types (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        
        -- Identity
        name TEXT NOT NULL,                           -- "General Admission", "VIP", "Student"
        description TEXT,
        
        -- Pricing (INR only)
        base_price DECIMAL(10,2) NOT NULL DEFAULT 0,  -- 0 = free
        
        -- Inventory
        total_quantity INTEGER,                       -- NULL = unlimited
        sold_count INTEGER DEFAULT 0,
        reserved_count INTEGER DEFAULT 0,             -- Currently in checkout
        
        -- Sale Window (in UTC)
        sale_start_at TIMESTAMPTZ,                    -- NULL = immediately available
        sale_end_at TIMESTAMPTZ,                      -- NULL = until event start
        
        -- Visibility & Access
        visibility TEXT DEFAULT 'public',             -- 'public', 'hidden', 'invite_only'
        access_code TEXT,                             -- Required for hidden/invite_only tickets
        
        -- Per-Order Limits
        min_per_order INTEGER DEFAULT 1,
        max_per_order INTEGER DEFAULT 10,
        max_per_user INTEGER,                         -- NULL = no limit
        
        -- Refund Policy (JSONB for flexibility)
        refund_policy JSONB DEFAULT '{"allowed": true, "deadline_hours_before": 24, "percentage": 100}'::jsonb,
        
        -- Display & Status
        gender_restriction TEXT DEFAULT 'all',         -- 'all', 'Male', 'Female', 'Non-binary'
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ticket_types_event ON ticket_types(event_id);
      CREATE INDEX IF NOT EXISTS idx_ticket_types_visibility ON ticket_types(visibility);
      CREATE INDEX IF NOT EXISTS idx_ticket_types_active ON ticket_types(is_active, event_id);

      -- Discount codes for events (promo codes)
      CREATE TABLE IF NOT EXISTS discount_codes (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        
        -- Code
        code TEXT NOT NULL,
        code_normalized TEXT NOT NULL,             -- UPPER(TRIM(code)) for case-insensitive lookup
        
        -- Discount type and value
        discount_type TEXT NOT NULL DEFAULT 'percentage',  -- 'percentage' or 'flat'
        discount_value DECIMAL(10,2) NOT NULL,             -- e.g., 20 for 20% or 500 for ₹500 off
        
        -- Usage limits
        max_uses INTEGER,                          -- NULL = unlimited
        current_uses INTEGER DEFAULT 0,
        max_uses_per_user INTEGER DEFAULT 1,
        
        -- Validity
        valid_from TIMESTAMPTZ,
        valid_until TIMESTAMPTZ,
        
        -- Restrictions
        min_cart_value DECIMAL(10,2),              -- Minimum order value to apply
        applicable_ticket_ids BIGINT[],            -- NULL = all tickets
        
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_codes_event_code ON discount_codes(event_id, code_normalized);
      CREATE INDEX IF NOT EXISTS idx_discount_codes_event ON discount_codes(event_id);

      -- Pricing rules for events (early bird, group discounts, etc.)
      CREATE TABLE IF NOT EXISTS pricing_rules (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        ticket_type_id BIGINT REFERENCES ticket_types(id) ON DELETE CASCADE,  -- NULL = applies to all
        
        -- Rule identity
        name TEXT NOT NULL,
        rule_type TEXT NOT NULL,                   -- 'early_bird_time', 'early_bird_quantity', 'group_discount'
        
        -- Discount
        discount_type TEXT NOT NULL DEFAULT 'percentage',  -- 'percentage' or 'flat'
        discount_value DECIMAL(10,2) NOT NULL,
        
        -- Conditions (depend on rule_type)
        -- For early_bird_time: valid_from/valid_until
        -- For early_bird_quantity: quantity_threshold
        -- For group_discount: min_quantity
        quantity_threshold INTEGER,                -- For early_bird_quantity: discount when sold < this
        min_quantity INTEGER,                      -- For group_discount: min tickets to get discount
        
        -- Validity
        valid_from TIMESTAMPTZ,
        valid_until TIMESTAMPTZ,
        
        -- Priority (lower = higher priority)
        priority INTEGER DEFAULT 100,
        
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pricing_rules_event ON pricing_rules(event_id);
      CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON pricing_rules(is_active, event_id);

      -- Event swipes (for matching attendees)
      CREATE TABLE IF NOT EXISTS event_swipes (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
        swiper_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
        swiped_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
        swipe_direction TEXT NOT NULL, -- 'left' or 'right'
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(event_id, swiper_id, swiped_id)
      );
      
      -- Matches (when both members swipe right)
      CREATE TABLE IF NOT EXISTS event_matches (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
        member1_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
        member2_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
        match_date TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(event_id, member1_id, member2_id)
      );
      
      -- Next event requests
      CREATE TABLE IF NOT EXISTS next_event_requests (
        id BIGSERIAL PRIMARY KEY,
        requester_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
        requested_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
        current_event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
        message TEXT,
        status TEXT DEFAULT 'pending', -- pending, accepted, declined
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Member photo gallery (for Hinge-like multiple photos)
      CREATE TABLE IF NOT EXISTS member_photos (
        id BIGSERIAL PRIMARY KEY,
        member_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
        photo_url TEXT NOT NULL,
        photo_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Conversations table for direct messaging
      CREATE TABLE IF NOT EXISTS conversations (
        id BIGSERIAL PRIMARY KEY,
        participant1_id BIGINT NOT NULL,
        participant1_type TEXT NOT NULL DEFAULT 'member',
        participant2_id BIGINT NOT NULL,
        participant2_type TEXT NOT NULL DEFAULT 'member',
        last_message_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(participant1_id, participant1_type, participant2_id, participant2_type)
      );
      -- Drop legacy foreign key constraints that forced member-only participants
      DO $$ BEGIN
        ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_participant1_id_fkey;
      EXCEPTION WHEN undefined_object THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_participant2_id_fkey;
      EXCEPTION WHEN undefined_object THEN NULL; END $$;
      
      -- Messages table
      CREATE TABLE IF NOT EXISTS messages (
        id BIGSERIAL PRIMARY KEY,
        conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id BIGINT NOT NULL,
        sender_type TEXT NOT NULL DEFAULT 'member',
        message_text TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      DO $$ BEGIN
        ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
      EXCEPTION WHEN undefined_object THEN NULL; END $$;
      
      -- Indexes for messages
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read) WHERE is_read = false;
      
      -- Indexes for conversations
      CREATE INDEX IF NOT EXISTS idx_conversations_participant1 ON conversations(participant1_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_participant2 ON conversations(participant2_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC);
      
      -- Add missing columns to members table
      DO $$ BEGIN
        ALTER TABLE members ADD COLUMN IF NOT EXISTS username TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE members ADD COLUMN IF NOT EXISTS bio TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE members ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE members ADD COLUMN IF NOT EXISTS pronouns TEXT[];
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE members ADD COLUMN IF NOT EXISTS location JSONB;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      -- Remove city column if it exists (migration from city to location JSONB)
      DO $$ BEGIN
        ALTER TABLE members DROP COLUMN IF EXISTS city;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      
      -- ============================================================
      -- Sessions table for OTP-only multi-account auth
      -- ============================================================
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id BIGINT NOT NULL,
        user_type TEXT NOT NULL CHECK (user_type IN ('member', 'community', 'sponsor', 'venue')),
        device_id TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_used_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, user_type, device_id)
      );
      
      -- Indexes for sessions
      CREATE INDEX IF NOT EXISTS idx_sessions_device ON sessions(device_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_access_token ON sessions(access_token);
      CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, user_type);
      
      -- ============================================================
      -- Remove supabase_user_id columns (no longer used)
      -- ============================================================
      ALTER TABLE members DROP COLUMN IF EXISTS supabase_user_id;
      ALTER TABLE communities DROP COLUMN IF EXISTS supabase_user_id;
      ALTER TABLE sponsors DROP COLUMN IF EXISTS supabase_user_id;
      ALTER TABLE venues DROP COLUMN IF EXISTS supabase_user_id;
      
      -- Drop old supabase_user_id indexes
      DROP INDEX IF EXISTS idx_members_supabase_user_id;
      DROP INDEX IF EXISTS idx_communities_supabase_user_id;
      DROP INDEX IF EXISTS idx_sponsors_supabase_user_id;
      DROP INDEX IF EXISTS idx_venues_supabase_user_id;
      
      -- ============================================================
      -- Remove email UNIQUE constraints (allow multi-account per email)
      -- ============================================================
      DO $$ BEGIN
        ALTER TABLE members DROP CONSTRAINT IF EXISTS members_email_key;
      EXCEPTION WHEN undefined_object THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE communities DROP CONSTRAINT IF EXISTS communities_email_key;
      EXCEPTION WHEN undefined_object THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE sponsors DROP CONSTRAINT IF EXISTS sponsors_email_key;
      EXCEPTION WHEN undefined_object THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE venues DROP CONSTRAINT IF EXISTS venues_contact_email_key;
      EXCEPTION WHEN undefined_object THEN NULL; END $$;
      
      -- Add indexes on email for fast lookups (non-unique)
      CREATE INDEX IF NOT EXISTS idx_members_email ON members(LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_communities_email ON communities(LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_sponsors_email ON sponsors(LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_venues_contact_email ON venues(LOWER(contact_email));

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
      DO $$ BEGIN
        -- Ensure latest username regex: allow letters, numbers, underscores, and dots
        ALTER TABLE members DROP CONSTRAINT IF EXISTS username_format;
        ALTER TABLE members ADD CONSTRAINT username_format CHECK (
          username IS NULL OR (username ~ '^[a-zA-Z0-9_.]{3,30}$')
        );
      EXCEPTION WHEN OTHERS THEN NULL; END $$;

      -- Add missing columns to communities table if they don't exist
      DO $$ BEGIN
        ALTER TABLE communities ADD COLUMN IF NOT EXISTS email TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE communities ADD COLUMN IF NOT EXISTS phone TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE communities ADD COLUMN IF NOT EXISTS secondary_phone TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE communities ADD COLUMN IF NOT EXISTS category TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'communities' AND column_name = 'categories'
        ) THEN
          ALTER TABLE communities ADD COLUMN categories JSONB DEFAULT '[]'::jsonb;
          UPDATE communities
          SET categories = CASE
            WHEN category IS NOT NULL THEN jsonb_build_array(category)
            ELSE '[]'::jsonb
          END
          WHERE category IS NOT NULL;
        END IF;
        UPDATE communities
        SET categories = CASE
          WHEN categories IS NULL OR jsonb_typeof(categories) <> 'array' THEN
            COALESCE(
              CASE WHEN category IS NOT NULL THEN jsonb_build_array(category) ELSE '[]'::jsonb END,
              '[]'::jsonb
            )
          ELSE categories
        END;
        ALTER TABLE communities ALTER COLUMN categories SET DEFAULT '[]'::jsonb;
        ALTER TABLE communities ALTER COLUMN categories SET NOT NULL;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE communities ADD COLUMN IF NOT EXISTS bio TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE communities ADD COLUMN IF NOT EXISTS sponsor_types JSONB;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE communities ADD COLUMN IF NOT EXISTS username TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      -- Banner for community profiles
      DO $$ BEGIN
        ALTER TABLE communities ADD COLUMN IF NOT EXISTS banner_url TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      -- Ensure profile picture URL exists for heads
      DO $$ BEGIN
        ALTER TABLE community_heads ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      -- Remove themes column if it exists
      DO $$ BEGIN
        ALTER TABLE communities DROP COLUMN IF EXISTS themes;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      -- Remove cities column if it exists (should not be in communities table)
      DO $$ BEGIN
        ALTER TABLE communities DROP COLUMN IF EXISTS cities;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;

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
      DO $$ BEGIN
        ALTER TABLE community_heads ADD COLUMN IF NOT EXISTS member_id BIGINT REFERENCES members(id) ON DELETE SET NULL;
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
        ALTER TABLE communities ADD CONSTRAINT phone_10_digits_comm CHECK (phone ~ '^\d{10}$');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE communities ADD CONSTRAINT communities_categories_length CHECK (
          jsonb_typeof(categories) = 'array' AND jsonb_array_length(categories) <= 3
        );
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
      DO $$ BEGIN
        ALTER TABLE communities DROP CONSTRAINT IF EXISTS username_format_comm;
        ALTER TABLE communities ADD CONSTRAINT username_format_comm CHECK (
          username IS NULL OR (username ~ '^[a-zA-Z0-9_.]{3,30}$')
        );
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      
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
      DO $$ BEGIN
        ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS username TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      
      -- Add pricing columns to venues table
      DO $$ BEGIN
        ALTER TABLE venues ADD COLUMN IF NOT EXISTS hourly_price DECIMAL(10,2) DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE venues ADD COLUMN IF NOT EXISTS daily_price DECIMAL(10,2) DEFAULT 0;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE venues ADD COLUMN IF NOT EXISTS username TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE venues DROP CONSTRAINT IF EXISTS username_format_venue;
        ALTER TABLE venues ADD CONSTRAINT username_format_venue CHECK (
          username IS NULL OR (username ~ '^[a-zA-Z0-9_.]{3,30}$')
        );
      EXCEPTION WHEN OTHERS THEN NULL; END $$;
      
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
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sponsors') THEN
          ALTER TABLE sponsors DROP CONSTRAINT IF EXISTS username_format_sponsor;
          ALTER TABLE sponsors ADD CONSTRAINT username_format_sponsor CHECK (
            username IS NULL OR (username ~ '^[a-zA-Z0-9_.]{3,30}$')
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;

      -- Notifications table and indexes
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGSERIAL PRIMARY KEY,
        recipient_id BIGINT NOT NULL,
        recipient_type VARCHAR(16) NOT NULL,
        actor_id BIGINT NOT NULL,
        actor_type VARCHAR(16) NOT NULL,
        type VARCHAR(32) NOT NULL,
        payload JSONB,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read
        ON notifications (recipient_id, recipient_type, is_read);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at
        ON notifications (created_at DESC);

      -- Member location history for analytics/personalization
      CREATE TABLE IF NOT EXISTS member_location_history (
        id BIGSERIAL PRIMARY KEY,
        member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        location JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_member_location_history_member_id
        ON member_location_history (member_id, created_at DESC);

      -- Sponsor types lookup table (admin-managed)
      CREATE TABLE IF NOT EXISTS sponsor_types (
        id BIGSERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sponsor_types_active ON sponsor_types(is_active, display_order);

      -- Seed default sponsor types if table is empty
      INSERT INTO sponsor_types (name, display_order, is_active) VALUES
        ('Protein brands', 1, true),
        ('Energy Drinks', 2, true),
        ('Supplements', 3, true),
        ('Apparel', 4, true),
        ('Tech Gadgets', 5, true),
        ('Local Businesses', 6, true)
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log("✅ Ensured all tables");
  } catch (err) {
    console.error("❌ Failed ensuring tables", err);
  }
}

module.exports = { createPool, ensureTables };
