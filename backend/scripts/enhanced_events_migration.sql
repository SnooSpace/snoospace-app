-- Enhanced Event Creation - Database Schema Migration
-- Run this script in pgAdmin Query Tool

-- ============================================
-- 1. EVENT GALLERY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS event_gallery (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  cloudinary_public_id TEXT,
  image_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_gallery_event_id ON event_gallery(event_id);
CREATE INDEX IF NOT EXISTS idx_event_gallery_order ON event_gallery(event_id, image_order);

-- ============================================
-- 2. EVENT HIGHLIGHTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS event_highlights (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  icon_name TEXT, -- Ionicons name (e.g., 'trophy-outline')
  title TEXT NOT NULL,
  description TEXT,
  highlight_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_highlights_event_id ON event_highlights(event_id);
CREATE INDEX IF NOT EXISTS idx_event_highlights_order ON event_highlights(event_id, highlight_order);

-- ============================================
-- 3. EVENT THINGS TO KNOW TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS event_things_to_know (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  preset_id TEXT, -- References preset if using preset (e.g., 'all-ages-allowed')
  icon_name TEXT NOT NULL, -- Ionicons name
  label TEXT NOT NULL,
  item_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_things_to_know_event_id ON event_things_to_know(event_id);
CREATE INDEX IF NOT EXISTS idx_event_things_to_know_order ON event_things_to_know(event_id, item_order);

-- ============================================
-- 4. EVENT FEATURED ACCOUNTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS event_featured_accounts (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  
  -- Account linking (for DJs, Sponsors, Venues, Communities with accounts)
  linked_account_id BIGINT, -- ID of the linked account
  linked_account_type TEXT, -- 'member', 'community', 'sponsor', 'venue'
  
  -- Manual entry (for performers/artists without accounts)
  display_name TEXT, -- Required if no linked account
  role TEXT NOT NULL, -- 'performer', 'dj', 'sponsor', 'vendor', 'speaker'
  description TEXT, -- Bio for performers, optional for others
  profile_photo_url TEXT, -- Only for non-linked accounts
  cloudinary_public_id TEXT,
  
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Either linked_account_id OR display_name must be set
  CONSTRAINT check_account_or_name CHECK (
    (linked_account_id IS NOT NULL) OR (display_name IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_event_featured_accounts_event_id ON event_featured_accounts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_featured_accounts_linked ON event_featured_accounts(linked_account_id, linked_account_type);
CREATE INDEX IF NOT EXISTS idx_event_featured_accounts_order ON event_featured_accounts(event_id, display_order);

-- ============================================
-- 5. UPDATE EVENTS TABLE
-- ============================================

-- Optional: Only for events with early entry (concerts, venues with gates)
ALTER TABLE events ADD COLUMN IF NOT EXISTS gates_open_time TIMESTAMPTZ;

-- Schedule description for timeline details
ALTER TABLE events ADD COLUMN IF NOT EXISTS schedule_description TEXT;

-- Event categories/tags
ALTER TABLE events ADD COLUMN IF NOT EXISTS categories TEXT[];

-- Flag for featured accounts
ALTER TABLE events ADD COLUMN IF NOT EXISTS has_featured_accounts BOOLEAN DEFAULT false;

-- Cloudinary public ID for primary banner
ALTER TABLE events ADD COLUMN IF NOT EXISTS cloudinary_banner_id TEXT;

-- Allow events to be edited after creation
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_editable BOOLEAN DEFAULT true;

-- Update existing events to be editable
UPDATE events SET is_editable = true WHERE is_editable IS NULL;

-- ============================================
-- 6. VERIFICATION QUERY
-- ============================================
-- Run this to verify all tables and columns exist

SELECT 
  'event_gallery' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'event_gallery'

UNION ALL

SELECT 
  'event_highlights' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'event_highlights'

UNION ALL

SELECT 
  'event_things_to_know' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'event_things_to_know'

UNION ALL

SELECT 
  'event_featured_accounts' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'event_featured_accounts'

UNION ALL

SELECT 
  'events (new columns)' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'events' 
AND column_name IN ('gates_open_time', 'schedule_description', 'categories', 'has_featured_accounts', 'cloudinary_banner_id', 'is_editable');

-- ============================================
-- EXPECTED RESULTS:
-- event_gallery: 6 columns
-- event_highlights: 6 columns
-- event_things_to_know: 6 columns
-- event_featured_accounts: 11 columns
-- events (new columns): 6 columns
-- ============================================
