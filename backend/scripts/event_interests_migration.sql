-- Event Interests (Bookmarks) Migration
-- Run this in pgAdmin Query Tool

-- ============================================
-- EVENT INTERESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS event_interests (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, member_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_event_interests_member ON event_interests(member_id);
CREATE INDEX IF NOT EXISTS idx_event_interests_event ON event_interests(event_id);

-- Verification query
SELECT 'event_interests' as table_name, COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'event_interests';
