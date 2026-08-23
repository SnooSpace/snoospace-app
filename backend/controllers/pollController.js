/**
 * Poll Controller
 * Handles poll post creation, voting, and results
 */

const { createPool } = require("../config/db");
const pushService = require("../services/pushService");
const { emitSignal, getCategoryForPost } = require("../utils/signalEmitter");

const pool = createPool();


/**
 * Create a poll post
 * POST /posts (with post_type: 'poll')
 */
const createPollPost = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Only communities and creator members can create polls
    if (userType !== "community") {
      if (userType === "member") {
        const creatorCheck = await pool.query(
          "SELECT is_creator_mode_enabled FROM members WHERE id = $1",
          [userId]
        );
        if (creatorCheck.rows.length === 0 || !creatorCheck.rows[0].is_creator_mode_enabled) {
          return res
            .status(403)
            .json({ error: "Only communities and creators can create polls" });
        }
      } else {
        return res
          .status(403)
          .json({ error: "Only communities and creators can create polls" });
      }
    }

    const {
      caption,
      question,
      options,
      allow_multiple = false,
      show_results_before_vote = false,
      allow_anonymous = false,
      expires_at,
    } = req.body;

    // Validate required fields
    if (!question || !question.trim()) {
      return res.status(400).json({ error: "Poll question is required" });
    }

    if (!options || !Array.isArray(options) || options.length < 2) {
      return res
        .status(400)
        .json({ error: "At least 2 poll options are required" });
    }

    if (options.length > 10) {
      return res.status(400).json({ error: "Maximum 10 poll options allowed" });
    }

    // Validate each option has text
    for (let i = 0; i < options.length; i++) {
      const opt =
        typeof options[i] === "string" ? options[i] : options[i]?.text;
      if (!opt || !opt.trim()) {
        return res
          .status(400)
          .json({ error: `Option ${i + 1} cannot be empty` });
      }
    }

    // Build type_data for poll
    const pollOptions = options.map((opt, index) => ({
      index,
      text: typeof opt === "string" ? opt.trim() : opt.text.trim(),
      vote_count: 0,
    }));

    const typeData = {
      question: question.trim(),
      options: pollOptions,
      allow_multiple: Boolean(allow_multiple),
      show_results_before_vote: Boolean(show_results_before_vote),
      allow_anonymous: Boolean(allow_anonymous),
      total_votes: 0,
    };

    // Insert poll post
    const query = `
      INSERT INTO posts (
        author_id, author_type, post_type, caption, 
        image_urls, type_data, status, expires_at
      )
      VALUES ($1, $2, 'poll', $3, '[]'::jsonb, $4, 'active', $5)
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
      `[createPollPost] Created poll post ${post.id} by ${userType}:${userId}`,
    );

    res.status(201).json({
      success: true,
      post: {
        id: post.id,
        author_id: userId,
        author_type: userType,
        post_type: "poll",
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
    console.error("Error creating poll post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Helper function to synchronize posts.type_data with poll_votes table ground truth
 */
const syncPollVoteCounts = async (postId) => {
  const postResult = await pool.query(
    `SELECT type_data FROM posts WHERE id = $1 AND post_type = 'poll'`,
    [postId],
  );
  if (postResult.rows.length === 0) return null;

  const typeData = postResult.rows[0].type_data || {};

  // Aggregate counts per option from poll_votes
  const optionCountsResult = await pool.query(
    `SELECT option_index, COUNT(*)::int as count
     FROM poll_votes
     WHERE post_id = $1
     GROUP BY option_index`,
    [postId],
  );

  const optionCountsMap = {};
  optionCountsResult.rows.forEach((r) => {
    optionCountsMap[r.option_index] = r.count;
  });

  // Aggregate total unique voters from poll_votes
  const totalVotersResult = await pool.query(
    `SELECT COUNT(DISTINCT (voter_id, voter_type))::int as total_voters
     FROM poll_votes
     WHERE post_id = $1`,
    [postId],
  );
  const totalVotes = totalVotersResult.rows[0]?.total_voters || 0;

  // Update option counts in type_data
  const updatedOptions = (typeData.options || []).map((opt) => ({
    ...opt,
    vote_count: optionCountsMap[opt.index] || 0,
  }));

  const updatedTypeData = {
    ...typeData,
    options: updatedOptions,
    total_votes: totalVotes,
  };

  await pool.query(
    `UPDATE posts SET type_data = $1 WHERE id = $2`,
    [JSON.stringify(updatedTypeData), postId],
  );

  return updatedTypeData;
};

/**
 * Vote on a poll
 * POST /posts/:postId/vote
 */
const vote = async (req, res) => {
  try {
    const { postId } = req.params;
    const { option_index, option_indexes, is_anonymous = false } = req.body; // Support single or multiple, and anonymous vote
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get the poll post
    const postResult = await pool.query(
      `SELECT id, post_type, type_data, status, expires_at FROM posts WHERE id = $1`,
      [postId],
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Poll not found" });
    }

    const post = postResult.rows[0];

    if (post.post_type !== "poll") {
      return res.status(400).json({ error: "This post is not a poll" });
    }

    if (post.status !== "active") {
      return res.status(400).json({ error: "This poll is no longer active" });
    }

    // Check expiry
    if (post.expires_at && new Date(post.expires_at) < new Date()) {
      return res.status(400).json({ error: "This poll has expired" });
    }

    const typeData = post.type_data;
    const optionCount = typeData.options?.length || 0;

    // Determine which option(s) to vote for
    let votingIndexes = [];
    if (option_indexes && Array.isArray(option_indexes)) {
      if (!typeData.allow_multiple && option_indexes.length > 1) {
        return res
          .status(400)
          .json({ error: "This poll only allows single selection" });
      }
      votingIndexes = option_indexes;
    } else if (typeof option_index === "number") {
      votingIndexes = [option_index];
    } else {
      return res.status(400).json({ error: "option_index is required" });
    }

    // Validate all indexes
    for (const idx of votingIndexes) {
      if (idx < 0 || idx >= optionCount) {
        return res.status(400).json({ error: `Invalid option index: ${idx}` });
      }
    }

    // Check if user already voted
    const existingVote = await pool.query(
      `SELECT option_index FROM poll_votes WHERE post_id = $1 AND voter_id = $2 AND voter_type = $3`,
      [postId, userId, userType],
    );

    const previousIndexes = existingVote.rows.map((r) => r.option_index);
    const isChangingVote = previousIndexes.length > 0;

    // Handle voting differently for single vs multiple selection
    let indexesToRemove = [];
    let indexesToAdd = [];

    if (typeData.allow_multiple && votingIndexes.length === 1) {
      // For multiple selection with single option: implement toggle behavior
      const toggleIndex = votingIndexes[0];
      if (previousIndexes.includes(toggleIndex)) {
        // Option is already selected, remove it
        indexesToRemove = [toggleIndex];
        indexesToAdd = [];
      } else {
        // Option is not selected, add it
        indexesToRemove = [];
        indexesToAdd = [toggleIndex];
      }
    } else if (typeData.allow_multiple && votingIndexes.length > 1) {
      // Multiple selection with multiple options: use as complete new vote set
      indexesToRemove = previousIndexes.filter(
        (idx) => !votingIndexes.includes(idx),
      );
      indexesToAdd = votingIndexes.filter(
        (idx) => !previousIndexes.includes(idx),
      );
    } else {
      // Single selection: remove all previous votes and add new one
      indexesToRemove = previousIndexes;
      indexesToAdd = votingIndexes;
    }

    // Delete specific votes that should be removed
    if (indexesToRemove.length > 0) {
      for (const idx of indexesToRemove) {
        await pool.query(
          `DELETE FROM poll_votes WHERE post_id = $1 AND voter_id = $2 AND voter_type = $3 AND option_index = $4`,
          [postId, userId, userType, idx],
        );
      }
    }

    // Insert new vote(s) — ON CONFLICT DO NOTHING guards against:
    // 1. Sequence drift (duplicate pkey from restored dumps)
    // 2. Race conditions (duplicate unique_poll_vote constraint)
    const effectiveIsAnonymous = Boolean(is_anonymous) && Boolean(typeData.allow_anonymous);

    for (const idx of indexesToAdd) {
      await pool.query(
        `INSERT INTO poll_votes (post_id, voter_id, voter_type, option_index, is_anonymous)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [postId, userId, userType, idx, effectiveIsAnonymous],
      );
    }

    // Synchronize type_data ground truth directly from poll_votes table
    const updatedTypeData = await syncPollVoteCounts(postId);
    const updatedOptions = updatedTypeData?.options || typeData.options;
    const newTotalVotes = updatedTypeData?.total_votes ?? 0;

    // Get current voted indexes for this user directly from database
    const finalVotesResult = await pool.query(
      `SELECT option_index FROM poll_votes WHERE post_id = $1 AND voter_id = $2 AND voter_type = $3`,
      [postId, userId, userType],
    );
    const finalVotedIndexes = finalVotesResult.rows.map((r) => r.option_index);

    console.log(
      `[vote] User ${userType}:${userId} ${
        isChangingVote ? "changed vote" : "voted"
      } on poll ${postId}. New total_votes: ${newTotalVotes}`,
    );

    // Emit behavioral signal — fire-and-forget, non-blocking
    if (indexesToAdd.length > 0) {
      getCategoryForPost(pool, postId).then((category) =>
        emitSignal(pool, {
          userId,
          userType,
          eventType: 'poll_vote',
          category,
          metadata: { postId: parseInt(postId) },
        })
      ).catch(() => {});
    }

    res.json({
      success: true,
      message: isChangingVote ? "Vote changed" : "Vote recorded",
      voted_indexes: finalVotedIndexes,
      total_votes: newTotalVotes,
      options: updatedOptions,
    });
  } catch (error) {
    console.error("Error voting on poll:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Remove vote from a poll
 * DELETE /posts/:postId/vote
 */
const removeVote = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get current vote(s)
    const voteResult = await pool.query(
      `SELECT option_index FROM poll_votes WHERE post_id = $1 AND voter_id = $2 AND voter_type = $3`,
      [postId, userId, userType],
    );

    if (voteResult.rows.length === 0) {
      return res.status(400).json({ error: "You haven't voted on this poll" });
    }

    // Delete votes
    await pool.query(
      `DELETE FROM poll_votes WHERE post_id = $1 AND voter_id = $2 AND voter_type = $3`,
      [postId, userId, userType],
    );

    // Synchronize type_data ground truth directly from poll_votes table
    const updatedTypeData = await syncPollVoteCounts(postId);

    console.log(
      `[removeVote] User ${userType}:${userId} removed vote from poll ${postId}`,
    );

    res.json({
      success: true,
      message: "Vote removed",
      options: updatedTypeData?.options || [],
      total_votes: updatedTypeData?.total_votes || 0,
    });
  } catch (error) {
    console.error("Error removing vote:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get poll results
 * GET /posts/:postId/results
 */
const getResults = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    // Get the poll post
    const postResult = await pool.query(
      `SELECT id, post_type, type_data, status, expires_at FROM posts WHERE id = $1`,
      [postId],
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Poll not found" });
    }

    const post = postResult.rows[0];

    if (post.post_type !== "poll") {
      return res.status(400).json({ error: "This post is not a poll" });
    }

    const typeData = post.type_data;
    const isExpired = post.expires_at && new Date(post.expires_at) < new Date();
    const isEnded = post.status === "expired" || isExpired;

    // Check if user has voted
    let userVotedIndexes = [];
    if (userId && userType) {
      const voteResult = await pool.query(
        `SELECT option_index FROM poll_votes WHERE post_id = $1 AND voter_id = $2 AND voter_type = $3`,
        [postId, userId, userType],
      );
      userVotedIndexes = voteResult.rows.map((r) => r.option_index);
    }

    const hasVoted = userVotedIndexes.length > 0;

    // Determine if we should show results
    // Show results if: poll ended, user has voted, or show_results_before_vote is true
    const showResults =
      isEnded || hasVoted || typeData.show_results_before_vote;

    res.json({
      postId: post.id,
      question: typeData.question,
      options: typeData.options.map((opt) => ({
        index: opt.index,
        text: opt.text,
        vote_count: showResults ? opt.vote_count : null,
        percentage:
          showResults && typeData.total_votes > 0
            ? Math.round((opt.vote_count / typeData.total_votes) * 100)
            : null,
      })),
      total_votes: showResults ? typeData.total_votes : null,
      has_voted: hasVoted,
      user_voted_indexes: userVotedIndexes,
      is_ended: isEnded,
      show_results: showResults,
      expires_at: post.expires_at,
    });
  } catch (error) {
    console.error("Error getting poll results:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Check if user has voted on a poll
 * GET /posts/:postId/vote-status
 */
const getVoteStatus = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const voteResult = await pool.query(
      `SELECT option_index FROM poll_votes WHERE post_id = $1 AND voter_id = $2 AND voter_type = $3`,
      [postId, userId, userType],
    );

    res.json({
      has_voted: voteResult.rows.length > 0,
      voted_indexes: voteResult.rows.map((r) => r.option_index),
    });
  } catch (error) {
    console.error("Error getting vote status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  createPollPost,
  vote,
  removeVote,
  getResults,
  getVoteStatus,
};
