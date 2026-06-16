/**
 * Community Voice Controller
 * Allows any authenticated user to post a text/image "voice" post
 * to a community's or creator's Community Posts feed.
 * Posts can be anonymous or attributed.
 */

const { createPool } = require('../config/db');
const pool = createPool();

/**
 * POST /community-voice-posts
 * Body: { target_id, target_type, content, image_url, is_anonymous }
 */
const createVoicePost = async (req, res) => {
  try {
    const userId  = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      target_id,
      target_type,   // 'community' | 'member'
      content,
      image_url,
      is_anonymous = false,
    } = req.body;

    if (!target_id || !target_type) {
      return res.status(400).json({ error: 'target_id and target_type are required' });
    }
    if (!['community', 'member'].includes(target_type)) {
      return res.status(400).json({ error: 'target_type must be community or member' });
    }
    if ((!content || !content.trim()) && !image_url) {
      return res.status(400).json({ error: 'Content or image is required' });
    }
    if (content && content.trim().length > 500) {
      return res.status(400).json({ error: 'Content cannot exceed 500 characters' });
    }

    // Validate target exists
    if (target_type === 'community') {
      const check = await pool.query('SELECT id FROM communities WHERE id = $1', [target_id]);
      if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Community not found' });
      }
    } else {
      // For member (creator), verify creator mode is enabled
      const check = await pool.query(
        'SELECT id, is_creator_mode_enabled FROM members WHERE id = $1',
        [target_id]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Creator not found' });
      }
      if (!check.rows[0].is_creator_mode_enabled) {
        return res.status(403).json({ error: 'This user is not a creator' });
      }
    }

    const typeData = {
      community_voice: true,
      target_id: parseInt(target_id),
      target_type,
      is_anonymous: Boolean(is_anonymous),
    };

    const imageUrls = image_url ? JSON.stringify([image_url]) : '[]';

    const result = await pool.query(
      `INSERT INTO posts (
        author_id, author_type, post_type, caption, image_urls, type_data, status
      )
      VALUES ($1, $2, 'community_voice', $3, $4::jsonb, $5, 'active')
      RETURNING id, created_at`,
      [
        userId,
        userType,
        content?.trim() || null,
        imageUrls,
        JSON.stringify(typeData),
      ]
    );

    const post = result.rows[0];

    // Get author info for response (omit if anonymous)
    let authorName = null;
    let authorPhotoUrl = null;
    let authorUsername = null;

    if (!is_anonymous) {
      if (userType === 'member') {
        const m = await pool.query(
          'SELECT name, username, profile_photo_url FROM members WHERE id = $1',
          [userId]
        );
        if (m.rows[0]) {
          authorName = m.rows[0].name;
          authorUsername = m.rows[0].username;
          authorPhotoUrl = m.rows[0].profile_photo_url;
        }
      } else if (userType === 'community') {
        const c = await pool.query(
          'SELECT name, username, logo_url FROM communities WHERE id = $1',
          [userId]
        );
        if (c.rows[0]) {
          authorName = c.rows[0].name;
          authorUsername = c.rows[0].username;
          authorPhotoUrl = c.rows[0].logo_url;
        }
      }
    }

    console.log(
      `[createVoicePost] ${is_anonymous ? 'Anonymous' : `${userType}:${userId}`} posted to ${target_type}:${target_id} — post ${post.id}`
    );

    return res.status(201).json({
      success: true,
      post: {
        id: post.id,
        author_id: is_anonymous ? null : userId,
        author_type: is_anonymous ? null : userType,
        author_name: is_anonymous ? 'Anonymous' : authorName,
        author_username: is_anonymous ? null : authorUsername,
        author_photo_url: is_anonymous ? null : authorPhotoUrl,
        post_type: 'community_voice',
        caption: content?.trim() || null,
        image_urls: image_url ? [image_url] : [],
        type_data: typeData,
        like_count: 0,
        comment_count: 0,
        created_at: post.created_at,
      },
    });
  } catch (error) {
    console.error('[createVoicePost] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /community-voice-posts?target_id=&target_type=&limit=20&offset=0
 */
const getVoicePosts = async (req, res) => {
  try {
    const userId   = req.user?.id;
    const userType = req.user?.type;

    const {
      target_id,
      target_type,
      limit = 20,
      offset = 0,
    } = req.query;

    if (!target_id || !target_type) {
      return res.status(400).json({ error: 'target_id and target_type are required' });
    }

    const parsedLimit  = Math.min(Math.max(parseInt(limit) || 20, 1), 50);
    const parsedOffset = Math.max(parseInt(offset) || 0, 0);

    // Fetch community_voice posts for this target
    const result = await pool.query(
      `SELECT
        p.*,
        CASE
          WHEN (p.type_data->>'is_anonymous')::boolean = true THEN NULL
          WHEN p.author_type = 'member' THEN m.name
          WHEN p.author_type = 'community' THEN c.name
        END as author_name,
        CASE
          WHEN (p.type_data->>'is_anonymous')::boolean = true THEN NULL
          WHEN p.author_type = 'member' THEN m.username
          WHEN p.author_type = 'community' THEN c.username
        END as author_username,
        CASE
          WHEN (p.type_data->>'is_anonymous')::boolean = true THEN NULL
          WHEN p.author_type = 'member' THEN m.profile_photo_url
          WHEN p.author_type = 'community' THEN c.logo_url
        END as author_photo_url,
        CASE
          WHEN $4::int IS NOT NULL AND $5::text IS NOT NULL THEN EXISTS (
            SELECT 1 FROM post_likes l
            WHERE l.post_id = p.id AND l.liker_id = $4 AND l.liker_type = $5
          )
          ELSE false
        END AS is_liked,
        CASE
          WHEN $4::int IS NOT NULL AND $5::text IS NOT NULL THEN EXISTS (
            SELECT 1 FROM post_saves ps
            WHERE ps.post_id = p.id AND ps.saver_id = $4 AND ps.saver_type = $5
          )
          ELSE false
        END AS is_saved
      FROM posts p
      LEFT JOIN members m ON p.author_type = 'member' AND p.author_id = m.id
      LEFT JOIN communities c ON p.author_type = 'community' AND p.author_id = c.id
      WHERE p.post_type = 'community_voice'
        AND (p.type_data->>'target_id')::int = $1::int
        AND p.type_data->>'target_type' = $2
        AND p.status = 'active'
      ORDER BY p.created_at DESC
      LIMIT $3 OFFSET ${parsedOffset}`,
      [parseInt(target_id), target_type, parsedLimit, userId || null, userType || null]
    );

    const posts = result.rows.map((p) => {
      const typeData = (() => {
        try {
          if (!p.type_data) return {};
          if (typeof p.type_data === 'object') return p.type_data;
          return JSON.parse(p.type_data);
        } catch {
          return {};
        }
      })();
      const image_urls = (() => {
        try {
          if (!p.image_urls) return [];
          if (Array.isArray(p.image_urls)) return p.image_urls;
          const parsed = JSON.parse(p.image_urls);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();
      const isAnon = typeData.is_anonymous === true;
      return {
        ...p,
        image_urls,
        type_data: typeData,
        author_id: isAnon ? null : p.author_id,
        author_type: isAnon ? null : p.author_type,
        author_name: p.author_name || (isAnon ? 'Anonymous' : null),
      };
    });

    return res.json({
      posts,
      hasMore: posts.length === parsedLimit,
    });
  } catch (error) {
    console.error('[getVoicePosts] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { createVoicePost, getVoicePosts };
