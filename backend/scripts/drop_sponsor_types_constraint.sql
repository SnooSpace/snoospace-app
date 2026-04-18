-- ============================================
-- DROP SPONSOR_TYPES_LEN CONSTRAINT
-- This constraint was blocking Individual Organizer signup
-- which requires empty sponsor_types[] array
-- ============================================

-- Drop the check constraint
ALTER TABLE communities DROP CONSTRAINT IF EXISTS sponsor_types_len;

-- Verification: Individual organizers should now be able to signup with empty sponsor_types
-- SELECT id, name, community_type, sponsor_types FROM communities WHERE community_type = 'individual_organizer';
