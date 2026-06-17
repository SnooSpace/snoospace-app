const { createPool } = require("../config/db");
const pool = createPool();

/**
 * Helper: Get or create conversation with proper participant normalization
 * Implemented here to avoid circular dependency with messageController
 */
const getOrCreateConversation = async (
  participant1Id,
  participant1Type,
  participant2Id,
  participant2Type,
) => {
  // Convert IDs to numbers for consistent comparison
  const id1 = Number(participant1Id);
  const id2 = Number(participant2Id);

  // Ensure consistent ordering (smaller ID first, or if same ID, alphabetically by type)
  let p1Id, p1Type, p2Id, p2Type;
  if (id1 < id2 || (id1 === id2 && participant1Type < participant2Type)) {
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

  // Use INSERT ... ON CONFLICT to handle race conditions safely
  const insertResult = await pool.query(
    `INSERT INTO conversations (participant1_id, participant1_type, participant2_id, participant2_type) 
     VALUES ($1, $2, $3, $4) 
     ON CONFLICT (participant1_id, participant1_type, participant2_id, participant2_type) 
     DO NOTHING
     RETURNING id`,
    [p1Id, p1Type, p2Id, p2Type],
  );

  // DO NOTHING returns no rows if the conversation already existed — fall back to SELECT
  if (insertResult.rows.length > 0) {
    return insertResult.rows[0].id;
  }

  const selectResult = await pool.query(
    `SELECT id FROM conversations
     WHERE participant1_id = $1 AND participant1_type = $2
       AND participant2_id = $3 AND participant2_type = $4`,
    [p1Id, p1Type, p2Id, p2Type],
  );

  return selectResult.rows[0].id;
};

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
      "SELECT id, author_id, author_type, caption, image_urls, type_data FROM posts WHERE id = $1",
      [postId],
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = postCheck.rows[0];

    // Determine if anonymous from type_data
    let typeData = {};
    try {
      if (post.type_data) {
        typeData = typeof post.type_data === "object" ? post.type_data : JSON.parse(post.type_data);
      }
    } catch (e) {
      typeData = {};
    }
    const isAnon = typeData.is_anonymous === true;

    // Also fetch author info so we can embed it in the metadata as a permanent fallback
    // (needed when the post is later deleted and we still want to show who posted it)
    let authorUsername = null;
    let authorName = null;
    if (!isAnon) {
      if (post.author_type === "member") {
        const authorInfo = await pool.query(
          "SELECT username, name FROM members WHERE id = $1",
          [post.author_id],
        );
        authorUsername = authorInfo.rows[0]?.username || null;
        authorName = authorInfo.rows[0]?.name || null;
      } else if (post.author_type === "community") {
        const authorInfo = await pool.query(
          "SELECT username, name FROM communities WHERE id = $1",
          [post.author_id],
        );
        authorUsername = authorInfo.rows[0]?.username || null;
        authorName = authorInfo.rows[0]?.name || null;
      }
    } else {
      authorName = "Anonymous";
    }

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
      authorId: isAnon ? null : post.author_id,
      authorType: isAnon ? null : post.author_type,
      authorUsername,
      authorName,
      imageUrl: firstImageUrl,
      caption: truncatedCaption,
    };

    // Send message to each recipient
    const blockedRecipients = [];
    for (const recipient of recipients) {
      // ── GROUP CHAT recipient ───────────────────────────────────────────────
      // When the frontend sends type:"group" it includes the conversationId
      // directly — no DM creation needed, just verify membership + restriction.
      if (recipient.type === "group") {
        const convId = recipient.conversationId;
        if (!convId) { blockedRecipients.push(recipient.id); continue; }

        const cpCheck = await pool.query(
          `SELECT cp.role, c.messaging_restricted
           FROM conversations c
           JOIN conversation_participants cp
             ON cp.conversation_id = c.id
             AND cp.participant_id = $1 AND cp.participant_type = $2
           WHERE c.id = $3 AND c.is_group = true`,
          [userId, userType, convId],
        );
        if (cpCheck.rows.length === 0) { blockedRecipients.push(recipient.id); continue; }

        const { role, messaging_restricted } = cpCheck.rows[0];
        if (messaging_restricted && role !== "admin") {
          blockedRecipients.push(recipient.id);
          continue;
        }

        const messageText = message || "Shared a post with you";
        await pool.query(
          `INSERT INTO messages (conversation_id, sender_id, sender_type, message_text, message_type, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [convId, userId, userType, messageText, "post_share", JSON.stringify(postPreview)],
        );
        await pool.query(
          `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
          [convId],
        );
        await pool.query(
          `INSERT INTO post_shares (post_id, sharer_id, sharer_type, share_type, recipient_id, recipient_type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [postId, userId, userType, "internal", convId, "group"],
        );
        continue;
      }

      // ── DM / COMMUNITY recipient ──────────────────────────────────────────
      // If the recipient is a community, find the group conversation between
      // the current user and that community. If messaging_restricted = true
      // and the current user is not an admin, block the share — same rule
      // as the sendMessage endpoint enforces.
      if (recipient.type === "community") {
        const groupConvCheck = await pool.query(
          `SELECT c.id, c.messaging_restricted, cp.role
           FROM conversations c
           JOIN conversation_participants cp
             ON cp.conversation_id = c.id
             AND cp.participant_id = $1 AND cp.participant_type = $2
           WHERE c.is_group = true
             AND c.group_owner_id = $3 AND c.group_owner_type = 'community'
           LIMIT 1`,
          [userId, userType, recipient.id],
        );

        if (groupConvCheck.rows.length > 0) {
          const { messaging_restricted, role } = groupConvCheck.rows[0];
          if (messaging_restricted && role !== "admin") {
            blockedRecipients.push(recipient.id);
            continue;
          }
        }
      }

      // Get or create conversation using our helper function
      const conversationId = await getOrCreateConversation(
        userId,
        userType,
        recipient.id,
        recipient.type,
      );

      // Update last message time
      await pool.query(
        `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
        [conversationId],
      );

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

    // If ALL recipients were blocked, return a clear error
    const successCount = recipients.length - blockedRecipients.length;
    if (successCount === 0) {
      return res.status(403).json({
        error: "Sharing is restricted in this group. Only admins can share posts here.",
      });
    }

    // Increment share count only for successfully shared recipients
    await pool.query(
      "UPDATE posts SET share_count = share_count + $1 WHERE id = $2",
      [successCount, postId],
    );

    const updatedPost = await pool.query(
      "SELECT share_count FROM posts WHERE id = $1",
      [postId],
    );

    res.json({
      success: true,
      shareCount: updatedPost.rows[0].share_count,
      recipientCount: successCount,
      blockedCount: blockedRecipients.length,
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
        let shareRestricted = false;

        // For community recipients, check if their group chat restricts
        // non-admin members from sending (and thus sharing) posts.
        if (conv.user_type === "community") {
          const groupRestrictionCheck = await pool.query(
            `SELECT c.messaging_restricted, cp.role
             FROM conversations c
             JOIN conversation_participants cp
               ON cp.conversation_id = c.id
               AND cp.participant_id = $1 AND cp.participant_type = $2
             WHERE c.is_group = true
               AND c.group_owner_id = $3 AND c.group_owner_type = 'community'
             LIMIT 1`,
            [userId, userType, conv.user_id],
          );

          if (groupRestrictionCheck.rows.length > 0) {
            const { messaging_restricted, role } = groupRestrictionCheck.rows[0];
            shareRestricted = messaging_restricted === true && role !== "admin";
          }
        }

        users.push({
          ...userQuery.rows[0],
          type: conv.user_type,
          lastMessageAt: conv.last_message_at,
          shareRestricted, // true = member cannot share to this community group
        });
      }
    }

    res.json({ users });
  } catch (error) {
    console.error("Get recent chat users error:", error);
    res.status(500).json({ error: "Failed to get recent users" });
  }
};

