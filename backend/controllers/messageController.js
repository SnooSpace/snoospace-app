const { createPool } = require("../config/db");

const pool = createPool();

// Helper function to get or create conversation between two participants (member or community)
const getOrCreateConversation = async (participant1Id, participant1Type, participant2Id, participant2Type) => {
  // Ensure consistent ordering (smaller ID first, or if same ID, type order)
  let p1Id, p1Type, p2Id, p2Type;
  if (participant1Id < participant2Id || (participant1Id === participant2Id && participant1Type < participant2Type)) {
    p1Id = participant1Id;
    p1Type = participant1Type;
    p2Id = participant2Id;
    p2Type = participant2Type;
  } else {
    p1Id = participant2Id;
    p1Type = participant2Type;
    p2Id = participant1Id;
    p2Type = participant1Type;
  }

  // Check if conversation exists
  const existing = await pool.query(
    `SELECT id FROM conversations 
     WHERE participant1_id = $1 AND participant1_type = $2 
       AND participant2_id = $3 AND participant2_type = $4`,
    [p1Id, p1Type, p2Id, p2Type]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  // Create new conversation
  const result = await pool.query(
    `INSERT INTO conversations (participant1_id, participant1_type, participant2_id, participant2_type) 
     VALUES ($1, $2, $3, $4) 
     RETURNING id`,
    [p1Id, p1Type, p2Id, p2Type]
  );

  return result.rows[0].id;
};

// Get all conversations for current user (member or community)
const getConversations = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || (userType !== 'member' && userType !== 'community')) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const query = `
      SELECT 
        c.id as conversation_id,
        c.last_message_at,
        c.created_at,
        CASE 
          WHEN c.participant1_id = $1 AND c.participant1_type = $2 THEN c.participant2_id
          ELSE c.participant1_id
        END as other_participant_id,
        CASE 
          WHEN c.participant1_id = $1 AND c.participant1_type = $2 THEN c.participant2_type
          ELSE c.participant1_type
        END as other_participant_type,
        COALESCE(m.name, comm.name) as other_participant_name,
        COALESCE(m.username, comm.username) as other_participant_username,
        COALESCE(m.profile_photo_url, comm.logo_url) as other_participant_photo,
        (
          SELECT message_text 
          FROM messages 
          WHERE conversation_id = c.id 
          ORDER BY created_at DESC 
          LIMIT 1
        ) as last_message_text,
        (
          SELECT COUNT(*) 
          FROM messages 
          WHERE conversation_id = c.id 
            AND (sender_id != $1 OR sender_type != $2)
            AND is_read = false
        ) as unread_count
      FROM conversations c
      LEFT JOIN members m ON (
        ((c.participant1_id = $1 AND c.participant1_type = $2 AND m.id = c.participant2_id AND c.participant2_type = 'member') OR
         (c.participant2_id = $1 AND c.participant2_type = $2 AND m.id = c.participant1_id AND c.participant1_type = 'member'))
      )
      LEFT JOIN communities comm ON (
        ((c.participant1_id = $1 AND c.participant1_type = $2 AND comm.id = c.participant2_id AND c.participant2_type = 'community') OR
         (c.participant2_id = $1 AND c.participant2_type = $2 AND comm.id = c.participant1_id AND c.participant1_type = 'community'))
      )
      WHERE (c.participant1_id = $1 AND c.participant1_type = $2) OR (c.participant2_id = $1 AND c.participant2_type = $2)
      ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
    `;

    const result = await pool.query(query, [userId, userType]);
    const conversations = result.rows.map(conv => ({
      id: conv.conversation_id,
      otherParticipant: {
        id: conv.other_participant_id,
        type: conv.other_participant_type,
        name: conv.other_participant_name,
        username: conv.other_participant_username,
        profilePhotoUrl: conv.other_participant_photo,
      },
      lastMessage: conv.last_message_text,
      lastMessageAt: conv.last_message_at,
      unreadCount: parseInt(conv.unread_count) || 0,
      createdAt: conv.created_at,
    }));

    res.json({ conversations });
  } catch (error) {
    console.error("Error getting conversations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get messages for a conversation
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    if (!userId || (userType !== 'member' && userType !== 'community')) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify user is part of this conversation
    const convCheck = await pool.query(
      `SELECT id FROM conversations 
       WHERE id = $1 AND ((participant1_id = $2 AND participant1_type = $3) OR (participant2_id = $2 AND participant2_type = $3))`,
      [conversationId, userId, userType]
    );

    if (convCheck.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Get messages
    const query = `
      SELECT 
        m.id,
        m.sender_id,
        m.sender_type,
        m.message_text,
        m.is_read,
        m.created_at,
        COALESCE(mem.name, comm.name) as sender_name,
        COALESCE(mem.username, comm.username) as sender_username,
        COALESCE(mem.profile_photo_url, comm.logo_url) as sender_photo_url
      FROM messages m
      LEFT JOIN members mem ON (m.sender_id = mem.id AND m.sender_type = 'member')
      LEFT JOIN communities comm ON (m.sender_id = comm.id AND m.sender_type = 'community')
      WHERE m.conversation_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [conversationId, limit, offset]);
    const messages = result.rows.reverse().map(msg => ({
      id: msg.id,
      senderId: msg.sender_id,
      senderType: msg.sender_type,
      senderName: msg.sender_name,
      senderUsername: msg.sender_username,
      senderPhotoUrl: msg.sender_photo_url,
      messageText: msg.message_text,
      isRead: msg.is_read,
      createdAt: msg.created_at,
    }));

    // Mark messages as read (only messages sent by the other participant)
    await pool.query(
      `UPDATE messages 
       SET is_read = true 
       WHERE conversation_id = $1 
         AND (sender_id != $2 OR sender_type != $3)
         AND is_read = false`,
      [conversationId, userId, userType]
    );

    res.json({ messages });
  } catch (error) {
    console.error("Error getting messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Send a message
const sendMessage = async (req, res) => {
  try {
    const { recipientId, recipientType = 'member', messageText } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || (userType !== 'member' && userType !== 'community')) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!recipientId || !messageText || messageText.trim().length === 0) {
      return res.status(400).json({ error: "Recipient ID and message text are required" });
    }

    if (userId === recipientId && userType === recipientType) {
      return res.status(400).json({ error: "Cannot send message to yourself" });
    }

    // Verify recipient exists
    let recipientCheck;
    if (recipientType === 'member') {
      recipientCheck = await pool.query(
        "SELECT id FROM members WHERE id = $1",
        [recipientId]
      );
    } else if (recipientType === 'community') {
      recipientCheck = await pool.query(
        "SELECT id FROM communities WHERE id = $1",
        [recipientId]
      );
    } else {
      return res.status(400).json({ error: "Invalid recipient type" });
    }

    if (recipientCheck.rows.length === 0) {
      return res.status(404).json({ error: "Recipient not found" });
    }

    // Get or create conversation
    const conversationId = await getOrCreateConversation(userId, userType, recipientId, recipientType);

    // Insert message
    const messageQuery = `
      INSERT INTO messages (conversation_id, sender_id, sender_type, message_text)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at
    `;

    const messageResult = await pool.query(messageQuery, [
      conversationId,
      userId,
      userType,
      messageText.trim()
    ]);

    const message = messageResult.rows[0];

    // Update conversation's last_message_at
    await pool.query(
      `UPDATE conversations 
       SET last_message_at = $1 
       WHERE id = $2`,
      [message.created_at, conversationId]
    );

    // Get sender info
    let senderInfo;
    if (userType === 'member') {
      senderInfo = await pool.query(
        "SELECT name, username, profile_photo_url FROM members WHERE id = $1",
        [userId]
      );
    } else {
      senderInfo = await pool.query(
        "SELECT name, username, logo_url as profile_photo_url FROM communities WHERE id = $1",
        [userId]
      );
    }

    res.status(201).json({
      success: true,
      message: {
        id: message.id,
        conversationId,
        senderId: userId,
        senderType: userType,
        senderName: senderInfo.rows[0]?.name,
        senderUsername: senderInfo.rows[0]?.username,
        senderPhotoUrl: senderInfo.rows[0]?.profile_photo_url,
        messageText: messageText.trim(),
        isRead: false,
        createdAt: message.created_at,
      }
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Mark message as read
const markMessageRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || (userType !== 'member' && userType !== 'community')) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify message exists and user is part of the conversation
    const messageCheck = await pool.query(
      `SELECT m.id, m.conversation_id, m.sender_id
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE m.id = $1 
         AND ((c.participant1_id = $2 AND c.participant1_type = $3) OR (c.participant2_id = $2 AND c.participant2_type = $3))
         AND (m.sender_id != $2 OR m.sender_type != $3)`,
      [messageId, userId, userType]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }

    await pool.query(
      "UPDATE messages SET is_read = true WHERE id = $1",
      [messageId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get unread message count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || (userType !== 'member' && userType !== 'community')) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const query = `
      SELECT COUNT(DISTINCT m.conversation_id) as unread_count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE ((c.participant1_id = $1 AND c.participant1_type = $2) OR (c.participant2_id = $1 AND c.participant2_type = $2))
        AND (m.sender_id != $1 OR m.sender_type != $2)
        AND m.is_read = false
    `;

    const result = await pool.query(query, [userId, userType]);
    const unreadCount = parseInt(result.rows[0]?.unread_count) || 0;

    res.json({ unreadCount });
  } catch (error) {
    console.error("Error getting unread count:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  markMessageRead,
  getUnreadCount,
};

