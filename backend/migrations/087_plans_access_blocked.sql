-- ==============================================================================
-- 087_plans_access_blocked.sql
-- Adds plans_access_blocked flag to members.
--
-- Set to TRUE by verificationRejectionService.handleVerificationRejection()
-- when a user's plans-scope verification is rejected (automated or manual).
-- Cleared to FALSE by the sync_verification_badge() trigger when ANY
-- verification is approved (see migration 088 which patches the trigger).
-- ==============================================================================

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS plans_access_blocked BOOLEAN NOT NULL DEFAULT FALSE;

-- Index: proofGate checks this column on every plan-create / join-request call.
CREATE INDEX IF NOT EXISTS idx_members_plans_access_blocked
  ON members (id, plans_access_blocked)
  WHERE plans_access_blocked = TRUE;
