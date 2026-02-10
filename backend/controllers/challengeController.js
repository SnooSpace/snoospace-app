/**
 * Challenge Controller
 * Handles Challenge post creation, participation, submissions, and moderation
 */

const { createPool } = require("../config/db");
const pushService = require("../services/pushService");

const pool = createPool();

// =============================================================================
// CREATE CHALLENGE POST
// =============================================================================

/**
 * Create a Challenge post
 * POST /posts (with post_type: 'challenge')
 */
const createChallengePost = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Only communities can create Challenge posts
    if (userType !== "community") {
      return res
        .status(403)
        .json({ error: "Only communities can create Challenge posts" });
    }

    const {
      title,
      description,
      challenge_type = "single", // 'single', 'progress', 'community'
      submission_type = "image", // 'text', 'image', 'video'
      target_count = 1,
      max_submissions_per_user = 1,
      require_approval = true,
      show_proofs_immediately = true, // If false, participants only see others' proofs after challenge ends
      deadline,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    // Build type_data
    const typeData = {
      title: title.trim(),
      description: description?.trim() || "",
      challenge_type,
      submission_type,
      target_count: parseInt(target_count) || 1,
      max_submissions_per_user: parseInt(max_submissions_per_user) || 1,
      require_approval,
      show_proofs_immediately,
      participant_count: 0,
      submission_count: 0,
      completed_count: 0,
    };

    // Insert post
    const query = `
      INSERT INTO posts (author_id, author_type, post_type, type_data, expires_at, image_urls)
      VALUES ($1, $2, 'challenge', $3, $4, $5)
      RETURNING id, created_at
    `;

    const result = await pool.query(query, [
      userId,
      userType,
      JSON.stringify(typeData),
      deadline || null,
      JSON.stringify([]), // Empty array for image_urls
    ]);

    const post = result.rows[0];

    console.log(
      `[Challenge] Created Challenge post ${post.id} by ${userType}:${userId}`,
    );

    res.status(201).json({
      success: true,
      post: {
        id: post.id,
        author_id: userId,
        author_type: userType,
        post_type: "challenge",
        type_data: typeData,
        expires_at: deadline || null,
        created_at: post.created_at,
      },
    });
  } catch (error) {
    console.error("[Challenge] Error creating Challenge post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =============================================================================
// PARTICIPATION
// =============================================================================

/**
 * Join a challenge
 * POST /posts/:postId/join
 */
const joinChallenge = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify post exists and is a challenge
    const postResult = await pool.query(
      `SELECT id, author_id, author_type, type_data, expires_at 
       FROM posts WHERE id = $1 AND post_type = 'challenge'`,
      [postId],
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    const post = postResult.rows[0];

    // Check if expired
    if (post.expires_at && new Date(post.expires_at) < new Date()) {
      return res.status(400).json({ error: "This challenge has ended" });
    }

    // Check if already joined
    const existingResult = await pool.query(
      `SELECT id FROM challenge_participations 
       WHERE post_id = $1 AND participant_id = $2 AND participant_type = $3`,
      [postId, userId, userType],
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: "Already joined" });
    }

    // Insert participation
    const insertResult = await pool.query(
      `INSERT INTO challenge_participations 
       (post_id, participant_id, participant_type, status, progress)
       VALUES ($1, $2, $3, 'joined', 0)
       RETURNING id, created_at`,
      [postId, userId, userType],
    );

    const participation = insertResult.rows[0];

    // Update participant count in type_data
    const typeData = post.type_data || {};
    await pool.query(
      `UPDATE posts SET type_data = type_data || $1 WHERE id = $2`,
      [
        JSON.stringify({
          participant_count: (typeData.participant_count || 0) + 1,
        }),
        postId,
      ],
    );

    console.log(
      `[Challenge] User ${userType}:${userId} joined challenge ${postId}`,
    );

    res.status(201).json({
      success: true,
      participation: {
        id: participation.id,
        post_id: parseInt(postId),
        status: "joined",
        progress: 0,
        joined_at: participation.created_at,
      },
    });
  } catch (error) {
    console.error("[Challenge] Error joining challenge:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Leave a challenge
 * DELETE /posts/:postId/join
 */
const leaveChallenge = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Delete participation (and cascade delete submissions)
    const deleteResult = await pool.query(
      `DELETE FROM challenge_participations 
       WHERE post_id = $1 AND participant_id = $2 AND participant_type = $3
       RETURNING id`,
      [postId, userId, userType],
    );

    if (deleteResult.rowCount === 0) {
      return res.status(400).json({ error: "Not joined" });
    }

    // Update participant count
    await pool.query(
      `UPDATE posts SET type_data = jsonb_set(
         type_data, 
         '{participant_count}', 
         (GREATEST(COALESCE((type_data->>'participant_count')::int, 1) - 1, 0))::text::jsonb
       ) WHERE id = $1`,
      [postId],
    );

    res.json({
      success: true,
      message: "Left challenge",
    });
  } catch (error) {
    console.error("[Challenge] Error leaving challenge:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get challenge participants
 * GET /posts/:postId/participants
 */
const getParticipants = async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await pool.query(
      `SELECT 
        cp.id,
        cp.participant_id,
        cp.participant_type,
        cp.status,
        cp.progress,
        cp.is_highlighted,
        cp.created_at as joined_at,
        cp.completed_at,
        CASE 
          WHEN cp.participant_type = 'member' THEN m.name
          WHEN cp.participant_type = 'community' THEN c.name
        END as participant_name,
        CASE 
          WHEN cp.participant_type = 'member' THEN m.profile_photo_url
          WHEN cp.participant_type = 'community' THEN c.logo_url
        END as participant_photo_url,
        (SELECT COUNT(*) FROM challenge_submissions cs WHERE cs.participant_id = cp.id) as submission_count
       FROM challenge_participations cp
       LEFT JOIN members m ON cp.participant_type = 'member' AND cp.participant_id = m.id
       LEFT JOIN communities c ON cp.participant_type = 'community' AND cp.participant_id = c.id
       WHERE cp.post_id = $1
       ORDER BY cp.is_highlighted DESC, cp.progress DESC, cp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [postId, parseInt(limit), offset],
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM challenge_participations WHERE post_id = $1`,
      [postId],
    );

    res.json({
      success: true,
      participants: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        has_more:
          offset + result.rows.length < parseInt(countResult.rows[0].total),
      },
    });
  } catch (error) {
    console.error("[Challenge] Error getting participants:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get preview avatars for participant stack display
 * GET /posts/:postId/participant-previews
 * Returns first 3 participants with photos for card display
 */
const getParticipantPreviews = async (req, res) => {
  try {
    const { postId } = req.params;

    // Get first 3 participants with their photos
    const result = await pool.query(
      `SELECT 
        cp.participant_id,
        cp.participant_type,
        CASE 
          WHEN cp.participant_type = 'member' THEN m.name
          WHEN cp.participant_type = 'community' THEN c.name
        END as participant_name,
        CASE 
          WHEN cp.participant_type = 'member' THEN m.profile_photo_url
          WHEN cp.participant_type = 'community' THEN c.logo_url
        END as participant_photo_url
       FROM challenge_participations cp
       LEFT JOIN members m ON cp.participant_type = 'member' AND cp.participant_id = m.id
       LEFT JOIN communities c ON cp.participant_type = 'community' AND cp.participant_id = c.id
       WHERE cp.post_id = $1
       ORDER BY cp.created_at ASC
       LIMIT 3`,
      [postId],
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM challenge_participations WHERE post_id = $1`,
      [postId],
    );

    res.json({
      success: true,
      previews: result.rows,
      total_count: parseInt(countResult.rows[0].total),
    });
  } catch (error) {
    console.error("[Challenge] Error getting participant previews:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =============================================================================
// SUBMISSIONS
// =============================================================================

/**
 * Submit proof for a challenge
 * POST /posts/:postId/challenge-submissions
 */
const submitProof = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { content, media_urls, video_url, video_thumbnail } = req.body;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get challenge and verify user is participating
    const postResult = await pool.query(
      `SELECT p.id, p.type_data, p.expires_at, p.author_id, p.author_type,
              cp.id as participation_id, cp.status as participation_status
       FROM posts p
       LEFT JOIN challenge_participations cp ON cp.post_id = p.id 
         AND cp.participant_id = $2 AND cp.participant_type = $3
       WHERE p.id = $1 AND p.post_type = 'challenge'`,
      [postId, userId, userType],
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    const post = postResult.rows[0];

    if (!post.participation_id) {
      return res
        .status(400)
        .json({ error: "You must join the challenge first" });
    }

    // Check if expired
    if (post.expires_at && new Date(post.expires_at) < new Date()) {
      return res.status(400).json({ error: "This challenge has ended" });
    }

    const typeData = post.type_data || {};

    // Check submission limit
    const submissionCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM challenge_submissions 
       WHERE participant_id = $1`,
      [post.participation_id],
    );

    const maxSubmissions = typeData.max_submissions_per_user || 1;
    if (parseInt(submissionCountResult.rows[0].count) >= maxSubmissions) {
      return res.status(400).json({
        error: `You can only submit ${maxSubmissions} time(s) for this challenge`,
      });
    }

    // Determine submission type and validate
    let submissionType = "text";
    if (video_url) {
      submissionType = "video";
    } else if (media_urls && media_urls.length > 0) {
      submissionType = "image";
    }

    // Check if submission type matches challenge requirement
    if (
      typeData.submission_type &&
      submissionType !== typeData.submission_type &&
      typeData.submission_type !== "any"
    ) {
      return res.status(400).json({
        error: `This challenge requires ${typeData.submission_type} submissions`,
      });
    }

    // Determine initial status
    const initialStatus = typeData.require_approval ? "pending" : "approved";

    // Insert submission
    const insertResult = await pool.query(
      `INSERT INTO challenge_submissions 
       (post_id, participant_id, content, media_urls, video_url, video_thumbnail, submission_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, created_at`,
      [
        postId,
        post.participation_id,
        content?.trim() || null,
        media_urls ? JSON.stringify(media_urls) : null,
        video_url || null,
        video_thumbnail || null,
        submissionType,
        initialStatus,
      ],
    );

    const submission = insertResult.rows[0];

    // Update submission count in type_data
    await pool.query(
      `UPDATE posts SET type_data = jsonb_set(
         type_data, 
         '{submission_count}', 
         (COALESCE((type_data->>'submission_count')::int, 0) + 1)::text::jsonb
       ) WHERE id = $1`,
      [postId],
    );

    // Update participant progress for progress-based challenges
    if (typeData.challenge_type === "progress") {
      const targetCount = typeData.target_count || 1;
      const newSubmissionCount =
        parseInt(submissionCountResult.rows[0].count) + 1;
      const progress = Math.min(
        100,
        Math.round((newSubmissionCount / targetCount) * 100),
      );

      await pool.query(
        `UPDATE challenge_participations 
         SET progress = $1, 
             status = CASE WHEN $1 >= 100 THEN 'completed' ELSE 'in_progress' END,
             completed_at = CASE WHEN $1 >= 100 THEN NOW() ELSE completed_at END
         WHERE id = $2`,
        [progress, post.participation_id],
      );

      // Update completed count if just completed
      if (progress >= 100) {
        await pool.query(
          `UPDATE posts SET type_data = jsonb_set(
             type_data, 
             '{completed_count}', 
             (COALESCE((type_data->>'completed_count')::int, 0) + 1)::text::jsonb
           ) WHERE id = $1`,
          [postId],
        );
      }
    }

    // Send notification to post author
    if (post.author_id !== userId || post.author_type !== userType) {
      try {
        let participantName = "Someone";
        if (userType === "member") {
          const nameResult = await pool.query(
            "SELECT name FROM members WHERE id = $1",
            [userId],
          );
          participantName = nameResult.rows[0]?.name || "Someone";
        }

        await pushService.sendPushNotification(
          pool,
          post.author_id,
          post.author_type,
          "New challenge submission! 📸",
          `${participantName} submitted proof for your challenge`,
          {
            type: "challenge_submission",
            postId: parseInt(postId),
            submissionId: submission.id,
          },
        );
      } catch (e) {
        console.error("[Challenge] Failed to send notification:", e);
      }
    }

    console.log(
      `[Challenge] Submission ${submission.id} created for post ${postId}`,
    );

    res.status(201).json({
      success: true,
      submission: {
        id: submission.id,
        post_id: parseInt(postId),
        content: content?.trim() || null,
        media_urls,
        video_url,
        submission_type: submissionType,
        status: initialStatus,
        created_at: submission.created_at,
      },
    });
  } catch (error) {
    console.error("[Challenge] Error submitting proof:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get submissions for a challenge
 * GET /posts/:postId/challenge-submissions
 *
 * Visibility logic:
 * - Challenge author: Always see all submissions
 * - Participants: See own submissions always; see others' proofs based on:
 *   - show_proofs_immediately = true: See all approved submissions
 *   - show_proofs_immediately = false: See others only after challenge ends
 */
const getSubmissions = async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20, filter = "approved" } = req.query;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get post details including type_data and expires_at
    const postResult = await pool.query(
      `SELECT author_id, author_type, type_data, expires_at FROM posts WHERE id = $1`,
      [postId],
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    const post = postResult.rows[0];
    const typeData = post.type_data || {};
    const isAuthor = post.author_id === userId && post.author_type === userType;

    // Check visibility settings
    const showProofsImmediately = typeData.show_proofs_immediately !== false; // Default true
    const isExpired = post.expires_at && new Date(post.expires_at) < new Date();
    const canSeeAllProofs = isAuthor || showProofsImmediately || isExpired;

    // Get user's participation ID if they're a participant
    let userParticipationId = null;
    if (userId && userType) {
      const participationResult = await pool.query(
        `SELECT id FROM challenge_participations 
         WHERE post_id = $1 AND participant_id = $2 AND participant_type = $3`,
        [postId, userId, userType],
      );
      userParticipationId = participationResult.rows[0]?.id || null;
    }

    // Build filter clause
    let filterClause = "";
    if (filter === "pending" && isAuthor) {
      filterClause = "AND cs.status = 'pending'";
    } else if (filter === "featured") {
      filterClause = "AND cs.is_featured = true AND cs.status = 'approved'";
    } else {
      filterClause = "AND cs.status = 'approved'";
    }

    // Add visibility restriction if user can't see all proofs
    let visibilityClause = "";
    if (!canSeeAllProofs && userParticipationId) {
      // User can only see their own submissions
      visibilityClause = `AND cs.participant_id = ${userParticipationId}`;
    } else if (!canSeeAllProofs && !userParticipationId) {
      // Non-participant, non-author, proofs hidden - show nothing
      return res.json({
        success: true,
        submissions: [],
        visibility_info: {
          proofs_visible: false,
          reason: "Proofs will be visible after the challenge ends",
          expires_at: post.expires_at,
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          has_more: false,
        },
      });
    }

    const result = await pool.query(
      `SELECT 
        cs.id,
        cs.content,
        cs.media_urls,
        cs.video_url,
        cs.video_thumbnail,
        cs.submission_type,
        cs.status,
        cs.like_count,
        cs.is_featured,
        cs.created_at,
        cp.participant_id,
        cp.participant_type,
        CASE 
          WHEN cp.participant_type = 'member' THEN m.name
          WHEN cp.participant_type = 'community' THEN c.name
        END as participant_name,
        CASE 
          WHEN cp.participant_type = 'member' THEN m.profile_photo_url
          WHEN cp.participant_type = 'community' THEN c.logo_url
        END as participant_photo_url,
        CASE 
          WHEN $4::bigint IS NOT NULL THEN EXISTS (
            SELECT 1 FROM challenge_submission_likes csl
            WHERE csl.submission_id = cs.id AND csl.user_id = $4 AND csl.user_type = $5
          )
          ELSE false
        END as has_liked,
        (cp.participant_id = $4 AND cp.participant_type = $5) as is_own_submission,
        css.source_post_id,
        css.is_from_tagged_post,
        CASE WHEN css.source_post_id IS NULL AND css.is_from_tagged_post = true THEN true ELSE false END as source_post_deleted
       FROM challenge_submissions cs
       JOIN challenge_participations cp ON cs.participant_id = cp.id
       LEFT JOIN members m ON cp.participant_type = 'member' AND cp.participant_id = m.id
       LEFT JOIN communities c ON cp.participant_type = 'community' AND cp.participant_id = c.id
       LEFT JOIN challenge_submission_sources css ON css.submission_id = cs.id
       WHERE cs.post_id = $1 ${filterClause} ${visibilityClause}
       ORDER BY cs.is_featured DESC, cs.created_at DESC
       LIMIT $2 OFFSET $3`,
      [postId, parseInt(limit), offset, userId || null, userType || null],
    );

    // Parse media_urls
    const submissions = result.rows.map((sub) => ({
      ...sub,
      media_urls: (() => {
        try {
          if (!sub.media_urls) return [];
          if (Array.isArray(sub.media_urls)) return sub.media_urls;
          return JSON.parse(sub.media_urls);
        } catch {
          return [];
        }
      })(),
    }));

    // Get total count with same visibility restrictions
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM challenge_submissions cs
       JOIN challenge_participations cp ON cs.participant_id = cp.id
       WHERE cs.post_id = $1 ${filterClause} ${visibilityClause}`,
      [postId],
    );

    res.json({
      success: true,
      submissions,
      visibility_info: {
        proofs_visible: canSeeAllProofs,
        is_author: isAuthor,
        show_proofs_immediately: showProofsImmediately,
        is_expired: isExpired,
        expires_at: post.expires_at,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        has_more:
          offset + submissions.length < parseInt(countResult.rows[0].total),
      },
    });
  } catch (error) {
    console.error("[Challenge] Error getting submissions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =============================================================================
// PROGRESS & COMPLETION
// =============================================================================

/**
 * Update progress for a challenge
 * PATCH /posts/:postId/progress
 */
const updateProgress = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { progress } = req.body;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (progress === undefined || progress < 0 || progress > 100) {
      return res
        .status(400)
        .json({ error: "Progress must be between 0 and 100" });
    }

    // Update progress
    const updateResult = await pool.query(
      `UPDATE challenge_participations 
       SET progress = $1,
           status = CASE WHEN $1 >= 100 THEN 'completed' ELSE 'in_progress' END,
           completed_at = CASE WHEN $1 >= 100 AND completed_at IS NULL THEN NOW() ELSE completed_at END,
           updated_at = NOW()
       WHERE post_id = $2 AND participant_id = $3 AND participant_type = $4
       RETURNING id, progress, status, completed_at`,
      [progress, postId, userId, userType],
    );

    if (updateResult.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Not participating in this challenge" });
    }

    const result = updateResult.rows[0];

    // If just completed, update completed count
    if (progress >= 100 && !result.completed_at) {
      await pool.query(
        `UPDATE posts SET type_data = jsonb_set(
           type_data, 
           '{completed_count}', 
           (COALESCE((type_data->>'completed_count')::int, 0) + 1)::text::jsonb
         ) WHERE id = $1`,
        [postId],
      );
    }

    res.json({
      success: true,
      progress: result.progress,
      status: result.status,
      completed_at: result.completed_at,
    });
  } catch (error) {
    console.error("[Challenge] Error updating progress:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Mark challenge as complete
 * POST /posts/:postId/complete
 */
const markComplete = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Update to completed
    const updateResult = await pool.query(
      `UPDATE challenge_participations 
       SET progress = 100,
           status = 'completed',
           completed_at = COALESCE(completed_at, NOW()),
           updated_at = NOW()
       WHERE post_id = $1 AND participant_id = $2 AND participant_type = $3
         AND status != 'completed'
       RETURNING id`,
      [postId, userId, userType],
    );

    if (updateResult.rowCount === 0) {
      // Check if already completed or not joined
      const existingResult = await pool.query(
        `SELECT status FROM challenge_participations 
         WHERE post_id = $1 AND participant_id = $2 AND participant_type = $3`,
        [postId, userId, userType],
      );

      if (existingResult.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Not participating in this challenge" });
      }
      if (existingResult.rows[0].status === "completed") {
        return res.status(400).json({ error: "Already completed" });
      }
    }

    // Update completed count
    await pool.query(
      `UPDATE posts SET type_data = jsonb_set(
         type_data, 
         '{completed_count}', 
         (COALESCE((type_data->>'completed_count')::int, 0) + 1)::text::jsonb
       ) WHERE id = $1`,
      [postId],
    );

    res.json({
      success: true,
      message: "Challenge completed! 🎉",
    });
  } catch (error) {
    console.error("[Challenge] Error marking complete:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =============================================================================
// MODERATION
// =============================================================================

/**
 * Moderate a submission (approve/reject)
 * PATCH /challenge-submissions/:id/status
 */
const moderateSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { status } = req.body;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ error: "Status must be 'approved' or 'rejected'" });
    }

    // Get submission and verify user is post author
    const submissionResult = await pool.query(
      `SELECT cs.id, cs.post_id, cs.participant_id, cs.status,
              p.author_id, p.author_type,
              cp.participant_id as user_id, cp.participant_type as user_type
       FROM challenge_submissions cs
       JOIN posts p ON cs.post_id = p.id
       JOIN challenge_participations cp ON cs.participant_id = cp.id
       WHERE cs.id = $1`,
      [id],
    );

    if (submissionResult.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found" });
    }

    const submission = submissionResult.rows[0];

    // Only post author can moderate
    if (
      submission.author_id !== userId ||
      submission.author_type !== userType
    ) {
      return res
        .status(403)
        .json({ error: "Only the challenge host can moderate" });
    }

    // Update status
    await pool.query(
      `UPDATE challenge_submissions 
       SET status = $1, moderated_by = $2, moderated_at = NOW()
       WHERE id = $3`,
      [status, userId, id],
    );

    // Send notification to submitter
    try {
      const message =
        status === "approved"
          ? "Your submission was approved ✓"
          : "Your submission was not approved";

      await pushService.sendPushNotification(
        pool,
        submission.user_id,
        submission.user_type,
        message,
        status === "approved"
          ? "Great job! Your challenge submission is now visible."
          : "Your submission didn't meet the requirements.",
        {
          type: "challenge_moderation",
          postId: submission.post_id,
          submissionId: parseInt(id),
          status,
        },
      );
    } catch (e) {
      console.error("[Challenge] Failed to send moderation notification:", e);
    }

    res.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error("[Challenge] Error moderating submission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Feature a submission
 * PATCH /challenge-submissions/:id/feature
 */
const featureSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { is_featured = true } = req.body;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify user is post author
    const submissionResult = await pool.query(
      `SELECT cs.id, cs.post_id, p.author_id, p.author_type,
              cp.participant_id as user_id, cp.participant_type as user_type
       FROM challenge_submissions cs
       JOIN posts p ON cs.post_id = p.id
       JOIN challenge_participations cp ON cs.participant_id = cp.id
       WHERE cs.id = $1`,
      [id],
    );

    if (submissionResult.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found" });
    }

    const submission = submissionResult.rows[0];

    if (
      submission.author_id !== userId ||
      submission.author_type !== userType
    ) {
      return res
        .status(403)
        .json({ error: "Only the challenge host can feature" });
    }

    // Update featured status
    await pool.query(
      `UPDATE challenge_submissions SET is_featured = $1 WHERE id = $2`,
      [is_featured, id],
    );

    // Send notification to submitter if featuring
    if (is_featured) {
      try {
        await pushService.sendPushNotification(
          pool,
          submission.user_id,
          submission.user_type,
          "Your submission was featured! 🌟",
          "Congratulations! Your challenge submission is now featured.",
          {
            type: "challenge_featured",
            postId: submission.post_id,
            submissionId: parseInt(id),
          },
        );
      } catch (e) {
        console.error("[Challenge] Failed to send feature notification:", e);
      }
    }

    res.json({
      success: true,
      is_featured,
    });
  } catch (error) {
    console.error("[Challenge] Error featuring submission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Highlight a participant
 * PATCH /participants/:id/highlight
 */
const highlightParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { is_highlighted = true } = req.body;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify user is post author
    const participationResult = await pool.query(
      `SELECT cp.id, cp.post_id, p.author_id, p.author_type
       FROM challenge_participations cp
       JOIN posts p ON cp.post_id = p.id
       WHERE cp.id = $1`,
      [id],
    );

    if (participationResult.rows.length === 0) {
      return res.status(404).json({ error: "Participant not found" });
    }

    const participation = participationResult.rows[0];

    if (
      participation.author_id !== userId ||
      participation.author_type !== userType
    ) {
      return res
        .status(403)
        .json({ error: "Only the challenge host can highlight" });
    }

    // Update highlighted status
    await pool.query(
      `UPDATE challenge_participations SET is_highlighted = $1 WHERE id = $2`,
      [is_highlighted, id],
    );

    res.json({
      success: true,
      is_highlighted,
    });
  } catch (error) {
    console.error("[Challenge] Error highlighting participant:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =============================================================================
// LIKES
// =============================================================================

/**
 * Like a submission
 * POST /challenge-submissions/:id/like
 */
const likeSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check if already liked
    const existingLike = await pool.query(
      `SELECT id FROM challenge_submission_likes 
       WHERE submission_id = $1 AND user_id = $2 AND user_type = $3`,
      [id, userId, userType],
    );

    if (existingLike.rows.length > 0) {
      return res.status(400).json({ error: "Already liked" });
    }

    // Add like
    await pool.query(
      `INSERT INTO challenge_submission_likes (submission_id, user_id, user_type)
       VALUES ($1, $2, $3)`,
      [id, userId, userType],
    );

    // Update like count
    const updateResult = await pool.query(
      `UPDATE challenge_submissions 
       SET like_count = like_count + 1 
       WHERE id = $1
       RETURNING like_count`,
      [id],
    );

    res.json({
      success: true,
      like_count: updateResult.rows[0].like_count,
    });
  } catch (error) {
    console.error("[Challenge] Error liking submission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Unlike a submission
 * DELETE /challenge-submissions/:id/like
 */
const unlikeSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Remove like
    const deleteResult = await pool.query(
      `DELETE FROM challenge_submission_likes 
       WHERE submission_id = $1 AND user_id = $2 AND user_type = $3`,
      [id, userId, userType],
    );

    if (deleteResult.rowCount === 0) {
      return res.status(400).json({ error: "Not liked" });
    }

    // Update like count
    const updateResult = await pool.query(
      `UPDATE challenge_submissions 
       SET like_count = GREATEST(like_count - 1, 0) 
       WHERE id = $1
       RETURNING like_count`,
      [id],
    );

    res.json({
      success: true,
      like_count: updateResult.rows[0]?.like_count || 0,
    });
  } catch (error) {
    console.error("[Challenge] Error unliking submission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =============================================================================
// REMOVAL REQUESTS & CHALLENGE SEARCH
// =============================================================================

/**
 * Request removal of a submission (after challenge ends)
 * POST /challenge-submissions/:id/request-removal
 */
const requestSubmissionRemoval = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { reason } = req.body;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get submission and verify ownership
    const submissionResult = await pool.query(
      `SELECT cs.id, cs.post_id,
              cp.participant_id, cp.participant_type,
              p.expires_at
       FROM challenge_submissions cs
       JOIN challenge_participations cp ON cs.participant_id = cp.id
       JOIN posts p ON cs.post_id = p.id
       WHERE cs.id = $1`,
      [id],
    );

    if (submissionResult.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found" });
    }

    const submission = submissionResult.rows[0];

    // Verify the requester owns this submission
    if (
      submission.participant_id !== userId ||
      submission.participant_type !== userType
    ) {
      return res
        .status(403)
        .json({
          error: "You can only request removal of your own submissions",
        });
    }

    // Verify challenge has ended
    if (
      !submission.expires_at ||
      new Date(submission.expires_at) > new Date()
    ) {
      return res.status(400).json({
        error:
          "You can only request removal after the challenge has ended. Delete the post instead.",
      });
    }

    // Check if already requested
    const existingRequest = await pool.query(
      `SELECT id, status FROM submission_removal_requests 
       WHERE submission_id = $1 AND requester_id = $2 AND requester_type = $3`,
      [id, userId, userType],
    );

    if (existingRequest.rows.length > 0) {
      const existing = existingRequest.rows[0];
      if (existing.status === "pending") {
        return res
          .status(400)
          .json({ error: "Removal request already pending" });
      } else if (existing.status === "rejected") {
        return res
          .status(400)
          .json({ error: "Removal request was previously rejected" });
      }
    }

    // Create removal request
    const insertResult = await pool.query(
      `INSERT INTO submission_removal_requests 
       (submission_id, requester_id, requester_type, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [id, userId, userType, reason?.trim() || null],
    );

    // Send notification to challenge author
    try {
      const challengeResult = await pool.query(
        `SELECT author_id, author_type FROM posts WHERE id = $1`,
        [submission.post_id],
      );
      if (challengeResult.rows.length > 0) {
        const challengeAuthor = challengeResult.rows[0];
        let requesterName = "Someone";
        if (userType === "member") {
          const nameResult = await pool.query(
            "SELECT name FROM members WHERE id = $1",
            [userId],
          );
          requesterName = nameResult.rows[0]?.name || "Someone";
        }

        await pushService.sendPushNotification(
          pool,
          challengeAuthor.author_id,
          challengeAuthor.author_type,
          "Submission Removal Request 📋",
          `${requesterName} requested to remove their challenge submission`,
          {
            type: "removal_request",
            postId: submission.post_id,
            submissionId: parseInt(id),
            requestId: insertResult.rows[0].id,
          },
        );
      }
    } catch (e) {
      console.error(
        "[Challenge] Failed to send removal request notification:",
        e,
      );
    }

    console.log(`[Challenge] Removal request created for submission ${id}`);

    res.status(201).json({
      success: true,
      request: {
        id: insertResult.rows[0].id,
        status: "pending",
        created_at: insertResult.rows[0].created_at,
      },
    });
  } catch (error) {
    console.error("[Challenge] Error requesting removal:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Review a removal request (approve/reject)
 * PATCH /submission-removal-requests/:id
 */
const reviewRemovalRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { status } = req.body;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ error: "Status must be 'approved' or 'rejected'" });
    }

    // Get request and verify reviewer is challenge author
    const requestResult = await pool.query(
      `SELECT srr.id, srr.submission_id, srr.requester_id, srr.requester_type, srr.status as current_status,
              cs.post_id,
              p.author_id, p.author_type
       FROM submission_removal_requests srr
       JOIN challenge_submissions cs ON srr.submission_id = cs.id
       JOIN posts p ON cs.post_id = p.id
       WHERE srr.id = $1`,
      [id],
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: "Removal request not found" });
    }

    const request = requestResult.rows[0];

    // Only challenge author can review
    if (request.author_id !== userId || request.author_type !== userType) {
      return res
        .status(403)
        .json({ error: "Only the challenge host can review removal requests" });
    }

    if (request.current_status !== "pending") {
      return res
        .status(400)
        .json({ error: "This request has already been reviewed" });
    }

    // Update request status
    await pool.query(
      `UPDATE submission_removal_requests 
       SET status = $1, reviewed_by = $2, reviewed_at = NOW()
       WHERE id = $3`,
      [status, userId, id],
    );

    // If approved, delete the submission
    if (status === "approved") {
      await pool.query(`DELETE FROM challenge_submissions WHERE id = $1`, [
        request.submission_id,
      ]);

      // Decrement submission count
      await pool.query(
        `UPDATE posts SET type_data = jsonb_set(
           type_data, 
           '{submission_count}', 
           (GREATEST(COALESCE((type_data->>'submission_count')::int, 0) - 1, 0))::text::jsonb
         ) WHERE id = $1`,
        [request.post_id],
      );
    }

    // Notify the requester
    try {
      const message =
        status === "approved"
          ? "Your removal request was approved ✓"
          : "Your removal request was declined";

      await pushService.sendPushNotification(
        pool,
        request.requester_id,
        request.requester_type,
        message,
        status === "approved"
          ? "Your challenge submission has been removed."
          : "The challenge host declined your removal request.",
        {
          type: "removal_request_review",
          postId: request.post_id,
          status,
        },
      );
    } catch (e) {
      console.error("[Challenge] Failed to send review notification:", e);
    }

    res.json({ success: true, status });
  } catch (error) {
    console.error("[Challenge] Error reviewing removal request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get pending removal requests for a challenge
 * GET /posts/:postId/removal-requests
 */
const getPendingRemovalRequests = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify user is the challenge author
    const postResult = await pool.query(
      `SELECT author_id, author_type FROM posts WHERE id = $1 AND post_type = 'challenge'`,
      [postId],
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    const post = postResult.rows[0];
    if (post.author_id !== userId || post.author_type !== userType) {
      return res
        .status(403)
        .json({ error: "Only the challenge host can view removal requests" });
    }

    const result = await pool.query(
      `SELECT 
        srr.id,
        srr.submission_id,
        srr.requester_id,
        srr.requester_type,
        srr.reason,
        srr.status,
        srr.created_at,
        cs.content as submission_content,
        cs.media_urls as submission_media,
        cs.video_url as submission_video,
        cs.submission_type,
        CASE 
          WHEN srr.requester_type = 'member' THEN m.name
        END as requester_name,
        CASE 
          WHEN srr.requester_type = 'member' THEN m.profile_photo_url
        END as requester_photo
       FROM submission_removal_requests srr
       JOIN challenge_submissions cs ON srr.submission_id = cs.id
       LEFT JOIN members m ON srr.requester_type = 'member' AND srr.requester_id = m.id
       WHERE cs.post_id = $1 AND srr.status = 'pending'
       ORDER BY srr.created_at DESC`,
      [postId],
    );

    res.json({
      success: true,
      requests: result.rows,
    });
  } catch (error) {
    console.error("[Challenge] Error getting removal requests:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Search for active challenges in a community
 * GET /challenges/search?q={query}&communityId={communityId}
 */
const searchChallenges = async (req, res) => {
  try {
    const { q, communityId } = req.query;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!communityId) {
      return res.status(400).json({ error: "communityId is required" });
    }

    // Search active challenges posted by the community
    let queryStr = `
      SELECT 
        p.id,
        p.caption,
        p.type_data,
        p.expires_at,
        p.created_at,
        p.author_id,
        p.author_type,
        CASE 
          WHEN p.author_type = 'community' THEN c.name
          WHEN p.author_type = 'member' THEN m.name
        END as author_name,
        CASE 
          WHEN p.author_type = 'community' THEN c.logo_url
          WHEN p.author_type = 'member' THEN m.profile_photo_url
        END as author_photo,
        EXISTS (
          SELECT 1 FROM challenge_participations cp 
          WHERE cp.post_id = p.id AND cp.participant_id = $2 AND cp.participant_type = $3
        ) as is_joined
      FROM posts p
      LEFT JOIN communities c ON p.author_type = 'community' AND p.author_id = c.id
      LEFT JOIN members m ON p.author_type = 'member' AND p.author_id = m.id
      WHERE p.post_type = 'challenge'
        AND p.author_id = $1 AND p.author_type = 'community'
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
    `;
    const params = [communityId, userId, userType];

    if (q && q.trim()) {
      queryStr += ` AND p.caption ILIKE $4`;
      params.push(`%${q.trim()}%`);
    }

    queryStr += ` ORDER BY p.created_at DESC LIMIT 20`;

    const result = await pool.query(queryStr, params);

    const challenges = result.rows.map((row) => ({
      id: row.id,
      title:
        row.type_data?.title ||
        row.caption?.substring(0, 50) ||
        "Untitled Challenge",
      caption: row.caption,
      type_data: row.type_data,
      expires_at: row.expires_at,
      author_name: row.author_name,
      author_photo: row.author_photo,
      is_joined: row.is_joined,
      created_at: row.created_at,
    }));

    res.json({
      success: true,
      challenges,
    });
  } catch (error) {
    console.error("[Challenge] Error searching challenges:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  createChallengePost,
  joinChallenge,
  leaveChallenge,
  getParticipants,
  getParticipantPreviews,
  submitProof,
  getSubmissions,
  updateProgress,
  markComplete,
  moderateSubmission,
  featureSubmission,
  highlightParticipant,
  likeSubmission,
  unlikeSubmission,
  requestSubmissionRemoval,
  reviewRemovalRequest,
  getPendingRemovalRequests,
  searchChallenges,
};
