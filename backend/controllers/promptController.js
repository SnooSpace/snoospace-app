/**
 * Prompt Controller
 * Handles prompt post creation, submissions, and moderation
 */

const { createPool } = require("../config/db");
const pushService = require("../services/pushService");

const pool = createPool();

/**
 * Create a prompt post
 * POST /posts (with post_type: 'prompt')
 */
const createPromptPost = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Only communities can create prompts
    if (userType !== "community") {
      return res
        .status(403)
        .json({ error: "Only communities can create prompts" });
    }

    const {
      caption,
      prompt_text,
      submission_type = "text", // text, image, video
      max_length = 500,
      require_approval = true,
      expires_at,
    } = req.body;

    // Validate required fields
    if (!prompt_text || !prompt_text.trim()) {
      return res.status(400).json({ error: "Prompt text is required" });
    }

    if (!["text", "image", "video"].includes(submission_type)) {
      return res.status(400).json({ error: "Invalid submission type" });
    }

    // Build type_data for prompt
    const typeData = {
      prompt_text: prompt_text.trim(),
      submission_type,
      max_length: parseInt(max_length) || 500,
      require_approval: Boolean(require_approval),
      submission_count: 0,
      featured_submission_ids: [],
    };

    // Insert prompt post
    const query = `
      INSERT INTO posts (
        author_id, author_type, post_type, caption, 
        image_urls, type_data, status, expires_at
      )
      VALUES ($1, $2, 'prompt', $3, '[]'::jsonb, $4, 'active', $5)
      RETURNING id, created_at
    `;

    const result = await pool.query(query, [
      userId,
      userType,
      caption || null,
      JSON.stringify(typeData),
      expires_at || null,
    ]);

    const post = result.rows[0];

    console.log(
      `[createPromptPost] Created prompt post ${post.id} by ${userType}:${userId}`
    );

    res.status(201).json({
      success: true,
      post: {
        id: post.id,
        author_id: userId,
        author_type: userType,
        post_type: "prompt",
        caption,
        type_data: typeData,
        status: "active",
        expires_at,
        like_count: 0,
        comment_count: 0,
        created_at: post.created_at,
      },
    });
  } catch (error) {
    console.error("Error creating prompt post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Submit a response to a prompt
 * POST /posts/:postId/submissions
 */
const submitResponse = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, media_urls } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get the prompt post
    const postResult = await pool.query(
      `SELECT id, post_type, type_data, status, expires_at, author_id, author_type FROM posts WHERE id = $1`,
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Prompt not found" });
    }

    const post = postResult.rows[0];

    if (post.post_type !== "prompt") {
      return res.status(400).json({ error: "This post is not a prompt" });
    }

    if (post.status !== "active") {
      return res
        .status(400)
        .json({ error: "This prompt is no longer accepting submissions" });
    }

    // Check expiry
    if (post.expires_at && new Date(post.expires_at) < new Date()) {
      return res.status(400).json({ error: "This prompt has expired" });
    }

    const typeData = post.type_data;

    // Validate content based on submission type
    if (typeData.submission_type === "text") {
      if (!content || !content.trim()) {
        return res
          .status(400)
          .json({ error: "Submission content is required" });
      }
      if (content.length > typeData.max_length) {
        return res.status(400).json({
          error: `Submission exceeds max length of ${typeData.max_length} characters`,
        });
      }
    } else if (["image", "video"].includes(typeData.submission_type)) {
      if (
        !media_urls ||
        !Array.isArray(media_urls) ||
        media_urls.length === 0
      ) {
        return res
          .status(400)
          .json({ error: "Media is required for this prompt" });
      }
    }

    // Check for duplicate submission from same user
    const existingSubmission = await pool.query(
      `SELECT id FROM prompt_submissions 
       WHERE post_id = $1 AND author_id = $2 AND author_type = $3`,
      [postId, userId, userType]
    );

    if (existingSubmission.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "You have already submitted to this prompt" });
    }

    // Determine initial status
    // Auto-approve if: no approval required OR submitter is the post author
    const isPostAuthor =
      parseInt(post.author_id) === parseInt(userId) &&
      post.author_type === userType;
    const initialStatus =
      !typeData.require_approval || isPostAuthor ? "approved" : "pending";

    // Insert submission
    const insertResult = await pool.query(
      `INSERT INTO prompt_submissions (post_id, author_id, author_type, content, media_urls, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [
        postId,
        userId,
        userType,
        content?.trim() || null,
        media_urls ? JSON.stringify(media_urls) : null,
        initialStatus,
      ]
    );

    const submission = insertResult.rows[0];

    // Update submission count in type_data
    const newCount = (typeData.submission_count || 0) + 1;
    await pool.query(
      `UPDATE posts SET 
        type_data = jsonb_set(type_data, '{submission_count}', $1::jsonb)
       WHERE id = $2`,
      [JSON.stringify(newCount), postId]
    );

    // Notify community admin about new submission (if approval required and not author's own submission)
    if (typeData.require_approval && !isPostAuthor) {
      try {
        // Get submitter info
        let submitterName = "Someone";
        if (userType === "member") {
          const memberResult = await pool.query(
            "SELECT name FROM members WHERE id = $1",
            [userId]
          );
          if (memberResult.rows[0]) {
            submitterName = memberResult.rows[0].name;
          }
        }

        await pushService.sendPushNotification(
          pool,
          post.author_id,
          post.author_type,
          "New prompt response 📝",
          `${submitterName} submitted a response to your prompt`,
          {
            type: "prompt_submission",
            postId: parseInt(postId),
            submissionId: submission.id,
          }
        );
      } catch (e) {
        console.error("Failed to send submission notification", e);
      }
    }

    console.log(
      `[submitResponse] User ${userType}:${userId} submitted to prompt ${postId}`
    );

    res.status(201).json({
      success: true,
      submission: {
        id: submission.id,
        post_id: parseInt(postId),
        author_id: userId,
        author_type: userType,
        content: content?.trim() || null,
        media_urls,
        status: initialStatus,
        created_at: submission.created_at,
      },
    });
  } catch (error) {
    console.error("Error submitting to prompt:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get submissions for a prompt
 * GET /posts/:postId/submissions
 */
const getSubmissions = async (req, res) => {
  try {
    const { postId } = req.params;
    const { status = "approved", page = 1, limit = 20 } = req.query;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get the prompt post
    const postResult = await pool.query(
      `SELECT id, post_type, author_id, author_type FROM posts WHERE id = $1`,
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Prompt not found" });
    }

    const post = postResult.rows[0];

    if (post.post_type !== "prompt") {
      return res.status(400).json({ error: "This post is not a prompt" });
    }

    // Check if user is the post author (can see all statuses)
    // Use parseInt to handle type mismatch between DB (integer) and token (string)
    const isAuthor =
      parseInt(post.author_id) === parseInt(userId) &&
      post.author_type === userType;

    // Build query based on permissions
    let statusFilter;
    if (isAuthor) {
      // Author can filter by any status
      statusFilter = status === "all" ? null : status;
    } else {
      // Non-authors can only see approved submissions
      statusFilter = "approved";
    }

    let query = `
      SELECT 
        s.*,
        CASE 
          WHEN s.author_type = 'member' THEN m.name
          WHEN s.author_type = 'community' THEN c.name
          WHEN s.author_type = 'sponsor' THEN sp.brand_name
        END as author_name,
        CASE 
          WHEN s.author_type = 'member' THEN m.username
          WHEN s.author_type = 'community' THEN c.username
          WHEN s.author_type = 'sponsor' THEN sp.username
        END as author_username,
        CASE 
          WHEN s.author_type = 'member' THEN m.profile_photo_url
          WHEN s.author_type = 'community' THEN c.logo_url
          WHEN s.author_type = 'sponsor' THEN sp.logo_url
        END as author_photo_url
      FROM prompt_submissions s
      LEFT JOIN members m ON s.author_type = 'member' AND s.author_id = m.id
      LEFT JOIN communities c ON s.author_type = 'community' AND s.author_id = c.id
      LEFT JOIN sponsors sp ON s.author_type = 'sponsor' AND s.author_id = sp.id
      WHERE s.post_id = $1
    `;

    const params = [postId];

    if (statusFilter) {
      query += ` AND s.status = $${params.length + 1}`;
      params.push(statusFilter);
    } else if (!isAuthor) {
      // If not author and no specific filter, show approved only
      query += ` AND s.status = 'approved'`;
    }

    // Order: pinned first, then by creation date
    query += ` ORDER BY 
      s.is_pinned DESC,
      s.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    // Parse media_urls JSON
    const submissions = result.rows.map((s) => ({
      ...s,
      media_urls: s.media_urls
        ? typeof s.media_urls === "string"
          ? JSON.parse(s.media_urls)
          : s.media_urls
        : null,
    }));

    res.json({
      submissions,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: submissions.length === parseInt(limit),
    });
  } catch (error) {
    console.error("Error getting submissions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Moderate a submission (approve/reject)
 * PATCH /submissions/:submissionId/status
 */
const moderateSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Must be: approved or rejected",
      });
    }

    // Get the submission and its parent post
    const subResult = await pool.query(
      `SELECT s.*, p.author_id as post_author_id, p.author_type as post_author_type
       FROM prompt_submissions s
       JOIN posts p ON s.post_id = p.id
       WHERE s.id = $1`,
      [submissionId]
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found" });
    }

    const submission = subResult.rows[0];

    // Check if user is the post author (has moderation rights)
    if (
      parseInt(submission.post_author_id) !== parseInt(userId) ||
      submission.post_author_type !== userType
    ) {
      return res
        .status(403)
        .json({ error: "Only the prompt author can moderate submissions" });
    }

    const previousStatus = submission.status;

    // Update submission status
    await pool.query(
      `UPDATE prompt_submissions 
       SET status = $1, moderated_by = $2, moderated_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [status, userId, submissionId]
    );

    // Notify the submitter about the moderation decision
    try {
      const notificationTitle =
        status === "approved"
          ? "Your response was approved ✅"
          : "Response update";

      const notificationBody =
        status === "approved"
          ? "Your prompt response is now visible to others"
          : "Your prompt response was reviewed";

      // Only notify for approval
      if (status === "approved") {
        await pushService.sendPushNotification(
          pool,
          submission.author_id,
          submission.author_type,
          notificationTitle,
          notificationBody,
          {
            type: "submission_moderated",
            postId: submission.post_id,
            submissionId: parseInt(submissionId),
            newStatus: status,
          }
        );
      }
    } catch (e) {
      console.error("Failed to send moderation notification", e);
    }

    console.log(
      `[moderateSubmission] Submission ${submissionId} changed from ${previousStatus} to ${status}`
    );

    res.json({
      success: true,
      message: `Submission ${status}`,
      submission_id: parseInt(submissionId),
      new_status: status,
    });
  } catch (error) {
    console.error("Error moderating submission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get user's own submission for a prompt
 * GET /posts/:postId/my-submission
 */
const getMySubmission = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = await pool.query(
      `SELECT * FROM prompt_submissions 
       WHERE post_id = $1 AND author_id = $2 AND author_type = $3`,
      [postId, userId, userType]
    );

    if (result.rows.length === 0) {
      return res.json({ submission: null, has_submitted: false });
    }

    const submission = result.rows[0];

    res.json({
      submission: {
        ...submission,
        media_urls: submission.media_urls
          ? typeof submission.media_urls === "string"
            ? JSON.parse(submission.media_urls)
            : submission.media_urls
          : null,
      },
      has_submitted: true,
    });
  } catch (error) {
    console.error("Error getting my submission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Pin/unpin a submission
 * PATCH /submissions/:submissionId/pin
 * Only one submission can be pinned per prompt - pinning a new one unpins the previous
 */
const pinSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get the submission and its parent post
    const subResult = await pool.query(
      `SELECT s.*, p.author_id as post_author_id, p.author_type as post_author_type
       FROM prompt_submissions s
       JOIN posts p ON s.post_id = p.id
       WHERE s.id = $1`,
      [submissionId]
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found" });
    }

    const submission = subResult.rows[0];

    // Check if user is the post author
    if (
      parseInt(submission.post_author_id) !== parseInt(userId) ||
      submission.post_author_type !== userType
    ) {
      return res
        .status(403)
        .json({ error: "Only the prompt author can pin submissions" });
    }

    // Only approved submissions can be pinned
    if (submission.status !== "approved") {
      return res
        .status(400)
        .json({ error: "Only approved submissions can be pinned" });
    }

    const willBePinned = !submission.is_pinned;

    // If pinning, first unpin any currently pinned submission for this post
    if (willBePinned) {
      await pool.query(
        `UPDATE prompt_submissions SET is_pinned = FALSE WHERE post_id = $1 AND is_pinned = TRUE`,
        [submission.post_id]
      );
    }

    // Toggle the pin
    await pool.query(
      `UPDATE prompt_submissions SET is_pinned = $1, updated_at = NOW() WHERE id = $2`,
      [willBePinned, submissionId]
    );

    console.log(
      `[pinSubmission] Submission ${submissionId} ${
        willBePinned ? "pinned" : "unpinned"
      }`
    );

    res.json({
      success: true,
      message: willBePinned ? "Submission pinned" : "Submission unpinned",
      is_pinned: willBePinned,
    });
  } catch (error) {
    console.error("Error pinning submission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Create a reply to a submission (or to another reply)
 * POST /submissions/:submissionId/replies
 * Body: { content, parent_reply_id? }
 */
const createReply = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { content, parent_reply_id } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Reply content is required" });
    }

    // Check if submission exists and is approved
    const subResult = await pool.query(
      `SELECT s.*, p.id as post_id FROM prompt_submissions s
       JOIN posts p ON s.post_id = p.id
       WHERE s.id = $1`,
      [submissionId]
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found" });
    }

    const submission = subResult.rows[0];

    if (submission.status !== "approved") {
      return res
        .status(400)
        .json({ error: "Can only reply to approved submissions" });
    }

    // If replying to another reply, verify the parent reply exists
    if (parent_reply_id) {
      const parentCheck = await pool.query(
        `SELECT id FROM prompt_replies WHERE id = $1 AND submission_id = $2`,
        [parent_reply_id, submissionId]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(404).json({ error: "Parent reply not found" });
      }
    }

    // Insert the reply
    const insertResult = await pool.query(
      `INSERT INTO prompt_replies (submission_id, author_id, author_type, content, parent_reply_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [submissionId, userId, userType, content.trim(), parent_reply_id || null]
    );

    // Update reply count on appropriate parent
    if (parent_reply_id) {
      // Update reply_count on parent reply
      await pool.query(
        `UPDATE prompt_replies SET reply_count = reply_count + 1, updated_at = NOW()
         WHERE id = $1`,
        [parent_reply_id]
      );
    } else {
      // Update reply_count on submission
      await pool.query(
        `UPDATE prompt_submissions SET reply_count = reply_count + 1, updated_at = NOW()
         WHERE id = $1`,
        [submissionId]
      );
    }

    const reply = insertResult.rows[0];

    // Get author info for response
    let authorName = "User";
    let authorPhotoUrl = null;
    if (userType === "member") {
      const memberResult = await pool.query(
        "SELECT name, profile_photo_url FROM members WHERE id = $1",
        [userId]
      );
      if (memberResult.rows[0]) {
        authorName = memberResult.rows[0].name;
        authorPhotoUrl = memberResult.rows[0].profile_photo_url;
      }
    } else if (userType === "community") {
      const commResult = await pool.query(
        "SELECT name, logo_url FROM communities WHERE id = $1",
        [userId]
      );
      if (commResult.rows[0]) {
        authorName = commResult.rows[0].name;
        authorPhotoUrl = commResult.rows[0].logo_url;
      }
    }

    console.log(
      `[createReply] User ${userType}:${userId} replied to ${
        parent_reply_id
          ? `reply ${parent_reply_id}`
          : `submission ${submissionId}`
      }`
    );

    res.status(201).json({
      success: true,
      reply: {
        id: reply.id,
        submission_id: parseInt(submissionId),
        parent_reply_id: parent_reply_id || null,
        author_id: userId,
        author_type: userType,
        author_name: authorName,
        author_photo_url: authorPhotoUrl,
        content: content.trim(),
        is_hidden: false,
        reply_count: 0,
        created_at: reply.created_at,
      },
    });
  } catch (error) {
    console.error("Error creating reply:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get replies for a submission
 * GET /submissions/:submissionId/replies
 */
const getReplies = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Check if submission exists
    const subResult = await pool.query(
      `SELECT id FROM prompt_submissions WHERE id = $1`,
      [submissionId]
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Get replies with author info
    const result = await pool.query(
      `SELECT 
        r.*,
        CASE 
          WHEN r.author_type = 'member' THEN m.name
          WHEN r.author_type = 'community' THEN c.name
          WHEN r.author_type = 'sponsor' THEN sp.brand_name
        END as author_name,
        CASE 
          WHEN r.author_type = 'member' THEN m.profile_photo_url
          WHEN r.author_type = 'community' THEN c.logo_url
          WHEN r.author_type = 'sponsor' THEN sp.logo_url
        END as author_photo_url
      FROM prompt_replies r
      LEFT JOIN members m ON r.author_type = 'member' AND r.author_id = m.id
      LEFT JOIN communities c ON r.author_type = 'community' AND r.author_id = c.id
      LEFT JOIN sponsors sp ON r.author_type = 'sponsor' AND r.author_id = sp.id
      WHERE r.submission_id = $1
      ORDER BY r.created_at ASC
      LIMIT $2 OFFSET $3`,
      [submissionId, parseInt(limit), offset]
    );

    res.json({
      replies: result.rows,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: result.rows.length === parseInt(limit),
    });
  } catch (error) {
    console.error("Error getting replies:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Hide a reply (community moderation)
 * PATCH /replies/:replyId/hide
 */
const hideReply = async (req, res) => {
  try {
    const { replyId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get the reply, its submission, and the post author
    const replyResult = await pool.query(
      `SELECT r.*, s.post_id, p.author_id as post_author_id, p.author_type as post_author_type
       FROM prompt_replies r
       JOIN prompt_submissions s ON r.submission_id = s.id
       JOIN posts p ON s.post_id = p.id
       WHERE r.id = $1`,
      [replyId]
    );

    if (replyResult.rows.length === 0) {
      return res.status(404).json({ error: "Reply not found" });
    }

    const reply = replyResult.rows[0];

    // Only post author (community) can hide replies
    if (
      parseInt(reply.post_author_id) !== parseInt(userId) ||
      reply.post_author_type !== userType
    ) {
      return res
        .status(403)
        .json({ error: "Only the prompt author can hide replies" });
    }

    // Toggle hide status
    const willBeHidden = !reply.is_hidden;

    await pool.query(
      `UPDATE prompt_replies 
       SET is_hidden = $1, hidden_at = $2, hidden_by = $3, updated_at = NOW()
       WHERE id = $4`,
      [
        willBeHidden,
        willBeHidden ? new Date() : null,
        willBeHidden ? userId : null,
        replyId,
      ]
    );

    // TODO: If hiding, create a report entry for admin panel

    console.log(
      `[hideReply] Reply ${replyId} ${
        willBeHidden ? "hidden" : "unhidden"
      } by ${userType}:${userId}`
    );

    res.json({
      success: true,
      message: willBeHidden ? "Reply hidden" : "Reply unhidden",
      is_hidden: willBeHidden,
    });
  } catch (error) {
    console.error("Error hiding reply:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  createPromptPost,
  submitResponse,
  getSubmissions,
  moderateSubmission,
  getMySubmission,
  pinSubmission,
  createReply,
  getReplies,
  hideReply,
};
