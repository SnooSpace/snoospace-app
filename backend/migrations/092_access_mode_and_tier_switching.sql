-- ── Migration 092: Access Mode and Tier Switching ──────────────────────

DO $$ BEGIN
  ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS access_mode TEXT DEFAULT 'in_person'
    CHECK (access_mode = ANY(ARRAY['in_person', 'virtual', 'both']));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE events ADD COLUMN IF NOT EXISTS allow_tier_switching BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE events ADD COLUMN IF NOT EXISTS allow_downgrade_refunds BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
