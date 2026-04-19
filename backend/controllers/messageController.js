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
        (SELECT COUNT(*) FROM messages msg
         WHERE msg.conversation_id = c.id
           AND (msg.sender_id != $1 OR msg.sender_type != $2)
           AND msg.is_read = false)                   AS unread_count
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
      WHERE (
        (c.participant1_id = $1 AND c.participant1_type = $2)
        OR (c.participant2_id = $1 AND c.participant2_type = $2)
      )
      AND c.is_group = false
      AND ch.id IS NULL
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
        NULL                          AS other_participant_id,
        NULL                          AS other_participant_type,
        NULL                          AS other_participant_name,
        NULL                          AS other_participant_username,
        NULL                          AS other_participant_photo,
        (SELECT msg.message_text FROM messages msg
         WHERE msg.conversation_id = c.id
         ORDER BY msg.created_at DESC LIMIT 1)       AS last_message_text,
        (SELECT COUNT(*) FROM messages msg
         WHERE msg.conversation_id = c.id
           AND (msg.sender_id != $1 OR msg.sender_type != $2)
           AND msg.is_read = false)                   AS unread_count
      FROM conversations c
      JOIN conversation_participants cp
        ON cp.conversation_id = c.id
        AND cp.participant_id = $1 AND cp.participant_type = $2
      LEFT JOIN conversation_hidden ch
        ON ch.conversation_id = c.id
        AND ch.hidden_by_id = $1 AND ch.hidden_by_type = $2
      WHERE c.is_group = true
        AND ch.id IS NULL
    `;

    const [dmResult, groupResult] = await Promise.all([
      pool.query(dmQuery, [userId, userType]),
      pool.query(groupQuery, [userId, userType]),
    ]);

    const mapConv = (conv) => ({
      id:             conv.conversation_id,
      isGroup:        conv.is_group,
      groupName:      conv.group_name      || null,
      groupAvatarUrl: conv.group_avatar_url || null,
      otherParticipant: conv.is_group ? null : {
        id:             conv.other_participant_id,
        type:           conv.other_participant_type,
        name:           conv.other_participant_name,
        username:       conv.other_participant_username,
        profilePhotoUrl: conv.other_participant_photo,
      },
      lastMessage:    conv.last_message_text,
      lastMessageAt:  conv.last_message_at,
      unreadCount:    parseInt(conv.unread_count) || 0,
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
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

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
        -- replied-to message preview
        rm.message_text   AS reply_message_text,
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
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [conversationId, limit, offset]);
    const messages = result.rows.reverse().map((msg) => ({
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
      replyPreview:      msg.reply_to_message_id ? {
        messageText:  msg.reply_is_deleted ? null : msg.reply_message_text,
        senderId:     msg.reply_sender_id,
        senderType:   msg.reply_sender_type,
        senderName:   msg.reply_sender_name,
        isDeleted:    msg.reply_is_deleted,
      } : null,
      createdAt:         msg.created_at,
    }));

    // Mark as read
    await pool.query(
      `UPDATE messages SET is_read = true
       WHERE conversation_id = $1
         AND (sender_id != $2 OR sender_type != $3)
         AND is_read = false`,
      [conversationId, userId, userType],
    );

    res.json({ messages });
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
      messageText,
      messageType = "text",
      reply_to_message_id,
    } = req.body;

    const userId   = req.user?.id;
    const userType = req.user?.type;

    if (!userId || (userType !== "member" && userType !== "community")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!messageText || messageText.trim().length === 0) {
      return res.status(400).json({ error: "Message text is required" });
    }

    let convId;

    if (conversationId) {
      // Group chat: verify participant
      const cpCheck = await pool.query(
        `SELECT id FROM conversation_participants
         WHERE conversation_id = $1 AND participant_id = $2 AND participant_type = $3`,
        [conversationId, userId, userType],
      );
      if (cpCheck.rows.length === 0) {
        return res.status(403).json({ error: "Not a participant of this group" });
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

    // Insert message
    const msgResult = await pool.query(
      `INSERT INTO messages
         (conversation_id, sender_id, sender_type, message_text, message_type, reply_to_message_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [convId, userId, userType, messageText.trim(), messageType, reply_to_message_id || null],
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
        messageText:    messageText.trim(),
        messageType,
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
    const result = await pool.query(
      `SELECT COUNT(DISTINCT m.conversation_id) AS unread_count
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       LEFT JOIN conversation_participants cp
         ON cp.conversation_id = c.id AND cp.participant_id = $1 AND cp.participant_type = $2
       WHERE (
         (c.is_group = false AND (
           (c.participant1_id = $1 AND c.participant1_type = $2)
           OR (c.participant2_id = $1 AND c.participant2_type = $2)
         ))
         OR (c.is_group = true AND cp.id IS NOT NULL)
       )
       AND (m.sender_id != $1 OR m.sender_type != $2)
       AND m.is_read = false`,
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

      const convResult = await client.query(
        `INSERT INTO conversations
           (is_group, group_name, group_avatar_url, community_auto_join)
         VALUES (true, $1, $2, $3)
         RETURNING id, created_at`,
        [groupName.trim(), groupAvatarUrl || null, autoJoin],
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
      id:          p.participant_id,
      type:        p.participant_type,
      role:        p.role,
      name:        p.name,
      username:    p.username,
      photoUrl:    p.photo_url,
      joinedAt:    p.joined_at,
    }));

    res.json({ participants });
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

    const setClauses = [];
    const values = [];
    let i = 1;
    if (groupName !== undefined)      { setClauses.push(`group_name = $${i++}`);       values.push(groupName.trim()); }
    if (groupAvatarUrl !== undefined) { setClauses.push(`group_avatar_url = $${i++}`); values.push(groupAvatarUrl); }
    if (communityAutoJoin !== undefined && userType === "community") {
      setClauses.push(`community_auto_join = $${i++}`);
      values.push(communityAutoJoin);
    }
    if (setClauses.length === 0) return res.status(400).json({ error: "Nothing to update" });
    values.push(conversationId);
    await pool.query(`UPDATE conversations SET ${setClauses.join(", ")} WHERE id = $${i}`, values);
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
      `UPDATE messages SET is_deleted = true, deleted_by_type = $1 WHERE id = $2`,
      [userType, messageId],
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error unsending message:", error);
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
    const result = await pool.query(
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
    if (result.rows.length === 0) return res.status(404).json({ error: "Report not found" });
    res.json({ report: result.rows[0] });
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
  removeGroupParticipant,
  transferAdmin,
  hideConversation,
  unsendMessage,
  getGroupJoinInvite,
  dismissGroupInvite,
  reportConversation,
  getChatReports,
  getChatReportById,
  resolveChatReport,
  // Internal helpers
  getOrCreateConversation,
  sendTicketMessage,
};
