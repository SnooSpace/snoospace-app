const { createPool } = require("../config/db");

const pool = createPool();

// ─── HELPER: get or create DM conversation (race-condition safe) ───────────────
const getOrCreateConversation = async (
  participant1Id,
  participant1Type,
  participant2Id,
  participant2Type,
) => {
  const id1 = Number(participant1Id);
  const id2 = Number(participant2Id);
  let p1Id, p1Type, p2Id, p2Type;
  if (id1 < id2 || (id1 === id2 && participant1Type < participant2Type)) {
    p1Id = participant1Id; p1Type = participant1Type;
    p2Id = participant2Id; p2Type = participant2Type;
  } else {
    p1Id = participant2Id; p1Type = participant2Type;
    p2Id = participant1Id; p2Type = participant1Type;
  }
  const result = await pool.query(
    `INSERT INTO conversations (participant1_id, participant1_type, participant2_id, participant2_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (participant1_id, participant1_type, participant2_id, participant2_type)
     DO NOTHING RETURNING id`,
    [p1Id, p1Type, p2Id, p2Type],
  );
  if (result.rows[0]) return result.rows[0].id;
  const existing = await pool.query(
    `SELECT id FROM conversations
     WHERE participant1_id = $1 AND participant1_type = $2
       AND participant2_id = $3 AND participant2_type = $4`,
    [p1Id, p1Type, p2Id, p2Type],
  );
  return existing.rows[0].id;
};

