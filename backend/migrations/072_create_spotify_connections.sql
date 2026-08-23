-- ============================================================
-- 072_create_spotify_connections.sql
-- Spotify Connect & Profile Integration
-- ============================================================

-- 1. Create or migrate spotify_connections table (stores encrypted tokens at rest)
CREATE TABLE IF NOT EXISTS spotify_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  spotify_user_id TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT NOT NULL DEFAULT 'user-top-read',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  UNIQUE (user_id)
);

-- Ensure all expected columns exist on spotify_connections
DO $$ BEGIN
  ALTER TABLE spotify_connections ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT;
  ALTER TABLE spotify_connections ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT;
  ALTER TABLE spotify_connections ADD COLUMN IF NOT EXISTS scopes TEXT NOT NULL DEFAULT 'user-top-read';
  ALTER TABLE spotify_connections ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
  -- If old plaintext columns existed, drop or null them
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'spotify_connections' AND column_name = 'access_token') THEN
    ALTER TABLE spotify_connections ALTER COLUMN access_token DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'spotify_connections' AND column_name = 'refresh_token') THEN
    ALTER TABLE spotify_connections ALTER COLUMN refresh_token DROP NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Create spotify_profile table (stores synced social top items for discovery)
CREATE TABLE IF NOT EXISTS spotify_profile (
  user_id BIGINT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  top_artists JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
  time_range TEXT NOT NULL DEFAULT 'medium_term',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for high performance lookups
CREATE INDEX IF NOT EXISTS idx_spotify_connections_user_id ON spotify_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_spotify_connections_spotify_user_id ON spotify_connections(spotify_user_id);
CREATE INDEX IF NOT EXISTS idx_spotify_profile_user_id ON spotify_profile(user_id);

-- 4. Enable Row Level Security
ALTER TABLE spotify_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE spotify_profile ENABLE ROW LEVEL SECURITY;

-- 5. Policies for backend postgres superuser (matches standard backend RLS pattern)
DO $$ BEGIN
  DROP POLICY IF EXISTS "service_role_all" ON spotify_connections;
  CREATE POLICY "service_role_all" ON spotify_connections AS PERMISSIVE FOR ALL TO postgres USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "service_role_all" ON spotify_profile;
  CREATE POLICY "service_role_all" ON spotify_profile AS PERMISSIVE FOR ALL TO postgres USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- 6. User-level policies: users can read their own connection status
DO $$ BEGIN
  DROP POLICY IF EXISTS "select own spotify_connections" ON spotify_connections;
  CREATE POLICY "select own spotify_connections" ON spotify_connections FOR SELECT USING (
    (auth.jwt() ->> 'sub')::bigint = user_id OR auth.uid()::text = user_id::text
  );
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- 7. Public profile policy & view: top artists/tracks are public social signals for Discover
DO $$ BEGIN
  DROP POLICY IF EXISTS "select public spotify_profile" ON spotify_profile;
  CREATE POLICY "select public spotify_profile" ON spotify_profile FOR SELECT USING (true);
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE OR REPLACE VIEW spotify_profile_public AS
  SELECT user_id, top_artists, top_tracks, time_range, last_synced_at
  FROM spotify_profile;
