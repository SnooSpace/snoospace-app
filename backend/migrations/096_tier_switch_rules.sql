-- ── Migration 096: Tier Switch Rules ──────────────────────────────
-- Adds tier_switch_rules JSONB column to events table to store explicit
-- host-configured allowed ticket switching pairs and mappings.

DO $$ BEGIN
  ALTER TABLE events ADD COLUMN IF NOT EXISTS tier_switch_rules JSONB DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
