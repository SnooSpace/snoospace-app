require('c:/Dev/SnooSpace/backend/node_modules/dotenv').config({ path: 'c:/Dev/SnooSpace/backend/.env' });
const { createPool } = require('c:/Dev/SnooSpace/backend/config/db');

const migrationSql = `
-- Create spotify_connections table
CREATE TABLE IF NOT EXISTS spotify_connections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  spotify_user_id  TEXT NOT NULL,
  display_name     TEXT,
  access_token     TEXT NOT NULL,
  refresh_token    TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  connected_at     TIMESTAMPTZ DEFAULT NOW(),
  is_active        BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id)
);

-- Create spotify_top_artists table
CREATE TABLE IF NOT EXISTS spotify_top_artists (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  spotify_artist_id TEXT NOT NULL,
  artist_name      TEXT NOT NULL,
  artist_image_url TEXT,
  genres           TEXT[] DEFAULT '{}',
  popularity       INTEGER,
  rank             SMALLINT NOT NULL,
  time_range       TEXT DEFAULT 'medium_term',
  synced_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, rank)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_spotify_connections_user_id ON spotify_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_spotify_top_artists_user_id ON spotify_top_artists(user_id);
`;

async function runMigration() {
  const pool = createPool();
  try {
    console.log('Running Spotify OAuth tables migration...');
    await pool.query(migrationSql);
    console.log('✅ Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await pool.end();
  }
}

runMigration();
