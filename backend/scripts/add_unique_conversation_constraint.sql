-- Add unique constraint to prevent duplicate conversations
-- Run this AFTER running fix_duplicate_conversations.sql to clean up existing duplicates

-- Step 1: Create unique constraint on conversations table
-- This ensures only one conversation can exist between the same two participants
ALTER TABLE conversations
ADD CONSTRAINT unique_conversation_participants 
UNIQUE (participant1_id, participant1_type, participant2_id, participant2_type);

-- Verification: Check that constraint was added
SELECT 
  constraint_name, 
  constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'conversations' 
  AND constraint_type = 'UNIQUE';
