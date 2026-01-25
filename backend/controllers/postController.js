const { createPool } = require("../config/db");
const pushService = require("../services/pushService");

const pool = createPool();

// Import type-specific controllers for routing
const PollController = require("./pollController");
const PromptController = require("./promptController");
const QnAController = require("./qnaController");
const ChallengeController = require("./challengeController");

// Create a new post (routes to type-specific handlers)
const createPost = async (req, res) => {
  try {
    const { post_type = "media" } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

    console.log(
      `[createPost] Attempting to create ${post_type} post for author_id: ${userId}, author_type: ${userType}`,
    );

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Route to type-specific handlers
    switch (post_type) {
      case "poll":
        return PollController.createPollPost(req, res);
      case "prompt":
        return PromptController.createPromptPost(req, res);
      case "qna":
        return QnAController.createQnAPost(req, res);
      case "challenge":
        return ChallengeController.createChallengePost(req, res);
      case "media":
      default:
        // Continue with media post logic below
        break;
    }

    // Media post logic (existing behavior)
    const { caption, imageUrls, taggedEntities, aspectRatios, mediaTypes } =
      req.body;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({ error: "At least one image is required" });
    }

    if (imageUrls.length > 10) {
      return res.status(400).json({ error: "Maximum 10 images allowed" });
    }

    // Validate aspect ratios if provided
    let validatedAspectRatios = null;
    if (aspectRatios && Array.isArray(aspectRatios)) {
      // Ensure aspect ratios array length matches image urls length
      if (aspectRatios.length !== imageUrls.length) {
        console.warn(
          "[createPost] aspectRatios length mismatch, defaulting to 0.8 (4:5)",
        );
        validatedAspectRatios = imageUrls.map(() => 0.8); // Default 4:5
      } else {
        // Validate each aspect ratio is a valid number between 0.5 and 2.0
        validatedAspectRatios = aspectRatios.map((ar) => {
          const num = parseFloat(ar);
          if (isNaN(num) || num < 0.5 || num > 2.0) {
            return 0.8; // Default to 4:5
          }
          return num;
        });
      }
    }

    // Validate tagged entities if provided
    if (taggedEntities && Array.isArray(taggedEntities)) {
      for (const entity of taggedEntities) {
        if (!entity.id || !entity.type) {
          return res
            .status(400)
            .json({ error: "Invalid tagged entity format" });
        }
        if (
          !["member", "community", "sponsor", "venue"].includes(entity.type)
        ) {
          return res.status(400).json({ error: "Invalid entity type" });
        }
      }
    }

    // Validate media types if provided
    let validatedMediaTypes = null;
    if (mediaTypes && Array.isArray(mediaTypes)) {
      if (mediaTypes.length !== imageUrls.length) {
        console.warn(
          "[createPost] mediaTypes length mismatch, defaulting to 'image'",
        );
        validatedMediaTypes = imageUrls.map(() => "image");
      } else {
        validatedMediaTypes = mediaTypes.map((mt) => {
          if (mt === "video" || mt === "image") return mt;
          return "image"; // Default to image
        });
      }
    }

    const query = `
      INSERT INTO posts (author_id, author_type, caption, image_urls, tagged_entities, aspect_ratios, media_types)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at
    `;

    const values = [
      userId,
      userType,
      caption || null,
      JSON.stringify(imageUrls),
      taggedEntities ? JSON.stringify(taggedEntities) : null,
      validatedAspectRatios ? JSON.stringify(validatedAspectRatios) : null,
      validatedMediaTypes ? JSON.stringify(validatedMediaTypes) : null,
    ];

    const result = await pool.query(query, values);
    const post = result.rows[0];

    // Create notifications for tagged users
    if (
      taggedEntities &&
      Array.isArray(taggedEntities) &&
      taggedEntities.length > 0
    ) {
      try {
        // Get actor info (post author)
        let actorName = null;
        let actorUsername = null;
        let actorAvatar = null;

        if (userType === "member") {
          const actorResult = await pool.query(
            "SELECT name, username, profile_photo_url FROM members WHERE id = $1",
            [userId],
          );
          if (actorResult.rows[0]) {
            actorName = actorResult.rows[0].name;
            actorUsername = actorResult.rows[0].username;
            actorAvatar = actorResult.rows[0].profile_photo_url;
          }
        } else if (userType === "community") {
          const actorResult = await pool.query(
            "SELECT name, username, logo_url FROM communities WHERE id = $1",
            [userId],
          );
          if (actorResult.rows[0]) {
            actorName = actorResult.rows[0].name;
            actorUsername = actorResult.rows[0].username;
            actorAvatar = actorResult.rows[0].logo_url;
          }
        } else if (userType === "sponsor") {
          const actorResult = await pool.query(
            "SELECT brand_name as name, username, logo_url FROM sponsors WHERE id = $1",
            [userId],
          );
          if (actorResult.rows[0]) {
            actorName = actorResult.rows[0].name;
            actorUsername = actorResult.rows[0].username;
            actorAvatar = actorResult.rows[0].logo_url;
          }
        } else if (userType === "venue") {
          const actorResult = await pool.query(
            "SELECT name, username FROM venues WHERE id = $1",
            [userId],
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
                "tag",
                JSON.stringify({
                  actorName,
                  actorUsername,
                  actorAvatar,
                  postId: post.id,
                }),
              ],
            );

            // Send push notification for tag
            await pushService.sendPushNotification(
              pool,
              entity.id,
              entity.type,
              "You were tagged 📌",
              `${actorName || "Someone"} tagged you in a post`,
              {
                type: "tag",
                postId: post.id,
              },
            );
          }
        }
      } catch (e) {
        // Non-fatal: do not block post creation if notification fails
        console.error("Failed to create tag notifications", e);
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
        aspect_ratios: validatedAspectRatios || imageUrls.map(() => 0.8), // Default 4:5
        media_types: validatedMediaTypes || imageUrls.map(() => "image"), // Default to image
        tagged_entities: taggedEntities,
        like_count: 0,
        comment_count: 0,
        created_at: post.created_at,
      },
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

    console.log("Feed request - userId:", userId, "userType:", userType);

    if (!userId || !userType) {
      console.log("Authentication failed - missing userId or userType");
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
        END AS is_liked,
        CASE 
          WHEN $5::int IS NOT NULL AND $6::text IS NOT NULL THEN EXISTS (
            SELECT 1 FROM follows f2
            WHERE f2.follower_id = $5 AND f2.follower_type = $6 
            AND f2.following_id = p.author_id AND f2.following_type = p.author_type
          )
          ELSE false
        END AS is_following
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

    const result = await pool.query(query, [
      userId,
      userType,
      limit,
      offset,
      viewerId,
      viewerType,
    ]);

    console.log("Feed query result:", result.rows.length, "posts found");

    // Parse JSON fields
    const posts = await Promise.all(
      result.rows.map(async (post) => {
        const parsedPost = {
          ...post,
          image_urls: (() => {
            try {
              if (!post.image_urls) return [];
              if (Array.isArray(post.image_urls)) return post.image_urls;
              const parsed = JSON.parse(post.image_urls);
              return Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              return post.image_urls ? [post.image_urls] : [];
            }
          })(),
          tagged_entities: (() => {
            try {
              if (!post.tagged_entities) return null;
              if (typeof post.tagged_entities === "object")
                return post.tagged_entities;
              return JSON.parse(post.tagged_entities);
            } catch {
              return null;
            }
          })(),
          aspect_ratios: (() => {
            try {
              if (!post.aspect_ratios) return null;
              if (Array.isArray(post.aspect_ratios)) return post.aspect_ratios;
              const parsed = JSON.parse(post.aspect_ratios);
              return Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              return null;
            }
          })(),
          media_types: (() => {
            try {
              if (!post.media_types) return null;
              if (Array.isArray(post.media_types)) return post.media_types;
              const parsed = JSON.parse(post.media_types);
              return Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              return null;
            }
          })(),
          type_data: (() => {
            try {
              if (!post.type_data) return {};
              if (typeof post.type_data === "object") return post.type_data;
              return JSON.parse(post.type_data);
            } catch {
              return {};
            }
          })(),
        };

        // For poll posts, check if user has voted
        if (parsedPost.post_type === "poll" && viewerId && viewerType) {
          try {
            const voteResult = await pool.query(
              `SELECT option_index FROM poll_votes 
               WHERE post_id = $1 AND voter_id = $2 AND voter_type = $3`,
              [post.id, viewerId, viewerType],
            );
            parsedPost.has_voted = voteResult.rows.length > 0;
            parsedPost.voted_indexes = voteResult.rows.map(
              (r) => r.option_index,
            );
          } catch (e) {
            parsedPost.has_voted = false;
            parsedPost.voted_indexes = [];
          }
        }

        // For prompt posts, check if user has submitted AND get real-time submission count
        if (parsedPost.post_type === "prompt") {
          try {
            // Get real-time submission count AND total reply count (including nested replies)
            const countResult = await pool.query(
              `SELECT 
                (SELECT COUNT(*) FROM prompt_submissions WHERE post_id = $1) as count,
                COALESCE((
                  SELECT COUNT(*) 
                  FROM prompt_replies pr
                  JOIN prompt_submissions ps ON pr.submission_id = ps.id
                  WHERE ps.post_id = $1 AND ps.status = 'approved'
                ), 0) as total_reply_count`,
              [post.id],
            );
            parsedPost.type_data = {
              ...parsedPost.type_data,
              submission_count: parseInt(countResult.rows[0]?.count || 0),
              total_reply_count: parseInt(
                countResult.rows[0]?.total_reply_count || 0,
              ),
            };

            // Check if current user has submitted
            if (viewerId && viewerType) {
              const subResult = await pool.query(
                `SELECT id, status FROM prompt_submissions 
                 WHERE post_id = $1 AND author_id = $2 AND author_type = $3`,
                [post.id, viewerId, viewerType],
              );
              parsedPost.has_submitted = subResult.rows.length > 0;
              parsedPost.submission_status = subResult.rows[0]?.status || null;
            }

            // Get preview submission (pinned first, then latest approved)
            const previewResult = await pool.query(
              `SELECT 
                s.id, s.content, s.created_at, s.status, s.is_pinned, s.reply_count,
                CASE 
                  WHEN s.author_type = 'member' THEN m.name
                  WHEN s.author_type = 'community' THEN c.name
                  WHEN s.author_type = 'sponsor' THEN sp.brand_name
                END as author_name,
                CASE 
                  WHEN s.author_type = 'member' THEN m.profile_photo_url
                  WHEN s.author_type = 'community' THEN c.logo_url
                  WHEN s.author_type = 'sponsor' THEN sp.logo_url
                END as author_photo_url
              FROM prompt_submissions s
              LEFT JOIN members m ON s.author_type = 'member' AND s.author_id = m.id
              LEFT JOIN communities c ON s.author_type = 'community' AND s.author_id = c.id
              LEFT JOIN sponsors sp ON s.author_type = 'sponsor' AND s.author_id = sp.id
              WHERE s.post_id = $1 AND s.status = 'approved'
              ORDER BY 
                s.is_pinned DESC,
                s.created_at DESC
              LIMIT 1`,
              [post.id],
            );
            parsedPost.preview_submission = previewResult.rows[0] || null;
          } catch (e) {
            parsedPost.has_submitted = false;
            parsedPost.preview_submission = null;
          }
        }

        // For Q&A posts, get question count, answered count, and top question preview
        if (parsedPost.post_type === "qna") {
          try {
            // Get question and answered counts
            const countResult = await pool.query(
              `SELECT 
                COUNT(*) as question_count,
                COUNT(*) FILTER (WHERE answered_at IS NOT NULL) as answered_count
               FROM qna_questions 
               WHERE post_id = $1 AND is_hidden = false`,
              [post.id],
            );
            parsedPost.type_data = {
              ...parsedPost.type_data,
              question_count: parseInt(
                countResult.rows[0]?.question_count || 0,
              ),
              answered_count: parseInt(
                countResult.rows[0]?.answered_count || 0,
              ),
            };

            // Check how many questions current user has asked
            if (viewerId && viewerType) {
              const userQuestionResult = await pool.query(
                `SELECT COUNT(*) as count FROM qna_questions 
                 WHERE post_id = $1 AND author_id = $2 AND author_type = $3`,
                [post.id, viewerId, viewerType],
              );
              parsedPost.user_question_count = parseInt(
                userQuestionResult.rows[0]?.count || 0,
              );
            } else {
              parsedPost.user_question_count = 0;
            }

            // Get top question preview (by upvotes, unanswered first)
            const previewResult = await pool.query(
              `SELECT 
                q.id, q.question as content, q.upvote_count, q.is_pinned,
                q.answered_at IS NOT NULL as is_answered,
                CASE 
                  WHEN q.author_type = 'member' THEN m.name
                  WHEN q.author_type = 'community' THEN c.name
                END as author_name,
                CASE 
                  WHEN q.author_type = 'member' THEN m.profile_photo_url
                  WHEN q.author_type = 'community' THEN c.logo_url
                END as author_photo_url
               FROM qna_questions q
               LEFT JOIN members m ON q.author_type = 'member' AND q.author_id = m.id
               LEFT JOIN communities c ON q.author_type = 'community' AND q.author_id = c.id
               WHERE q.post_id = $1 AND q.is_hidden = false
               ORDER BY q.is_pinned DESC, q.upvote_count DESC, q.created_at DESC
               LIMIT 1`,
              [post.id],
            );
            parsedPost.preview_question = previewResult.rows[0] || null;
          } catch (e) {
            console.error("[getFeed] Error hydrating Q&A post:", e);
            parsedPost.user_question_count = 0;
            parsedPost.preview_question = null;
          }
        }

        // For Challenge posts, get participant count and user join status
        if (parsedPost.post_type === "challenge") {
          try {
            // Get participant and submission counts
            const countResult = await pool.query(
              `SELECT 
                COUNT(*) as participant_count,
                COUNT(*) FILTER (WHERE status = 'completed') as completed_count
               FROM challenge_participations 
               WHERE post_id = $1`,
              [post.id],
            );
            parsedPost.type_data = {
              ...parsedPost.type_data,
              participant_count: parseInt(
                countResult.rows[0]?.participant_count || 0,
              ),
              completed_count: parseInt(
                countResult.rows[0]?.completed_count || 0,
              ),
            };

            // Check if current user has joined
            if (viewerId && viewerType) {
              const joinedResult = await pool.query(
                `SELECT id, status, progress FROM challenge_participations 
                 WHERE post_id = $1 AND participant_id = $2 AND participant_type = $3`,
                [post.id, viewerId, viewerType],
              );
              parsedPost.has_joined = joinedResult.rows.length > 0;
              parsedPost.user_participation = joinedResult.rows[0] || null;
            }

            // Get featured submission preview
            const previewResult = await pool.query(
              `SELECT 
                cs.id, cs.content, cs.media_urls, cs.video_url, cs.video_thumbnail,
                cs.like_count, cs.is_featured,
                cp.participant_id, cp.participant_type,
                CASE 
                  WHEN cp.participant_type = 'member' THEN m.name
                  WHEN cp.participant_type = 'community' THEN c.name
                END as participant_name,
                CASE 
                  WHEN cp.participant_type = 'member' THEN m.profile_photo_url
                  WHEN cp.participant_type = 'community' THEN c.logo_url
                END as participant_photo_url
               FROM challenge_submissions cs
               JOIN challenge_participations cp ON cs.participant_id = cp.id
               LEFT JOIN members m ON cp.participant_type = 'member' AND cp.participant_id = m.id
               LEFT JOIN communities c ON cp.participant_type = 'community' AND cp.participant_id = c.id
               WHERE cs.post_id = $1 AND cs.status = 'approved'
               ORDER BY cs.is_featured DESC, cs.like_count DESC, cs.created_at DESC
               LIMIT 1`,
              [post.id],
            );
            if (previewResult.rows[0]) {
              const preview = previewResult.rows[0];
              parsedPost.preview_submission = {
                ...preview,
                media_urls: (() => {
                  try {
                    if (!preview.media_urls) return [];
                    if (Array.isArray(preview.media_urls))
                      return preview.media_urls;
                    return JSON.parse(preview.media_urls);
                  } catch {
                    return [];
                  }
                })(),
              };
            } else {
              parsedPost.preview_submission = null;
            }
          } catch (e) {
            console.error("[getFeed] Error hydrating Challenge post:", e);
            parsedPost.has_joined = false;
            parsedPost.preview_submission = null;
          }
        }

        return parsedPost;
      }),
    );

    console.log("Parsed posts:", posts.length);
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
    const posts = result.rows.map((post) => ({
      ...post,
      image_urls: (() => {
        try {
          const parsed = JSON.parse(post.image_urls);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return post.image_urls ? [post.image_urls] : [];
        }
      })(),
      tagged_entities: post.tagged_entities
        ? JSON.parse(post.tagged_entities)
        : null,
      aspect_ratios: (() => {
        try {
          if (!post.aspect_ratios) return null;
          const parsed = JSON.parse(post.aspect_ratios);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return null;
        }
      })(),
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
    const postCheck = await pool.query("SELECT id FROM posts WHERE id = $1", [
      postId,
    ]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if already liked
    const existingLike = await pool.query(
      "SELECT id FROM post_likes WHERE post_id = $1 AND liker_id = $2 AND liker_type = $3",
      [postId, userId, userType],
    );

    if (existingLike.rows.length > 0) {
      return res.status(400).json({ error: "Post already liked" });
    }

    // Add like
    await pool.query(
      "INSERT INTO post_likes (post_id, liker_id, liker_type) VALUES ($1, $2, $3)",
      [postId, userId, userType],
    );

    // Update like count
    await pool.query(
      "UPDATE posts SET like_count = like_count + 1 WHERE id = $1",
      [postId],
    );

    // Create notification for post author (skip if user likes their own post)
    try {
      const postResult = await pool.query(
        "SELECT author_id, author_type FROM posts WHERE id = $1",
        [postId],
      );
      const postAuthor = postResult.rows[0];

      if (
        postAuthor &&
        (postAuthor.author_id !== userId || postAuthor.author_type !== userType)
      ) {
        // Get actor info (liker)
        let actorName = null;
        let actorUsername = null;
        let actorAvatar = null;

        if (userType === "member") {
          const actorResult = await pool.query(
            "SELECT name, username, profile_photo_url FROM members WHERE id = $1",
            [userId],
          );
          if (actorResult.rows[0]) {
            actorName = actorResult.rows[0].name;
            actorUsername = actorResult.rows[0].username;
            actorAvatar = actorResult.rows[0].profile_photo_url;
          }
        } else if (userType === "community") {
          const actorResult = await pool.query(
            "SELECT name, username, logo_url FROM communities WHERE id = $1",
            [userId],
          );
          if (actorResult.rows[0]) {
            actorName = actorResult.rows[0].name;
            actorUsername = actorResult.rows[0].username;
            actorAvatar = actorResult.rows[0].logo_url;
          }
        } else if (userType === "sponsor") {
          const actorResult = await pool.query(
            "SELECT brand_name as name, username, logo_url FROM sponsors WHERE id = $1",
            [userId],
          );
          if (actorResult.rows[0]) {
            actorName = actorResult.rows[0].name;
            actorUsername = actorResult.rows[0].username;
            actorAvatar = actorResult.rows[0].logo_url;
          }
        } else if (userType === "venue") {
          const actorResult = await pool.query(
            "SELECT name, username FROM venues WHERE id = $1",
            [userId],
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
            "like",
            JSON.stringify({
              actorName,
              actorUsername,
              actorAvatar,
              postId,
            }),
          ],
        );

        // Send push notification for like
        await pushService.sendPushNotification(
          pool,
          postAuthor.author_id,
          postAuthor.author_type,
          "Someone liked your post ❤️",
          `${actorName || "Someone"} liked your post`,
          {
            type: "like",
            postId: parseInt(postId),
          },
        );
      }
    } catch (e) {
      // Non-fatal: do not block like if notification fails
      console.error("Failed to create like notification", e);
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
      [postId, userId, userType],
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: "Post not liked" });
    }

    // Update like count
    await pool.query(
      "UPDATE posts SET like_count = like_count - 1 WHERE id = $1",
      [postId],
    );

    // Delete the like notification if it exists
    try {
      const postResult = await pool.query(
        "SELECT author_id, author_type FROM posts WHERE id = $1",
        [postId],
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
          [
            postAuthor.author_id,
            postAuthor.author_type,
            userId,
            userType,
            postId,
          ],
        );
      }
    } catch (e) {
      // Non-fatal: do not block unlike if notification deletion fails
      console.error("Failed to delete like notification", e);
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

    const result = await pool.query(query, [
      postId,
      userId || null,
      userType || null,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = result.rows[0];
    const postType = post.post_type || "media";

    // Parse JSON fields for media posts
    try {
      const parsed = JSON.parse(post.image_urls);
      post.image_urls = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      post.image_urls = post.image_urls ? [post.image_urls] : [];
    }

    try {
      post.tagged_entities = post.tagged_entities
        ? JSON.parse(post.tagged_entities)
        : null;
    } catch {
      post.tagged_entities = null;
    }

    try {
      post.aspect_ratios = post.aspect_ratios
        ? JSON.parse(post.aspect_ratios)
        : null;
    } catch {
      post.aspect_ratios = null;
    }

    // Get type-specific user interaction status
    let interactionStatus = {};

    if (postType === "poll" && userId && userType) {
      // Check if user has voted
      const voteResult = await pool.query(
        `SELECT option_index FROM poll_votes WHERE post_id = $1 AND voter_id = $2 AND voter_type = $3`,
        [postId, userId, userType],
      );
      interactionStatus.has_voted = voteResult.rows.length > 0;
      interactionStatus.voted_indexes = voteResult.rows.map(
        (r) => r.option_index,
      );
    } else if (postType === "prompt" && userId && userType) {
      // Check if user has submitted
      const subResult = await pool.query(
        `SELECT id, status FROM prompt_submissions WHERE post_id = $1 AND author_id = $2 AND author_type = $3`,
        [postId, userId, userType],
      );
      interactionStatus.has_submitted = subResult.rows.length > 0;
      if (subResult.rows[0]) {
        interactionStatus.submission_id = subResult.rows[0].id;
        interactionStatus.submission_status = subResult.rows[0].status;
      }
    }

    // Check if post is expired
    const isExpired = post.expires_at && new Date(post.expires_at) < new Date();
    if (isExpired && post.status === "active") {
      post.status = "expired";
    }

    res.json({
      post: {
        ...post,
        ...interactionStatus,
      },
    });
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

    console.log(
      `[getUserPosts] Fetching posts for user_id: ${userId}, user_type: ${userType}`,
    );
    console.log(
      `[getUserPosts] Viewer info - viewerId: ${viewerId}, viewerType: ${viewerType}`,
    );

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

    const result = await pool.query(query, [
      userId,
      userType,
      limit,
      offset,
      viewerId,
      viewerType,
    ]);

    console.log(
      `[getUserPosts] Found ${result.rows.length} posts for user_id: ${userId}`,
    );

    // Parse JSON fields
    const posts = result.rows.map((post) => ({
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
      })(),
      aspect_ratios: (() => {
        try {
          if (!post.aspect_ratios) return null;
          const parsed = JSON.parse(post.aspect_ratios);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return null;
        }
      })(),
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
      [postId, userId, userType],
    );

    if (postCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Post not found or not authorized" });
    }

    // Delete post (CASCADE will handle related likes and comments)
    const result = await pool.query("DELETE FROM posts WHERE id = $1", [
      postId,
    ]);

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
  deletePost,
};
