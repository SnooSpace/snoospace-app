-- Fix Duplicate Conversations Script
-- This script merges duplicate conversations between the same participants

-- Step 1: Find all duplicate conversations
-- (Conversations where the same two participants have multiple conversation records)

WITH ordered_conversations AS (
  SELECT 
    c.id,
    LEAST(c.participant1_id, c.participant2_id) AS p1_id,
    GREATEST(c.participant1_id, c.participant2_id) AS p2_id,
    CASE 
      WHEN c.participant1_id < c.participant2_id THEN c.participant1_type
      WHEN c.participant1_id > c.participant2_id THEN c.participant2_type
      ELSE LEAST(c.participant1_type, c.participant2_type)
    END AS p1_type,
    CASE 
      WHEN c.participant1_id < c.participant2_id THEN c.participant2_type
      WHEN c.participant1_id > c.participant2_id THEN c.participant1_type
      ELSE GREATEST(c.participant1_type, c.participant2_type)
    END AS p2_type,
    c.created_at,
    c.last_message_at,
    ROW_NUMBER() OVER (
      PARTITION BY 
        LEAST(c.participant1_id, c.participant2_id),
        GREATEST(c.participant1_id, c.participant2_id),
        CASE WHEN c.participant1_id < c.participant2_id THEN c.participant1_type ELSE c.participant2_type END,
        CASE WHEN c.participant1_id < c.participant2_id THEN c.participant2_type ELSE c.participant1_type END
      ORDER BY c.created_at ASC  -- Keep the oldest conversation
    ) AS row_num
  FROM conversations c
),
conversations_to_keep AS (
  SELECT id AS keep_id
  FROM ordered_conversations
  WHERE row_num = 1
),
conversations_to_delete AS (
  SELECT id AS delete_id
  FROM ordered_conversations
  WHERE row_num > 1
),
duplicate_info AS (
  SELECT 
    ctk.keep_id,
    ctd.delete_id,
    (SELECT COUNT(*) FROM messages WHERE conversation_id = ctd.delete_id) AS messages_in_duplicate
  FROM conversations_to_keep ctk
  CROSS JOIN conversations_to_delete ctd
  WHERE EXISTS (
    SELECT 1 FROM ordered_conversations oc1
    WHERE oc1.id = ctk.keep_id
    AND EXISTS (
      SELECT 1 FROM ordered_conversations oc2
      WHERE oc2.id = ctd.delete_id
      AND oc1.p1_id = oc2.p1_id
      AND oc1.p2_id = oc2.p2_id
      AND oc1.p1_type = oc2.p1_type
      AND oc1.p2_type = oc2.p2_type
    )
  )
)
SELECT 
  'Total duplicate conversations found:' AS info,
  COUNT(DISTINCT delete_id) AS count
FROM duplicate_info;

-- Step 2: Move all messages from duplicate conversations to the main conversation
WITH ordered_conversations AS (
  SELECT 
    c.id,
    LEAST(c.participant1_id, c.participant2_id) AS p1_id,
    GREATEST(c.participant1_id, c.participant2_id) AS p2_id,
    CASE 
      WHEN c.participant1_id < c.participant2_id THEN c.participant1_type
      WHEN c.participant1_id > c.participant2_id THEN c.participant2_type
      ELSE LEAST(c.participant1_type, c.participant2_type)
    END AS p1_type,
    CASE 
      WHEN c.participant1_id < c.participant2_id THEN c.participant2_type
      WHEN c.participant1_id > c.participant2_id THEN c.participant1_type
      ELSE GREATEST(c.participant1_type, c.participant2_type)
    END AS p2_type,
    c.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY 
        LEAST(c.participant1_id, c.participant2_id),
        GREATEST(c.participant1_id, c.participant2_id),
        CASE WHEN c.participant1_id < c.participant2_id THEN c.participant1_type ELSE c.participant2_type END,
        CASE WHEN c.participant1_id < c.participant2_id THEN c.participant2_type ELSE c.participant1_type END
      ORDER BY c.created_at ASC
    ) AS row_num
  FROM conversations c
),
conversations_to_keep AS (
  SELECT id AS keep_id
  FROM ordered_conversations
  WHERE row_num = 1
),
conversations_to_delete AS (
  SELECT id AS delete_id
  FROM ordered_conversations
  WHERE row_num > 1
),
duplicate_mapping AS (
  SELECT 
    ctk.keep_id,
    ctd.delete_id
  FROM conversations_to_keep ctk
  CROSS JOIN conversations_to_delete ctd
  WHERE EXISTS (
    SELECT 1 FROM ordered_conversations oc1
    WHERE oc1.id = ctk.keep_id
    AND EXISTS (
      SELECT 1 FROM ordered_conversations oc2
      WHERE oc2.id = ctd.delete_id
      AND oc1.p1_id = oc2.p1_id
      AND oc1.p2_id = oc2.p2_id
      AND oc1.p1_type = oc2.p1_type
      AND oc1.p2_type = oc2.p2_type
    )
  )
)
UPDATE messages
SET conversation_id = dm.keep_id
FROM duplicate_mapping dm
WHERE messages.conversation_id = dm.delete_id;

-- Step 3: Delete duplicate conversations
WITH ordered_conversations AS (
  SELECT 
    c.id,
    LEAST(c.participant1_id, c.participant2_id) AS p1_id,
    GREATEST(c.participant1_id, c.participant2_id) AS p2_id,
    CASE 
      WHEN c.participant1_id < c.participant2_id THEN c.participant1_type
      WHEN c.participant1_id > c.participant2_id THEN c.participant2_type
      ELSE LEAST(c.participant1_type, c.participant2_type)
    END AS p1_type,
    CASE 
      WHEN c.participant1_id < c.participant2_id THEN c.participant2_type 
      WHEN c.participant1_id > c.participant2_id THEN c.participant1_type
      ELSE GREATEST(c.participant1_type, c.participant2_type)
    END AS p2_type,
    c.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY 
        LEAST(c.participant1_id, c.participant2_id),
        GREATEST(c.participant1_id, c.participant2_id),
        CASE WHEN c.participant1_id < c.participant2_id THEN c.participant1_type ELSE c.participant2_type END,
        CASE WHEN c.participant1_id < c.participant2_id THEN c.participant2_type ELSE c.participant1_type END
      ORDER BY c.created_at ASC
    ) AS row_num
  FROM conversations c
)
DELETE FROM conversations
WHERE id IN (
  SELECT id 
  FROM ordered_conversations 
  WHERE row_num > 1
);

-- Step 4: Update last_message_at for merged conversations
UPDATE conversations c
SET last_message_at = (
  SELECT MAX(created_at)
  FROM messages
  WHERE conversation_id = c.id
)
WHERE EXISTS (
  SELECT 1 FROM messages WHERE conversation_id = c.id
);

-- Verification: Check for remaining duplicates (should return 0)
WITH ordered_conversations AS (
  SELECT 
    LEAST(c.participant1_id, c.participant2_id) AS p1_id,
    GREATEST(c.participant1_id, c.participant2_id) AS p2_id,
    CASE 
      WHEN c.participant1_id < c.participant2_id THEN c.participant1_type
      ELSE c.participant2_type
    END AS p1_type,
    CASE 
      WHEN c.participant1_id < c.participant2_id THEN c.participant2_type
      ELSE c.participant1_type
    END AS p2_type,
    COUNT(*) AS conversation_count
  FROM conversations c
  GROUP BY p1_id, p2_id, p1_type, p2_type
  HAVING COUNT(*) > 1
)
SELECT 
  'Remaining duplicates:' AS info,
  COUNT(*) AS count
FROM ordered_conversations;
