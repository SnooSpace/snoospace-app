-- ==============================================================================
-- 090_open_plans_description.sql
-- Adds optional free-text description to open_plans.
--
-- Design notes:
--   - No NOT NULL  : field is optional; existing rows silently get NULL.
--   - No CHECK     : max 300-char limit enforced at API layer only,
--                    consistent with title (100 chars) and
--                    custom_activity_label (25 chars) which follow the
--                    same pattern.
-- ==============================================================================

ALTER TABLE open_plans
  ADD COLUMN IF NOT EXISTS description TEXT;
