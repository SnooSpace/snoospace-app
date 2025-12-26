/**
 * Migration: Enhance Notifications Table for Deduplication
 * 
 * This migration:
 * 1. Adds `is_active` and `updated_at` columns
 * 2. Deduplicates existing follow notifications (keeps most recent)
 * 3. Creates partial unique index to prevent future duplicates
 * 4. Updates query performance indexes
 * 
 * Run with: node scripts/runNotificationMigration.js
 */

-- Step 1: Add new columns (safe for running system)
ALTER TABLE notifications 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE notifications 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 2: Backfill updated_at for existing rows
UPDATE notifications 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Step 3: Deduplicate existing follow notifications
-- Keep only the most recent per (actor, recipient, type), mark others as inactive
WITH ranked AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY actor_id, actor_type, recipient_id, recipient_type, type 
           ORDER BY created_at DESC
         ) AS rn
  FROM notifications
  WHERE type = 'follow'
)
UPDATE notifications n
SET is_active = FALSE
FROM ranked r
WHERE n.id = r.id AND r.rn > 1;

-- Step 4: Create partial unique index for follow notifications
-- This ensures only ONE active 'follow' notification per (actor, recipient) combo
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_active_follow
  ON notifications (actor_id, actor_type, recipient_id, recipient_type, type)
  WHERE type IN ('follow') AND is_active = TRUE;

-- Step 5: Update query performance indexes
DROP INDEX IF EXISTS idx_notifications_recipient_read;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_active_read
  ON notifications (recipient_id, recipient_type, is_active, is_read)
  WHERE is_active = TRUE;

-- Keep existing created_at index but add is_active filter
DROP INDEX IF EXISTS idx_notifications_created_at;

CREATE INDEX IF NOT EXISTS idx_notifications_created_at_active
  ON notifications (created_at DESC)
  WHERE is_active = TRUE;

-- Step 6: Index for cleanup/archival queries
CREATE INDEX IF NOT EXISTS idx_notifications_inactive_old
  ON notifications (is_active, updated_at)
  WHERE is_active = FALSE;

-- Step 7: Create notification_aggregates table for likes/comments aggregation
CREATE TABLE IF NOT EXISTS notification_aggregates (
  id BIGSERIAL PRIMARY KEY,
  recipient_id BIGINT NOT NULL,
  recipient_type VARCHAR(16) NOT NULL,
  type VARCHAR(32) NOT NULL,
  reference_id BIGINT,
  reference_type VARCHAR(16),
  actor_ids BIGINT[] NOT NULL DEFAULT '{}',
  actor_types VARCHAR(16)[] NOT NULL DEFAULT '{}',
  actor_count INT NOT NULL DEFAULT 1,
  latest_actor_id BIGINT NOT NULL,
  latest_actor_type VARCHAR(16) NOT NULL,
  payload JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint for aggregated notifications per reference
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_agg_unique
  ON notification_aggregates (recipient_id, recipient_type, type, reference_id, reference_type)
  WHERE is_active = TRUE;

-- Query index for listing aggregated notifications
CREATE INDEX IF NOT EXISTS idx_notif_agg_recipient
  ON notification_aggregates (recipient_id, recipient_type, is_active, is_read)
  WHERE is_active = TRUE;
