require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();

async function run() {
  const client = await pool.connect();
  try {
    // 1. Create aqi_sessions table (raw session records for AQI pipeline)
    // NOTE: user_sessions already exists as a device/auth session table.
    // This table is named aqi_sessions to avoid collision.
    await client.query(
      `CREATE TABLE IF NOT EXISTS aqi_sessions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        session_end TIMESTAMPTZ,
        duration_seconds INT,
        screens_visited INT DEFAULT 0,
        screen_sequence JSONB,
        deepest_screen_depth INT DEFAULT 1,
        session_quality VARCHAR(20),
        hour_of_day INT,
        day_of_week INT,
        is_professional_hours BOOLEAN,
        device_was_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    );
    console.log('aqi_sessions table created');

    await client.query('CREATE INDEX IF NOT EXISTS idx_aqi_sessions_user ON aqi_sessions(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_aqi_sessions_start ON aqi_sessions(session_start DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_aqi_sessions_user_start ON aqi_sessions(user_id, session_start DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_aqi_sessions_quality ON aqi_sessions(session_quality)');
    console.log('aqi_sessions indexes created');

    // 2. Create aqi_session_stats table (weekly aggregated stats)
    await client.query(
      `CREATE TABLE IF NOT EXISTS aqi_session_stats (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE UNIQUE,
        active_days_last_7 INT DEFAULT 0,
        active_days_last_30 INT DEFAULT 0,
        active_weeks_last_8 INT DEFAULT 0,
        avg_sessions_per_active_day NUMERIC DEFAULT 0,
        longest_streak_days INT DEFAULT 0,
        avg_screens_per_session NUMERIC DEFAULT 0,
        avg_session_duration_seconds NUMERIC DEFAULT 0,
        deep_session_ratio NUMERIC DEFAULT 0,
        bounce_rate NUMERIC DEFAULT 0,
        professional_hours_session_ratio NUMERIC DEFAULT 0,
        most_active_hour INT,
        weekend_vs_weekday_ratio NUMERIC DEFAULT 0,
        last_session_at TIMESTAMPTZ,
        days_since_last_session INT,
        total_sessions INT DEFAULT 0,
        calculated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    );
    console.log('aqi_session_stats table created');

    await client.query('CREATE INDEX IF NOT EXISTS idx_aqi_session_stats_user ON aqi_session_stats(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_aqi_session_stats_active_days ON aqi_session_stats(active_days_last_7 DESC)');
    console.log('aqi_session_stats indexes created');

    // 3. Add session-derived AQI signal columns
    await client.query('ALTER TABLE user_aqi_signals ADD COLUMN IF NOT EXISTS return_frequency_score NUMERIC DEFAULT 0');
    await client.query('ALTER TABLE user_aqi_signals ADD COLUMN IF NOT EXISTS session_depth_score NUMERIC DEFAULT 0');
    console.log('user_aqi_signals columns added: return_frequency_score, session_depth_score');

    console.log('\nSession tracking migration complete!');
  } finally {
    client.release();
    pool.end();
  }
}

run().catch(err => {
  console.error('Migration failed:', err.message, err.detail || '', err.hint || '');
  process.exit(1);
});
