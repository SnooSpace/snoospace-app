const { createPool } = require("../config/db");

const pool = createPool();

// Create a new post
const createPost = async (req, res) => {
  try {
    const { caption, imageUrls, taggedEntities } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

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

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const offset = (page - 1) * limit;

    // Get posts from followed entities
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
      WHERE f.follower_id = $1 AND f.follower_type = $2
      ORDER BY p.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, [userId, userType, limit, offset]);
    
    // Parse JSON fields
    const posts = result.rows.map(post => ({
      ...post,
      image_urls: JSON.parse(post.image_urls),
      tagged_entities: post.tagged_entities ? JSON.parse(post.tagged_entities) : null
    }));

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
      image_urls: JSON.parse(post.image_urls),
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
      WHERE p.id = $1
    `;

    const result = await pool.query(query, [postId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = result.rows[0];
    
    // Parse JSON fields
    post.image_urls = JSON.parse(post.image_urls);
    post.tagged_entities = post.tagged_entities ? JSON.parse(post.tagged_entities) : null;

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
      WHERE p.author_id = $1 AND p.author_type = $2
      ORDER BY p.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, [userId, userType, limit, offset]);
    
    // Parse JSON fields
    const posts = result.rows.map(post => ({
      ...post,
      image_urls: JSON.parse(post.image_urls),
      tagged_entities: post.tagged_entities ? JSON.parse(post.tagged_entities) : null
    }));

    res.json({ posts });

  } catch (error) {
    console.error("Error getting user posts:", error);
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
  getUserPosts
};
