-- ============================================================
-- SAFE Step-by-Step Script to Clean Up Duplicate Conversations
-- ============================================================
-- Run each section separately and verify results before proceeding
-- ============================================================

-- ============================================================
-- STEP 1: IDENTIFY DUPLICATES (READ-ONLY)
-- ============================================================
-- Run this first to see what duplicates exist
SELECT 
    participant1_id,
    participant1_type,
    participant2_id,
    participant2_type,
    COUNT(*) as duplicate_count,
    array_agg(id ORDER BY id) as conversation_ids,
    MIN(id) as will_keep
FROM conversations
GROUP BY participant1_id, participant1_type, participant2_id, participant2_type
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Review the output above before proceeding!
-- Make note of the total number of duplicates

-- ============================================================
-- STEP 2: COUNT MESSAGES THAT WILL BE MIGRATED (READ-ONLY)
-- ============================================================
-- This shows how many messages are in duplicate conversations
WITH duplicate_groups AS (
    SELECT 
        participant1_id,
        participant1_type,
        participant2_id,
        participant2_type,
        MIN(id) as keep_id
    FROM conversations
    GROUP BY participant1_id, participant1_type, participant2_id, participant2_type
    HAVING COUNT(*) > 1
)
SELECT 
    c.id as conversation_id,
    c.participant1_id,
    c.participant1_type,
    c.participant2_id,
    c.participant2_type,
    COUNT(m.id) as message_count
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
INNER JOIN duplicate_groups dg ON 
    c.participant1_id = dg.participant1_id AND
    c.participant1_type = dg.participant1_type AND
    c.participant2_id = dg.participant2_id AND
    c.participant2_type = dg.participant2_type AND
    c.id != dg.keep_id  -- Only show conversations that will be deleted
GROUP BY c.id, c.participant1_id, c.participant1_type, c.participant2_id, c.participant2_type
ORDER BY message_count DESC;

-- ============================================================
-- STEP 3: PERFORM THE CLEANUP (WRITE OPERATION)
-- ============================================================
-- Only run this after reviewing Steps 1 and 2!
-- This is wrapped in a transaction for safety

BEGIN;

-- Create temporary table with duplicate info
CREATE TEMP TABLE conversation_duplicates AS
SELECT 
    participant1_id,
    participant1_type,
    participant2_id,
    participant2_type,
    MIN(id) as keep_id,
    COUNT(*) as duplicate_count
FROM conversations
GROUP BY participant1_id, participant1_type, participant2_id, participant2_type
HAVING COUNT(*) > 1;

-- Migrate messages from duplicates to kept conversation
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

-- Update last_message_at for kept conversations
UPDATE conversations c
SET last_message_at = (
    SELECT MAX(created_at)
    FROM messages
    WHERE conversation_id = c.id
)
WHERE c.id IN (SELECT keep_id FROM conversation_duplicates);

-- Delete duplicate conversations
DELETE FROM conversations c
USING conversation_duplicates cd
WHERE c.participant1_id = cd.participant1_id 
  AND c.participant1_type = cd.participant1_type
  AND c.participant2_id = cd.participant2_id
  AND c.participant2_type = cd.participant2_type
  AND c.id != cd.keep_id;

-- Show what was done
SELECT 
    (SELECT COUNT(*) FROM conversation_duplicates) as duplicate_groups_cleaned,
    (SELECT SUM(duplicate_count - 1) FROM conversation_duplicates) as conversations_deleted,
    (SELECT COUNT(DISTINCT conversation_id) FROM messages) as unique_conversations_with_messages;

DROP TABLE conversation_duplicates;

-- IMPORTANT: Review the output above!
-- If it looks correct, run: COMMIT;
-- If something looks wrong, run: ROLLBACK;

-- Uncomment one of these after reviewing:
-- COMMIT;
-- ROLLBACK;

-- ============================================================
-- STEP 4: VERIFICATION (READ-ONLY)
-- ============================================================
-- Run these queries AFTER committing to verify cleanup worked

-- Should return 0 rows (no duplicates remain)
SELECT 
    participant1_id,
    participant1_type,
    participant2_id,
    participant2_type,
    COUNT(*) as count
FROM conversations
GROUP BY participant1_id, participant1_type, participant2_id, participant2_type
HAVING COUNT(*) > 1;

-- Should return 0 (all messages have valid conversations)
SELECT COUNT(*) 
FROM messages m
LEFT JOIN conversations c ON m.conversation_id = c.id
WHERE c.id IS NULL;

-- Show statistics
SELECT 
    (SELECT COUNT(*) FROM conversations) as total_conversations,
    (SELECT COUNT(*) FROM messages) as total_messages,
    (SELECT COUNT(DISTINCT conversation_id) FROM messages) as conversations_with_messages;
