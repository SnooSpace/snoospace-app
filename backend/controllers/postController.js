const { createPool } = require("../config/db");

const pool = createPool();

// Create a new post
const createPost = async (req, res) => {
  try {
    const { caption, imageUrls, taggedEntities } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

    console.log(`[createPost] Attempting to create post for author_id: ${userId}, author_type: ${userType}`);

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({ error: "At least one image is required" });
    }

    if (imageUrls.length > 10) {
      return res.status(400).json({ error: "Maximum 10 images allowed" });
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

    const query = `
      INSERT INTO posts (author_id, author_type, caption, image_urls, tagged_entities)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `;

    const values = [
      userId,
      userType,
      caption || null,
      JSON.stringify(imageUrls),
      taggedEntities ? JSON.stringify(taggedEntities) : null
    ];

    const result = await pool.query(query, values);
    const post = result.rows[0];

    // Create notifications for tagged users
    if (taggedEntities && Array.isArray(taggedEntities) && taggedEntities.length > 0) {
      try {
        // Get actor info (post author)
        let actorName = null;
        let actorUsername = null;
        let actorAvatar = null;
        
        if (userType === 'member') {
          const actorResult = await pool.query(
            'SELECT name, username, profile_photo_url FROM members WHERE id = $1',
            [userId]
          );
          if (actorResult.rows[0]) {
            actorName = actorResult.rows[0].name;
            actorUsername = actorResult.rows[0].username;
            actorAvatar = actorResult.rows[0].profile_photo_url;
          }
        } else if (userType === 'community') {
          const actorResult = await pool.query(
            'SELECT name, username, logo_url FROM communities WHERE id = $1',
            [userId]
          );
          if (actorResult.rows[0]) {
            actorName = actorResult.rows[0].name;
            actorUsername = actorResult.rows[0].username;
            actorAvatar = actorResult.rows[0].logo_url;
          }
        } else if (userType === 'sponsor') {
          const actorResult = await pool.query(
            'SELECT brand_name as name, username, logo_url FROM sponsors WHERE id = $1',
            [userId]
          );
          if (actorResult.rows[0]) {
            actorName = actorResult.rows[0].name;
            actorUsername = actorResult.rows[0].username;
            actorAvatar = actorResult.rows[0].logo_url;
          }
        } else if (userType === 'venue') {
          const actorResult = await pool.query(
            'SELECT name, username FROM venues WHERE id = $1',
            [userId]
          );
          if (actorResult.rows[0]) {
            actorName = actorResult.rows[0].name;
            actorUsername = actorResult.rows[0].username;
            actorAvatar = null; // venues don't have avatars
          }
        }

        // Create notification for each tagged entity (skip if tagging self)
        for (const entity of taggedEntities) {
          if (entity.id !== userId || entity.type !== userType) {
            await pool.query(
              `INSERT INTO notifications (recipient_id, recipient_type, actor_id, actor_type, type, payload)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                entity.id,
                entity.type,
                userId,
                userType,
                'tag',
                JSON.stringify({
                  actorName,
                  actorUsername,
                  actorAvatar,
                  postId: post.id,
                })
              ]
            );
          }
        }
      } catch (e) {
        // Non-fatal: do not block post creation if notification fails
        console.error('Failed to create tag notifications', e);
      }
    }

    res.status(201).json({
      success: true,
      post: {
        id: post.id,
        author_id: userId,
        author_type: userType,
        caption,
        image_urls: imageUrls,
        tagged_entities: taggedEntities,
        like_count: 0,
        comment_count: 0,
        created_at: post.created_at
      }
    });

  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get posts feed (from followed entities)
const getFeed = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { page = 1, limit = 10 } = req.query;

    console.log('Feed request - userId:', userId, 'userType:', userType);

    if (!userId || !userType) {
      console.log('Authentication failed - missing userId or userType');
      return res.status(401).json({ error: "Authentication required" });
    }

    const offset = (page - 1) * limit;

    // Get posts from followed entities AND own posts
    const viewerId = req.user?.id || null;
    const viewerType = req.user?.type || null;

    const query = `
      SELECT 
        p.*,
        CASE 
          WHEN p.author_type = 'member' THEN m.name
          WHEN p.author_type = 'community' THEN c.name
          WHEN p.author_type = 'sponsor' THEN s.brand_name
          WHEN p.author_type = 'venue' THEN v.name
        END as author_name,
        CASE 
          WHEN p.author_type = 'member' THEN m.username
          WHEN p.author_type = 'community' THEN c.username
          WHEN p.author_type = 'sponsor' THEN s.username
          WHEN p.author_type = 'venue' THEN v.username
        END as author_username,
        CASE 
          WHEN p.author_type = 'member' THEN m.profile_photo_url
          WHEN p.author_type = 'community' THEN c.logo_url
          WHEN p.author_type = 'sponsor' THEN s.logo_url
          WHEN p.author_type = 'venue' THEN NULL
        END as author_photo_url,
        CASE 
          WHEN $5::int IS NOT NULL AND $6::text IS NOT NULL THEN EXISTS (
            SELECT 1 FROM post_likes l
            WHERE l.post_id = p.id AND l.liker_id = $5 AND l.liker_type = $6
          )
          ELSE false
        END AS is_liked
      FROM posts p
      LEFT JOIN members m ON p.author_type = 'member' AND p.author_id = m.id
      LEFT JOIN communities c ON p.author_type = 'community' AND p.author_id = c.id
      LEFT JOIN sponsors s ON p.author_type = 'sponsor' AND p.author_id = s.id
      LEFT JOIN venues v ON p.author_type = 'venue' AND p.author_id = v.id
      LEFT JOIN follows f ON f.following_id = p.author_id AND f.following_type = p.author_type
        AND f.follower_id = $1 AND f.follower_type = $2
      WHERE (f.id IS NOT NULL OR (p.author_id = $1 AND p.author_type = $2))
      ORDER BY p.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, [userId, userType, limit, offset, viewerId, viewerType]);
    
    console.log('Feed query result:', result.rows.length, 'posts found');
    
    // Parse JSON fields
    const posts = result.rows.map(post => ({
      ...post,
      image_urls: (() => {
        try {
          if (!post.image_urls) return [];
          const parsed = JSON.parse(post.image_urls);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return post.image_urls ? [post.image_urls] : [];
        }
      })(),
      tagged_entities: (() => {
        try {
          return post.tagged_entities ? JSON.parse(post.tagged_entities) : null;
        } catch {
          return null; // Fallback on parsing error
        }
      })()
    }));

    console.log('Parsed posts:', posts.length);
    res.json({ posts });

  } catch (error) {
    console.error("Error getting feed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get explore posts (non-followed entities)
const getExplore = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get posts from non-followed entities
    const query = `
      SELECT 
        p.*,
        CASE 
          WHEN p.author_type = 'member' THEN m.name
          WHEN p.author_type = 'community' THEN c.name
          WHEN p.author_type = 'sponsor' THEN s.brand_name
          WHEN p.author_type = 'venue' THEN v.name
        END as author_name,
        CASE 
          WHEN p.author_type = 'member' THEN m.username
          WHEN p.author_type = 'community' THEN c.username
          WHEN p.author_type = 'sponsor' THEN s.username
          WHEN p.author_type = 'venue' THEN v.username
        END as author_username,
        CASE 
          WHEN p.author_type = 'member' THEN m.profile_photo_url
          WHEN p.author_type = 'community' THEN c.logo_url
          WHEN p.author_type = 'sponsor' THEN s.logo_url
          WHEN p.author_type = 'venue' THEN NULL
        END as author_photo_url
      FROM posts p
      LEFT JOIN members m ON p.author_type = 'member' AND p.author_id = m.id
      LEFT JOIN communities c ON p.author_type = 'community' AND p.author_id = c.id
      LEFT JOIN sponsors s ON p.author_type = 'sponsor' AND p.author_id = s.id
      LEFT JOIN venues v ON p.author_type = 'venue' AND p.author_id = v.id
      LEFT JOIN follows f ON f.following_id = p.author_id AND f.following_type = p.author_type 
        AND f.follower_id = $1 AND f.follower_type = $2
      WHERE f.id IS NULL
      ORDER BY p.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, [userId, userType, limit, offset]);
    
    // Parse JSON fields
    const posts = result.rows.map(post => ({
      ...post,
      image_urls: (() => {
        try {
          const parsed = JSON.parse(post.image_urls);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return post.image_urls ? [post.image_urls] : [];
        }
      })(),
      tagged_entities: post.tagged_entities ? JSON.parse(post.tagged_entities) : null
    }));

    res.json({ posts });

  } catch (error) {
    console.error("Error getting explore:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Like a post
const likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check if post exists
    const postCheck = await pool.query("SELECT id FROM posts WHERE id = $1", [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if already liked
    const existingLike = await pool.query(
      "SELECT id FROM post_likes WHERE post_id = $1 AND liker_id = $2 AND liker_type = $3",
      [postId, userId, userType]
    );

    if (existingLike.rows.length > 0) {
      return res.status(400).json({ error: "Post already liked" });
    }

    // Add like
    await pool.query(
      "INSERT INTO post_likes (post_id, liker_id, liker_type) VALUES ($1, $2, $3)",
      [postId, userId, userType]
    );

    // Update like count
    await pool.query(
      "UPDATE posts SET like_count = like_count + 1 WHERE id = $1",
      [postId]
    );

    // Create notification for post author (skip if user likes their own post)
    try {
      const postResult = await pool.query(
        "SELECT author_id, author_type FROM posts WHERE id = $1",
        [postId]
      );
      const postAuthor = postResult.rows[0];
      
      if (postAuthor && (postAuthor.author_id !== userId || postAuthor.author_type !== userType)) {
        // Get actor info (liker)
        let actorName = null;
        let actorUsername = null;
        let actorAvatar = null;
        
        if (userType === 'member') {
          const actorResult = await pool.query(
            'SELECT name, username, profile_photo_url FROM members WHERE id = $1',
            [userId]
          );
          if (actorResult.rows[0]) {
            actorName = actorResult.rows[0].name;
            actorUsername = actorResult.rows[0].username;
            actorAvatar = actorResult.rows[0].profile_photo_url;
          }
        } else if (userType === 'community') {
          const actorResult = await pool.query(
            'SELECT name, username, logo_url FROM communities WHERE id = $1',
            [userId]
          );
          if (actorResult.rows[0]) {
            actorName = actorResult.rows[0].name;
            actorUsername = actorResult.rows[0].username;
            actorAvatar = actorResult.rows[0].logo_url;
          }
        } else if (userType === 'sponsor') {
          const actorResult = await pool.query(
            'SELECT brand_name as name, username, logo_url FROM sponsors WHERE id = $1',
            [userId]
          );
          if (actorResult.rows[0]) {
            actorName = actorResult.rows[0].name;
            actorUsername = actorResult.rows[0].username;
            actorAvatar = actorResult.rows[0].logo_url;
          }
        } else if (userType === 'venue') {
          const actorResult = await pool.query(
            'SELECT name, username FROM venues WHERE id = $1',
            [userId]
          );
          if (actorResult.rows[0]) {
            actorName = actorResult.rows[0].name;
            actorUsername = actorResult.rows[0].username;
            actorAvatar = null; // venues don't have avatars
          }
        }

        await pool.query(
          `INSERT INTO notifications (recipient_id, recipient_type, actor_id, actor_type, type, payload)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            postAuthor.author_id,
            postAuthor.author_type,
            userId,
            userType,
            'like',
            JSON.stringify({
              actorName,
              actorUsername,
              actorAvatar,
              postId,
            })
          ]
        );
      }
    } catch (e) {
      // Non-fatal: do not block like if notification fails
      console.error('Failed to create like notification', e);
    }

    res.json({ success: true, message: "Post liked" });

  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Unlike a post
const unlikePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Remove like
    const result = await pool.query(
      "DELETE FROM post_likes WHERE post_id = $1 AND liker_id = $2 AND liker_type = $3",
      [postId, userId, userType]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: "Post not liked" });
    }

    // Update like count
    await pool.query(
      "UPDATE posts SET like_count = like_count - 1 WHERE id = $1",
      [postId]
    );

    // Delete the like notification if it exists
    try {
      const postResult = await pool.query(
        "SELECT author_id, author_type FROM posts WHERE id = $1",
        [postId]
      );
      const postAuthor = postResult.rows[0];
      
      if (postAuthor) {
        await pool.query(
          `DELETE FROM notifications 
           WHERE recipient_id = $1 
           AND recipient_type = $2 
           AND actor_id = $3 
           AND actor_type = $4 
           AND type = 'like' 
           AND payload->>'postId' = $5`,
          [postAuthor.author_id, postAuthor.author_type, userId, userType, postId]
        );
      }
    } catch (e) {
      // Non-fatal: do not block unlike if notification deletion fails
      console.error('Failed to delete like notification', e);
    }

    res.json({ success: true, message: "Post unliked" });

  } catch (error) {
    console.error("Error unliking post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get single post
const getPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    const query = `
      SELECT 
        p.*,
        CASE 
          WHEN p.author_type = 'member' THEN m.name
          WHEN p.author_type = 'community' THEN c.name
          WHEN p.author_type = 'sponsor' THEN s.brand_name
          WHEN p.author_type = 'venue' THEN v.name
        END as author_name,
        CASE 
          WHEN p.author_type = 'member' THEN m.username
          WHEN p.author_type = 'community' THEN c.username
          WHEN p.author_type = 'sponsor' THEN s.username
          WHEN p.author_type = 'venue' THEN v.username
        END as author_username,
        CASE 
          WHEN p.author_type = 'member' THEN m.profile_photo_url
          WHEN p.author_type = 'community' THEN c.logo_url
          WHEN p.author_type = 'sponsor' THEN s.logo_url
          WHEN p.author_type = 'venue' THEN NULL
        END as author_photo_url,
        CASE WHEN $2::int IS NOT NULL AND $3::text IS NOT NULL THEN EXISTS (
          SELECT 1 FROM post_likes l
          WHERE l.post_id = p.id AND l.liker_id = $2 AND l.liker_type = $3
        ) ELSE false END AS is_liked
      FROM posts p
      LEFT JOIN members m ON p.author_type = 'member' AND p.author_id = m.id
      LEFT JOIN communities c ON p.author_type = 'community' AND p.author_id = c.id
      LEFT JOIN sponsors s ON p.author_type = 'sponsor' AND p.author_id = s.id
      LEFT JOIN venues v ON p.author_type = 'venue' AND p.author_id = v.id
      WHERE p.id = $1
    `;

    const result = await pool.query(query, [postId, userId || null, userType || null]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = result.rows[0];
    
    // Parse JSON fields
    try {
      const parsed = JSON.parse(post.image_urls);
      post.image_urls = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      post.image_urls = post.image_urls ? [post.image_urls] : [];
    }
    
    try {
      post.tagged_entities = post.tagged_entities ? JSON.parse(post.tagged_entities) : null;
    } catch {
      post.tagged_entities = null;
    }

    res.json({ post });

  } catch (error) {
    console.error("Error getting post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get posts by user
const getUserPosts = async (req, res) => {
  try {
    const { userId, userType } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    // Get viewer info from auth (the person viewing the profile)
    const viewerId = req.user?.id || null;
    const viewerType = req.user?.type || null;

    console.log(`[getUserPosts] Fetching posts for user_id: ${userId}, user_type: ${userType}`);
    console.log(`[getUserPosts] Viewer info - viewerId: ${viewerId}, viewerType: ${viewerType}`);

    const query = `
      SELECT 
        p.*,
        CASE 
          WHEN p.author_type = 'member' THEN m.name
          WHEN p.author_type = 'community' THEN c.name
          WHEN p.author_type = 'sponsor' THEN s.brand_name
          WHEN p.author_type = 'venue' THEN v.name
        END as author_name,
        CASE 
          WHEN p.author_type = 'member' THEN m.username
          WHEN p.author_type = 'community' THEN c.username
          WHEN p.author_type = 'sponsor' THEN s.username
          WHEN p.author_type = 'venue' THEN v.username
        END as author_username,
        CASE 
          WHEN p.author_type = 'member' THEN m.profile_photo_url
          WHEN p.author_type = 'community' THEN c.logo_url
          WHEN p.author_type = 'sponsor' THEN s.logo_url
          WHEN p.author_type = 'venue' THEN NULL
        END as author_photo_url,
        CASE 
          WHEN $5::int IS NOT NULL AND $6::text IS NOT NULL THEN EXISTS (
            SELECT 1 FROM post_likes l
            WHERE l.post_id = p.id AND l.liker_id = $5 AND l.liker_type = $6
          )
          ELSE false
        END AS is_liked
      FROM posts p
      LEFT JOIN members m ON p.author_type = 'member' AND p.author_id = m.id
      LEFT JOIN communities c ON p.author_type = 'community' AND p.author_id = c.id
      LEFT JOIN sponsors s ON p.author_type = 'sponsor' AND p.author_id = s.id
      LEFT JOIN venues v ON p.author_type = 'venue' AND p.author_id = v.id
      WHERE p.author_id = $1 AND p.author_type = $2
      ORDER BY p.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, [userId, userType, limit, offset, viewerId, viewerType]);
    
    console.log(`[getUserPosts] Found ${result.rows.length} posts for user_id: ${userId}`);
    
    // Parse JSON fields
    const posts = result.rows.map(post => ({
      ...post,
      image_urls: (() => {
        try {
          if (!post.image_urls) return [];
          const parsed = JSON.parse(post.image_urls);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return post.image_urls ? [post.image_urls] : [];
        }
      })(),
      tagged_entities: (() => {
        try {
          return post.tagged_entities ? JSON.parse(post.tagged_entities) : null;
        } catch {
          return null; // Fallback on parsing error
        }
      })()
    }));

    res.json({ posts });

  } catch (error) {
    console.error("Error getting user posts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete a post
const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check if post exists and belongs to user
    const postCheck = await pool.query(
      "SELECT id FROM posts WHERE id = $1 AND author_id = $2 AND author_type = $3",
      [postId, userId, userType]
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: "Post not found or not authorized" });
    }

    // Delete post (CASCADE will handle related likes and comments)
    const result = await pool.query(
      "DELETE FROM posts WHERE id = $1",
      [postId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json({ success: true, message: "Post deleted successfully" });

  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  createPost,
  getFeed,
  getExplore,
  likePost,
  unlikePost,
  getPost,
  getUserPosts,
  deletePost
};