/**
 * Search share recipients: members, communities, and group chats the user belongs to.
 * Empty query → recent DM partners + group chats. Non-empty → live search.
 * GET /chat/share-search?q=<query>
 */
const searchShareRecipients = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.type;
    const q = (req.query.q || "").trim();
    const limit = Math.min(parseInt(req.query.limit) || 30, 50);

    // ── Helper: check share restriction for a community ──────────────────────
    const getShareRestricted = async (communityId) => {
      const check = await pool.query(
        `SELECT c.messaging_restricted, cp.role
         FROM conversations c
         JOIN conversation_participants cp
           ON cp.conversation_id = c.id
           AND cp.participant_id = $1 AND cp.participant_type = $2
         WHERE c.is_group = true
           AND c.group_owner_id = $3 AND c.group_owner_type = 'community'
         LIMIT 1`,
        [userId, userType, communityId],
      );
      if (check.rows.length === 0) return false;
      const { messaging_restricted, role } = check.rows[0];
      return messaging_restricted === true && role !== "admin";
    };

    if (!q) {
      // ── Empty query: recent DM partners + group chats ────────────────────
      const perLimit = Math.ceil(limit / 2);

      const recentDMs = await pool.query(
        `SELECT DISTINCT
           CASE WHEN participant1_id=$1 AND participant1_type=$2 THEN participant2_id ELSE participant1_id END AS user_id,
           CASE WHEN participant1_id=$1 AND participant1_type=$2 THEN participant2_type ELSE participant1_type END AS user_type,
           last_message_at
         FROM conversations
         WHERE is_group = false
           AND ((participant1_id=$1 AND participant1_type=$2) OR (participant2_id=$1 AND participant2_type=$2))
         ORDER BY last_message_at DESC NULLS LAST
         LIMIT $3`,
        [userId, userType, perLimit],
      );

      const recentGroups = await pool.query(
        `SELECT c.id, c.group_name, c.group_avatar_url, c.messaging_restricted,
                cp.role, c.last_message_at
         FROM conversations c
         JOIN conversation_participants cp
           ON cp.conversation_id = c.id AND cp.participant_id=$1 AND cp.participant_type=$2
         WHERE c.is_group = true
         ORDER BY c.last_message_at DESC NULLS LAST
         LIMIT $3`,
        [userId, userType, perLimit],
      );

      const users = [];

      for (const conv of recentDMs.rows) {
        let row = null;
        if (conv.user_type === "member") {
          const r = await pool.query(
            "SELECT id, name as full_name, username, profile_photo_url FROM members WHERE id=$1",
            [conv.user_id],
          );
          row = r.rows[0];
        } else if (conv.user_type === "community") {
          const r = await pool.query(
            "SELECT id, name, username, logo_url as profile_photo_url FROM communities WHERE id=$1",
            [conv.user_id],
          );
          row = r.rows[0];
        } else if (conv.user_type === "sponsor") {
          const r = await pool.query(
            "SELECT id, brand_name as name, username, logo_url as profile_photo_url FROM sponsors WHERE id=$1",
            [conv.user_id],
          );
          row = r.rows[0];
        } else if (conv.user_type === "venue") {
          const r = await pool.query(
            "SELECT id, name, username, logo_url as profile_photo_url FROM venues WHERE id=$1",
            [conv.user_id],
          );
          row = r.rows[0];
        }
        if (row) {
          const shareRestricted = conv.user_type === "community"
            ? await getShareRestricted(conv.user_id)
            : false;
          users.push({
            ...row,
            type: conv.user_type,
            lastMessageAt: conv.last_message_at,
            shareRestricted,
            isGroup: false,
          });
        }
      }

      for (const g of recentGroups.rows) {
        const shareRestricted = g.messaging_restricted === true && g.role !== "admin";
        users.push({
          id: g.id,
          name: g.group_name,
          full_name: g.group_name,
          profile_photo_url: g.group_avatar_url || null,
          type: "group",
          isGroup: true,
          conversationId: g.id,
          myRole: g.role,
          lastMessageAt: g.last_message_at,
          shareRestricted,
        });
      }

      return res.json({ users });
    }

    // ── Active query: live search ─────────────────────────────────────────────
    const like = `%${q}%`;
    const perTypeLimit = Math.ceil(limit / 3);

    let membersQuery, membersParams;
    if (userType === "member") {
      membersQuery = `SELECT id, name as full_name, username, profile_photo_url
                      FROM members
                      WHERE (LOWER(COALESCE(username,'')) LIKE LOWER($1) OR LOWER(name) LIKE LOWER($1))
                        AND id <> $2
                      ORDER BY name ASC LIMIT $3`;
      membersParams = [like, userId, perTypeLimit];
    } else {
      membersQuery = `SELECT id, name as full_name, username, profile_photo_url
                      FROM members
                      WHERE LOWER(COALESCE(username,'')) LIKE LOWER($1) OR LOWER(name) LIKE LOWER($1)
                      ORDER BY name ASC LIMIT $2`;
      membersParams = [like, perTypeLimit];
    }

    let communitiesQuery, communitiesParams;
    if (userType === "community") {
      communitiesQuery = `SELECT id, name, username, logo_url as profile_photo_url
                          FROM communities
                          WHERE (LOWER(COALESCE(username,'')) LIKE LOWER($1) OR LOWER(name) LIKE LOWER($1))
                            AND id <> $2
                          ORDER BY name ASC LIMIT $3`;
      communitiesParams = [like, userId, perTypeLimit];
    } else {
      communitiesQuery = `SELECT id, name, username, logo_url as profile_photo_url
                          FROM communities
                          WHERE LOWER(COALESCE(username,'')) LIKE LOWER($1) OR LOWER(name) LIKE LOWER($1)
                          ORDER BY name ASC LIMIT $2`;
      communitiesParams = [like, perTypeLimit];
    }

    const groupsQuery = `
      SELECT c.id, c.group_name, c.group_avatar_url, c.messaging_restricted, cp.role
      FROM conversations c
      JOIN conversation_participants cp
        ON cp.conversation_id = c.id AND cp.participant_id=$1 AND cp.participant_type=$2
      WHERE c.is_group = true
        AND LOWER(c.group_name) LIKE LOWER($3)
      ORDER BY c.group_name ASC LIMIT $4`;
    const groupsParams = [userId, userType, like, perTypeLimit];

    const [membersResult, communitiesResult, groupsResult] = await Promise.all([
      pool.query(membersQuery, membersParams).catch(() => ({ rows: [] })),
      pool.query(communitiesQuery, communitiesParams).catch(() => ({ rows: [] })),
      pool.query(groupsQuery, groupsParams).catch(() => ({ rows: [] })),
    ]);

    const users = [];

    for (const row of membersResult.rows) {
      users.push({ ...row, type: "member", isGroup: false, shareRestricted: false });
    }

    for (const row of communitiesResult.rows) {
      const shareRestricted = await getShareRestricted(row.id);
      users.push({
        id: row.id,
        name: row.name,
        full_name: row.name,
        username: row.username,
        profile_photo_url: row.profile_photo_url,
        type: "community",
        isGroup: false,
        shareRestricted,
      });
    }

    for (const g of groupsResult.rows) {
      const shareRestricted = g.messaging_restricted === true && g.role !== "admin";
      users.push({
        id: g.id,
        name: g.group_name,
        full_name: g.group_name,
        profile_photo_url: g.group_avatar_url || null,
        type: "group",
        isGroup: true,
        conversationId: g.id,
        myRole: g.role,
        shareRestricted,
      });
    }

    res.json({ users });
  } catch (error) {
    console.error("Search share recipients error:", error);
    res.status(500).json({ error: "Failed to search recipients" });
  }
};

module.exports = {
  sharePost,
  getPostShares,
  getRecentChatUsers,
  searchShareRecipients,
};
