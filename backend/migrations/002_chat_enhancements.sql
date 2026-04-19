-- ============================================================
-- Migration 002: Chat Enhancements
-- SnooSpace — Group Chats, Replies, Unsend, Reports
-- Run once against your Supabase/PostgreSQL database
-- ============================================================

-- ---- 1. Extend conversations table ----
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_group              BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_name            TEXT,
  ADD COLUMN IF NOT EXISTS group_avatar_url      TEXT,
  ADD COLUMN IF NOT EXISTS is_community_primary  BOOLEAN     NOT NULL DEFAULT false;

-- Only one community group can be "primary" at a time (enforced in app logic, not DB constraint,
-- because multiple communities can each have their own primary group)

-- ---- 2. conversation_participants (group membership) ----
CREATE TABLE IF NOT EXISTS conversation_participants (
  id               BIGSERIAL    PRIMARY KEY,
  conversation_id  BIGINT       NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  participant_id   BIGINT       NOT NULL,
  participant_type TEXT         NOT NULL CHECK (participant_type IN ('member', 'community')),
  role             TEXT         NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_participants_unique
  ON conversation_participants(conversation_id, participant_id, participant_type);

CREATE INDEX IF NOT EXISTS idx_conv_participants_lookup
  ON conversation_participants(participant_id, participant_type);

CREATE INDEX IF NOT EXISTS idx_conv_participants_conv
  ON conversation_participants(conversation_id);

-- ---- 3. Extend messages table ----
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id  BIGINT  REFERENCES messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_deleted           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_by_type      TEXT    CHECK (deleted_by_type IN ('sender', 'admin'));

-- message_type column already exists as varchar(20).
-- Valid values now include: 'text', 'image', 'shared_post', 'ticket', 'system'
-- No constraint change needed — 'system' fits within 20 chars.

CREATE INDEX IF NOT EXISTS idx_messages_conv_deleted
  ON messages(conversation_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_messages_reply
  ON messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;

-- ---- 4. group_auto_join_dismissed ----
-- Tracks members who dismissed the "join group" modal (never show again)
CREATE TABLE IF NOT EXISTS group_auto_join_dismissed (
  id               BIGSERIAL    PRIMARY KEY,
  conversation_id  BIGINT       NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  member_id        BIGINT       NOT NULL,
  dismissed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_dismissed_unique
  ON group_auto_join_dismissed(conversation_id, member_id);

-- ---- 5. conversation_hidden ----
-- For DM "delete for me" without affecting the other party
CREATE TABLE IF NOT EXISTS conversation_hidden (
  id               BIGSERIAL    PRIMARY KEY,
  conversation_id  BIGINT       NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  hidden_by_id     BIGINT       NOT NULL,
  hidden_by_type   TEXT         NOT NULL CHECK (hidden_by_type IN ('member', 'community', 'sponsor', 'venue')),
  hidden_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_hidden_unique
  ON conversation_hidden(conversation_id, hidden_by_id, hidden_by_type);

-- ---- 6. conversation_reports ----
CREATE TABLE IF NOT EXISTS conversation_reports (
  id                  BIGSERIAL    PRIMARY KEY,
  conversation_id     BIGINT       NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reporter_id         BIGINT       NOT NULL,
  reporter_type       TEXT         NOT NULL CHECK (reporter_type IN ('member', 'community', 'sponsor', 'venue')),
  reported_user_id    BIGINT       NOT NULL,
  reported_user_type  TEXT         NOT NULL CHECK (reported_user_type IN ('member', 'community', 'sponsor', 'venue')),
  reason              TEXT         NOT NULL CHECK (reason IN (
                        'spam',
                        'harassment',
                        'inappropriate_content',
                        'hate_speech',
                        'other'
                      )),
  description         TEXT,
  status              TEXT         NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  admin_note          TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  reviewed_at         TIMESTAMPTZ
);

-- One report per reporter per conversation
CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_reports_unique
  ON conversation_reports(conversation_id, reporter_id, reporter_type);

CREATE INDEX IF NOT EXISTS idx_conv_reports_status
  ON conversation_reports(status, created_at DESC);

-- ---- 7. Enable Supabase Realtime on new tables ----
-- Run this only if your project uses Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;

-- ---- Verify migration ----
-- Run these SELECTs to confirm everything applied correctly:
--
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'conversations' AND column_name IN ('is_group','group_name','group_avatar_url','is_community_primary');
--
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'messages' AND column_name IN ('reply_to_message_id','is_deleted','deleted_by_type');
--
-- SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('conversation_participants','group_auto_join_dismissed','conversation_hidden','conversation_reports');
