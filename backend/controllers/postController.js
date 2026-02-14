const { createPool } = require("../config/db");
const pushService = require("../services/pushService");
const {
  generateVideoMetadata,
  findVideoIndex,
} = require("../utils/cloudinaryVideo");

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
    const {
      caption,
      imageUrls,
      taggedEntities,
      aspectRatios,
      mediaTypes,
      cropMetadata,
    } = req.body;

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
          !["member", "community", "sponsor", "venue", "challenge"].includes(
            entity.type,
          )
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

    // Validate crop metadata if provided
    let validatedCropMetadata = null;
    if (cropMetadata && Array.isArray(cropMetadata)) {
      if (cropMetadata.length !== imageUrls.length) {
        console.warn("[createPost] cropMetadata length mismatch, ignoring");
        validatedCropMetadata = null;
      } else {
        validatedCropMetadata = cropMetadata;
      }
    }

    // Generate video thumbnails for videos using Cloudinary transformation
    let videoThumbnails = null;
    if (validatedMediaTypes && validatedMediaTypes.includes("video")) {
      const { toThumbnailUrl } = require("../utils/cloudinaryVideo");
      videoThumbnails = imageUrls.map((url, index) => {
        // Only generate thumbnail if this media is a video
        if (validatedMediaTypes[index] === "video") {
          const thumbnail = toThumbnailUrl(url, { width: 800 });
          console.log(
            `[createPost] Generated thumbnail for video ${index}:`,
            thumbnail,
          );
          return thumbnail;
        }
        return null; // Not a video, no thumbnail
      });
    }

    // Check for challenge tag
    const challengeTag = taggedEntities?.find((e) => e.type === "challenge");
    const challengeTags =
      taggedEntities?.filter((e) => e.type === "challenge") || [];
    if (challengeTags.length > 1) {
      return res
        .status(400)
        .json({ error: "You can only tag one challenge per post" });
    }

    const linkedChallengeId = challengeTag ? challengeTag.id : null;

    const query = `
      INSERT INTO posts (author_id, author_type, caption, image_urls, tagged_entities, aspect_ratios, media_types, crop_metadata, video_thumbnail, linked_challenge_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      validatedCropMetadata ? JSON.stringify(validatedCropMetadata) : null,
      videoThumbnails ? JSON.stringify(videoThumbnails) : null,
      linkedChallengeId,
    ];

    const result = await pool.query(query, values);
    const post = result.rows[0];

    // =========================================================================
    // CHALLENGE TAG HANDLING: Auto-join + create submission
    // =========================================================================
    if (challengeTag) {
      try {
        const challengeId = challengeTag.id;
        console.log(`[createPost] Challenge tag detected: ${challengeId}`);

        // Verify challenge exists and is still active
        const challengeResult = await pool.query(
          `SELECT id, type_data, expires_at, author_id, author_type 
           FROM posts WHERE id = $1 AND post_type = 'challenge'`,
          [challengeId],
        );

        if (challengeResult.rows.length === 0) {
          console.warn(
            `[createPost] Tagged challenge ${challengeId} not found, skipping`,
          );
        } else {
          const challenge = challengeResult.rows[0];
          const challengeTypeData = challenge.type_data || {};

          // Check if challenge has ended
          if (
            challenge.expires_at &&
            new Date(challenge.expires_at) < new Date()
          ) {
            console.warn(
              `[createPost] Tagged challenge ${challengeId} has ended, skipping`,
            );
          } else {
            // Check if user is already a participant
            let participationId = null;
            let wasAutoJoined = false;
            const existingParticipation = await pool.query(
              `SELECT id FROM challenge_participations 
               WHERE post_id = $1 AND participant_id = $2 AND participant_type = $3`,
              [challengeId, userId, userType],
            );

            if (existingParticipation.rows.length > 0) {
              participationId = existingParticipation.rows[0].id;
              console.log(
                `[createPost] User already participant (id=${participationId}) in challenge ${challengeId}`,
              );
            } else {
              // Auto-join the challenge
              try {
                const joinResult = await pool.query(
                  `INSERT INTO challenge_participations 
                   (post_id, participant_id, participant_type, status, progress)
                   VALUES ($1, $2, $3, 'joined', 0)
                   RETURNING id`,
                  [challengeId, userId, userType],
                );
                participationId = joinResult.rows[0].id;
                wasAutoJoined = true;

                // Update participant count in type_data
                await pool.query(
                  `UPDATE posts SET type_data = type_data || $1 WHERE id = $2`,
                  [
                    JSON.stringify({
                      participant_count:
                        (challengeTypeData.participant_count || 0) + 1,
                    }),
                    challengeId,
                  ],
                );
                console.log(
                  `[createPost] Auto-joined user ${userType}:${userId} to challenge ${challengeId} (participation=${participationId})`,
                );
              } catch (joinError) {
                console.error(
                  `[createPost] Failed to auto-join challenge ${challengeId}:`,
                  joinError.message,
                );
                throw joinError; // Can't create submission without participation
              }
            }

            // Determine submission type from media
            let submissionType = "text";
            const hasVideo = validatedMediaTypes?.includes("video");
            if (hasVideo) {
              submissionType = "video";
            } else if (imageUrls && imageUrls.length > 0) {
              submissionType = "image";
            }

            // Tagged-post submissions are always auto-approved since
            // the post itself is already publicly visible
            const initialStatus = "approved";

            // Extract first video URL and thumbnail
            let videoUrl = null;
            let videoThumb = null;
            if (hasVideo && validatedMediaTypes) {
              const videoIdx = validatedMediaTypes.indexOf("video");
              if (videoIdx !== -1) {
                videoUrl = imageUrls[videoIdx];
                videoThumb = videoThumbnails?.[videoIdx] || null;
              }
            }

            // Create challenge submission
            let submissionId;
            try {
              const submissionResult = await pool.query(
                `INSERT INTO challenge_submissions 
                 (post_id, participant_id, content, media_urls, video_url, video_thumbnail, submission_type, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id`,
                [
                  challengeId,
                  participationId,
                  caption?.trim() || null,
                  imageUrls ? JSON.stringify(imageUrls) : null,
                  videoUrl,
                  videoThumb,
                  submissionType,
                  initialStatus,
                ],
              );
              submissionId = submissionResult.rows[0].id;
              console.log(
                `[createPost] Challenge submission ${submissionId} created (status=${initialStatus}) for challenge ${challengeId}`,
              );
            } catch (subError) {
              console.error(
                `[createPost] Failed to INSERT challenge_submissions for challenge ${challengeId}, participation ${participationId}:`,
                subError.message,
              );
              throw subError;
            }

            // Link submission to source post (non-fatal if this fails)
            try {
              await pool.query(
                `INSERT INTO challenge_submission_sources 
                 (submission_id, source_post_id, is_from_tagged_post)
                 VALUES ($1, $2, TRUE)`,
                [submissionId, post.id],
              );
            } catch (sourceError) {
              console.error(
                `[createPost] Failed to link submission ${submissionId} to source post ${post.id}:`,
                sourceError.message,
              );
              // Non-fatal: submission already exists, just missing source link
            }

            // Update submission count in type_data
            try {
              await pool.query(
                `UPDATE posts SET type_data = jsonb_set(
                   type_data, 
                   '{submission_count}', 
                   (COALESCE((type_data->>'submission_count')::int, 0) + 1)::text::jsonb
                 ) WHERE id = $1`,
                [challengeId],
              );
            } catch (countError) {
              console.error(
                `[createPost] Failed to update submission_count for challenge ${challengeId}:`,
                countError.message,
              );
            }

            // Update participant progress for progress-based challenges
            if (challengeTypeData.challenge_type === "progress") {
              try {
                const submissionCountResult = await pool.query(
                  `SELECT COUNT(*) as count FROM challenge_submissions 
                   WHERE participant_id = $1`,
                  [participationId],
                );
                const targetCount = challengeTypeData.target_count || 1;
                const progress = Math.min(
                  100,
                  Math.round(
                    (parseInt(submissionCountResult.rows[0].count) /
                      targetCount) *
                      100,
                  ),
                );

                await pool.query(
                  `UPDATE challenge_participations 
                   SET progress = $1, 
                       status = CASE WHEN $1 >= 100 THEN 'completed' ELSE 'in_progress' END
                   WHERE id = $2`,
                  [progress, participationId],
                );
              } catch (progressError) {
                console.error(
                  `[createPost] Failed to update progress for participation ${participationId}:`,
                  progressError.message,
                );
              }
            }

            console.log(
              `[createPost] Challenge tag handling complete: submission ${submissionId} from post ${post.id}`,
            );
          }
        }
      } catch (challengeError) {
        // Non-fatal: don't block post creation if challenge tag handling fails
        console.error(
          "[createPost] Error handling challenge tag:",
          challengeError.message || challengeError,
        );
      }
    }

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
        crop_metadata: validatedCropMetadata || null,
        video_thumbnail: videoThumbnails ? videoThumbnails[0] : null, // First video's thumbnail
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
    // Support cursor-based pagination (preferred) with fallback to offset
    const { cursor, limit = 20 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50); // Clamp between 1-50

    console.log(
      "Feed request - userId:",
      userId,
      "userType:",
      userType,
      "cursor:",
      cursor,
    );

    if (!userId || !userType) {
      console.log("Authentication failed - missing userId or userType");
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get posts from followed entities AND own posts
    const viewerId = req.user?.id || null;
    const viewerType = req.user?.type || null;

    // Build cursor condition for stable pagination
    const cursorCondition = cursor ? `AND p.created_at < $6` : "";

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
          WHEN $4::int IS NOT NULL AND $5::text IS NOT NULL THEN EXISTS (
            SELECT 1 FROM post_likes l
            WHERE l.post_id = p.id AND l.liker_id = $4 AND l.liker_type = $5
          )
          ELSE false
        END AS is_liked,
        CASE 
          WHEN $4::int IS NOT NULL AND $5::text IS NOT NULL THEN EXISTS (
            SELECT 1 FROM follows f2
            WHERE f2.follower_id = $4 AND f2.follower_type = $5 
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
      ${cursorCondition}
      ORDER BY p.created_at DESC
      LIMIT $3
    `;

    // Build query params: $1=userId, $2=userType, $3=limit, $4=viewerId, $5=viewerType, $6=cursor (optional)
    const queryParams = cursor
      ? [userId, userType, parsedLimit + 1, viewerId, viewerType, cursor]
      : [userId, userType, parsedLimit + 1, viewerId, viewerType];

    // Note: We fetch limit+1 to determine if there are more results
    const result = await pool.query(query, queryParams);

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
          crop_metadata: (() => {
            try {
              if (!post.crop_metadata) return null;
              if (Array.isArray(post.crop_metadata)) return post.crop_metadata;
              const parsed = JSON.parse(post.crop_metadata);
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

        // Extract video data with HLS streaming support
        const videoIndex = findVideoIndex(parsedPost.media_types);
        if (videoIndex !== -1 && parsedPost.image_urls[videoIndex]) {
          const rawVideoUrl = parsedPost.image_urls[videoIndex];
          const aspectRatio = parsedPost.aspect_ratios?.[videoIndex] || null;
          const videoMeta = generateVideoMetadata(rawVideoUrl, aspectRatio);

          // Merge video metadata into post
          parsedPost.video_url = videoMeta.video_url;
          parsedPost.video_hls_url = videoMeta.video_hls_url;
          parsedPost.video_thumbnail = videoMeta.video_thumbnail;
          parsedPost.video_aspect_ratio = videoMeta.video_aspect_ratio;
        }

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

    // Determine pagination metadata
    const hasMore = posts.length > parsedLimit;
    const trimmedPosts = hasMore ? posts.slice(0, parsedLimit) : posts;
    const nextCursor =
      trimmedPosts.length > 0
        ? trimmedPosts[trimmedPosts.length - 1].created_at
        : null;

    console.log("Parsed posts:", trimmedPosts.length, "hasMore:", hasMore);
    res.json({
      posts: trimmedPosts,
      next_cursor: nextCursor,
      has_more: hasMore,
    });
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
    const posts = result.rows.map((post) => {
      const parsedPost = {
        ...post,
        image_urls: (() => {
          try {
            const parsed = JSON.parse(post.image_urls);
            return Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            return post.image_urls ? [post.image_urls] : [];
          }
        })(),
        media_types: (() => {
          try {
            if (!post.media_types) return null;
            const parsed = JSON.parse(post.media_types);
            return Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            return null;
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
        crop_metadata: post.crop_metadata
          ? (() => {
              try {
                const parsed = JSON.parse(post.crop_metadata);
                return Array.isArray(parsed) ? parsed : [parsed];
              } catch {
                return null;
              }
            })()
          : null,
      };

      // Extract video data with HLS streaming support
      const videoIndex = findVideoIndex(parsedPost.media_types);
      if (videoIndex !== -1 && parsedPost.image_urls[videoIndex]) {
        const rawVideoUrl = parsedPost.image_urls[videoIndex];
        const aspectRatio = parsedPost.aspect_ratios?.[videoIndex] || null;
        const videoMeta = generateVideoMetadata(rawVideoUrl, aspectRatio);

        // Merge video metadata into post
        parsedPost.video_url = videoMeta.video_url;
        parsedPost.video_hls_url = videoMeta.video_hls_url;
        parsedPost.video_thumbnail = videoMeta.video_thumbnail;
        parsedPost.video_aspect_ratio = videoMeta.video_aspect_ratio;
      }

      return parsedPost;
    });

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

    // Parse media_types
    try {
      post.media_types = post.media_types ? JSON.parse(post.media_types) : null;
      if (post.media_types && !Array.isArray(post.media_types)) {
        post.media_types = [post.media_types];
      }
    } catch {
      post.media_types = null;
    }

    // Extract video data with HLS streaming support
    const videoIndex = findVideoIndex(post.media_types);
    if (videoIndex !== -1 && post.image_urls[videoIndex]) {
      const rawVideoUrl = post.image_urls[videoIndex];
      const aspectRatio = post.aspect_ratios?.[videoIndex] || null;
      const videoMeta = generateVideoMetadata(rawVideoUrl, aspectRatio);

      // Merge video metadata into post
      post.video_url = videoMeta.video_url;
      post.video_hls_url = videoMeta.video_hls_url;
      post.video_thumbnail = videoMeta.video_thumbnail;
      post.video_aspect_ratio = videoMeta.video_aspect_ratio;
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
    // Support cursor-based pagination (preferred) with fallback to offset
    const { cursor, limit = 20 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50); // Clamp between 1-50

    // Get viewer info from auth (the person viewing the profile)
    const viewerId = req.user?.id || null;
    const viewerType = req.user?.type || null;

    console.log(
      `[getUserPosts] Fetching posts for user_id: ${userId}, user_type: ${userType}, cursor: ${cursor}`,
    );
    console.log(
      `[getUserPosts] Viewer info - viewerId: ${viewerId}, viewerType: ${viewerType}`,
    );

    // Build cursor condition for stable pagination
    const cursorCondition = cursor ? `AND p.created_at < $5` : "";

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
          WHEN $3::int IS NOT NULL AND $4::text IS NOT NULL THEN EXISTS (
            SELECT 1 FROM post_likes l
            WHERE l.post_id = p.id AND l.liker_id = $3 AND l.liker_type = $4
          )
          ELSE false
        END AS is_liked
      FROM posts p
      LEFT JOIN members m ON p.author_type = 'member' AND p.author_id = m.id
      LEFT JOIN communities c ON p.author_type = 'community' AND p.author_id = c.id
      LEFT JOIN sponsors s ON p.author_type = 'sponsor' AND p.author_id = s.id
      LEFT JOIN venues v ON p.author_type = 'venue' AND p.author_id = v.id
      WHERE p.author_id = $1 AND p.author_type = $2
      ${cursorCondition}
      ORDER BY p.created_at DESC
      LIMIT ${parsedLimit + 1}
    `;

    // Build query params: $1=userId, $2=userType, $3=viewerId, $4=viewerType, $5=cursor (optional)
    const queryParams = cursor
      ? [userId, userType, viewerId, viewerType, cursor]
      : [userId, userType, viewerId, viewerType];

    // Note: We fetch limit+1 to determine if there are more results
    const result = await pool.query(query, queryParams);

    console.log(
      `[getUserPosts] Found ${result.rows.length} posts for user_id: ${userId}`,
    );

    // Parse JSON fields
    const posts = result.rows.map((post) => {
      const parsedPost = {
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
        media_types: (() => {
          try {
            if (!post.media_types) return null;
            const parsed = JSON.parse(post.media_types);
            return Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            return null;
          }
        })(),
        tagged_entities: (() => {
          try {
            return post.tagged_entities
              ? JSON.parse(post.tagged_entities)
              : null;
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
      };

      // Extract video data with HLS streaming support
      const videoIndex = findVideoIndex(parsedPost.media_types);
      if (videoIndex !== -1 && parsedPost.image_urls[videoIndex]) {
        const rawVideoUrl = parsedPost.image_urls[videoIndex];
        const aspectRatio = parsedPost.aspect_ratios?.[videoIndex] || null;
        const videoMeta = generateVideoMetadata(rawVideoUrl, aspectRatio);

        // Merge video metadata into post
        parsedPost.video_url = videoMeta.video_url;
        parsedPost.video_hls_url = videoMeta.video_hls_url;
        parsedPost.video_thumbnail = videoMeta.video_thumbnail;
        parsedPost.video_aspect_ratio = videoMeta.video_aspect_ratio;
      }

      return parsedPost;
    });

    // Add interaction status for polls (has_voted, voted_indexes)
    if (viewerId && viewerType) {
      const postsWithInteractions = await Promise.all(
        posts.map(async (post) => {
          const postType = post.post_type || "media";

          if (postType === "poll") {
            // Check if user has voted on this poll
            const voteResult = await pool.query(
              `SELECT option_index FROM poll_votes WHERE post_id = $1 AND voter_id = $2 AND voter_type = $3`,
              [post.id, viewerId, viewerType],
            );

            return {
              ...post,
              has_voted: voteResult.rows.length > 0,
              voted_indexes: voteResult.rows.map((r) => r.option_index),
            };
          }

          return post;
        }),
      );

      // Determine pagination metadata using posts with interactions
      const hasMore = postsWithInteractions.length > parsedLimit;
      const trimmedPosts = hasMore
        ? postsWithInteractions.slice(0, parsedLimit)
        : postsWithInteractions;
      const nextCursor =
        trimmedPosts.length > 0
          ? trimmedPosts[trimmedPosts.length - 1].created_at
          : null;

      console.log(
        `[getUserPosts] hasMore: ${hasMore}, nextCursor: ${nextCursor}`,
      );
      res.json({
        posts: trimmedPosts,
        next_cursor: nextCursor,
        has_more: hasMore,
      });
    } else {
      // No viewer info - return posts without interaction status (fallback)
      // Determine pagination metadata
      const hasMore = posts.length > parsedLimit;
      const trimmedPosts = hasMore ? posts.slice(0, parsedLimit) : posts;
      const nextCursor =
        trimmedPosts.length > 0
          ? trimmedPosts[trimmedPosts.length - 1].created_at
          : null;

      console.log(
        `[getUserPosts] hasMore: ${hasMore}, nextCursor: ${nextCursor}`,
      );
      res.json({
        posts: trimmedPosts,
        next_cursor: nextCursor,
        has_more: hasMore,
      });
    }
  } catch (error) {
    console.error("Error getting user posts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update a post
const updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { updates } = req.body;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ error: "Updates object is required" });
    }

    // Fetch the existing post
    const postResult = await pool.query("SELECT * FROM posts WHERE id = $1", [
      postId,
    ]);

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = postResult.rows[0];

    // Check ownership
    if (
      String(post.author_id) !== String(userId) ||
      post.author_type !== userType
    ) {
      return res
        .status(403)
        .json({ error: "You don't have permission to edit this post" });
    }

    const postType = post.post_type;
    const typeData = post.type_data || {};
    const updatedTypeData = { ...typeData };

    // Validate editable fields based on post type
    const allowedUpdates = {};

    switch (postType) {
      case "poll":
        // Poll: question, expires_at
        if (updates.question !== undefined) {
          if (
            typeof updates.question !== "string" ||
            updates.question.trim().length === 0
          ) {
            return res.status(400).json({ error: "Invalid question text" });
          }
          updatedTypeData.question = updates.question.trim();
        }
        if (updates.expires_at !== undefined) {
          const newExpiry = new Date(updates.expires_at);
          const currentExpiry = post.expires_at
            ? new Date(post.expires_at)
            : null;
          if (isNaN(newExpiry.getTime())) {
            return res.status(400).json({ error: "Invalid expiry date" });
          }
          if (newExpiry <= new Date()) {
            return res
              .status(400)
              .json({ error: "Expiry date must be in the future" });
          }
          if (currentExpiry && newExpiry < currentExpiry) {
            return res
              .status(400)
              .json({ error: "Can only extend deadline, not shorten it" });
          }
          allowedUpdates.expires_at = newExpiry.toISOString();
        }
        break;

      case "prompt":
        // Prompt: prompt_text, max_length, expires_at
        if (updates.prompt_text !== undefined) {
          if (
            typeof updates.prompt_text !== "string" ||
            updates.prompt_text.trim().length === 0
          ) {
            return res.status(400).json({ error: "Invalid prompt text" });
          }
          updatedTypeData.prompt_text = updates.prompt_text.trim();
        }
        if (updates.max_length !== undefined) {
          const newMaxLength = parseInt(updates.max_length, 10);
          const currentMaxLength = typeData.max_length || 500;
          if (isNaN(newMaxLength) || newMaxLength < 1) {
            return res.status(400).json({ error: "Invalid max length" });
          }
          if (newMaxLength < currentMaxLength) {
            return res
              .status(400)
              .json({ error: "Can only increase max length, not decrease it" });
          }
          updatedTypeData.max_length = newMaxLength;
        }
        if (updates.expires_at !== undefined) {
          const newExpiry = new Date(updates.expires_at);
          const currentExpiry = post.expires_at
            ? new Date(post.expires_at)
            : null;
          if (isNaN(newExpiry.getTime())) {
            return res.status(400).json({ error: "Invalid expiry date" });
          }
          if (newExpiry <= new Date()) {
            return res
              .status(400)
              .json({ error: "Expiry date must be in the future" });
          }
          if (currentExpiry && newExpiry < currentExpiry) {
            return res
              .status(400)
              .json({ error: "Can only extend deadline, not shorten it" });
          }
          allowedUpdates.expires_at = newExpiry.toISOString();
        }
        break;

      case "qna":
        // Q&A: title, max_questions_per_user, expires_at
        if (updates.title !== undefined) {
          if (
            typeof updates.title !== "string" ||
            updates.title.trim().length === 0
          ) {
            return res.status(400).json({ error: "Invalid title" });
          }
          updatedTypeData.title = updates.title.trim();
        }
        if (updates.max_questions_per_user !== undefined) {
          const newMax = parseInt(updates.max_questions_per_user, 10);
          const currentMax = typeData.max_questions_per_user || 1;
          if (isNaN(newMax) || newMax < 1) {
            return res
              .status(400)
              .json({ error: "Invalid max questions per user" });
          }
          if (newMax < currentMax) {
            return res.status(400).json({
              error:
                "Can only increase max questions per user, not decrease it",
            });
          }
          updatedTypeData.max_questions_per_user = newMax;
        }
        if (updates.expires_at !== undefined) {
          const newExpiry = new Date(updates.expires_at);
          const currentExpiry = post.expires_at
            ? new Date(post.expires_at)
            : null;
          if (isNaN(newExpiry.getTime())) {
            return res.status(400).json({ error: "Invalid expiry date" });
          }
          if (newExpiry <= new Date()) {
            return res
              .status(400)
              .json({ error: "Expiry date must be in the future" });
          }
          if (currentExpiry && newExpiry < currentExpiry) {
            return res
              .status(400)
              .json({ error: "Can only extend deadline, not shorten it" });
          }
          allowedUpdates.expires_at = newExpiry.toISOString();
        }
        break;

      case "challenge":
        // Challenge: title, description, deadline, target_count
        if (updates.title !== undefined) {
          if (
            typeof updates.title !== "string" ||
            updates.title.trim().length === 0
          ) {
            return res.status(400).json({ error: "Invalid title" });
          }
          updatedTypeData.title = updates.title.trim();
        }
        if (updates.description !== undefined) {
          if (typeof updates.description !== "string") {
            return res.status(400).json({ error: "Invalid description" });
          }
          updatedTypeData.description = updates.description.trim();
        }
        if (updates.target_count !== undefined) {
          const newTarget = parseInt(updates.target_count, 10);
          const currentTarget = typeData.target_count || 0;
          if (isNaN(newTarget) || newTarget < 1) {
            return res.status(400).json({ error: "Invalid target count" });
          }
          if (newTarget < currentTarget) {
            return res.status(400).json({
              error: "Can only increase target count, not decrease it",
            });
          }
          updatedTypeData.target_count = newTarget;
        }
        if (updates.deadline !== undefined) {
          const newDeadline = new Date(updates.deadline);
          const currentDeadline = typeData.deadline
            ? new Date(typeData.deadline)
            : null;
          if (isNaN(newDeadline.getTime())) {
            return res.status(400).json({ error: "Invalid deadline" });
          }
          if (newDeadline <= new Date()) {
            return res
              .status(400)
              .json({ error: "Deadline must be in the future" });
          }
          if (currentDeadline && newDeadline < currentDeadline) {
            return res
              .status(400)
              .json({ error: "Can only extend deadline, not shorten it" });
          }
          updatedTypeData.deadline = newDeadline.toISOString();
        }
        break;

      default:
        return res.status(400).json({ error: "Invalid post type for editing" });
    }

    // Build query
    const queryParams = [postId];
    const setClauses = [];
    let paramCount = 2;

    // Always update type_data if it changed
    setClauses.push(`type_data = $${paramCount}`);
    queryParams.push(JSON.stringify(updatedTypeData));
    paramCount++;

    // Add expires_at if it was updated
    if (allowedUpdates.expires_at) {
      setClauses.push(`expires_at = $${paramCount}`);
      queryParams.push(allowedUpdates.expires_at);
      paramCount++;
    }

    // Always set edited_at
    setClauses.push(`edited_at = NOW()`);

    // Update edit_history for admin users (placeholder - need to detect admin)
    // For now, we just track edited_at for all users

    const updateQuery = `
      UPDATE posts
      SET ${setClauses.join(", ")}
      WHERE id = $1
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, queryParams);

    if (updateResult.rows.length === 0) {
      return res.status(500).json({ error: "Failed to update post" });
    }

    const updatedPost = updateResult.rows[0];

    res.json({
      success: true,
      message: "Post updated successfully",
      post: updatedPost,
    });
  } catch (error) {
    console.error("Error updating post:", error);
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
      "SELECT id, linked_challenge_id FROM posts WHERE id = $1 AND author_id = $2 AND author_type = $3",
      [postId, userId, userType],
    );

    if (postCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Post not found or not authorized" });
    }

    const postToDelete = postCheck.rows[0];

    // =========================================================================
    // CHALLENGE SUBMISSION CLEANUP
    // =========================================================================
    if (postToDelete.linked_challenge_id) {
      try {
        const challengeId = postToDelete.linked_challenge_id;
        console.log(
          `[deletePost] Post ${postId} has linked challenge ${challengeId}`,
        );

        // Get the challenge to check if it has ended
        const challengeResult = await pool.query(
          `SELECT expires_at, type_data FROM posts WHERE id = $1 AND post_type = 'challenge'`,
          [challengeId],
        );

        if (challengeResult.rows.length > 0) {
          const challenge = challengeResult.rows[0];
          const challengeHasEnded =
            challenge.expires_at && new Date(challenge.expires_at) < new Date();

          // Get the linked submission
          const sourceResult = await pool.query(
            `SELECT css.submission_id, css.id as source_id, cs.participant_id
             FROM challenge_submission_sources css
             JOIN challenge_submissions cs ON cs.id = css.submission_id
             WHERE css.source_post_id = $1`,
            [postId],
          );

          if (sourceResult.rows.length > 0) {
            const { submission_id, participant_id } = sourceResult.rows[0];

            if (challengeHasEnded) {
              // Challenge has ended: keep submission visible but mark source as deleted
              // ON DELETE SET NULL on source_post_id handles this automatically when post is deleted
              console.log(
                `[deletePost] Challenge ended - submission ${submission_id} will remain (source nullified)`,
              );
            } else {
              // Challenge still active: delete the submission and adjust progress
              console.log(
                `[deletePost] Challenge active - deleting submission ${submission_id}`,
              );

              // Delete the submission (CASCADE will handle source link)
              await pool.query(
                `DELETE FROM challenge_submissions WHERE id = $1`,
                [submission_id],
              );

              // Decrement submission count
              await pool.query(
                `UPDATE posts SET type_data = jsonb_set(
                   type_data, 
                   '{submission_count}', 
                   (GREATEST(COALESCE((type_data->>'submission_count')::int, 0) - 1, 0))::text::jsonb
                 ) WHERE id = $1`,
                [challengeId],
              );

              // Recalculate participant progress for progress-based challenges
              const challengeTypeData = challenge.type_data || {};
              if (challengeTypeData.challenge_type === "progress") {
                const submissionCountResult = await pool.query(
                  `SELECT COUNT(*) as count FROM challenge_submissions 
                   WHERE participant_id = $1`,
                  [participant_id],
                );
                const targetCount = challengeTypeData.target_count || 1;
                const newCount = parseInt(submissionCountResult.rows[0].count);
                const progress = Math.min(
                  100,
                  Math.round((newCount / targetCount) * 100),
                );

                await pool.query(
                  `UPDATE challenge_participations 
                   SET progress = $1, 
                       status = CASE WHEN $1 >= 100 THEN 'completed' ELSE 'in_progress' END
                   WHERE id = $2`,
                  [progress, participant_id],
                );
              }
            }
          }
        }
      } catch (challengeError) {
        // Non-fatal: don't block post deletion
        console.error(
          "[deletePost] Error handling challenge cleanup:",
          challengeError,
        );
      }
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

// Get poll voters grouped by option
const getPollVoters = async (req, res) => {
  try {
    const { postId } = req.params;

    // Check if post exists and is a poll
    const postCheck = await pool.query(
      "SELECT post_type FROM posts WHERE id = $1",
      [postId],
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (postCheck.rows[0].post_type !== "poll") {
      return res.status(400).json({ error: "Post is not a poll" });
    }

    // Fetch all votes with voter profile information
    const votesQuery = `
      SELECT 
        pv.option_index,
        pv.voter_id,
        pv.voter_type,
        pv.created_at as voted_at,
        CASE 
          WHEN pv.voter_type = 'member' THEN m.name
          WHEN pv.voter_type = 'community' THEN c.name
          WHEN pv.voter_type = 'sponsor' THEN s.brand_name
        END as voter_name,
        CASE 
          WHEN pv.voter_type = 'member' THEN m.username
          WHEN pv.voter_type = 'community' THEN c.username
          WHEN pv.voter_type = 'sponsor' THEN s.username
        END as voter_username,
        CASE 
          WHEN pv.voter_type = 'member' THEN m.profile_photo_url
          WHEN pv.voter_type = 'community' THEN c.logo_url
          WHEN pv.voter_type = 'sponsor' THEN s.logo_url
        END as voter_photo_url
      FROM poll_votes pv
      LEFT JOIN members m ON pv.voter_type = 'member' AND pv.voter_id = m.id
      LEFT JOIN communities c ON pv.voter_type = 'community' AND pv.voter_id = c.id
      LEFT JOIN sponsors s ON pv.voter_type = 'sponsor' AND pv.voter_id = s.id
      WHERE pv.post_id = $1
      ORDER BY pv.option_index, pv.created_at DESC
    `;

    const votesResult = await pool.query(votesQuery, [postId]);

    // Group voters by option_index
    const votersByOption = {};
    votesResult.rows.forEach((vote) => {
      const optionIndex = vote.option_index;
      if (!votersByOption[optionIndex]) {
        votersByOption[optionIndex] = [];
      }
      votersByOption[optionIndex].push({
        voter_id: vote.voter_id,
        voter_type: vote.voter_type,
        voter_name: vote.voter_name,
        voter_username: vote.voter_username,
        voter_photo_url: vote.voter_photo_url,
        voted_at: vote.voted_at,
      });
    });

    res.json({
      voters_by_option: votersByOption,
      total_votes: votesResult.rows.length,
    });
  } catch (error) {
    console.error("Error getting poll voters:", error);
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
  updatePost,
  deletePost,
  getPollVoters,
};
