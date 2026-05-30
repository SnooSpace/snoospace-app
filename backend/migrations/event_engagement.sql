-- ============================================================
-- EVENT ENGAGEMENT TABLES & COLUMNS
-- Adds like, view, comment, and share support to events
-- ============================================================

-- 1. Add engagement count columns to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS like_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_count   INTEGER NOT NULL DEFAULT 0;

-- 2. Event likes (one per user per event)
CREATE TABLE IF NOT EXISTS event_likes (
  id          SERIAL PRIMARY KEY,
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  liker_id    INTEGER NOT NULL,
  liker_type  TEXT    NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE (event_id, liker_id, liker_type)
);
CREATE INDEX IF NOT EXISTS idx_event_likes_event_id ON event_likes(event_id);
CREATE INDEX IF NOT EXISTS idx_event_likes_liker    ON event_likes(liker_id, liker_type);

-- 3. Event views (one per user per event, lifetime)
CREATE TABLE IF NOT EXISTS event_views (
  id          SERIAL PRIMARY KEY,
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  viewer_id   INTEGER NOT NULL,
  viewer_type TEXT    NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE (event_id, viewer_id, viewer_type)
);
CREATE INDEX IF NOT EXISTS idx_event_views_event_id ON event_views(event_id);

-- 4. Event comments (supports threaded replies via parent_id)
CREATE TABLE IF NOT EXISTS event_comments (
  id              SERIAL PRIMARY KEY,
  event_id        INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  parent_id       INTEGER REFERENCES event_comments(id) ON DELETE CASCADE,
  commenter_id    INTEGER NOT NULL,
  commenter_type  TEXT    NOT NULL,
  comment_text    TEXT    NOT NULL,
  like_count      INTEGER NOT NULL DEFAULT 0,
  tagged_entities JSONB,
  created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_comments_event_id   ON event_comments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_comments_parent_id  ON event_comments(parent_id);

-- 5. Event comment likes
CREATE TABLE IF NOT EXISTS event_comment_likes (
  id          SERIAL PRIMARY KEY,
  comment_id  INTEGER NOT NULL REFERENCES event_comments(id) ON DELETE CASCADE,
  liker_id    INTEGER NOT NULL,
  liker_type  TEXT    NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE (comment_id, liker_id, liker_type)
);
CREATE INDEX IF NOT EXISTS idx_event_comment_likes_comment ON event_comment_likes(comment_id);
