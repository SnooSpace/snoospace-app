const { createPool } = require("../config/db");

const pool = createPool();

// Helper function to get or create conversation between two members
const getOrCreateConversation = async (member1Id, member2Id) => {
  // Ensure consistent ordering (smaller ID first)
  const participant1Id = Math.min(member1Id, member2Id);
  const participant2Id = Math.max(member1Id, member2Id);

  // Check if conversation exists
  const existing = await pool.query(
    `SELECT id FROM conversations 
     WHERE participant1_id = $1 AND participant2_id = $2`,
    [participant1Id, participant2Id]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  // Create new conversation
  const result = await pool.query(
    `INSERT INTO conversations (participant1_id, participant2_id) 
     VALUES ($1, $2) 
     RETURNING id`,
    [participant1Id, participant2Id]
  );

  return result.rows[0].id;
};

// Get all conversations for current user
const getConversations = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: "Authentication required" });
    }

    const query = `
      SELECT 
        c.id as conversation_id,
        c.last_message_at,
        c.created_at,
        CASE 
          WHEN c.participant1_id = $1 THEN c.participant2_id
          ELSE c.participant1_id
        END as other_participant_id,
        m.name as other_participant_name,
        m.username as other_participant_username,
        m.profile_photo_url as other_participant_photo,
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
            AND sender_id != $1 
            AND is_read = false
        ) as unread_count
      FROM conversations c
      LEFT JOIN members m ON (
        (c.participant1_id = $1 AND m.id = c.participant2_id) OR
        (c.participant2_id = $1 AND m.id = c.participant1_id)
      )
      WHERE c.participant1_id = $1 OR c.participant2_id = $1
      ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    const conversations = result.rows.map(conv => ({
      id: conv.conversation_id,
      otherParticipant: {
        id: conv.other_participant_id,
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

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify user is part of this conversation
    const convCheck = await pool.query(
      `SELECT id FROM conversations 
       WHERE id = $1 AND (participant1_id = $2 OR participant2_id = $2)`,
      [conversationId, userId]
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
        mem.name as sender_name,
        mem.username as sender_username,
        mem.profile_photo_url as sender_photo_url
      FROM messages m
      LEFT JOIN members mem ON m.sender_id = mem.id
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
         AND sender_id != $2 
         AND is_read = false`,
      [conversationId, userId]
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
    const { recipientId, messageText } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!recipientId || !messageText || messageText.trim().length === 0) {
      return res.status(400).json({ error: "Recipient ID and message text are required" });
    }

    if (userId === recipientId) {
      return res.status(400).json({ error: "Cannot send message to yourself" });
    }

    // Verify recipient exists
    const recipientCheck = await pool.query(
      "SELECT id FROM members WHERE id = $1",
      [recipientId]
    );

    if (recipientCheck.rows.length === 0) {
      return res.status(404).json({ error: "Recipient not found" });
    }

    // Get or create conversation
    const conversationId = await getOrCreateConversation(userId, recipientId);

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
    const senderInfo = await pool.query(
      "SELECT name, username, profile_photo_url FROM members WHERE id = $1",
      [userId]
    );

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

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify message exists and user is part of the conversation
    const messageCheck = await pool.query(
      `SELECT m.id, m.conversation_id, m.sender_id
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE m.id = $1 
         AND (c.participant1_id = $2 OR c.participant2_id = $2)
         AND m.sender_id != $2`,
      [messageId, userId]
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

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: "Authentication required" });
    }

    const query = `
      SELECT COUNT(*) as unread_count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE (c.participant1_id = $1 OR c.participant2_id = $1)
        AND m.sender_id != $1
        AND m.is_read = false
    `;

    const result = await pool.query(query, [userId]);
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

