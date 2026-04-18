-- Notifications table for in-app events (follow, like, comment, etc.)
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  recipient_id BIGINT NOT NULL,
  recipient_type VARCHAR(16) NOT NULL,
  actor_id BIGINT NOT NULL,
  actor_type VARCHAR(16) NOT NULL,
  type VARCHAR(32) NOT NULL,
  payload JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes to speed up lookups by recipient and unread state
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read
  ON notifications (recipient_id, recipient_type, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications (created_at DESC);


