-- Migration: 036_venue_cache.sql
-- Purpose: Cache venue/place API results to reduce redundant external API calls.
--          Supports both Mappls and Google as providers.
--          Upserted by the location provider files in the Expo client.
--
-- Run this against your Supabase project via the SQL Editor or CLI.

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: venue_cache
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS venue_cache (
  id                  UUID          DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Provider identity
  provider            TEXT          NOT NULL
                        CHECK (provider IN ('google', 'mappls')),
  provider_place_id   TEXT          NOT NULL,

  -- Unified display fields (mirrors UnifiedPlaceResult)
  name                TEXT          NOT NULL,
  address             TEXT,
  short_address       TEXT,
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,
  category            TEXT,

  -- Full provider response for debugging / re-parsing without a fresh API call
  raw_data            JSONB,

  created_at          TIMESTAMPTZ   DEFAULT now() NOT NULL,
  updated_at          TIMESTAMPTZ   DEFAULT now() NOT NULL,

  -- Composite unique constraint — one row per provider + place
  UNIQUE (provider, provider_place_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- Primary lookup index (used in getPlaceDetails before hitting the API)
CREATE INDEX IF NOT EXISTS venue_cache_provider_id
  ON venue_cache (provider, provider_place_id);

-- Optional: proximity search on cached venues
CREATE INDEX IF NOT EXISTS venue_cache_lat_lng
  ON venue_cache (lat, lng);

-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-update updated_at
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_venue_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_venue_cache_updated_at ON venue_cache;

CREATE TRIGGER trg_venue_cache_updated_at
  BEFORE UPDATE ON venue_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_venue_cache_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — allow the anon key (Expo client) to read and upsert
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE venue_cache ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read cached venues
CREATE POLICY "venue_cache_select"
  ON venue_cache FOR SELECT
  USING (true);

-- Any authenticated user can insert / upsert cached venues
CREATE POLICY "venue_cache_insert"
  ON venue_cache FOR INSERT
  WITH CHECK (true);

-- Any authenticated user can update a cached venue (for upsert)
CREATE POLICY "venue_cache_update"
  ON venue_cache FOR UPDATE
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Optional: auto-expire old cache entries older than 30 days
-- (run as a Supabase cron job or pg_cron if desired)
-- ─────────────────────────────────────────────────────────────────────────────

-- DELETE FROM venue_cache WHERE updated_at < now() - INTERVAL '30 days';

COMMENT ON TABLE venue_cache IS
  'Client-side venue/place API response cache. Avoids redundant calls to Google Places or Mappls. Upserted by the Expo app on getPlaceDetails().';
