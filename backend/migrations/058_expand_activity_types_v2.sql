-- ============================================================
-- SNOOSPACE — EXPAND OPEN PLANS ACTIVITY TYPES V2
-- Migration: 058_expand_activity_types_v2.sql
-- ============================================================
-- Adds 4 new activity types that are already present in the
-- plansController validActivityTypes list but were missing from
-- the DB check constraint, causing INSERT failures:
--   house_party, club, hiking, shopping
-- ============================================================

ALTER TABLE open_plans
  DROP CONSTRAINT IF EXISTS open_plans_activity_type_check;

ALTER TABLE open_plans
  ADD CONSTRAINT open_plans_activity_type_check
    CHECK (activity_type IN (
      'sports',
      'study',
      'food',
      'gaming',
      'other',
      'cafe',
      'walk',
      'pet_friendly',
      'hangout',
      'rides',
      'creative',
      'gym',
      'yoga',
      'live_music',
      'movies',
      'bar',
      'house_party',
      'club',
      'hiking',
      'shopping'
    ));

-- ============================================================
-- END OF MIGRATION
-- ============================================================
