-- Migration 061: Event & Opportunity Repeat View Events
-- Tracking revisits/repeat impressions for events and opportunities

CREATE TABLE IF NOT EXISTS event_repeat_view_events (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_repeat_views_event ON event_repeat_view_events(event_id);

CREATE TABLE IF NOT EXISTS opportunity_repeat_view_events (
  id SERIAL PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_repeat_views_opp ON opportunity_repeat_view_events(opportunity_id);
