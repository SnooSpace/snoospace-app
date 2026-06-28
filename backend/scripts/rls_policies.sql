-- =====================================================================
-- SnooSpace Supabase RLS Policies
-- Run this entire file in Supabase SQL Editor (Project > SQL Editor > New Query)
--
-- JWT Claim Key: 'userId' (confirmed from authControllerV2.js generateAccessToken)
-- Auth approach: Custom Express JWT (NOT Supabase Auth)
-- All policies use: auth.jwt() ->> 'userId'   (auth.uid() always returns NULL)
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. NOTIFICATIONS
--    Users see only their own notifications (recipient_id match)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop if exists to allow re-running safely
DROP POLICY IF EXISTS "Users see own notifications" ON notifications;
DROP POLICY IF EXISTS "Service role bypass notifications" ON notifications;

CREATE POLICY "Users see own notifications"
  ON notifications FOR SELECT
  USING (recipient_id::text = (auth.jwt() ->> 'userId'));

-- Allow backend (service_role) to INSERT/UPDATE/DELETE without restriction
CREATE POLICY "Service role bypass notifications"
  ON notifications FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────
-- 2. CONVERSATIONS
--    Users see only conversations they participate in.
--    Supports both DM (participant1_id/participant2_id) and group
--    (conversation_participants join table) patterns.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own conversations" ON conversations;
DROP POLICY IF EXISTS "Service role bypass conversations" ON conversations;

CREATE POLICY "Users see own conversations"
  ON conversations FOR SELECT
  USING (
    participant1_id::text = (auth.jwt() ->> 'userId')
    OR participant2_id::text = (auth.jwt() ->> 'userId')
    OR EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversations.id
        AND cp.participant_id::text = (auth.jwt() ->> 'userId')
    )
  );

CREATE POLICY "Service role bypass conversations"
  ON conversations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────
-- 3. MESSAGES
--    Users see messages only within their own conversations.
--    No receiver_id column on messages — filtering is done via the
--    conversations join so RLS scopes without a direct filter.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see conversation messages" ON messages;
DROP POLICY IF EXISTS "Service role bypass messages" ON messages;

CREATE POLICY "Users see conversation messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.participant1_id::text = (auth.jwt() ->> 'userId')
          OR c.participant2_id::text = (auth.jwt() ->> 'userId')
          OR EXISTS (
            SELECT 1 FROM conversation_participants cp
            WHERE cp.conversation_id = c.id
              AND cp.participant_id::text = (auth.jwt() ->> 'userId')
          )
        )
    )
  );

CREATE POLICY "Service role bypass messages"
  ON messages FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────
-- 4. FOLLOWS
--    Public reads — anyone authenticated can see follow relationships.
--    Backend still controls writes; Realtime subscription on follows
--    table is public-safe (follower counts are public information).
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads follows" ON follows;
DROP POLICY IF EXISTS "Service role bypass follows" ON follows;

CREATE POLICY "Public reads follows"
  ON follows FOR SELECT USING (true);

CREATE POLICY "Service role bypass follows"
  ON follows FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────
-- 5. CREATOR_FOLLOWS
--    Public reads — same reasoning as follows.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE creator_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads creator_follows" ON creator_follows;
DROP POLICY IF EXISTS "Service role bypass creator_follows" ON creator_follows;

CREATE POLICY "Public reads creator_follows"
  ON creator_follows FOR SELECT USING (true);

CREATE POLICY "Service role bypass creator_follows"
  ON creator_follows FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────
-- ENABLE REALTIME REPLICATION
-- Run these if not already done via the Supabase Dashboard
-- (Supabase > Database > Replication > supabase_realtime publication)
-- ─────────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE follows;
ALTER PUBLICATION supabase_realtime ADD TABLE creator_follows;

-- ─────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERY
-- Run this after applying the policies to confirm they are active:
-- ─────────────────────────────────────────────────────────────────────
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('notifications', 'messages', 'conversations', 'follows', 'creator_follows')
-- ORDER BY tablename, policyname;
