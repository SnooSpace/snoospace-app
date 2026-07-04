-- Migration 043: Notification Categories & Preferences

-- 1. Add category column to notifications and notification_aggregates tables
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE notification_aggregates ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- 2. Create index for performance on category filters
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_active_category 
ON notifications (recipient_id, recipient_type, is_active, category, is_read);

-- 3. Create user notification preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id BIGINT NOT NULL,
  user_type VARCHAR(16) NOT NULL,
  category VARCHAR(50) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, user_type, category)
);

-- 4. Create trigger function to automatically set category based on type
CREATE OR REPLACE FUNCTION set_notification_category()
RETURNS TRIGGER AS $$
BEGIN
  NEW.category := CASE NEW.type
    -- Activity Category
    WHEN 'like' THEN 'activity'
    WHEN 'comment' THEN 'activity'
    WHEN 'reply' THEN 'activity'
    WHEN 'tag' THEN 'activity'
    WHEN 'submission_approved' THEN 'activity'
    WHEN 'submission_rejected' THEN 'activity'
    WHEN 'submission_comment' THEN 'activity'
    WHEN 'prompt_submission' THEN 'activity'
    WHEN 'qna_question' THEN 'activity'
    WHEN 'qna_upvote' THEN 'activity'
    WHEN 'qna_answered' THEN 'activity'
    WHEN 'submission_moderated' THEN 'activity'
    WHEN 'plan_like' THEN 'activity'
    WHEN 'plan_comment' THEN 'activity'
    WHEN 'challenge_submission_like' THEN 'activity'

    -- Communities Category
    WHEN 'follow' THEN 'communities'
    WHEN 'creator_follow_received' THEN 'communities'
    WHEN 'circle_request_received' THEN 'communities'
    WHEN 'circle_request_accepted' THEN 'communities'
    WHEN 'community_circle_invite' THEN 'communities'

    -- Messages Category
    WHEN 'dm' THEN 'messages'

    -- Events Category
    WHEN 'event_reminder_24h' THEN 'events'
    WHEN 'event_reminder_1h' THEN 'events'
    WHEN 'attendance_confirmation' THEN 'events'
    WHEN 'event_updated' THEN 'events'
    WHEN 'event_rescheduled' THEN 'events'
    WHEN 'event_cancelled' THEN 'events'
    WHEN 'event_deleted' THEN 'events'
    WHEN 'event_registration' THEN 'events'
    WHEN 'tickets_sold_out' THEN 'events'
    WHEN 'refund_processed' THEN 'events'
    WHEN 'ticket_gifted' THEN 'events'
    WHEN 'gift_revoked' THEN 'events'
    WHEN 'event_invite' THEN 'events'
    WHEN 'invite_request' THEN 'events'
    WHEN 'invite_approved' THEN 'events'
    WHEN 'invite_declined' THEN 'events'
    WHEN 'plan_request' THEN 'events'
    WHEN 'plan_approved' THEN 'events'
    WHEN 'plan_declined' THEN 'events'
    WHEN 'plan_removed' THEN 'events'

    -- System Category
    WHEN 'removal_request' THEN 'system'
    WHEN 'removal_request_review' THEN 'system'

    -- Default fallback
    ELSE 'system'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Drop triggers if they already exist, then recreate them
DROP TRIGGER IF EXISTS trigger_set_notification_category ON notifications;
CREATE TRIGGER trigger_set_notification_category
BEFORE INSERT OR UPDATE OF type ON notifications
FOR EACH ROW
EXECUTE FUNCTION set_notification_category();

DROP TRIGGER IF EXISTS trigger_set_notification_aggregate_category ON notification_aggregates;
CREATE TRIGGER trigger_set_notification_aggregate_category
BEFORE INSERT OR UPDATE OF type ON notification_aggregates
FOR EACH ROW
EXECUTE FUNCTION set_notification_category();

