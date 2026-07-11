-- ============================================================
-- 047_sparks.sql  –  Sparks Intent-Declaration System
-- ============================================================
-- Run once against the live database.
-- Safe to re-run: all DDL uses IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- ============================================================

-- 1. Enable trigram extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 2. sparks  ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sparks (
  id               BIGSERIAL PRIMARY KEY,
  label            TEXT        NOT NULL,
  normalized_label TEXT        NOT NULL,          -- lowercase + trimmed, for dedup
  category         TEXT        NOT NULL           -- professional|social|activity|learning|travel
                   CHECK (category IN ('professional','social','activity','learning','travel')),
  spark_type       TEXT        NULL               -- seeking|offering (professional only, else NULL)
                   CHECK (spark_type IS NULL OR spark_type IN ('seeking','offering')),
  requires_date_range BOOLEAN  NOT NULL DEFAULT false,
  is_system        BOOLEAN     NOT NULL DEFAULT false,
  created_by       BIGINT      NULL,              -- member id for custom sparks; NULL for system
  usage_count      BIGINT      NOT NULL DEFAULT 0,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GIN trigram index for similarity search
CREATE INDEX IF NOT EXISTS sparks_trgm_idx
  ON sparks USING GIN (normalized_label gin_trgm_ops);

-- Fast lookup by category + usage for the grouped chip UI
CREATE INDEX IF NOT EXISTS sparks_category_usage_idx
  ON sparks (category, usage_count DESC)
  WHERE is_active = true AND is_system = true;

-- ── 3. user_sparks  ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sparks (
  user_id    BIGINT      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  spark_id   BIGINT      NOT NULL REFERENCES sparks(id)  ON DELETE CASCADE,
  start_date DATE        NULL,   -- travel sparks only
  end_date   DATE        NULL,   -- travel sparks only
  is_expired BOOLEAN     NOT NULL DEFAULT false,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, spark_id)
);

-- For fast "get all users who have spark X" (used by feed filter)
CREATE INDEX IF NOT EXISTS user_sparks_spark_id_idx
  ON user_sparks (spark_id)
  WHERE is_expired = false;

-- For fast "get all sparks for user Y" (profile fetch)
CREATE INDEX IF NOT EXISTS user_sparks_user_id_idx
  ON user_sparks (user_id)
  WHERE is_expired = false;

-- ── 4. Seed system sparks  ───────────────────────────────────────────────────
-- 19 sparks across 5 categories.
-- normalized_label = label lowercased + trimmed.
INSERT INTO sparks (label, normalized_label, category, spark_type, requires_date_range, is_system) VALUES
  -- Professional (6)
  ('Open to Collaborations',    'open to collaborations',    'professional', NULL,       false, true),
  ('Looking for a Co-founder',  'looking for a co-founder',  'professional', 'seeking',  false, true),
  ('Seeking Mentorship',        'seeking mentorship',        'professional', 'seeking',  false, true),
  ('Offering Mentorship',       'offering mentorship',       'professional', 'offering', false, true),
  ('Exploring Opportunities',   'exploring opportunities',   'professional', NULL,       false, true),
  ('Hiring',                    'hiring',                    'professional', 'offering', false, true),

  -- Social (4)
  ('Open to Friendships',       'open to friendships',       'social',       NULL,       false, true),
  ('New to the City',           'new to the city',           'social',       NULL,       false, true),
  ('Here to Network',           'here to network',           'social',       NULL,       false, true),
  ('Just Curious',              'just curious',              'social',       NULL,       false, true),

  -- Activity (3)
  ('Wants to Play Sports',      'wants to play sports',      'activity',     NULL,       false, true),
  ('Looking for Teammates',     'looking for teammates',     'activity',     NULL,       false, true),
  ('Looking for Study Partners','looking for study partners','activity',     NULL,       false, true),

  -- Learning (3)
  ('Here to Learn',             'here to learn',             'learning',     NULL,       false, true),
  ('Sharing Knowledge',         'sharing knowledge',         'learning',     'offering', false, true),
  ('Seeking Skill Swap',        'seeking skill swap',        'learning',     'seeking',  false, true),

  -- Travel (3)
  ('Visiting This City',        'visiting this city',        'travel',       NULL,       true,  true),
  ('Planning a Trip',           'planning a trip',           'travel',       NULL,       true,  true),
  ('Looking for Travel Buddies','looking for travel buddies','travel',       NULL,       true,  true)

ON CONFLICT DO NOTHING;

-- ── 5. Backfill intent_badges → user_sparks  ─────────────────────────────────
-- For each existing intent_badge string, try to match it to an existing spark
-- via trigram similarity (threshold 0.35).  Lower threshold than custom-creation
-- (0.4) to be more generous for historical free-text data.
-- Unmatched badges are silently skipped — no data is lost from the members table
-- yet; intent_badges column is only dropped once verified.
DO $$
DECLARE
  r RECORD;
  best_spark_id BIGINT;
BEGIN
  FOR r IN
    SELECT
      m.id          AS member_id,
      unnest(m.intent_badges) AS badge_label
    FROM members m
    WHERE m.intent_badges IS NOT NULL
      AND array_length(m.intent_badges, 1) > 0
  LOOP
    -- Find best-matching system spark by trigram similarity
    SELECT s.id
    INTO   best_spark_id
    FROM   sparks s
    WHERE  s.is_system = true
      AND  similarity(s.normalized_label, lower(trim(r.badge_label))) >= 0.35
    ORDER  BY similarity(s.normalized_label, lower(trim(r.badge_label))) DESC
    LIMIT  1;

    IF best_spark_id IS NOT NULL THEN
      -- Insert into user_sparks; skip if already migrated
      INSERT INTO user_sparks (user_id, spark_id)
      VALUES (r.member_id, best_spark_id)
      ON CONFLICT DO NOTHING;

      -- Increment usage count
      UPDATE sparks SET usage_count = usage_count + 1 WHERE id = best_spark_id;
    END IF;
  END LOOP;
END;
$$;

-- ── 6. Deprecate intent_badges column  ───────────────────────────────────────
-- We rename the column to _deprecated_intent_badges as a safety net.
-- It will be dropped in the next release cycle after verifying the migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'intent_badges'
  ) THEN
    ALTER TABLE members
      RENAME COLUMN intent_badges TO _deprecated_intent_badges;
  END IF;
END;
$$;
