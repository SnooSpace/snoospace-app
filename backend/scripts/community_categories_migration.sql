-- ============================================
-- COMMUNITY CATEGORIES MIGRATION
-- Run this script in pgAdmin Query Tool
-- ============================================

-- ============================================
-- 1. COMMUNITY CATEGORIES TABLE
-- Stores categories that communities can choose during signup
-- ============================================
CREATE TABLE IF NOT EXISTS community_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'approved',  -- 'approved', 'pending', 'rejected'
  requested_by_community_id BIGINT,  -- NULL for admin-created categories
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_categories_active ON community_categories(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_community_categories_status ON community_categories(status);

-- ============================================
-- 2. SEED DEFAULT CATEGORIES
-- These match the previously hardcoded list
-- ============================================
INSERT INTO community_categories (name, display_order, status) VALUES
  ('Sports', 1, 'approved'),
  ('Music', 2, 'approved'),
  ('Technology', 3, 'approved'),
  ('Travel', 4, 'approved'),
  ('Food & Drink', 5, 'approved'),
  ('Art & Culture', 6, 'approved'),
  ('Fitness', 7, 'approved'),
  ('Gaming', 8, 'approved'),
  ('Movies', 9, 'approved'),
  ('Books', 10, 'approved'),
  ('Fashion', 11, 'approved'),
  ('Photography', 12, 'approved'),
  ('Outdoors', 13, 'approved'),
  ('Volunteering', 14, 'approved'),
  ('Networking', 15, 'approved')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- VERIFICATION QUERY
-- ============================================
SELECT 
  'community_categories' as table_name,
  COUNT(*) as row_count
FROM community_categories;

-- Expected: 15 rows
