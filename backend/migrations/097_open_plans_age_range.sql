-- ── Migration 097: Open Plans Age Range ──────────────────────────────
-- Adds min_age and max_age columns to open_plans table to support host-configured
-- age range restrictions and user-side discovery filtering.

DO $$ BEGIN
  ALTER TABLE open_plans ADD COLUMN IF NOT EXISTS min_age INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE open_plans ADD COLUMN IF NOT EXISTS max_age INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Check constraint: min_age and max_age must be between 18 and 99, and min_age <= max_age
DO $$ BEGIN
  ALTER TABLE open_plans
    ADD CONSTRAINT open_plans_age_range_check
    CHECK (
      (min_age IS NULL OR (min_age >= 18 AND min_age <= 99)) AND
      (max_age IS NULL OR (max_age >= 18 AND max_age <= 99)) AND
      (min_age IS NULL OR max_age IS NULL OR min_age <= max_age)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_open_plans_age_range ON open_plans (min_age, max_age)
  WHERE min_age IS NOT NULL OR max_age IS NOT NULL;
