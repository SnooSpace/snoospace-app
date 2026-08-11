-- Migration 063: Collab Requests System
--
-- Structured collab-intent objects between Community and Creator (member) entities.
-- Sponsors are out of scope for v1 — the collab_type enum and sender/receiver type
-- enums are kept generic so Sponsor can be wired in later without a schema change.
--
-- Rules:
--   - Only community ↔ member (creator) pairs for v1 (member↔member valid at DB level)
--   - Chat thread is created ONLY on acceptance
--   - pitch_text is capped at 300 chars (enforced via CHECK constraint)
--   - Reputation numbers are computed on-read — no mutable avg columns

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE collab_entity_type AS ENUM ('community', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE collab_type AS ENUM (
    'event_partnership',
    'sponsorship',
    'cross_promo',
    'guest_collab',
    'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE request_status AS ENUM (
    'pending',
    'accepted',
    'declined',
    'withdrawn',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE decline_reason_type AS ENUM (
    'not_right_fit',
    'different_focus_area',
    'timing_doesnt_work'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- requests
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS collab_requests (
  id                    BIGSERIAL PRIMARY KEY,

  -- Sender
  sender_id             BIGINT        NOT NULL,
  sender_type           collab_entity_type NOT NULL,

  -- Receiver
  receiver_id           BIGINT        NOT NULL,
  receiver_type         collab_entity_type NOT NULL,

  -- Pitch
  collab_type           collab_type   NOT NULL,
  pitch_text            VARCHAR(300)  NOT NULL
                          CONSTRAINT pitch_text_not_empty CHECK (TRIM(pitch_text) <> ''),
  attachment_url        TEXT,

  -- State
  status                request_status NOT NULL DEFAULT 'pending',
  decline_reason        decline_reason_type,

  -- Timestamps
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  responded_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ   NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),

  -- Link to chat (populated on accept only)
  linked_chat_thread_id BIGINT REFERENCES conversations(id) ON DELETE SET NULL,

  -- Business rule: sender cannot equal receiver
  CONSTRAINT sender_not_receiver CHECK (
    sender_id <> receiver_id OR sender_type <> receiver_type
  )
);

-- Inbox query: all requests where I am the receiver, filtered by status
CREATE INDEX IF NOT EXISTS idx_collab_requests_receiver
  ON collab_requests (receiver_type, receiver_id, status);

-- Sent query: all requests where I am the sender, filtered by status
CREATE INDEX IF NOT EXISTS idx_collab_requests_sender
  ON collab_requests (sender_type, sender_id, status);

-- Expiry sweep: quickly find all pending requests past expires_at
CREATE INDEX IF NOT EXISTS idx_collab_requests_expiry
  ON collab_requests (expires_at)
  WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- request_ratings
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS collab_request_ratings (
  id          BIGSERIAL PRIMARY KEY,

  -- One rating per completed request (enforced by unique constraint)
  request_id  BIGINT NOT NULL REFERENCES collab_requests(id) ON DELETE CASCADE,
  CONSTRAINT  one_rating_per_request UNIQUE (request_id),

  -- Rater = original requester (sender of the request)
  rater_id    BIGINT NOT NULL,
  rater_type  collab_entity_type NOT NULL,

  -- Ratee = the receiver being rated
  ratee_id    BIGINT NOT NULL,
  ratee_type  collab_entity_type NOT NULL,

  stars       SMALLINT NOT NULL CONSTRAINT stars_range CHECK (stars BETWEEN 1 AND 5),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reputation read: avg stars per ratee
CREATE INDEX IF NOT EXISTS idx_collab_ratings_ratee
  ON collab_request_ratings (ratee_type, ratee_id);
