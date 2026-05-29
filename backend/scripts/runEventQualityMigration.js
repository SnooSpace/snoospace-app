require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();

async function run() {
  const client = await pool.connect();
  try {
    // 1. Create event_quality_scores table
    await client.query(
      `CREATE TABLE IF NOT EXISTS event_quality_scores (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT NOT NULL UNIQUE,
        total_rsvps INT DEFAULT 0,
        total_verified_attendees INT DEFAULT 0,
        tier1_attendee_pct NUMERIC DEFAULT 0,
        tier2_attendee_pct NUMERIC DEFAULT 0,
        tier3_attendee_pct NUMERIC DEFAULT 0,
        tier4_attendee_pct NUMERIC DEFAULT 0,
        avg_attendee_aqi NUMERIC DEFAULT 0,
        buying_class_density NUMERIC DEFAULT 0,
        rsvp_to_attend_ratio NUMERIC DEFAULT 0,
        content_generated INT DEFAULT 0,
        post_event_follows INT DEFAULT 0,
        echo_signal_count INT DEFAULT 0,
        event_quality_score NUMERIC DEFAULT 0,
        event_quality_tier VARCHAR(20),
        predicted_buying_class_density NUMERIC,
        prediction_confidence VARCHAR(20),
        calculated_at TIMESTAMPTZ DEFAULT NOW(),
        is_post_event BOOLEAN DEFAULT FALSE
      )`
    );
    console.log('event_quality_scores table created');

    await client.query('CREATE INDEX IF NOT EXISTS idx_event_quality_event ON event_quality_scores(event_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_event_quality_score ON event_quality_scores(event_quality_score DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_event_quality_tier ON event_quality_scores(event_quality_tier)');
    console.log('event_quality_scores indexes created');

    // 2. Add quality_score_id to events table
    await client.query(
      `ALTER TABLE events ADD COLUMN IF NOT EXISTS quality_score_id BIGINT REFERENCES event_quality_scores(id)`
    );
    console.log('events.quality_score_id column added');

    console.log('\nEvent quality migration complete!');
  } finally {
    client.release();
    pool.end();
  }
}

run().catch(err => {
  console.error('Migration failed:', err.message, err.detail || '');
  process.exit(1);
});
