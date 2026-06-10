-- ============================================================
-- SNOOSPACE — EXPAND OPEN PLANS ACTIVITY TYPES
-- Migration: 015_expand_activity_types.sql
-- ============================================================
-- Adds 11 new first-class activity types to open_plans.
-- Previously only: sports, study, food, gaming, other
-- Now supports: cafe, walk, pet_friendly, hangout, rides,
--               creative, gym, yoga, live_music, movies, bar
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
      'bar'
    ));

-- ============================================================
-- END OF MIGRATION
-- ============================================================