// ─── getConversations: UNION DMs + group chats ────────────────────────────────
const getConversations = async (req, res) => {
  try {
    const userId   = req.user?.id;
    const userType = req.user?.type;
    if (!userId || (userType !== "member" && userType !== "community")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // DMs (classic two-participant rows)
    const dmQuery = `
      SELECT
        c.id                          AS conversation_id,
        false                         AS is_group,
        NULL                          AS group_name,
        NULL                          AS group_avatar_url,
        c.last_message_at,
        c.created_at,
        CASE
          WHEN c.participant1_id = $1 AND c.participant1_type = $2
            THEN c.participant2_id
          ELSE c.participant1_id
        END                           AS other_participant_id,
        CASE
          WHEN c.participant1_id = $1 AND c.participant1_type = $2
            THEN c.participant2_type
          ELSE c.participant1_type
        END                           AS other_participant_type,
        COALESCE(m.name,  comm.name)         AS other_participant_name,
        COALESCE(m.username, comm.username)  AS other_participant_username,
        COALESCE(m.profile_photo_url, comm.logo_url) AS other_participant_photo,
        (SELECT msg.message_text FROM messages msg
         WHERE msg.conversation_id = c.id
         ORDER BY msg.created_at DESC LIMIT 1)       AS last_message_text,
        (SELECT msg.message_type FROM messages msg
         WHERE msg.conversation_id = c.id
         ORDER BY msg.created_at DESC LIMIT 1)       AS last_message_type,
        -- For muted convos: suppress unread count (Instagram behaviour)
        CASE WHEN cm.id IS NOT NULL THEN 0
          ELSE (SELECT COUNT(*) FROM messages msg
            WHERE msg.conversation_id = c.id
              AND (msg.sender_id != $1 OR msg.sender_type != $2)
              AND msg.is_read = false)
        END                                          AS unread_count,
        (cm.id IS NOT NULL)                          AS is_muted,
        cm.muted_until                               AS muted_until
      FROM conversations c
      LEFT JOIN members m ON (
        (c.participant1_id = $1 AND c.participant1_type = $2
          AND m.id = c.participant2_id AND c.participant2_type = 'member')
        OR
        (c.participant2_id = $1 AND c.participant2_type = $2
          AND m.id = c.participant1_id AND c.participant1_type = 'member')
      )
      LEFT JOIN communities comm ON (
        (c.participant1_id = $1 AND c.participant1_type = $2
          AND comm.id = c.participant2_id AND c.participant2_type = 'community')
        OR
        (c.participant2_id = $1 AND c.participant2_type = $2
          AND comm.id = c.participant1_id AND c.participant1_type = 'community')
      )
      LEFT JOIN conversation_hidden ch
        ON ch.conversation_id = c.id
        AND ch.hidden_by_id = $1 AND ch.hidden_by_type = $2
      LEFT JOIN conversation_muted cm
        ON cm.conversation_id = c.id
        AND cm.muted_by_id = $1 AND cm.muted_by_type = $2
        AND (cm.muted_until IS NULL OR cm.muted_until > NOW())
      WHERE (
        (c.participant1_id = $1 AND c.participant1_type = $2)
        OR (c.participant2_id = $1 AND c.participant2_type = $2)
      )
      AND c.is_group = false
      AND (ch.id IS NULL OR c.last_message_at > ch.hidden_at)
    `;

    // Group chats (via conversation_participants)
    const groupQuery = `
      SELECT
        c.id                          AS conversation_id,
        true                          AS is_group,
        c.group_name,
        c.group_avatar_url,
        c.last_message_at,
        c.created_at,
        c.messaging_restricted,
        cp.role                       AS my_role,
        (SELECT COUNT(*) FROM conversation_participants p2
         WHERE p2.conversation_id = c.id)             AS participant_count,
        NULL                          AS other_participant_id,
        NULL                          AS other_participant_type,
        NULL                          AS other_participant_name,
        NULL                          AS other_participant_username,
        NULL                          AS other_participant_photo,
        (SELECT msg.message_text FROM messages msg
         WHERE msg.conversation_id = c.id
         ORDER BY msg.created_at DESC LIMIT 1)       AS last_message_text,
        (SELECT msg.message_type FROM messages msg
         WHERE msg.conversation_id = c.id
         ORDER BY msg.created_at DESC LIMIT 1)       AS last_message_type,
        NULL                          AS muted_until,
        (SELECT COUNT(*) FROM messages msg
         WHERE msg.conversation_id = c.id
           AND (msg.sender_id != $1 OR msg.sender_type != $2)
           AND msg.is_read = false)                   AS unread_count,
        (cm.id IS NOT NULL)                           AS is_muted
      FROM conversations c
      JOIN conversation_participants cp
        ON cp.conversation_id = c.id
        AND cp.participant_id = $1 AND cp.participant_type = $2
      LEFT JOIN conversation_hidden ch
        ON ch.conversation_id = c.id
        AND ch.hidden_by_id = $1 AND ch.hidden_by_type = $2
      LEFT JOIN conversation_muted cm
        ON cm.conversation_id = c.id
        AND cm.muted_by_id = $1 AND cm.muted_by_type = $2
        AND (cm.muted_until IS NULL OR cm.muted_until > NOW())
      WHERE c.is_group = true
        AND (ch.id IS NULL OR c.last_message_at > ch.hidden_at)
    `;

    const [dmResult, groupResult] = await Promise.all([
      pool.query(dmQuery, [userId, userType]),
      pool.query(groupQuery, [userId, userType]),
    ]);

    const formatLastMessage = (text, type) => {
      if (type === 'image') return '\ud83d\udcf7 Photo';
      if (type === 'video') return '\ud83c\udfa5 Video';
      return text || null;
    };

    const mapConv = (conv) => ({
      id:                  conv.conversation_id,
      isGroup:             conv.is_group,
      groupName:           conv.group_name      || null,
      groupAvatarUrl:      conv.group_avatar_url || null,
      messagingRestricted: conv.messaging_restricted || false,
      myRole:              conv.my_role           || null,   // 'admin' | 'member' | null for DMs
      participantCount:    parseInt(conv.participant_count) || null,
      otherParticipant: conv.is_group ? null : {
        id:             conv.other_participant_id,
        type:           conv.other_participant_type,
        name:           conv.other_participant_name,
        username:       conv.other_participant_username,
        profilePhotoUrl: conv.other_participant_photo,
      },
      lastMessage:    formatLastMessage(conv.last_message_text, conv.last_message_type),
      lastMessageAt:  conv.last_message_at,
      unreadCount:    parseInt(conv.unread_count) || 0,
      isMuted:        conv.is_muted === true || conv.is_muted === 't',
      mutedUntil:     conv.muted_until || null,
      createdAt:      conv.created_at,
    });

    const conversations = [
      ...dmResult.rows.map(mapConv),
      ...groupResult.rows.map(mapConv),
    ].sort((a, b) => {
      const ta = a.lastMessageAt || a.createdAt;
      const tb = b.lastMessageAt || b.createdAt;
      return new Date(tb) - new Date(ta);
    });

    res.json({ conversations });
  } catch (error) {
    console.error("Error getting conversations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── getMessages ──────────────────────────────────────────────────────────────
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId   = req.user?.id;
    const userType = req.user?.type;

    // ── Cursor-based pagination ──────────────────────────────────────────────
    // ?before=<ISO>&limit=N  → fetch N messages older than cursor (scroll-up pagination)
    // ?after=<ISO>&limit=N   → fetch messages NEWER than cursor (polling forward pass)
    // ?limit=N (no cursor)   → fetch N most-recent messages (initial load)
    const limitNum     = Math.min(parseInt(req.query.limit) || 20, 100);
    const beforeCursor = req.query.before || null; // ISO string or null
    const afterCursor  = req.query.after  || null; // ISO string or null (polling)

    if (!userId || (userType !== "member" && userType !== "community")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Access check: DM participant OR group participant
    const accessCheck = await pool.query(
      `SELECT c.id FROM conversations c
       LEFT JOIN conversation_participants cp
         ON cp.conversation_id = c.id
         AND cp.participant_id = $2 AND cp.participant_type = $3
       WHERE c.id = $1
         AND (
           (c.is_group = false AND (
             (c.participant1_id = $2 AND c.participant1_type = $3)
             OR (c.participant2_id = $2 AND c.participant2_type = $3)
           ))
           OR (c.is_group = true AND cp.id IS NOT NULL)
         )`,
      [conversationId, userId, userType],
    );
    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // ── Instagram-style: find if this user previously deleted the chat ─────────
    // If a conversation_hidden record exists AND the conversation re-appeared
    // (because a new message arrived after hidden_at), we only show messages
    // sent after the deletion timestamp — old history stays invisible.
    const hiddenCheck = await pool.query(
      `SELECT hidden_at FROM conversation_hidden
       WHERE conversation_id = $1 AND hidden_by_id = $2 AND hidden_by_type = $3`,
      [conversationId, userId, userType],
    );
    const hiddenAt = hiddenCheck.rows[0]?.hidden_at || null;

    // ── Effective lower-bound for created_at ────────────────────────────────
    // When ?after= is supplied (polling forward pass), we use the later of
    // afterCursor and hiddenAt so the deletion cutoff is always respected.
    // When only hiddenAt exists we fall back to it.
    let effectiveLowerBound = hiddenAt;
    if (afterCursor) {
      if (!hiddenAt || new Date(afterCursor) > new Date(hiddenAt)) {
        effectiveLowerBound = afterCursor;
      }
    }

    const query = `
      SELECT
        m.id,
        m.sender_id,
        m.sender_type,
        m.message_text,
        m.message_type,
        m.metadata,
        m.is_read,
        m.is_deleted,
        m.deleted_by_type,
        m.reply_to_message_id,
        m.created_at,
        COALESCE(mem.name,  comm.name)           AS sender_name,
        COALESCE(mem.username, comm.username)    AS sender_username,
        COALESCE(mem.profile_photo_url, comm.logo_url) AS sender_photo_url,
        rm.message_text   AS reply_message_text,
        rm.message_type   AS reply_message_type,
        rm.metadata       AS reply_metadata,
        rm.sender_id      AS reply_sender_id,
        rm.sender_type    AS reply_sender_type,
        rm.is_deleted     AS reply_is_deleted,
        COALESCE(rmem.name, rcomm.name) AS reply_sender_name
      FROM messages m
      LEFT JOIN members  mem  ON (m.sender_id = mem.id  AND m.sender_type = 'member')
      LEFT JOIN communities comm ON (m.sender_id = comm.id AND m.sender_type = 'community')
      LEFT JOIN messages rm ON rm.id = m.reply_to_message_id
      LEFT JOIN members  rmem  ON (rm.sender_id = rmem.id  AND rm.sender_type = 'member')
      LEFT JOIN communities rcomm ON (rm.sender_id = rcomm.id AND rm.sender_type = 'community')
      WHERE m.conversation_id = $1
        AND ($3::timestamptz IS NULL OR m.created_at < $3::timestamptz)
        AND ($4::timestamptz IS NULL OR m.created_at > $4::timestamptz)
      ORDER BY m.created_at DESC
      LIMIT $2
    `;

    // Fetch limit+1 rows so we can detect whether more pages exist without a COUNT query
    const result = await pool.query(query, [conversationId, limitNum + 1, beforeCursor, effectiveLowerBound]);
    const hasMore = result.rows.length > limitNum;
    const rawRows = hasMore ? result.rows.slice(0, limitNum) : result.rows;

    const messages = rawRows.reverse().map((msg) => {
      let replyPreview = null;
      if (msg.reply_to_message_id) {
        const isPostShare = msg.reply_message_type === "post_share";
        const replyMeta = msg.reply_metadata || {};
        replyPreview = {
          messageText:       msg.reply_is_deleted ? null : msg.reply_message_text,
          messageType:       msg.reply_message_type,
          senderId:          msg.reply_sender_id,
          senderType:        msg.reply_sender_type,
          senderName:        msg.reply_sender_name,
          isDeleted:         msg.reply_is_deleted,
          isPostShare:       isPostShare,
          postAuthorUsername: isPostShare ? (replyMeta.authorUsername || null) : null,
          postAuthorName:    isPostShare ? (replyMeta.authorName || null) : null,
          postCaption:       isPostShare ? (replyMeta.caption || null) : null,
        };
      }
      return {
        id:                msg.id,
        senderId:          msg.sender_id,
        senderType:        msg.sender_type,
        senderName:        msg.sender_name,
        senderUsername:    msg.sender_username,
        senderPhotoUrl:    msg.sender_photo_url,
        messageText:       msg.is_deleted ? null : msg.message_text,
        messageType:       msg.message_type || "text",
        metadata:          msg.is_deleted ? null : msg.metadata,
        isRead:            msg.is_read,
        isDeleted:         msg.is_deleted,
        deletedByType:     msg.deleted_by_type,
        replyToMessageId:  msg.reply_to_message_id,
        replyPreview,
        createdAt:         msg.created_at,
      };
    });

    // Mark as read — respects the effective lower-bound (deletion cutoff or polling cutoff)
    await pool.query(
      `UPDATE messages SET is_read = true
       WHERE conversation_id = $1
         AND (sender_id != $2 OR sender_type != $3)
         AND is_read = false
         AND ($4::timestamptz IS NULL OR created_at > $4::timestamptz)`,
      [conversationId, userId, userType, hiddenAt],
    );

    // Return oldest message's createdAt as next cursor for the client
    const nextCursor = messages.length > 0 ? messages[0].createdAt : null;

    res.json({ messages, hasMore, nextCursor });
  } catch (error) {
    console.error("Error getting messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


// ─── sendMessage ──────────────────────────────────────────────────────────────
const sendMessage = async (req, res) => {
  try {
    const {
      conversationId,         // group chat path
      recipientId,            // DM path
      recipientType = "member",
      messageText = "",
      messageType = "text",
      reply_to_message_id,
      metadata = null,        // for image/video: { url, public_id, resource_type, duration? }
    } = req.body;

    const userId   = req.user?.id;
    const userType = req.user?.type;

    if (!userId || (userType !== "member" && userType !== "community")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Media messages (image/video/multi_media) may have empty messageText; text messages must have content
    const isMediaMessage = ["image", "video", "multi_media"].includes(messageType);
    if (!isMediaMessage && (!messageText || messageText.trim().length === 0)) {
      return res.status(400).json({ error: "Message text is required" });
    }
    if (["image", "video"].includes(messageType) && !metadata?.url) {
      return res.status(400).json({ error: "metadata.url is required for media messages" });
    }
    if (messageType === "multi_media" && (!Array.isArray(metadata) || metadata.length === 0)) {
      return res.status(400).json({ error: "metadata array is required for multi_media messages" });
    }

    let convId;

    if (conversationId) {
      // Look up the conversation to determine if it's a group or DM
      const convLookup = await pool.query(
        `SELECT id, is_group, messaging_restricted FROM conversations WHERE id = $1`,
        [conversationId],
      );
      if (convLookup.rows.length === 0) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const { is_group: isGroup, messaging_restricted: restricted } = convLookup.rows[0];

      if (isGroup) {
        // Group chat: verify the user is a participant and check messaging restriction
        const cpCheck = await pool.query(
          `SELECT id, role FROM conversation_participants
           WHERE conversation_id = $1 AND participant_id = $2 AND participant_type = $3`,
          [conversationId, userId, userType],
        );
        if (cpCheck.rows.length === 0) {
          return res.status(403).json({ error: "Not a participant of this group" });
        }
        // Enforce announcement mode: only admins can send when messaging_restricted = true
        if (restricted && cpCheck.rows[0].role !== "admin") {
          return res.status(403).json({ error: "Messaging is restricted to admins only" });
        }
      } else {
        // DM: verify the user is one of the two participants
        const dmCheck = await pool.query(
          `SELECT id FROM conversations
           WHERE id = $1
             AND (
               (participant1_id = $2 AND participant1_type = $3)
               OR (participant2_id = $2 AND participant2_type = $3)
             )`,
          [conversationId, userId, userType],
        );
        if (dmCheck.rows.length === 0) {
          return res.status(403).json({ error: "Not a participant of this conversation" });
        }
      }
      convId = conversationId;
    } else {
      // DM
      if (!recipientId) {
        return res.status(400).json({ error: "conversationId or recipientId required" });
      }
      if (String(userId) === String(recipientId) && userType === recipientType) {
        return res.status(400).json({ error: "Cannot send message to yourself" });
      }
      // Verify recipient exists
      const table = recipientType === "community" ? "communities" : "members";
      const rCheck = await pool.query(`SELECT id FROM ${table} WHERE id = $1`, [recipientId]);
      if (rCheck.rows.length === 0) {
        return res.status(404).json({ error: "Recipient not found" });
      }
      convId = await getOrCreateConversation(userId, userType, recipientId, recipientType);
    }

    const finalText = messageText?.trim() || "";
    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    // Insert message
    const msgResult = await pool.query(
      `INSERT INTO messages
         (conversation_id, sender_id, sender_type, message_text, message_type, reply_to_message_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [convId, userId, userType, finalText, messageType, reply_to_message_id || null, metadataJson],
    );
    const message = msgResult.rows[0];

    await pool.query(
      `UPDATE conversations SET last_message_at = $1 WHERE id = $2`,
      [message.created_at, convId],
    );

    // Sender info
    const senderQ = userType === "member"
      ? "SELECT name, username, profile_photo_url FROM members WHERE id = $1"
      : "SELECT name, username, logo_url AS profile_photo_url FROM communities WHERE id = $1";
    const senderInfo = await pool.query(senderQ, [userId]);

    res.status(201).json({
      success: true,
      message: {
        id:             message.id,
        conversationId: convId,
        senderId:       userId,
        senderType:     userType,
        senderName:     senderInfo.rows[0]?.name,
        senderUsername: senderInfo.rows[0]?.username,
        senderPhotoUrl: senderInfo.rows[0]?.profile_photo_url,
        messageText:    finalText,
        messageType,
        metadata:       metadata || null,
        replyToMessageId: reply_to_message_id || null,
        isRead:         false,
        isDeleted:      false,
        createdAt:      message.created_at,
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── markMessageRead ──────────────────────────────────────────────────────────
const markMessageRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId   = req.user?.id;
    const userType = req.user?.type;
    if (!userId || (userType !== "member" && userType !== "community")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const check = await pool.query(
      `SELECT m.id FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       LEFT JOIN conversation_participants cp
         ON cp.conversation_id = c.id AND cp.participant_id = $2 AND cp.participant_type = $3
       WHERE m.id = $1
         AND (m.sender_id != $2 OR m.sender_type != $3)
         AND (
           (c.is_group = false AND (
             (c.participant1_id = $2 AND c.participant1_type = $3)
             OR (c.participant2_id = $2 AND c.participant2_type = $3)
           ))
           OR (c.is_group = true AND cp.id IS NOT NULL)
         )`,
      [messageId, userId, userType],
    );
    if (check.rows.length === 0) return res.status(404).json({ error: "Message not found" });
    await pool.query("UPDATE messages SET is_read = true WHERE id = $1", [messageId]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── getUnreadCount ───────────────────────────────────────────────────────────
const getUnreadCount = async (req, res) => {
  try {
    const userId   = req.user?.id;
    const userType = req.user?.type;
    if (!userId || (userType !== "member" && userType !== "community")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    // Mirror the Instagram-style logic:
    // 1. Exclude hidden conversations unless a new message arrived after hidden_at
    // 2. Exclude muted conversations from the badge count entirely
    const result = await pool.query(
      `SELECT COUNT(DISTINCT m.conversation_id) AS unread_count
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       LEFT JOIN conversation_participants cp
         ON cp.conversation_id = c.id AND cp.participant_id = $1 AND cp.participant_type = $2
       LEFT JOIN conversation_hidden ch
         ON ch.conversation_id = c.id AND ch.hidden_by_id = $1 AND ch.hidden_by_type = $2
       LEFT JOIN conversation_muted cm
         ON cm.conversation_id = c.id AND cm.muted_by_id = $1 AND cm.muted_by_type = $2
         AND (cm.muted_until IS NULL OR cm.muted_until > NOW())
       WHERE (
         (c.is_group = false AND (
           (c.participant1_id = $1 AND c.participant1_type = $2)
           OR (c.participant2_id = $1 AND c.participant2_type = $2)
         ))
         OR (c.is_group = true AND cp.id IS NOT NULL)
       )
       AND (m.sender_id != $1 OR m.sender_type != $2)
       AND m.is_read = false
       AND (ch.id IS NULL OR c.last_message_at > ch.hidden_at)
       AND cm.id IS NULL`,
      [userId, userType],
    );
    res.json({ unreadCount: parseInt(result.rows[0]?.unread_count) || 0 });
  } catch (error) {
    console.error("Error getting unread count:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── sendTicketMessage (internal helper for eventController) ─────────────────
const sendTicketMessage = async ({ senderId, senderType, recipientId, recipientType, ticketData }) => {
  const conversationId = await getOrCreateConversation(senderId, senderType, recipientId, recipientType);
  const messageText = `🎟️ You received ${ticketData.quantity} ${ticketData.ticketName} ticket${ticketData.quantity > 1 ? "s" : ""} for ${ticketData.eventTitle}!`;
  const msgResult = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, sender_type, message_text, message_type, metadata)
     VALUES ($1, $2, $3, $4, 'ticket', $5)
     RETURNING id, created_at`,
    [conversationId, senderId, senderType, messageText, JSON.stringify(ticketData)],
  );
  const message = msgResult.rows[0];
  await pool.query(`UPDATE conversations SET last_message_at = $1 WHERE id = $2`, [message.created_at, conversationId]);
  return { conversationId, messageId: message.id, createdAt: message.created_at };
};

// ─── createGroupConversation ──────────────────────────────────────────────────
const createGroupConversation = async (req, res) => {
  try {
    const userId   = req.user?.id;
    const userType = req.user?.type;
    const { groupName, groupAvatarUrl, participants = [], autoJoin = false } = req.body;

    if (!userId || (userType !== "member" && userType !== "community")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!groupName || groupName.trim().length === 0) {
      return res.status(400).json({ error: "Group name is required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // If the creator is a community, record them as the owner so the per-group
      // auto-join toggle is visible in GroupInfoScreen.
      const communityOwnerId = userType === "community" ? userId : null;

      const convResult = await client.query(
        `INSERT INTO conversations
           (is_group, group_name, group_avatar_url, community_auto_join, community_owner_id)
         VALUES (true, $1, $2, $3, $4)
         RETURNING id, created_at`,
        [groupName.trim(), groupAvatarUrl || null, autoJoin, communityOwnerId],
      );
      const convId = convResult.rows[0].id;

      // Add creator as admin
      await client.query(
        `INSERT INTO conversation_participants
           (conversation_id, participant_id, participant_type, role)
         VALUES ($1, $2, $3, 'admin')`,
        [convId, userId, userType],
      );

      // Add other participants as members
      for (const p of participants) {
        if (String(p.id) === String(userId) && p.type === userType) continue;
        await client.query(
          `INSERT INTO conversation_participants
             (conversation_id, participant_id, participant_type, role)
           VALUES ($1, $2, $3, 'member')
           ON CONFLICT (conversation_id, participant_id, participant_type) DO NOTHING`,
          [convId, p.id, p.type || "member"],
        );
      }

      // System message
      await client.query(
        `INSERT INTO messages
           (conversation_id, sender_id, sender_type, message_text, message_type)
         VALUES ($1, $2, $3, $4, 'system')`,
        [convId, userId, userType, `Group "${groupName.trim()}" was created`],
      );

      await client.query(`UPDATE conversations SET last_message_at = NOW() WHERE id = $1`, [convId]);
      await client.query("COMMIT");

      res.status(201).json({ success: true, conversationId: convId });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error creating group conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── getGroupParticipants ─────────────────────────────────────────────────────
const getGroupParticipants = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId   = req.user?.id;
    const userType = req.user?.type;

    if (!userId || (userType !== "member" && userType !== "community")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify requester is a participant
    const check = await pool.query(
      `SELECT id FROM conversation_participants
       WHERE conversation_id = $1 AND participant_id = $2 AND participant_type = $3`,
      [conversationId, userId, userType],
    );
    if (check.rows.length === 0) return res.status(403).json({ error: "Not a participant" });

    // Fetch conversation metadata (created_at, avatar, messaging_restricted, auto-join)
    const convInfo = await pool.query(
      `SELECT created_at, group_avatar_url, messaging_restricted,
              community_auto_join, community_owner_id
       FROM conversations WHERE id = $1`,
      [conversationId],
    );
    const conversationMeta = convInfo.rows[0] || {};

    const result = await pool.query(
      `SELECT
         cp.id, cp.participant_id, cp.participant_type, cp.role, cp.joined_at,
         COALESCE(m.name,  comm.name)           AS name,
         COALESCE(m.username, comm.username)    AS username,
         COALESCE(m.profile_photo_url, comm.logo_url) AS photo_url
       FROM conversation_participants cp
       LEFT JOIN members m
         ON cp.participant_id = m.id AND cp.participant_type = 'member'
       LEFT JOIN communities comm
         ON cp.participant_id = comm.id AND cp.participant_type = 'community'
       WHERE cp.conversation_id = $1
       ORDER BY cp.role DESC, cp.joined_at ASC`,
      [conversationId],
    );

    const participants = result.rows.map((p) => ({
      participantId:   p.participant_id,
      participantType: p.participant_type,
      role:            p.role,
      name:            p.name,
      username:        p.username,
      photoUrl:        p.photo_url,
      joinedAt:        p.joined_at,
    }));

    // Derive the calling user's own role from the result
    const myParticipant = result.rows.find(
      (p) => String(p.participant_id) === String(userId) && p.participant_type === userType,
    );

    res.json({
      participants,
      createdAt:           conversationMeta.created_at,
      groupAvatarUrl:      conversationMeta.group_avatar_url,
      messagingRestricted: conversationMeta.messaging_restricted || false,
      communityAutoJoin:   conversationMeta.community_auto_join  || false,
      communityOwnerId:    conversationMeta.community_owner_id   || null,
      _myRole:             myParticipant?.role || "member",
    });
  } catch (error) {
    console.error("Error getting group participants:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── updateGroupConversation ──────────────────────────────────────────────────
const updateGroupConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId   = req.user?.id;
    const userType = req.user?.type;
    const { groupName, groupAvatarUrl, communityAutoJoin } = req.body;

    if (!userId || (userType !== "member" && userType !== "community")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const adminCheck = await pool.query(
      `SELECT id FROM conversation_participants
       WHERE conversation_id = $1 AND participant_id = $2 AND participant_type = $3 AND role = 'admin'`,
      [conversationId, userId, userType],
    );
    if (adminCheck.rows.length === 0) return res.status(403).json({ error: "Admin access required" });

    const { messagingRestricted } = req.body;
    const setClauses = [];
    const values = [];
    let i = 1;
    if (groupName !== undefined)      { setClauses.push(`group_name = $${i++}`);       values.push(groupName.trim()); }
    if (groupAvatarUrl !== undefined) { setClauses.push(`group_avatar_url = $${i++}`); values.push(groupAvatarUrl); }
    if (communityAutoJoin !== undefined && userType === "community") {
      setClauses.push(`community_auto_join = $${i++}`);
      values.push(communityAutoJoin);
    }
    if (messagingRestricted !== undefined) {
      setClauses.push(`messaging_restricted = $${i++}`);
      values.push(Boolean(messagingRestricted));
    }
    if (setClauses.length === 0) return res.status(400).json({ error: "Nothing to update" });
    values.push(conversationId);
    await pool.query(`UPDATE conversations SET ${setClauses.join(", ")} WHERE id = $${i}`, values);

    // Sync the community-wide master flag so the join-invite gate reflects per-group state.
    // When any group has community_auto_join = true → set auto_join_group_chat = true on community.
    // When all groups are off → set auto_join_group_chat = false.
    if (communityAutoJoin !== undefined && userType === "community") {
      const ownerRow = await pool.query(
        `SELECT community_owner_id FROM conversations WHERE id = $1`,
        [conversationId],
      );
      const ownerId = ownerRow.rows[0]?.community_owner_id;
      if (ownerId) {
        const anyOn = await pool.query(
          `SELECT 1 FROM conversations
           WHERE community_owner_id = $1 AND community_auto_join = true AND is_group = true
           LIMIT 1`,
          [ownerId],
        );
        await pool.query(
          `UPDATE communities SET auto_join_group_chat = $1 WHERE id = $2`,
          [anyOn.rows.length > 0, ownerId],
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating group conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── addGroupParticipant ──────────────────────────────────────────────────────
const addGroupParticipant = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId   = req.user?.id;
    const userType = req.user?.type;
    const { participantId, participantType = "member" } = req.body;

    if (!userId || (userType !== "member" && userType !== "community")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!participantId) return res.status(400).json({ error: "participantId required" });
    if (participantType !== "member") return res.status(403).json({ error: "Only members can be added" });

    const selfCheck = await pool.query(
      `SELECT id FROM conversation_participants
       WHERE conversation_id = $1 AND participant_id = $2 AND participant_type = $3`,
      [conversationId, userId, userType],
    );
    if (selfCheck.rows.length === 0) return res.status(403).json({ error: "Not a participant" });

    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, participant_id, participant_type, role)
       VALUES ($1, $2, $3, 'member')
       ON CONFLICT (conversation_id, participant_id, participant_type) DO NOTHING`,
      [conversationId, participantId, participantType],
    );
    await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, sender_type, message_text, message_type)
       VALUES ($1, $2, $3, 'A new member joined the group', 'system')`,
      [conversationId, userId, userType],
    );
    await pool.query(`UPDATE conversations SET last_message_at = NOW() WHERE id = $1`, [conversationId]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error adding group participant:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── selfJoinGroup ─────────────────────────────────────────────────────────────
// Called when a member accepts the "Join Group Chat" invite modal.
// They are NOT yet a participant, so we can't use the existing guard.
// Security: only succeeds if the group has community_auto_join = true.
const selfJoinGroup = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId   = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "member") {
      return res.status(401).json({ error: "Only members can self-join a group" });
    }

    // Verify the group exists and has auto-join enabled
    const groupCheck = await pool.query(
      `SELECT id, community_auto_join FROM conversations WHERE id = $1 AND is_group = true`,
      [conversationId],
    );
    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ error: "Group not found" });
    }
    if (!groupCheck.rows[0].community_auto_join) {
      return res.status(403).json({ error: "This group does not accept open joins" });
    }

    // Add the member (idempotent — DO NOTHING if already in group)
    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, participant_id, participant_type, role)
       VALUES ($1, $2, 'member', 'member')
       ON CONFLICT (conversation_id, participant_id, participant_type) DO NOTHING`,
      [conversationId, userId],
    );

    // System message announcing the join
    await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, sender_type, message_text, message_type)
       VALUES ($1, $2, 'member', 'joined the group.', 'system')`,
      [conversationId, userId],
    );
    await pool.query(`UPDATE conversations SET last_message_at = NOW() WHERE id = $1`, [conversationId]);

    res.json({ success: true, conversationId: Number(conversationId) });
  } catch (error) {
    console.error("Error self-joining group:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── removeGroupParticipant ───────────────────────────────────────────────────
const removeGroupParticipant = async (req, res) => {
  try {
    const { conversationId, participantId } = req.params;
    const { participantType = "member" } = req.query;
    const userId   = req.user?.id;
    const userType = req.user?.type;

    if (!userId || (userType !== "member" && userType !== "community")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const selfCheck = await pool.query(
      `SELECT role FROM conversation_participants
       WHERE conversation_id = $1 AND participant_id = $2 AND participant_type = $3`,
      [conversationId, userId, userType],
    );
    if (selfCheck.rows.length === 0) return res.status(403).json({ error: "Not a participant" });

    const isSelf  = String(participantId) === String(userId) && participantType === userType;
    const isAdmin = selfCheck.rows[0].role === "admin";

    if (!isSelf && !isAdmin) return res.status(403).json({ error: "Admin required to remove others" });

    if (isAdmin && isSelf) {
      const adminCount  = await pool.query(`SELECT COUNT(*) AS cnt FROM conversation_participants WHERE conversation_id = $1 AND role = 'admin'`, [conversationId]);
      const memberCount = await pool.query(`SELECT COUNT(*) AS cnt FROM conversation_participants WHERE conversation_id = $1`, [conversationId]);
      if (parseInt(adminCount.rows[0].cnt) === 1 && parseInt(memberCount.rows[0].cnt) > 1) {
        return res.status(400).json({ error: "Transfer admin role before leaving" });
      }
    }

    await pool.query(
      `DELETE FROM conversation_participants WHERE conversation_id = $1 AND participant_id = $2 AND participant_type = $3`,
      [conversationId, participantId, participantType],
    );
    const actionText = isSelf ? "A member left the group" : "A member was removed from the group";
    await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, sender_type, message_text, message_type) VALUES ($1, $2, $3, $4, 'system')`,
      [conversationId, userId, userType, actionText],
    );
    await pool.query(`UPDATE conversations SET last_message_at = NOW() WHERE id = $1`, [conversationId]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing group participant:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── transferAdmin (community-only) ──────────────────────────────────────────
const transferAdmin = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId   = req.user?.id;
    const userType = req.user?.type;
    const { newAdminId, newAdminType = "member" } = req.body;

    if (!userId || userType !== "community") return res.status(403).json({ error: "Community accounts only" });
    if (!newAdminId) return res.status(400).json({ error: "newAdminId required" });

    const adminCheck = await pool.query(
      `SELECT id FROM conversation_participants WHERE conversation_id = $1 AND participant_id = $2 AND participant_type = $3 AND role = 'admin'`,
      [conversationId, userId, userType],
    );
    if (adminCheck.rows.length === 0) return res.status(403).json({ error: "Admin access required" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE conversation_participants SET role = 'member' WHERE conversation_id = $1 AND participant_id = $2 AND participant_type = $3`, [conversationId, userId, userType]);
      await client.query(`UPDATE conversation_participants SET role = 'admin'  WHERE conversation_id = $1 AND participant_id = $2 AND participant_type = $3`, [conversationId, newAdminId, newAdminType]);
      await client.query("COMMIT");
    } catch (err) { await client.query("ROLLBACK"); throw err; }
    finally { client.release(); }
    res.json({ success: true });
  } catch (error) {
    console.error("Error transferring admin:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── hideConversation (DM delete-for-me) ─────────────────────────────────────
const hideConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId   = req.user?.id;
    const userType = req.user?.type;

    if (!userId || (userType !== "member" && userType !== "community")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const check = await pool.query(
      `SELECT id FROM conversations WHERE id = $1
       AND ((participant1_id = $2 AND participant1_type = $3) OR (participant2_id = $2 AND participant2_type = $3))`,
      [conversationId, userId, userType],
    );
    if (check.rows.length === 0) return res.status(404).json({ error: "Conversation not found" });

    await pool.query(
      `INSERT INTO conversation_hidden (conversation_id, hidden_by_id, hidden_by_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (conversation_id, hidden_by_id, hidden_by_type) DO NOTHING`,
      [conversationId, userId, userType],
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error hiding conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── unsendMessage ────────────────────────────────────────────────────────────
const unsendMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId   = req.user?.id;
    const userType = req.user?.type;

    if (!userId || (userType !== "member" && userType !== "community")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const check = await pool.query(
      `SELECT id FROM messages WHERE id = $1 AND sender_id = $2 AND sender_type = $3`,
      [messageId, userId, userType],
    );
    if (check.rows.length === 0) return res.status(403).json({ error: "Cannot unsend this message" });

    await pool.query(
      // deleted_by_type must be 'sender' or 'recipient' (DB CHECK constraint).
      // Unsend is only permitted by the message's own sender, so always use 'sender'.
      `UPDATE messages SET is_deleted = true, deleted_by_type = 'sender' WHERE id = $1`,
      [messageId],
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error unsending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── getGroupJoinInviteByCommunity ───────────────────────────────────────────
// Called with communityId; finds the first eligible auto-join group for that community.
const getGroupJoinInviteByCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId   = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "member") {
      return res.status(401).json({ error: "Member auth required" });
    }

    // 1. Check community-level preference
    const communityR = await pool.query(
      `SELECT id, name, auto_join_group_chat FROM communities WHERE id = $1`,
      [communityId],
    );
    if (communityR.rows.length === 0) {
      return res.json({ invite: null });
    }
    const community = communityR.rows[0];
    if (!community.auto_join_group_chat) {
      return res.json({ invite: null });
    }

    // 2. Find group chats owned by this community with auto-join enabled
    const groups = await pool.query(
      `SELECT c.id, c.group_name, c.group_avatar_url
       FROM conversations c
       JOIN conversation_participants cp
         ON cp.conversation_id = c.id
         AND cp.participant_id = $1
         AND cp.participant_type = 'community'
         AND cp.role = 'admin'
       WHERE c.is_group = true AND c.community_auto_join = true
       LIMIT 5`,
      [communityId],
    );
    if (groups.rows.length === 0) return res.json({ invite: null });

    // 3. Find the first group the member hasn't joined and hasn't dismissed
    for (const group of groups.rows) {
      const inGroup = await pool.query(
        `SELECT id FROM conversation_participants
         WHERE conversation_id = $1 AND participant_id = $2 AND participant_type = 'member'`,
        [group.id, userId],
      );
      if (inGroup.rows.length > 0) continue;

      const dismissed = await pool.query(
        `SELECT id FROM group_auto_join_dismissed
         WHERE conversation_id = $1 AND member_id = $2`,
        [group.id, userId],
      );
      if (dismissed.rows.length > 0) continue;

      return res.json({
        invite: {
          conversationId: group.id,
          groupName:      group.group_name,
          groupAvatarUrl: group.group_avatar_url,
          communityName:  community.name,
        },
      });
    }

    return res.json({ invite: null });
  } catch (error) {
    console.error("Error getting community group join invite:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── getGroupJoinInvite ───────────────────────────────────────────────────────

const getGroupJoinInvite = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId   = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "member") return res.status(401).json({ error: "Member auth required" });

    const conv = await pool.query(
      `SELECT id, group_name, group_avatar_url, community_auto_join FROM conversations WHERE id = $1 AND is_group = true`,
      [conversationId],
    );
    if (conv.rows.length === 0) return res.status(404).json({ error: "Group not found" });
    const group = conv.rows[0];
    if (!group.community_auto_join) return res.json({ showInvite: false });

    const inGroup = await pool.query(
      `SELECT id FROM conversation_participants WHERE conversation_id = $1 AND participant_id = $2 AND participant_type = 'member'`,
      [conversationId, userId],
    );
    if (inGroup.rows.length > 0) return res.json({ showInvite: false });

    const dismissed = await pool.query(
      `SELECT id FROM group_auto_join_dismissed WHERE conversation_id = $1 AND member_id = $2`,
      [conversationId, userId],
    );
    if (dismissed.rows.length > 0) return res.json({ showInvite: false });

    res.json({ showInvite: true, group: { id: group.id, name: group.group_name, avatarUrl: group.group_avatar_url } });
  } catch (error) {
    console.error("Error getting group join invite:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── dismissGroupInvite ───────────────────────────────────────────────────────
const dismissGroupInvite = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId   = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "member") return res.status(401).json({ error: "Member auth required" });

    await pool.query(
      `INSERT INTO group_auto_join_dismissed (conversation_id, member_id)
       VALUES ($1, $2) ON CONFLICT (conversation_id, member_id) DO NOTHING`,
      [conversationId, userId],
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error dismissing group invite:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── muteConversation ────────────────────────────────────────────────────────
const muteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId   = req.user?.id;
    const userType = req.user?.type;
    const { mutedUntil } = req.body; // ISO string or null (forever)

    if (!userId || (userType !== "member" && userType !== "community")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    // Verify user is part of this conversation
    const check = await pool.query(
      `SELECT c.id FROM conversations c
       LEFT JOIN conversation_participants cp
         ON cp.conversation_id = c.id AND cp.participant_id = $2 AND cp.participant_type = $3
       WHERE c.id = $1 AND (
         (c.is_group = false AND (
           (c.participant1_id = $2 AND c.participant1_type = $3)
           OR (c.participant2_id = $2 AND c.participant2_type = $3)
         ))
         OR (c.is_group = true AND cp.id IS NOT NULL)
       )`,
      [conversationId, userId, userType],
    );
    if (check.rows.length === 0) return res.status(404).json({ error: "Conversation not found" });

    await pool.query(
      `INSERT INTO conversation_muted (conversation_id, muted_by_id, muted_by_type, muted_until)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (conversation_id, muted_by_id, muted_by_type)
       DO UPDATE SET muted_until = $4, created_at = NOW()`,
      [conversationId, userId, userType, mutedUntil || null],
    );
    res.json({ success: true, mutedUntil: mutedUntil || null });
  } catch (error) {
    console.error("Error muting conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── unmuteConversation ───────────────────────────────────────────────────────
const unmuteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId   = req.user?.id;
    const userType = req.user?.type;

    if (!userId || (userType !== "member" && userType !== "community")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    await pool.query(
      `DELETE FROM conversation_muted
       WHERE conversation_id = $1 AND muted_by_id = $2 AND muted_by_type = $3`,
      [conversationId, userId, userType],
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error unmuting conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── reportConversation ───────────────────────────────────────────────────────
const reportConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId   = req.user?.id;
    const userType = req.user?.type;
    const { reason, details } = req.body;

    if (!userId || (userType !== "member" && userType !== "community")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!reason) return res.status(400).json({ error: "reason is required" });

    await pool.query(
      `INSERT INTO conversation_reports (conversation_id, reporter_id, reporter_type, reason, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [conversationId, userId, userType, reason, details || null],
    );
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("Error reporting conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── Admin: getChatReports ────────────────────────────────────────────────────
const getChatReports = async (req, res) => {
  try {
    const { status = "pending", page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const result = await pool.query(
      `SELECT cr.id, cr.conversation_id, cr.reporter_id, cr.reporter_type,
              cr.reason, cr.details, cr.status, cr.created_at, cr.resolved_at,
              cr.resolved_by, cr.resolution_note,
              c.group_name, c.is_group,
              COALESCE(m.name, comm.name)         AS reporter_name,
              COALESCE(m.username, comm.username) AS reporter_username
       FROM conversation_reports cr
       JOIN conversations c ON cr.conversation_id = c.id
       LEFT JOIN members m       ON (cr.reporter_id = m.id AND cr.reporter_type = 'member')
       LEFT JOIN communities comm ON (cr.reporter_id = comm.id AND cr.reporter_type = 'community')
       WHERE ($1 = 'all' OR cr.status = $1)
       ORDER BY cr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset],
    );
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM conversation_reports WHERE ($1 = 'all' OR status = $1)`,
      [status],
    );
    res.json({ reports: result.rows, total: parseInt(countResult.rows[0].total), page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error("Error getting chat reports:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── Admin: getChatReportById ─────────────────────────────────────────────────
const getChatReportById = async (req, res) => {
  try {
    const { reportId } = req.params;
    const reportResult = await pool.query(
      `SELECT cr.*, c.group_name, c.is_group, c.group_avatar_url,
              COALESCE(m.name, comm.name)               AS reporter_name,
              COALESCE(m.username, comm.username)        AS reporter_username,
              COALESCE(m.profile_photo_url, comm.logo_url) AS reporter_photo
       FROM conversation_reports cr
       JOIN conversations c ON cr.conversation_id = c.id
       LEFT JOIN members m       ON (cr.reporter_id = m.id AND cr.reporter_type = 'member')
       LEFT JOIN communities comm ON (cr.reporter_id = comm.id AND cr.reporter_type = 'community')
       WHERE cr.id = $1`,
      [reportId],
    );
    if (reportResult.rows.length === 0) return res.status(404).json({ error: "Report not found" });

    const report = reportResult.rows[0];
    const conversationId = report.conversation_id;

    // Fetch the last 100 messages for this conversation so admin can review the history
    const messagesResult = await pool.query(
      `SELECT
         msg.id,
         msg.sender_id,
         msg.sender_type,
         msg.message_text,
         msg.message_type,
         msg.is_deleted,
         msg.created_at,
         COALESCE(m.name,  comm.name)                      AS sender_name,
         COALESCE(m.username, comm.username)                AS sender_username,
         COALESCE(m.profile_photo_url, comm.logo_url)      AS sender_photo_url
       FROM messages msg
       LEFT JOIN members m       ON (msg.sender_id = m.id    AND msg.sender_type = 'member')
       LEFT JOIN communities comm ON (msg.sender_id = comm.id AND msg.sender_type = 'community')
       WHERE msg.conversation_id = $1
       ORDER BY msg.created_at ASC
       LIMIT 100`,
      [conversationId],
    );

    res.json({ report, messages: messagesResult.rows });
  } catch (error) {
    console.error("Error getting chat report:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── Admin: resolveChatReport ─────────────────────────────────────────────────
const resolveChatReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, resolutionNote } = req.body;
    if (!["resolved", "dismissed"].includes(status)) {
      return res.status(400).json({ error: "status must be 'resolved' or 'dismissed'" });
    }
    const result = await pool.query(
      `UPDATE conversation_reports
       SET status = $1, resolution_note = $2, resolved_at = NOW(), resolved_by = 'admin'
       WHERE id = $3 RETURNING id`,
      [status, resolutionNote || null, reportId],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Report not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("Error resolving chat report:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── module.exports ───────────────────────────────────────────────────────────
module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  markMessageRead,
  getUnreadCount,
  createGroupConversation,
  getGroupParticipants,
  updateGroupConversation,
  addGroupParticipant,
  selfJoinGroup,
  removeGroupParticipant,
  transferAdmin,
  hideConversation,
  muteConversation,
  unmuteConversation,
  unsendMessage,
  getGroupJoinInvite,
  getGroupJoinInviteByCommunity,
  dismissGroupInvite,

  reportConversation,
  getChatReports,
  getChatReportById,
  resolveChatReport,
  // Internal helpers
  getOrCreateConversation,
  sendTicketMessage,
};
