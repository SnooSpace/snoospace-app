const { createPool } = require("../config/db");

const pool = createPool();

// Create a comment
const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { commentText } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!commentText || commentText.trim().length === 0) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    // Check if post exists
    const postCheck = await pool.query("SELECT id FROM posts WHERE id = $1", [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const query = `
      INSERT INTO post_comments (post_id, commenter_id, commenter_type, comment_text)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at
    `;

    const result = await pool.query(query, [postId, userId, userType, commentText.trim()]);
    const comment = result.rows[0];

    // Update comment count
    await pool.query(
      "UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1",
      [postId]
    );

    res.status(201).json({
      success: true,
      comment: {
        id: comment.id,
        post_id: postId,
        commenter_id: userId,
        commenter_type: userType,
        comment_text: commentText.trim(),
        parent_comment_id: null,
        created_at: comment.created_at
      }
    });

  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Reply to a comment
const replyToComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { commentText } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!commentText || commentText.trim().length === 0) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    // Check if parent comment exists and get post_id
    const parentComment = await pool.query(
      "SELECT post_id FROM post_comments WHERE id = $1",
      [commentId]
    );

    if (parentComment.rows.length === 0) {
      return res.status(404).json({ error: "Parent comment not found" });
    }

    const postId = parentComment.rows[0].post_id;

    const query = `
      INSERT INTO post_comments (post_id, commenter_id, commenter_type, comment_text, parent_comment_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `;

    const result = await pool.query(query, [postId, userId, userType, commentText.trim(), commentId]);
    const comment = result.rows[0];

    // Update comment count
    await pool.query(
      "UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1",
      [postId]
    );

    res.status(201).json({
      success: true,
      comment: {
        id: comment.id,
        post_id: postId,
        commenter_id: userId,
        commenter_type: userType,
        comment_text: commentText.trim(),
        parent_comment_id: commentId,
        created_at: comment.created_at
      }
    });

  } catch (error) {
    console.error("Error replying to comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get comments for a post
const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Check if post exists
    const postCheck = await pool.query("SELECT id FROM posts WHERE id = $1", [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Get top-level comments (no parent)
    const query = `
      SELECT 
        c.*,
        CASE 
          WHEN c.commenter_type = 'member' THEN m.name
          WHEN c.commenter_type = 'community' THEN comm.name
          WHEN c.commenter_type = 'sponsor' THEN s.brand_name
          WHEN c.commenter_type = 'venue' THEN v.name
        END as commenter_name,
        CASE 
          WHEN c.commenter_type = 'member' THEN m.username
          WHEN c.commenter_type = 'community' THEN comm.username
          WHEN c.commenter_type = 'sponsor' THEN s.username
          WHEN c.commenter_type = 'venue' THEN v.username
        END as commenter_username,
        CASE 
          WHEN c.commenter_type = 'member' THEN m.profile_photo_url
          WHEN c.commenter_type = 'community' THEN comm.logo_url
          WHEN c.commenter_type = 'sponsor' THEN s.logo_url
          WHEN c.commenter_type = 'venue' THEN NULL
        END as commenter_photo_url
      FROM post_comments c
      LEFT JOIN members m ON c.commenter_type = 'member' AND c.commenter_id = m.id
      LEFT JOIN communities comm ON c.commenter_type = 'community' AND c.commenter_id = comm.id
      LEFT JOIN sponsors s ON c.commenter_type = 'sponsor' AND c.commenter_id = s.id
      LEFT JOIN venues v ON c.commenter_type = 'venue' AND c.commenter_id = v.id
      WHERE c.post_id = $1 AND c.parent_comment_id IS NULL
      ORDER BY c.created_at ASC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [postId, limit, offset]);
    const comments = result.rows;

    // Get replies for each comment
    for (let comment of comments) {
      const repliesQuery = `
        SELECT 
          r.*,
          CASE 
            WHEN r.commenter_type = 'member' THEN m.name
            WHEN r.commenter_type = 'community' THEN comm.name
            WHEN r.commenter_type = 'sponsor' THEN s.brand_name
            WHEN r.commenter_type = 'venue' THEN v.name
          END as commenter_name,
          CASE 
            WHEN r.commenter_type = 'member' THEN m.username
            WHEN r.commenter_type = 'community' THEN comm.username
            WHEN r.commenter_type = 'sponsor' THEN s.username
            WHEN r.commenter_type = 'venue' THEN v.username
          END as commenter_username,
          CASE 
            WHEN r.commenter_type = 'member' THEN m.profile_photo_url
            WHEN r.commenter_type = 'community' THEN comm.logo_url
            WHEN r.commenter_type = 'sponsor' THEN s.logo_url
            WHEN r.commenter_type = 'venue' THEN NULL
          END as commenter_photo_url
        FROM post_comments r
        LEFT JOIN members m ON r.commenter_type = 'member' AND r.commenter_id = m.id
        LEFT JOIN communities comm ON r.commenter_type = 'community' AND r.commenter_id = comm.id
        LEFT JOIN sponsors s ON r.commenter_type = 'sponsor' AND r.commenter_id = s.id
        LEFT JOIN venues v ON r.commenter_type = 'venue' AND r.commenter_id = v.id
        WHERE r.parent_comment_id = $1
        ORDER BY r.created_at ASC
      `;

      const repliesResult = await pool.query(repliesQuery, [comment.id]);
      comment.replies = repliesResult.rows;
    }

    res.json({ comments });

  } catch (error) {
    console.error("Error getting post comments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete a comment
const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check if comment exists and belongs to user
    const commentCheck = await pool.query(
      "SELECT post_id FROM post_comments WHERE id = $1 AND commenter_id = $2 AND commenter_type = $3",
      [commentId, userId, userType]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ error: "Comment not found or not authorized" });
    }

    const postId = commentCheck.rows[0].post_id;

    // Delete comment (this will also delete replies due to CASCADE)
    const result = await pool.query(
      "DELETE FROM post_comments WHERE id = $1",
      [commentId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    // Update comment count
    await pool.query(
      "UPDATE posts SET comment_count = comment_count - 1 WHERE id = $1",
      [postId]
    );

    res.json({ success: true, message: "Comment deleted" });

  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  createComment,
  replyToComment,
  getPostComments,
  deleteComment
};