-- 6. Backfill existing notifications to assign category based on type
UPDATE notifications SET category = CASE type
  WHEN 'like' THEN 'activity'
  WHEN 'comment' THEN 'activity'
  WHEN 'reply' THEN 'activity'
  WHEN 'tag' THEN 'activity'
  WHEN 'submission_approved' THEN 'activity'
  WHEN 'submission_rejected' THEN 'activity'
  WHEN 'submission_comment' THEN 'activity'
  WHEN 'prompt_submission' THEN 'activity'
  WHEN 'qna_question' THEN 'activity'
  WHEN 'qna_upvote' THEN 'activity'
  WHEN 'qna_answered' THEN 'activity'
  WHEN 'submission_moderated' THEN 'activity'
  WHEN 'plan_like' THEN 'activity'
  WHEN 'plan_comment' THEN 'activity'
  WHEN 'challenge_submission_like' THEN 'activity'

  WHEN 'follow' THEN 'communities'
  WHEN 'creator_follow_received' THEN 'communities'
  WHEN 'circle_request_received' THEN 'communities'
  WHEN 'circle_request_accepted' THEN 'communities'
  WHEN 'community_circle_invite' THEN 'communities'

  WHEN 'dm' THEN 'messages'

  WHEN 'event_reminder_24h' THEN 'events'
  WHEN 'event_reminder_1h' THEN 'events'
  WHEN 'attendance_confirmation' THEN 'events'
  WHEN 'event_updated' THEN 'events'
  WHEN 'event_rescheduled' THEN 'events'
  WHEN 'event_cancelled' THEN 'events'
  WHEN 'event_deleted' THEN 'events'
  WHEN 'event_registration' THEN 'events'
  WHEN 'tickets_sold_out' THEN 'events'
  WHEN 'refund_processed' THEN 'events'
  WHEN 'ticket_gifted' THEN 'events'
  WHEN 'gift_revoked' THEN 'events'
  WHEN 'event_invite' THEN 'events'
  WHEN 'invite_request' THEN 'events'
  WHEN 'invite_approved' THEN 'events'
  WHEN 'invite_declined' THEN 'events'
  WHEN 'plan_request' THEN 'events'
  WHEN 'plan_approved' THEN 'events'
  WHEN 'plan_declined' THEN 'events'
  WHEN 'plan_removed' THEN 'events'

  WHEN 'removal_request' THEN 'system'
  WHEN 'removal_request_review' THEN 'system'

  ELSE 'system'
END WHERE category IS NULL;

-- Backfill aggregates
UPDATE notification_aggregates SET category = CASE type
  WHEN 'like' THEN 'activity'
  WHEN 'comment' THEN 'activity'
  WHEN 'reply' THEN 'activity'
  WHEN 'tag' THEN 'activity'
  WHEN 'submission_approved' THEN 'activity'
  WHEN 'submission_rejected' THEN 'activity'
  WHEN 'submission_comment' THEN 'activity'
  WHEN 'prompt_submission' THEN 'activity'
  WHEN 'qna_question' THEN 'activity'
  WHEN 'qna_upvote' THEN 'activity'
  WHEN 'qna_answered' THEN 'activity'
  WHEN 'submission_moderated' THEN 'activity'
  WHEN 'plan_like' THEN 'activity'
  WHEN 'plan_comment' THEN 'activity'
  WHEN 'challenge_submission_like' THEN 'activity'

  WHEN 'follow' THEN 'communities'
  WHEN 'creator_follow_received' THEN 'communities'
  WHEN 'circle_request_received' THEN 'communities'
  WHEN 'circle_request_accepted' THEN 'communities'
  WHEN 'community_circle_invite' THEN 'communities'

  WHEN 'dm' THEN 'messages'

  WHEN 'event_reminder_24h' THEN 'events'
  WHEN 'event_reminder_1h' THEN 'events'
  WHEN 'attendance_confirmation' THEN 'events'
  WHEN 'event_updated' THEN 'events'
  WHEN 'event_rescheduled' THEN 'events'
  WHEN 'event_cancelled' THEN 'events'
  WHEN 'event_deleted' THEN 'events'
  WHEN 'event_registration' THEN 'events'
  WHEN 'tickets_sold_out' THEN 'events'
  WHEN 'refund_processed' THEN 'events'
  WHEN 'ticket_gifted' THEN 'events'
  WHEN 'gift_revoked' THEN 'events'
  WHEN 'event_invite' THEN 'events'
  WHEN 'invite_request' THEN 'events'
  WHEN 'invite_approved' THEN 'events'
  WHEN 'invite_declined' THEN 'events'
  WHEN 'plan_request' THEN 'events'
  WHEN 'plan_approved' THEN 'events'
  WHEN 'plan_declined' THEN 'events'
  WHEN 'plan_removed' THEN 'events'

  WHEN 'removal_request' THEN 'system'
  WHEN 'removal_request_review' THEN 'system'

  ELSE 'system'
END WHERE category IS NULL;
