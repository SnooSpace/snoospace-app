const { createPool } = require("../config/db");
const pool = createPool();

/**
 * Share a post to user(s) via DM or copy link
 * POST /posts/:postId/share
 */
const sharePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { recipients, shareType, message } = req.body; // recipients: [{id, type}], shareType: 'internal' | 'copy_link'
    const userId = req.user.id;
    const userType = req.user.type;

    // Validate share type
    if (!["internal", "copy_link"].includes(shareType)) {
      return res.status(400).json({ error: "Invalid share type" });
    }

    // Verify post exists
    const postCheck = await pool.query(
      "SELECT id, author_id, author_type, caption, image_urls FROM posts WHERE id = $1",
      [postId],
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = postCheck.rows[0];

    if (shareType === "copy_link") {
      // Record copy link share
      await pool.query(
        `INSERT INTO post_shares (post_id, sharer_id, sharer_type, share_type)
         VALUES ($1, $2, $3, $4)`,
        [postId, userId, userType, "copy_link"],
      );

      // Increment share count
      await pool.query(
        "UPDATE posts SET share_count = share_count + 1 WHERE id = $1",
        [postId],
      );

      const updatedPost = await pool.query(
        "SELECT share_count FROM posts WHERE id = $1",
        [postId],
      );

      return res.json({
        success: true,
        shareCount: updatedPost.rows[0].share_count,
      });
    }

    // Internal sharing to users
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res
        .status(400)
        .json({ error: "Recipients required for internal sharing" });
    }

    // Create post preview for message
    const firstImageUrl = Array.isArray(post.image_urls)
      ? post.image_urls.flat()[0]
      : null;

    const truncatedCaption = post.caption
      ? post.caption.substring(0, 100) +
        (post.caption.length > 100 ? "..." : "")
      : "";

    const postPreview = {
      postId: post.id,
      authorId: post.author_id,
      authorType: post.author_type,
      imageUrl: firstImageUrl,
      caption: truncatedCaption,
    };

    // Send message to each recipient
    for (const recipient of recipients) {
      // Normalize participant order (lower ID first)
      const p1Id = userId < recipient.id ? userId : recipient.id;
      const p1Type = userId < recipient.id ? userType : recipient.type;
      const p2Id = userId < recipient.id ? recipient.id : userId;
      const p2Type = userId < recipient.id ? recipient.type : userType;

      // Find existing conversation
      let conversationId;
      const existingConv = await pool.query(
        `SELECT id FROM conversations 
         WHERE participant1_id = $1 AND participant1_type = $2 
           AND participant2_id = $3 AND participant2_type = $4`,
        [p1Id, p1Type, p2Id, p2Type],
      );

      if (existingConv.rows.length > 0) {
        conversationId = existingConv.rows[0].id;
        // Update last message time
        await pool.query(
          `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
          [conversationId],
        );
      } else {
        // Create new conversation
        const newConv = await pool.query(
          `INSERT INTO conversations (participant1_id, participant1_type, participant2_id, participant2_type, last_message_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING id`,
          [p1Id, p1Type, p2Id, p2Type],
        );
        conversationId = newConv.rows[0].id;
      }

      // Create message with post preview
      const messageText = message || "Shared a post with you";
      await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, sender_type, message_text, message_type, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          conversationId,
          userId,
          userType,
          messageText,
          "post_share",
          JSON.stringify(postPreview),
        ],
      );

      // Record share
      await pool.query(
        `INSERT INTO post_shares (post_id, sharer_id, sharer_type, share_type, recipient_id, recipient_type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [postId, userId, userType, "internal", recipient.id, recipient.type],
      );
    }

    // Increment share count by number of recipients
    await pool.query(
      "UPDATE posts SET share_count = share_count + $1 WHERE id = $2",
      [recipients.length, postId],
    );

    const updatedPost = await pool.query(
      "SELECT share_count FROM posts WHERE id = $1",
      [postId],
    );

    res.json({
      success: true,
      shareCount: updatedPost.rows[0].share_count,
      recipientCount: recipients.length,
    });
  } catch (error) {
    console.error("Share post error:", error);
    res.status(500).json({ error: "Failed to share post" });
  }
};

/**
 * Get share count and details for a post
 * GET /posts/:postId/shares
 */
const getPostShares = async (req, res) => {
  try {
    const { postId } = req.params;

    const result = await pool.query(
      "SELECT share_count FROM posts WHERE id = $1",
      [postId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json({ shareCount: result.rows[0].share_count });
  } catch (error) {
    console.error("Get post shares error:", error);
    res.status(500).json({ error: "Failed to get share count" });
  }
};

/**
 * Get users the current user has recently chatted with
 * GET /chat/recent-users
 */
const getRecentChatUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.type;
    const limit = parseInt(req.query.limit) || 20;

    // Get recent conversations
    const conversations = await pool.query(
      `SELECT DISTINCT
        CASE 
          WHEN participant1_id = $1 AND participant1_type = $2 THEN participant2_id
          ELSE participant1_id
        END as user_id,
        CASE 
          WHEN participant1_id = $1 AND participant1_type = $2 THEN participant2_type
          ELSE participant1_type
        END as user_type,
        last_message_at
       FROM conversations
       WHERE (participant1_id = $1 AND participant1_type = $2)
          OR (participant2_id = $1 AND participant2_type = $2)
       ORDER BY last_message_at DESC
       LIMIT $3`,
      [userId, userType, limit],
    );

    // Fetch user details for each conversation partner
    const users = [];
    for (const conv of conversations.rows) {
      let userQuery;
      if (conv.user_type === "member") {
        userQuery = await pool.query(
          "SELECT id, name as full_name, username, profile_photo_url FROM members WHERE id = $1",
          [conv.user_id],
        );
      } else if (conv.user_type === "community") {
        userQuery = await pool.query(
          "SELECT id, name, username, logo_url as profile_photo_url FROM communities WHERE id = $1",
          [conv.user_id],
        );
      } else if (conv.user_type === "sponsor") {
        userQuery = await pool.query(
          "SELECT id, brand_name as name, username, logo_url as profile_photo_url FROM sponsors WHERE id = $1",
          [conv.user_id],
        );
      } else if (conv.user_type === "venue") {
        userQuery = await pool.query(
          "SELECT id, name, username, logo_url as profile_photo_url FROM venues WHERE id = $1",
          [conv.user_id],
        );
      }

      if (userQuery && userQuery.rows.length > 0) {
        users.push({
          ...userQuery.rows[0],
          type: conv.user_type,
          lastMessageAt: conv.last_message_at,
        });
      }
    }

    res.json({ users });
  } catch (error) {
    console.error("Get recent chat users error:", error);
    res.status(500).json({ error: "Failed to get recent users" });
  }
};

module.exports = {
  sharePost,
  getPostShares,
  getRecentChatUsers,
};
