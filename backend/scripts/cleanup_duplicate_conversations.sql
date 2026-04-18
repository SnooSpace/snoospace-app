-- ============================================================
-- SQL Script to Clean Up Duplicate Conversations
-- ============================================================
-- This script identifies duplicate conversations (same participant pairs)
-- and merges them into a single conversation, preserving all messages.
--
-- IMPORTANT: Test on a backup database first!
-- ============================================================

BEGIN;

-- Step 1: Identify duplicate conversations
-- This creates a temporary table with conversation groups
CREATE TEMP TABLE conversation_duplicates AS
SELECT 
    participant1_id,
    participant1_type,
    participant2_id,
    participant2_type,
    MIN(id) as keep_id,  -- Keep the oldest conversation
    COUNT(*) as duplicate_count
FROM conversations
GROUP BY participant1_id, participant1_type, participant2_id, participant2_type
HAVING COUNT(*) > 1;

-- Step 2: Show what will be cleaned up (for verification)
SELECT 
    participant1_id,
    participant1_type,
    participant2_id,
    participant2_type,
    duplicate_count,
    keep_id
FROM conversation_duplicates
ORDER BY duplicate_count DESC;

-- Step 3: Migrate all messages from duplicate conversations to the kept conversation
UPDATE messages m
SET conversation_id = cd.keep_id
FROM conversations c
INNER JOIN conversation_duplicates cd ON 
    c.participant1_id = cd.participant1_id AND
    c.participant1_type = cd.participant1_type AND
    c.participant2_id = cd.participant2_id AND
    c.participant2_type = cd.participant2_type AND
    c.id != cd.keep_id
WHERE m.conversation_id = c.id;

-- Step 4: Update last_message_at for kept conversations
UPDATE conversations c
SET last_message_at = (
    SELECT MAX(created_at)
    FROM messages
    WHERE conversation_id = c.id
)
WHERE c.id IN (SELECT keep_id FROM conversation_duplicates);

-- Step 5: Delete duplicate conversation records
DELETE FROM conversations c
USING conversation_duplicates cd
WHERE c.participant1_id = cd.participant1_id 
  AND c.participant1_type = cd.participant1_type
  AND c.participant2_id = cd.participant2_id
  AND c.participant2_type = cd.participant2_type
  AND c.id != cd.keep_id;

-- Step 6: Show cleanup summary
SELECT 
    (SELECT COUNT(*) FROM conversation_duplicates) as duplicate_groups_found,
    (SELECT SUM(duplicate_count - 1) FROM conversation_duplicates) as conversations_deleted,
    (SELECT COUNT(*) FROM messages) as total_messages_preserved;

-- Clean up temp table
DROP TABLE conversation_duplicates;

COMMIT;

-- ============================================================
-- Verification Queries (run AFTER cleanup)
-- ============================================================

-- Verify no duplicates remain
SELECT 
    participant1_id,
    participant1_type,
    participant2_id,
    participant2_type,
    COUNT(*) as count
FROM conversations
GROUP BY participant1_id, participant1_type, participant2_id, participant2_type
HAVING COUNT(*) > 1;
-- Should return 0 rows

-- Verify all messages have valid conversation_id
SELECT COUNT(*) 
FROM messages m
LEFT JOIN conversations c ON m.conversation_id = c.id
WHERE c.id IS NULL;
-- Should return 0
