-- ============================================================
-- SNOOSPACE — EXPAND OPEN PLANS ACTIVITY TYPES V3
-- Migration: 076_expand_activity_types_v3.sql
-- ============================================================
-- Adds new activity types:
--   bowling, gokarting, go_karting, indoorgames, indoor_games,
--   pilates, swimming, pet_gathering, cowork, games
-- ============================================================

ALTER TABLE open_plans
  DROP CONSTRAINT IF EXISTS open_plans_activity_type_check;

ALTER TABLE open_plans
  ADD CONSTRAINT open_plans_activity_type_check
    CHECK (activity_type IN (
      'sports',
      'study',
      'cowork',
      'food',
      'gaming',
      'games',
      'other',
      'cafe',
      'walk',
      'pet_friendly',
      'pet_gathering',
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
      'shopping',
      'bowling',
      'gokarting',
      'go_karting',
      'indoorgames',
      'indoor_games',
      'pilates',
      'swimming'
    ));

-- ============================================================
-- END OF MIGRATION
-- ============================================================
