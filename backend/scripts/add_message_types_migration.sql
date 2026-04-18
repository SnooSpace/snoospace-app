-- Migration: Add message_type and metadata columns to messages table
-- This enables special message types like ticket cards in chat

-- Add message_type column (default 'text' for backward compatibility)
ALTER TABLE messages 
  ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'text';

-- Add metadata column for storing structured data (ticket info, event info, etc.)
ALTER TABLE messages 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Add index for querying by message type if needed
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type) WHERE message_type != 'text';

-- Verify registration status column exists and supports pending/confirmed
-- (event_registrations should already have status column from earlier work)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_registrations' AND column_name = 'status'
  ) THEN
    ALTER TABLE event_registrations ADD COLUMN status VARCHAR(20) DEFAULT 'confirmed';
  END IF;
END $$;

COMMENT ON COLUMN messages.message_type IS 'Type of message: text, ticket, event_invite, etc.';
COMMENT ON COLUMN messages.metadata IS 'JSON data for special message types (gift info, event details, etc.)';
