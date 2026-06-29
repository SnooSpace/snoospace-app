-- Migration 035: Remove 'individual_organizer' from community_type enum
-- 
-- IMPORTANT: Run this ONLY after verifying no communities with
-- community_type = 'individual_organizer' exist in the database.
--
-- Step 1: Verify no rows will be affected (run this first — DO NOT proceed if count > 0)
-- SELECT COUNT(*) FROM communities WHERE community_type = 'individual_organizer';
--
-- Step 2: If any rows exist, update or delete them first:
-- DELETE FROM communities WHERE community_type = 'individual_organizer';
-- OR UPDATE communities SET community_type = 'organization' WHERE community_type = 'individual_organizer';
--
-- Step 3: Check the current CHECK constraint name on the communities table:
-- SELECT conname, consrc FROM pg_constraint WHERE conrelid = 'communities'::regclass AND contype = 'c';
--
-- Step 4: If the community_type column uses a CHECK constraint (not an enum type),
-- drop and recreate the constraint:

-- Drop the old constraint (replace <constraint_name> with the actual name from Step 3)
-- ALTER TABLE communities DROP CONSTRAINT IF EXISTS communities_community_type_check;

-- Add new constraint with only the two valid types
ALTER TABLE communities
  ADD CONSTRAINT communities_community_type_check
  CHECK (community_type IN ('college_affiliated', 'organization'));

-- Note: If community_type is implemented as a PostgreSQL ENUM type (not a CHECK constraint),
-- use this approach instead:
--
-- ALTER TYPE community_type RENAME TO community_type_old;
-- CREATE TYPE community_type AS ENUM ('college_affiliated', 'organization');
-- ALTER TABLE communities
--   ALTER COLUMN community_type TYPE community_type
--   USING community_type::text::community_type;
-- DROP TYPE community_type_old;
