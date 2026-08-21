-- Migration 069: Add rank_penalty_tier and rank_penalty_until to event_impression_state
--
-- Mirrors the exact column types/defaults already in opportunity_impression_state
-- (VARCHAR(10) NULL DEFAULT NULL / TIMESTAMPTZ NULL DEFAULT NULL).
-- These columns are read by discoverEvents' score formula (strike-1 multiplier)
-- and written by submitUnseenEventImpression (strike-1 on first new-session unseen,
-- strike-2 retirement on second new-session unseen — same thresholds as Opportunities).
--
-- Safe to run repeatedly: both ALTER TABLE statements are IF NOT EXISTS-guarded.

ALTER TABLE event_impression_state
  ADD COLUMN IF NOT EXISTS rank_penalty_tier  VARCHAR(10)               DEFAULT NULL;

ALTER TABLE event_impression_state
  ADD COLUMN IF NOT EXISTS rank_penalty_until TIMESTAMPTZ               DEFAULT NULL;
