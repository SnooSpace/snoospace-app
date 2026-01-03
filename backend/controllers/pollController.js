/**
 * Poll Controller
 * Handles poll post creation, voting, and results
 */

const { createPool } = require("../config/db");
const pushService = require("../services/pushService");

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

    // Only communities can create polls
    if (userType !== "community") {
      return res
        .status(403)
        .json({ error: "Only communities can create polls" });
    }

    const {
      caption,
      question,
      options,
      allow_multiple = false,
      show_results_before_vote = false,
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
      `[createPollPost] Created poll post ${post.id} by ${userType}:${userId}`
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
 * Vote on a poll
 * POST /posts/:postId/vote
 */
const vote = async (req, res) => {
  try {
    const { postId } = req.params;
    const { option_index, option_indexes } = req.body; // Support single or multiple
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get the poll post
    const postResult = await pool.query(
      `SELECT id, post_type, type_data, status, expires_at FROM posts WHERE id = $1`,
      [postId]
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
      [postId, userId, userType]
    );

    const previousIndexes = existingVote.rows.map((r) => r.option_index);
    const isChangingVote = previousIndexes.length > 0;

    // If voting for the same option, just return current state (no change needed)
    if (
      isChangingVote &&
      previousIndexes.length === votingIndexes.length &&
      previousIndexes.every((idx) => votingIndexes.includes(idx))
    ) {
      return res.json({
        success: true,
        message: "Vote unchanged",
        voted_indexes: votingIndexes,
        total_votes: typeData.total_votes,
        options: typeData.options,
      });
    }

    // If changing vote, delete old votes first
    if (isChangingVote) {
      await pool.query(
        `DELETE FROM poll_votes WHERE post_id = $1 AND voter_id = $2 AND voter_type = $3`,
        [postId, userId, userType]
      );
    }

    // Insert new vote(s)
    for (const idx of votingIndexes) {
      await pool.query(
        `INSERT INTO poll_votes (post_id, voter_id, voter_type, option_index)
         VALUES ($1, $2, $3, $4)`,
        [postId, userId, userType, idx]
      );
    }

    // Update vote counts in type_data
    // Decrement old options, increment new options
    const updatedOptions = typeData.options.map((opt) => {
      let newCount = opt.vote_count;
      // Decrement if user previously voted for this option
      if (previousIndexes.includes(opt.index)) {
        newCount = Math.max(0, newCount - 1);
      }
      // Increment if user now voted for this option
      if (votingIndexes.includes(opt.index)) {
        newCount = newCount + 1;
      }
      return { ...opt, vote_count: newCount };
    });

    // Total votes only changes if this is a new vote (not a change)
    const newTotalVotes = isChangingVote
      ? typeData.total_votes || 0
      : (typeData.total_votes || 0) + 1;

    const updatedTypeData = {
      ...typeData,
      options: updatedOptions,
      total_votes: newTotalVotes,
    };

    await pool.query(`UPDATE posts SET type_data = $1 WHERE id = $2`, [
      JSON.stringify(updatedTypeData),
      postId,
    ]);

    console.log(
      `[vote] User ${userType}:${userId} ${
        isChangingVote ? "changed vote" : "voted"
      } on poll ${postId}`
    );

    // Debug: Log options being returned
    console.log(
      `[vote] Returning options:`,
      JSON.stringify(updatedOptions, null, 2)
    );

    res.json({
      success: true,
      message: isChangingVote ? "Vote changed" : "Vote recorded",
      voted_indexes: votingIndexes,
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
      [postId, userId, userType]
    );

    if (voteResult.rows.length === 0) {
      return res.status(400).json({ error: "You haven't voted on this poll" });
    }

    const votedIndexes = voteResult.rows.map((r) => r.option_index);

    // Delete votes
    await pool.query(
      `DELETE FROM poll_votes WHERE post_id = $1 AND voter_id = $2 AND voter_type = $3`,
      [postId, userId, userType]
    );

    // Update counts in type_data
    const postResult = await pool.query(
      `SELECT type_data FROM posts WHERE id = $1`,
      [postId]
    );

    if (postResult.rows.length > 0) {
      const typeData = postResult.rows[0].type_data;

      const updatedOptions = typeData.options.map((opt) => ({
        ...opt,
        vote_count: votedIndexes.includes(opt.index)
          ? Math.max(0, opt.vote_count - 1)
          : opt.vote_count,
      }));

      const newTotalVotes = Math.max(0, (typeData.total_votes || 0) - 1);

      const updatedTypeData = {
        ...typeData,
        options: updatedOptions,
        total_votes: newTotalVotes,
      };

      await pool.query(`UPDATE posts SET type_data = $1 WHERE id = $2`, [
        JSON.stringify(updatedTypeData),
        postId,
      ]);
    }

    console.log(
      `[removeVote] User ${userType}:${userId} removed vote from poll ${postId}`
    );

    // Return updated options so frontend can update UI
    const updatedPost = await pool.query(
      `SELECT type_data FROM posts WHERE id = $1`,
      [postId]
    );
    const finalTypeData = updatedPost.rows[0]?.type_data || {};

    res.json({
      success: true,
      message: "Vote removed",
      options: finalTypeData.options || [],
      total_votes: finalTypeData.total_votes || 0,
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
      [postId]
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
        [postId, userId, userType]
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
      [postId, userId, userType]
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
