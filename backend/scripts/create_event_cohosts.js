require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const p = createPool();

p.query(`
  CREATE TABLE IF NOT EXISTS event_cohosts (
    id          BIGSERIAL PRIMARY KEY,
    event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    cohost_id   BIGINT NOT NULL,
    cohost_type TEXT NOT NULL CHECK (cohost_type IN ('member', 'community')),
    status      TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'declined')),
    invited_by  BIGINT,
    message     TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, cohost_id, cohost_type)
  )
`).then(() => {
  console.log('✅ event_cohosts table created on Supabase');
  return p.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='event_cohosts'");
}).then(r => {
  console.log('Verification:', r.rows.length > 0 ? '✅ Table confirmed' : '❌ Table NOT found');
  p.end();
}).catch(e => {
  console.error('❌ ERROR:', e.message);
  p.end();
});
