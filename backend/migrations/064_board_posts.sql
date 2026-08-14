-- Migration 064: Board Posts (Public Collab Marketplace)
--
-- Extends the existing collab_requests system with a public board where
-- community and creator (member) entities can post open spots and receive
-- join-requests from eligible applicants.
--
-- New objects:
--   board_post_status   — enum: open | filled | closed | expired
--   board_posts         — the board listing table
--
-- Alterations to collab_requests:
--   board_post_id       — nullable FK, populated for board-sourced join-requests
--   source              — 'direct' | 'board', DB-level CHECK constraint
--   pitch_text CHECK    — relaxed to allow NULL for board join-requests with no note
--
-- NOTE: ALTER TYPE … ADD VALUE must run OUTSIDE a transaction block in Postgres.
-- This migration file is idempotent (uses IF NOT EXISTS / IF EXISTS everywhere).

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP A — add 'position_filled' to the existing decline_reason_type enum
-- Must run outside a BEGIN/COMMIT block (Postgres restriction).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE decline_reason_type ADD VALUE IF NOT EXISTS 'position_filled';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP B — board_post_status enum
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE board_post_status AS ENUM ('open', 'filled', 'closed', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP C — board_posts table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS board_posts (
  id            BIGSERIAL       PRIMARY KEY,

  -- Poster identity
  poster_id     BIGINT          NOT NULL,
  poster_type   collab_entity_type NOT NULL,

  -- Listing details
  collab_type   collab_type     NOT NULL,
  title         VARCHAR(80)     NOT NULL
                  CONSTRAINT title_not_empty CHECK (TRIM(title) <> ''),
  description   VARCHAR(500)    NOT NULL
                  CONSTRAINT description_not_empty CHECK (TRIM(description) <> ''),

  -- Spots
  spots_total   SMALLINT        NOT NULL
                  CONSTRAINT spots_total_positive CHECK (spots_total >= 1),
  spots_filled  SMALLINT        NOT NULL DEFAULT 0
                  CONSTRAINT spots_filled_lte_total CHECK (spots_filled <= spots_total),

  -- Lifecycle
  status        board_post_status NOT NULL DEFAULT 'open',
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ     NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  closed_at     TIMESTAMPTZ
);

-- Feed query: open posts newest-first
CREATE INDEX IF NOT EXISTS idx_board_posts_feed
  ON board_posts (status, created_at DESC);

-- Poster's own posts
CREATE INDEX IF NOT EXISTS idx_board_posts_poster
  ON board_posts (poster_type, poster_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP D — alter collab_requests
-- ─────────────────────────────────────────────────────────────────────────────

-- D1. board_post_id FK (nullable — only set for board-sourced join-requests)
ALTER TABLE collab_requests
  ADD COLUMN IF NOT EXISTS board_post_id BIGINT
    REFERENCES board_posts (id) ON DELETE CASCADE;

-- D2. source column with DB-level CHECK constraint
--     Protects every write path, not just the API controller.
ALTER TABLE collab_requests
  ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'direct';

-- Add the CHECK constraint separately so ADD COLUMN IF NOT EXISTS is idempotent
-- (constraint creation is still guarded by the DO block).
DO $$ BEGIN
  ALTER TABLE collab_requests
    ADD CONSTRAINT source_valid CHECK (source IN ('direct', 'board'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- D3. Relax the pitch_text constraint to allow NULL pitch for board joins.
--     Board join-requests carry an optional note, not a mandatory pitch.
--     We drop NOT NULL on the column and replace the old CHECK constraint with
--     one that enforces pitch_text NOT NULL only for direct requests.
ALTER TABLE collab_requests ALTER COLUMN pitch_text DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE collab_requests DROP CONSTRAINT pitch_text_not_empty;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE collab_requests
    ADD CONSTRAINT pitch_text_required CHECK (
      (source = 'direct' AND pitch_text IS NOT NULL AND TRIM(pitch_text) <> '')
      OR source = 'board'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- D4. Unique partial index: one pending/accepted join-request per requester per post
CREATE UNIQUE INDEX IF NOT EXISTS uq_board_join_per_requester
  ON collab_requests (board_post_id, sender_id, sender_type)
  WHERE board_post_id IS NOT NULL AND status IN ('pending', 'accepted');

-- D5. Non-unique index for bulk-decline query on close/fill
CREATE INDEX IF NOT EXISTS idx_collab_requests_board_post
  ON collab_requests (board_post_id)
  WHERE board_post_id IS NOT NULL;
