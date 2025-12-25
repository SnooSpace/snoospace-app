-- ============================================
-- DISCOVER CATEGORIES & ADMIN SYSTEM MIGRATION
-- Run this script in pgAdmin Query Tool
-- ============================================

-- ============================================
-- 1. DISCOVER CATEGORIES (Admin-managed)
-- ============================================
CREATE TABLE IF NOT EXISTS discover_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,           -- "Christmas Parties", "New Year Events"
  slug TEXT NOT NULL UNIQUE,           -- "christmas-parties" (URL-friendly)
  icon_name TEXT,                      -- Ionicons name for display
  description TEXT,
  display_order INTEGER DEFAULT 0,     -- Admin-controlled order
  is_active BOOLEAN DEFAULT true,
  visible_from TIMESTAMPTZ,            -- Scheduled visibility start
  visible_until TIMESTAMPTZ,           -- Scheduled visibility end
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discover_categories_active ON discover_categories(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_discover_categories_visibility ON discover_categories(visible_from, visible_until);

-- ============================================
-- 2. EVENT CATEGORIES (Many-to-Many Junction)
-- ============================================
CREATE TABLE IF NOT EXISTS event_discover_categories (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES discover_categories(id) ON DELETE CASCADE,
  is_featured BOOLEAN DEFAULT false,   -- Admin can feature in category
  display_order INTEGER DEFAULT 0,     -- Order within category
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_event_discover_categories_event ON event_discover_categories(event_id);
CREATE INDEX IF NOT EXISTS idx_event_discover_categories_category ON event_discover_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_event_discover_categories_featured ON event_discover_categories(is_featured) WHERE is_featured = true;

-- ============================================
-- 3. SIGNUP INTERESTS (Dynamic, Admin-managed)
-- ============================================
CREATE TABLE IF NOT EXISTS signup_interests (
  id BIGSERIAL PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  icon_name TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  user_type TEXT DEFAULT 'all',        -- 'member', 'sponsor', 'venue', 'all'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with current hardcoded interests
INSERT INTO signup_interests (label, display_order) VALUES
  ('Sports', 1), ('Music', 2), ('Technology', 3), ('Travel', 4),
  ('Food & Drink', 5), ('Art & Culture', 6), ('Fitness', 7), ('Gaming', 8),
  ('Movies', 9), ('Books', 10), ('Fashion', 11), ('Photography', 12),
  ('Outdoors', 13), ('Volunteering', 14), ('Networking', 15)
ON CONFLICT (label) DO NOTHING;

-- ============================================
-- 4. ADMIN USERS
-- ============================================
CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'moderator', -- 'super_admin', 'moderator', 'analytics_viewer'
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- ============================================
-- 5. ADMIN AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_id BIGINT REFERENCES admins(id),
  action_type TEXT NOT NULL,           -- 'user_ban', 'category_create', 'event_feature'
  target_type TEXT,                    -- 'member', 'community', 'event', 'category'
  target_id BIGINT,
  details JSONB,                       -- Additional context
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON admin_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON admin_audit_log(created_at DESC);

-- ============================================
-- 6. ANALYTICS: User Sessions
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_type TEXT NOT NULL,
  device_id TEXT,
  device_type TEXT,                    -- 'ios', 'android'
  app_version TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_user_sessions_started ON user_sessions(started_at);

-- ============================================
-- 7. ANALYTICS: User Events (Actions)
-- ============================================
CREATE TABLE IF NOT EXISTS user_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_type TEXT NOT NULL,
  session_id BIGINT REFERENCES user_sessions(id),
  event_type TEXT NOT NULL,            -- 'screen_view', 'button_click', 'search', etc.
  event_name TEXT NOT NULL,            -- 'home_feed_viewed', 'event_purchased', etc.
  properties JSONB,                    -- Event-specific data
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_events_user ON user_events(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_name ON user_events(event_name);
CREATE INDEX IF NOT EXISTS idx_user_events_created ON user_events(created_at);

-- ============================================
-- 8. ANALYTICS: Daily Aggregates
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_daily (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  dau INTEGER DEFAULT 0,               -- Daily Active Users
  new_users INTEGER DEFAULT 0,
  new_members INTEGER DEFAULT 0,
  new_communities INTEGER DEFAULT 0,
  new_sponsors INTEGER DEFAULT 0,
  new_venues INTEGER DEFAULT 0,
  posts_created INTEGER DEFAULT 0,
  events_created INTEGER DEFAULT 0,
  tickets_sold INTEGER DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0,
  avg_session_duration INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily(date DESC);

-- ============================================
-- 9. MODERATION: Reports
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_id BIGINT NOT NULL,
  reporter_type TEXT NOT NULL,
  target_type TEXT NOT NULL,           -- 'post', 'comment', 'event', 'member', 'community'
  target_id BIGINT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',       -- 'pending', 'reviewed', 'actioned', 'dismissed'
  reviewed_by BIGINT REFERENCES admins(id),
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

-- ============================================
-- 10. MODERATION: User Bans
-- ============================================
CREATE TABLE IF NOT EXISTS user_bans (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_type TEXT NOT NULL,
  ban_type TEXT NOT NULL,              -- 'warning', 'temporary', 'permanent'
  reason TEXT NOT NULL,
  banned_by BIGINT REFERENCES admins(id),
  expires_at TIMESTAMPTZ,              -- NULL for permanent
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_bans_user ON user_bans(user_id, user_type, is_active);
CREATE INDEX IF NOT EXISTS idx_user_bans_active ON user_bans(is_active) WHERE is_active = true;

-- ============================================
-- 11. PUSH NOTIFICATION TOKENS
-- ============================================
CREATE TABLE IF NOT EXISTS push_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_type TEXT NOT NULL,
  expo_push_token TEXT NOT NULL,
  device_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, user_type, device_id)
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = true;

-- ============================================
-- 12. SUBSCRIPTIONS (for tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_type TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  payment_provider TEXT,               -- 'razorpay', 'stripe', etc.
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(is_active, expires_at);

-- ============================================
-- 13. SEED INITIAL DISCOVER CATEGORIES
-- ============================================
INSERT INTO discover_categories (name, slug, icon_name, display_order, is_active) VALUES
  ('Christmas Parties', 'christmas-parties', 'gift-outline', 1, true),
  ('New Year Parties', 'new-year-parties', 'sparkles-outline', 2, true),
  ('Music Events', 'music-events', 'musical-notes-outline', 3, true),
  ('Food & Dining', 'food-dining', 'restaurant-outline', 4, true),
  ('Sports & Fitness', 'sports-fitness', 'fitness-outline', 5, true),
  ('Art & Culture', 'art-culture', 'color-palette-outline', 6, true),
  ('Tech & Networking', 'tech-networking', 'code-slash-outline', 7, true),
  ('Gaming', 'gaming', 'game-controller-outline', 8, true),
  ('Outdoor Adventures', 'outdoor-adventures', 'trail-sign-outline', 9, true),
  ('Workshops & Learning', 'workshops-learning', 'school-outline', 10, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- VERIFICATION QUERY
-- ============================================
SELECT 
  'discover_categories' as table_name,
  COUNT(*) as row_count
FROM discover_categories

UNION ALL

SELECT 
  'signup_interests' as table_name,
  COUNT(*) as row_count
FROM signup_interests

UNION ALL

SELECT 
  'admins' as table_name,
  COUNT(*) as row_count
FROM admins;

-- ============================================
-- EXPECTED RESULTS:
-- discover_categories: 10 rows (seeded categories)
-- signup_interests: 15 rows (seeded interests)
-- admins: 0 rows (will be created via admin panel)
-- ============================================
