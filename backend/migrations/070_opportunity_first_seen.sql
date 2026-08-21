-- Migration 070: Add first_discovered_at to opportunity_impression_state
--
-- Mirrors post_impression_state.first_discovered_at (from 068_discovery_first_seen.sql).
-- Stamped by the batch-write handler (discovery_opp_serve type) when a discovery
-- opportunity is first served to a viewer. Used by getDiscoveryOpportunities'
-- trickle-pacing gate (max 5 genuinely new introductions per viewer per 24h).
--
-- Safe to run repeatedly: ADD COLUMN IF NOT EXISTS is idempotent.

ALTER TABLE opportunity_impression_state
  ADD COLUMN IF NOT EXISTS first_discovered_at TIMESTAMPTZ DEFAULT NULL;
