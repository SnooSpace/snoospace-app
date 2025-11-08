const { createPool } = require("../config/db");

const pool = createPool();

// Create a comment
const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { commentText, taggedEntities } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!commentText || commentText.trim().length === 0) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    // Validate tagged entities if provided
    if (taggedEntities && Array.isArray(taggedEntities)) {
      for (const entity of taggedEntities) {
        if (!entity.id || !entity.type) {
          return res.status(400).json({ error: "Invalid tagged entity format" });
        }
        if (!['member', 'community', 'sponsor', 'venue'].includes(entity.type)) {
          return res.status(400).json({ error: "Invalid entity type" });
        }
      }
    }

    // Check if post exists
    const postCheck = await pool.query("SELECT id FROM posts WHERE id = $1", [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const query = `
      INSERT INTO post_comments (post_id, commenter_id, commenter_type, comment_text, tagged_entities)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `;

    const taggedEntitiesJson = taggedEntities && Array.isArray(taggedEntities) && taggedEntities.length > 0
      ? JSON.stringify(taggedEntities)
      : null;

    const result = await pool.query(query, [postId, userId, userType, commentText.trim(), taggedEntitiesJson]);
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
        tagged_entities: taggedEntities || null,
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
    const { commentText, taggedEntities } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!commentText || commentText.trim().length === 0) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    // Validate tagged entities if provided
    if (taggedEntities && Array.isArray(taggedEntities)) {
      for (const entity of taggedEntities) {
        if (!entity.id || !entity.type) {
          return res.status(400).json({ error: "Invalid tagged entity format" });
        }
        if (!['member', 'community', 'sponsor', 'venue'].includes(entity.type)) {
          return res.status(400).json({ error: "Invalid entity type" });
        }
      }
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
      INSERT INTO post_comments (post_id, commenter_id, commenter_type, comment_text, parent_comment_id, tagged_entities)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `;

    const taggedEntitiesJson = taggedEntities && Array.isArray(taggedEntities) && taggedEntities.length > 0
      ? JSON.stringify(taggedEntities)
      : null;

    const result = await pool.query(query, [postId, userId, userType, commentText.trim(), commentId, taggedEntitiesJson]);
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
        tagged_entities: taggedEntities || null,
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

    // Get current user info for is_liked check
    const userId = req.user?.id;
    const userType = req.user?.type;

    // Build query based on whether user is authenticated
    let query, queryParams;
    if (userId && userType) {
      query = `
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
          END as commenter_photo_url,
          COALESCE((
            SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id
          ), 0) as like_count,
          EXISTS (
            SELECT 1 FROM comment_likes l
            WHERE l.comment_id = c.id AND l.liker_id = $4 AND l.liker_type = $5
          ) AS is_liked
        FROM post_comments c
        LEFT JOIN members m ON c.commenter_type = 'member' AND c.commenter_id = m.id
        LEFT JOIN communities comm ON c.commenter_type = 'community' AND c.commenter_id = comm.id
        LEFT JOIN sponsors s ON c.commenter_type = 'sponsor' AND c.commenter_id = s.id
        LEFT JOIN venues v ON c.commenter_type = 'venue' AND c.commenter_id = v.id
        WHERE c.post_id = $1 AND c.parent_comment_id IS NULL
        ORDER BY c.created_at ASC
        LIMIT $2 OFFSET $3
      `;
      queryParams = [postId, limit, offset, userId, userType];
    } else {
      query = `
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
          END as commenter_photo_url,
          COALESCE((
            SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id
          ), 0) as like_count,
          false AS is_liked
        FROM post_comments c
        LEFT JOIN members m ON c.commenter_type = 'member' AND c.commenter_id = m.id
        LEFT JOIN communities comm ON c.commenter_type = 'community' AND c.commenter_id = comm.id
        LEFT JOIN sponsors s ON c.commenter_type = 'sponsor' AND c.commenter_id = s.id
        LEFT JOIN venues v ON c.commenter_type = 'venue' AND c.commenter_id = v.id
        WHERE c.post_id = $1 AND c.parent_comment_id IS NULL
        ORDER BY c.created_at ASC
        LIMIT $2 OFFSET $3
      `;
      queryParams = [postId, limit, offset];
    }

    const result = await pool.query(query, queryParams).catch(() => {
      // Fallback if comment_likes table doesn't exist yet
      return pool.query(`
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
          END as commenter_photo_url,
          0 as like_count,
          false AS is_liked
        FROM post_comments c
        LEFT JOIN members m ON c.commenter_type = 'member' AND c.commenter_id = m.id
        LEFT JOIN communities comm ON c.commenter_type = 'community' AND c.commenter_id = comm.id
        LEFT JOIN sponsors s ON c.commenter_type = 'sponsor' AND c.commenter_id = s.id
        LEFT JOIN venues v ON c.commenter_type = 'venue' AND c.commenter_id = v.id
        WHERE c.post_id = $1 AND c.parent_comment_id IS NULL
        ORDER BY c.created_at ASC
        LIMIT $2 OFFSET $3
      `, [postId, limit, offset]);
    });
    // Parse tagged_entities for each comment
    const comments = result.rows.map(comment => {
      try {
        comment.tagged_entities = comment.tagged_entities ? JSON.parse(comment.tagged_entities) : null;
      } catch {
        comment.tagged_entities = null;
      }
      return comment;
    });

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
      // Parse tagged_entities for replies
      comment.replies = repliesResult.rows.map(reply => {
        try {
          reply.tagged_entities = reply.tagged_entities ? JSON.parse(reply.tagged_entities) : null;
        } catch {
          reply.tagged_entities = null;
        }
        return reply;
      });
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

// Like a comment
const likeComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check if comment exists
    const commentCheck = await pool.query("SELECT id FROM post_comments WHERE id = $1", [commentId]);
    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    // Check if already liked (assuming we have a comment_likes table)
    // For now, we'll check if the table exists and handle gracefully
    const existingLike = await pool.query(
      "SELECT id FROM comment_likes WHERE comment_id = $1 AND liker_id = $2 AND liker_type = $3",
      [commentId, userId, userType]
    ).catch(() => ({ rows: [] }));

    if (existingLike.rows && existingLike.rows.length > 0) {
      return res.status(400).json({ error: "Comment already liked" });
    }

    // Add like (assuming comment_likes table exists)
    await pool.query(
      "INSERT INTO comment_likes (comment_id, liker_id, liker_type) VALUES ($1, $2, $3)",
      [commentId, userId, userType]
    ).catch(async (err) => {
      // If table doesn't exist, create it first (one-time setup)
      if (err.code === '42P01') {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS comment_likes (
            id SERIAL PRIMARY KEY,
            comment_id INTEGER NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
            liker_id INTEGER NOT NULL,
            liker_type VARCHAR(20) NOT NULL CHECK (liker_type IN ('member', 'community', 'sponsor', 'venue')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(comment_id, liker_id, liker_type)
          )
        `);
        await pool.query(
          "INSERT INTO comment_likes (comment_id, liker_id, liker_type) VALUES ($1, $2, $3)",
          [commentId, userId, userType]
        );
      } else {
        throw err;
      }
    });

    // Update like count in post_comments if column exists
    await pool.query(
      "UPDATE post_comments SET like_count = COALESCE(like_count, 0) + 1 WHERE id = $1",
      [commentId]
    ).catch(() => {
      // Column might not exist yet, that's okay
      console.log('like_count column may not exist on post_comments');
    });

    res.json({ success: true, message: "Comment liked" });

  } catch (error) {
    console.error("Error liking comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Unlike a comment
const unlikeComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check if comment exists
    const commentCheck = await pool.query("SELECT id FROM post_comments WHERE id = $1", [commentId]);
    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    // Remove like (handle case where table doesn't exist)
    const result = await pool.query(
      "DELETE FROM comment_likes WHERE comment_id = $1 AND liker_id = $2 AND liker_type = $3",
      [commentId, userId, userType]
    ).catch(() => {
      // Table might not exist yet
      return { rowCount: 0 };
    });

    if (!result || result.rowCount === 0) {
      return res.status(400).json({ error: "Comment not liked" });
    }

    // Update like count in post_comments if column exists
    await pool.query(
      "UPDATE post_comments SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0) WHERE id = $1",
      [commentId]
    ).catch(() => {
      // Column might not exist yet, that's okay
      console.log('like_count column may not exist on post_comments');
    });

    res.json({ success: true, message: "Comment unliked" });

  } catch (error) {
    console.error("Error unliking comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  createComment,
  replyToComment,
  getPostComments,
  deleteComment,
  likeComment,
  unlikeComment
};
