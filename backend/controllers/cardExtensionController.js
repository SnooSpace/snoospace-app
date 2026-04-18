/**
 * Card Extension Controller
 * Handles extension requests for Poll, Challenge, and Opportunity cards
 */

const { createPool } = require("../config/db");
const { canExtendCard } = require("../utils/cardState");
const pushService = require("../services/pushService");

const pool = createPool();

/**
 * Extend a card's deadline
 * POST /posts/:postId/extend
 * Body: { new_end_time, reason? }
 */
const extendCard = async (req, res) => {
  try {
    const { postId } = req.params;
    const { new_end_time, reason } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!new_end_time) {
      return res.status(400).json({ error: "new_end_time is required" });
    }

    // Get the card/post
    const postResult = await pool.query(
      `SELECT id, post_type, author_id, author_type, expires_at, extension_count, original_end_time, type_data
       FROM posts WHERE id = $1`,
      [postId],
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Card not found" });
    }

    const post = postResult.rows[0];

    // Check if user is the author
    if (
      parseInt(post.author_id) !== parseInt(userId) ||
      post.author_type !== userType
    ) {
      return res
        .status(403)
        .json({ error: "Only the card creator can extend the deadline" });
    }

    // Validate extension is allowed
    const validation = canExtendCard(post);
    if (!validation.canExtend) {
      return res.status(400).json({ error: validation.reason });
    }

    // Validate new end time is after current end time
    const currentEndTime = new Date(post.expires_at);
    const newEndTime = new Date(new_end_time);

    if (newEndTime <= currentEndTime) {
      return res.status(400).json({
        error: "New end time must be after the current end time",
      });
    }

    // Validate minimum extension duration (24 hours)
    const minExtensionHours = 24;
    const extensionHours = (newEndTime - currentEndTime) / (1000 * 60 * 60);

    if (extensionHours < minExtensionHours) {
      return res.status(400).json({
        error: `Minimum extension is ${minExtensionHours} hours`,
      });
    }

    // For challenges, check if there are submissions (prevents shortening workaround)
    if (post.post_type === "challenge") {
      const typeData = post.type_data || {};
      const submissionCount = typeData.submission_count || 0;

      if (submissionCount > 0 && newEndTime < currentEndTime) {
        return res.status(400).json({
          error: "Cannot shorten deadline after submissions have been received",
        });
      }
    }

    // Begin transaction
    await pool.query("BEGIN");

    try {
      // Update post with new end time
      await pool.query(
        `UPDATE posts 
         SET expires_at = $1,
             extended_at = NOW(),
             extension_count = extension_count + 1,
             original_end_time = COALESCE(original_end_time, expires_at)
         WHERE id = $2`,
        [new_end_time, postId],
      );

      // Log extension in audit table
      await pool.query(
        `INSERT INTO card_extensions 
         (card_type, card_id, original_end_time, new_end_time, extended_by_user_id, extended_by_user_type, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          post.post_type,
          postId,
          post.expires_at,
          new_end_time,
          userId,
          userType,
          reason || null,
        ],
      );

      // For challenges, notify all participants
      if (post.post_type === "challenge") {
        try {
          // Get all participants
          const participantsResult = await pool.query(
            `SELECT DISTINCT participant_id, participant_type 
             FROM challenge_participations 
             WHERE post_id = $1`,
            [postId],
          );

          // Send notification to each participant
          for (const participant of participantsResult.rows) {
            await pushService.sendPushNotification(
              pool,
              participant.participant_id,
              participant.participant_type,
              "Challenge deadline extended ⏱️",
              `The deadline has been extended. You have more time to submit!`,
              {
                type: "challenge_extended",
                postId: parseInt(postId),
                newEndTime: new_end_time,
              },
            );
          }
        } catch (notifError) {
          console.error(
            "[Extension] Failed to send notifications:",
            notifError,
          );
          // Don't fail the extension if notifications fail
        }
      }

      await pool.query("COMMIT");

      console.log(
        `[Extension] ${post.post_type} ${postId} extended by ${userType}:${userId} from ${post.expires_at} to ${new_end_time}`,
      );

      res.json({
        success: true,
        message: "Deadline extended successfully",
        new_end_time,
        extension_count: (post.extension_count || 0) + 1,
        is_publicly_visible: true, // All extensions are transparent per design
      });
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("[Extension] Error extending card:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get extension history for a card
 * GET /posts/:postId/extensions
 */
const getExtensionHistory = async (req, res) => {
  try {
    const { postId } = req.params;

    const result = await pool.query(
      `SELECT 
        ce.id,
        ce.original_end_time,
        ce.new_end_time,
        ce.reason,
        ce.created_at as extended_at,
        ce.extended_by_user_id,
        ce.extended_by_user_type,
        CASE 
          WHEN ce.extended_by_user_type = 'member' THEN m.name
          WHEN ce.extended_by_user_type = 'community' THEN c.name
        END as extended_by_name
       FROM card_extensions ce
       LEFT JOIN members m ON ce.extended_by_user_type = 'member' AND ce.extended_by_user_id = m.id
       LEFT JOIN communities c ON ce.extended_by_user_type = 'community' AND ce.extended_by_user_id = c.id
       WHERE ce.card_id = $1
       ORDER BY ce.created_at ASC`,
      [postId],
    );

    res.json({
      success: true,
      extensions: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("[Extension] Error getting extension history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Close an opportunity manually (for open-ended opportunities)
 * POST /posts/:postId/close
 */
const closeOpportunity = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get the post
    const postResult = await pool.query(
      `SELECT id, post_type, author_id, author_type, closed_at, expires_at
       FROM posts WHERE id = $1`,
      [postId],
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Opportunity not found" });
    }

    const post = postResult.rows[0];

    if (post.post_type !== "opportunity") {
      return res
        .status(400)
        .json({ error: "Only opportunities can be manually closed" });
    }

    // Check if user is the author
    if (
      parseInt(post.author_id) !== parseInt(userId) ||
      post.author_type !== userType
    ) {
      return res
        .status(403)
        .json({ error: "Only the opportunity creator can close it" });
    }

    // Check if already closed
    if (post.closed_at) {
      return res.status(400).json({ error: "Opportunity is already closed" });
    }

    // Determine closure type
    const closureType = post.expires_at ? "automatic" : "manual";

    // Update post
    await pool.query(
      `UPDATE posts 
       SET closed_at = NOW(),
           closure_type = $1
       WHERE id = $2`,
      [closureType, postId],
    );

    console.log(
      `[Opportunity] Opportunity ${postId} manually closed by ${userType}:${userId}`,
    );

    res.json({
      success: true,
      message: "Opportunity closed successfully",
      closed_at: new Date(),
      closure_type: closureType,
    });
  } catch (error) {
    console.error("[Opportunity] Error closing opportunity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Resolve a Q&A (mark as resolved)
 * POST /posts/:postId/resolve
 */
const resolveQnA = async (req, res) => {
  try {
    const { postId } = req.params;
    const { questionId, bestAnswerId } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!questionId) {
      return res.status(400).json({ error: "questionId is required" });
    }

    // Get the post
    const postResult = await pool.query(
      `SELECT id, post_type, author_id, author_type
       FROM posts WHERE id = $1`,
      [postId],
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Q&A post not found" });
    }

    const post = postResult.rows[0];

    if (post.post_type !== "qna") {
      return res.status(400).json({ error: "This is not a Q&A post" });
    }

    // Check if user is the author
    if (
      parseInt(post.author_id) !== parseInt(userId) ||
      post.author_type !== userType
    ) {
      return res
        .status(403)
        .json({ error: "Only the Q&A creator can mark questions as resolved" });
    }

    // Update the question
    await pool.query(
      `UPDATE qna_questions 
       SET resolved_at = NOW(),
           resolved_by_user_id = $1,
           best_answer_id = $2
       WHERE id = $3 AND post_id = $4`,
      [userId, bestAnswerId || null, questionId, postId],
    );

    console.log(
      `[QnA] Question ${questionId} in post ${postId} marked as resolved by ${userType}:${userId}`,
    );

    res.json({
      success: true,
      message: "Question marked as resolved",
      resolved_at: new Date(),
    });
  } catch (error) {
    console.error("[QnA] Error resolving question:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  extendCard,
  getExtensionHistory,
  closeOpportunity,
  resolveQnA,
};
