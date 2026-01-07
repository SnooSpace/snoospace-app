/**
 * Q&A Controller
 * Handles Q&A post creation, questions, answers, upvotes, and expert management
 */

const { createPool } = require("../config/db");
const pushService = require("../services/pushService");

const pool = createPool();

// =============================================================================
// CREATE Q&A POST
// =============================================================================

/**
 * Create a Q&A post
 * POST /posts (with post_type: 'qna')
 */
const createQnAPost = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Only communities can create Q&A posts
    if (userType !== "community") {
      return res
        .status(403)
        .json({ error: "Only communities can create Q&A posts" });
    }

    const {
      title,
      description,
      allow_anonymous = false,
      max_questions_per_user = 1,
      expires_at,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    // Build type_data
    const typeData = {
      title: title.trim(),
      description: description?.trim() || "",
      allow_anonymous,
      max_questions_per_user,
      question_count: 0,
      answered_count: 0,
    };

    // Insert post
    const query = `
      INSERT INTO posts (author_id, author_type, post_type, type_data, expires_at, image_urls)
      VALUES ($1, $2, 'qna', $3, $4, $5)
      RETURNING id, created_at
    `;

    const result = await pool.query(query, [
      userId,
      userType,
      JSON.stringify(typeData),
      expires_at || null,
      JSON.stringify([]), // Empty array for image_urls
    ]);

    const post = result.rows[0];

    console.log(`[QnA] Created Q&A post ${post.id} by ${userType}:${userId}`);

    res.status(201).json({
      success: true,
      post: {
        id: post.id,
        author_id: userId,
        author_type: userType,
        post_type: "qna",
        type_data: typeData,
        expires_at: expires_at || null,
        created_at: post.created_at,
      },
    });
  } catch (error) {
    console.error("[QnA] Error creating Q&A post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =============================================================================
// QUESTIONS
// =============================================================================

/**
 * Submit a question to a Q&A post
 * POST /posts/:postId/questions
 */
const submitQuestion = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { content, is_anonymous = false } = req.body;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Question content is required" });
    }

    // Verify post exists and is a Q&A post
    const postResult = await pool.query(
      `SELECT id, author_id, author_type, type_data, expires_at 
       FROM posts WHERE id = $1 AND post_type = 'qna'`,
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Q&A post not found" });
    }

    const post = postResult.rows[0];
    const typeData = post.type_data || {};

    // Check if expired
    if (post.expires_at && new Date(post.expires_at) < new Date()) {
      return res.status(400).json({ error: "This Q&A session has ended" });
    }

    // Check max questions per user
    const existingCount = await pool.query(
      `SELECT COUNT(*) as count FROM qna_questions 
       WHERE post_id = $1 AND author_id = $2 AND author_type = $3`,
      [postId, userId, userType]
    );

    const maxQuestions = typeData.max_questions_per_user || 1;
    if (parseInt(existingCount.rows[0].count) >= maxQuestions) {
      return res.status(400).json({
        error: `You can only ask ${maxQuestions} question(s) per Q&A`,
      });
    }

    // Determine if this question is anonymous
    const isAnonymousQuestion = is_anonymous && typeData.allow_anonymous;

    // Insert question
    const insertResult = await pool.query(
      `INSERT INTO qna_questions (post_id, author_id, author_type, question, is_pinned, upvote_count, is_anonymous)
       VALUES ($1, $2, $3, $4, false, 0, $5)
       RETURNING id, created_at`,
      [postId, userId, userType, content.trim(), isAnonymousQuestion]
    );

    const question = insertResult.rows[0];

    // Update question count in type_data
    await pool.query(
      `UPDATE posts SET type_data = type_data || $1
       WHERE id = $2`,
      [
        JSON.stringify({ question_count: (typeData.question_count || 0) + 1 }),
        postId,
      ]
    );

    // Get author info for response
    let authorName = null;
    let authorPhoto = null;

    if (!is_anonymous || !typeData.allow_anonymous) {
      if (userType === "member") {
        const authorResult = await pool.query(
          "SELECT name, profile_photo_url FROM members WHERE id = $1",
          [userId]
        );
        if (authorResult.rows[0]) {
          authorName = authorResult.rows[0].name;
          authorPhoto = authorResult.rows[0].profile_photo_url;
        }
      } else if (userType === "community") {
        const authorResult = await pool.query(
          "SELECT name, logo_url FROM communities WHERE id = $1",
          [userId]
        );
        if (authorResult.rows[0]) {
          authorName = authorResult.rows[0].name;
          authorPhoto = authorResult.rows[0].logo_url;
        }
      }
    }

    // Send notification to post author
    try {
      await pushService.sendPushNotification(
        pool,
        post.author_id,
        post.author_type,
        "New question on your Q&A 🙋",
        `${authorName || "Someone"} asked: "${content.substring(0, 50)}${
          content.length > 50 ? "..." : ""
        }"`,
        {
          type: "qna_question",
          postId: parseInt(postId),
          questionId: question.id,
        }
      );
    } catch (e) {
      console.error("[QnA] Failed to send notification:", e);
    }

    console.log(`[QnA] Question ${question.id} submitted to post ${postId}`);

    res.status(201).json({
      success: true,
      question: {
        id: question.id,
        post_id: parseInt(postId),
        author_id: is_anonymous && typeData.allow_anonymous ? null : userId,
        author_type: is_anonymous && typeData.allow_anonymous ? null : userType,
        author_name:
          is_anonymous && typeData.allow_anonymous ? "Anonymous" : authorName,
        author_photo_url:
          is_anonymous && typeData.allow_anonymous ? null : authorPhoto,
        content: content.trim(),
        upvote_count: 0,
        is_answered: false,
        is_pinned: false,
        created_at: question.created_at,
      },
    });
  } catch (error) {
    console.error("[QnA] Error submitting question:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get questions for a Q&A post
 * GET /posts/:postId/questions
 * Query params: sort=top|recent, filter=all|answered|unanswered
 */
const getQuestions = async (req, res) => {
  try {
    const { postId } = req.params;
    const { sort = "top", filter = "all", page = 1, limit = 20 } = req.query;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let filterClause = "";
    if (filter === "answered") {
      filterClause = "AND q.answered_at IS NOT NULL";
    } else if (filter === "unanswered") {
      filterClause = "AND q.answered_at IS NULL";
    }

    const orderClause =
      sort === "recent"
        ? "q.created_at DESC"
        : "q.upvote_count DESC, q.created_at DESC";

    const query = `
      SELECT 
        q.id,
        q.post_id,
        CASE WHEN q.is_anonymous = true THEN NULL ELSE q.author_id END as author_id,
        CASE WHEN q.is_anonymous = true THEN NULL ELSE q.author_type END as author_type,
        q.question as content,
        q.answer,
        q.answered_at,
        q.answered_by,
        q.is_pinned,
        q.is_locked,
        q.is_hidden,
        q.is_anonymous,
        q.upvote_count,
        q.created_at,
        CASE 
          WHEN q.is_anonymous = true THEN 'Anonymous'
          WHEN q.author_type = 'member' THEN m.name
          WHEN q.author_type = 'community' THEN c.name
        END as author_name,
        CASE 
          WHEN q.is_anonymous = true THEN NULL
          WHEN q.author_type = 'member' THEN m.profile_photo_url
          WHEN q.author_type = 'community' THEN c.logo_url
        END as author_photo_url,
        CASE 
          WHEN $4::bigint IS NOT NULL THEN EXISTS (
            SELECT 1 FROM qna_question_upvotes u
            WHERE u.question_id = q.id AND u.voter_id = $4 AND u.voter_type = $5
          )
          ELSE false
        END as has_upvoted,
        (SELECT COUNT(*) FROM qna_answers a WHERE a.question_id = q.id) as answer_count
      FROM qna_questions q
      LEFT JOIN members m ON q.author_type = 'member' AND q.author_id = m.id
      LEFT JOIN communities c ON q.author_type = 'community' AND q.author_id = c.id
      WHERE q.post_id = $1 AND (q.is_hidden = false OR q.author_id = $4)
      ${filterClause}
      ORDER BY q.is_pinned DESC, ${orderClause}
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [
      postId,
      parseInt(limit),
      offset,
      userId || null,
      userType || null,
    ]);

    // Get answers for questions that have them
    const questions = await Promise.all(
      result.rows.map(async (q) => {
        let answers = [];
        if (q.answer_count > 0) {
          const answersResult = await pool.query(
            `SELECT 
              a.id,
              a.content,
              a.media_urls,
              a.is_best_answer,
              a.created_at,
              a.author_id,
              a.author_type,
              CASE 
                WHEN a.author_type = 'member' THEN m.name
                WHEN a.author_type = 'community' THEN c.name
              END as author_name,
              CASE 
                WHEN a.author_type = 'member' THEN m.profile_photo_url
                WHEN a.author_type = 'community' THEN c.logo_url
              END as author_photo_url
            FROM qna_answers a
            LEFT JOIN members m ON a.author_type = 'member' AND a.author_id = m.id
            LEFT JOIN communities c ON a.author_type = 'community' AND a.author_id = c.id
            WHERE a.question_id = $1
            ORDER BY a.is_best_answer DESC, a.created_at ASC`,
            [q.id]
          );
          answers = answersResult.rows;
        }

        return {
          ...q,
          is_answered: q.answered_at !== null || q.answer_count > 0,
          answers,
        };
      })
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM qna_questions q
       WHERE q.post_id = $1 AND q.is_hidden = false ${filterClause}`,
      [postId]
    );

    res.json({
      success: true,
      questions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        has_more:
          offset + questions.length < parseInt(countResult.rows[0].total),
      },
    });
  } catch (error) {
    console.error("[QnA] Error getting questions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =============================================================================
// UPVOTES
// =============================================================================

/**
 * Upvote a question
 * POST /questions/:questionId/upvote
 */
const upvoteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check question exists
    const questionResult = await pool.query(
      "SELECT id, post_id, author_id, author_type FROM qna_questions WHERE id = $1",
      [questionId]
    );

    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: "Question not found" });
    }

    const question = questionResult.rows[0];

    // Check if already upvoted
    const existingUpvote = await pool.query(
      `SELECT id FROM qna_question_upvotes 
       WHERE question_id = $1 AND voter_id = $2 AND voter_type = $3`,
      [questionId, userId, userType]
    );

    if (existingUpvote.rows.length > 0) {
      return res.status(400).json({ error: "Already upvoted" });
    }

    // Add upvote
    await pool.query(
      `INSERT INTO qna_question_upvotes (question_id, voter_id, voter_type)
       VALUES ($1, $2, $3)`,
      [questionId, userId, userType]
    );

    // Update upvote count
    const updateResult = await pool.query(
      `UPDATE qna_questions 
       SET upvote_count = upvote_count + 1 
       WHERE id = $1
       RETURNING upvote_count`,
      [questionId]
    );

    const newCount = updateResult.rows[0].upvote_count;

    // Send notification to question author (if not self)
    if (question.author_id !== userId || question.author_type !== userType) {
      try {
        let voterName = "Someone";
        if (userType === "member") {
          const voterResult = await pool.query(
            "SELECT name FROM members WHERE id = $1",
            [userId]
          );
          voterName = voterResult.rows[0]?.name || "Someone";
        }

        await pushService.sendPushNotification(
          pool,
          question.author_id,
          question.author_type,
          "Your question got an upvote 👍",
          `${voterName} upvoted your question`,
          {
            type: "qna_upvote",
            postId: question.post_id,
            questionId: parseInt(questionId),
          }
        );
      } catch (e) {
        console.error("[QnA] Failed to send upvote notification:", e);
      }
    }

    res.json({
      success: true,
      upvote_count: newCount,
    });
  } catch (error) {
    console.error("[QnA] Error upvoting question:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Remove upvote from a question
 * DELETE /questions/:questionId/upvote
 */
const removeUpvote = async (req, res) => {
  try {
    const { questionId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Remove upvote
    const deleteResult = await pool.query(
      `DELETE FROM qna_question_upvotes 
       WHERE question_id = $1 AND voter_id = $2 AND voter_type = $3`,
      [questionId, userId, userType]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(400).json({ error: "Not upvoted" });
    }

    // Update upvote count
    const updateResult = await pool.query(
      `UPDATE qna_questions 
       SET upvote_count = GREATEST(upvote_count - 1, 0) 
       WHERE id = $1
       RETURNING upvote_count`,
      [questionId]
    );

    res.json({
      success: true,
      upvote_count: updateResult.rows[0]?.upvote_count || 0,
    });
  } catch (error) {
    console.error("[QnA] Error removing upvote:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =============================================================================
// ANSWERS
// =============================================================================

/**
 * Answer a question (host or designated expert)
 * POST /questions/:questionId/answer
 */
const answerQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { content, media_urls } = req.body;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Answer content is required" });
    }

    // Get question and post info
    const questionResult = await pool.query(
      `SELECT q.id, q.post_id, q.author_id, q.author_type, q.question,
              p.author_id as post_author_id, p.author_type as post_author_type
       FROM qna_questions q
       JOIN posts p ON q.post_id = p.id
       WHERE q.id = $1`,
      [questionId]
    );

    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: "Question not found" });
    }

    const question = questionResult.rows[0];

    // Check if user is post author or designated expert
    const isPostAuthor =
      question.post_author_id === userId &&
      question.post_author_type === userType;

    let isExpert = false;
    if (!isPostAuthor) {
      const expertResult = await pool.query(
        `SELECT id FROM qna_experts 
         WHERE post_id = $1 AND user_id = $2 AND user_type = $3`,
        [question.post_id, userId, userType]
      );
      isExpert = expertResult.rows.length > 0;
    }

    if (!isPostAuthor && !isExpert) {
      return res.status(403).json({
        error: "Only the Q&A host or designated experts can answer",
      });
    }

    // Insert answer
    const insertResult = await pool.query(
      `INSERT INTO qna_answers (question_id, author_id, author_type, content, media_urls)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [
        questionId,
        userId,
        userType,
        content.trim(),
        media_urls ? JSON.stringify(media_urls) : null,
      ]
    );

    const answer = insertResult.rows[0];

    // Update question answered status (legacy field)
    await pool.query(
      `UPDATE qna_questions 
       SET answered_at = NOW(), answered_by = $1, answer = $2
       WHERE id = $3 AND answered_at IS NULL`,
      [userId, content.trim(), questionId]
    );

    // Update answered count in post type_data
    await pool.query(
      `UPDATE posts 
       SET type_data = jsonb_set(
         type_data, 
         '{answered_count}', 
         (COALESCE((type_data->>'answered_count')::int, 0) + 1)::text::jsonb
       )
       WHERE id = $1`,
      [question.post_id]
    );

    // Get author info
    let authorName = null;
    let authorPhoto = null;

    if (userType === "member") {
      const authorResult = await pool.query(
        "SELECT name, profile_photo_url FROM members WHERE id = $1",
        [userId]
      );
      if (authorResult.rows[0]) {
        authorName = authorResult.rows[0].name;
        authorPhoto = authorResult.rows[0].profile_photo_url;
      }
    } else if (userType === "community") {
      const authorResult = await pool.query(
        "SELECT name, logo_url FROM communities WHERE id = $1",
        [userId]
      );
      if (authorResult.rows[0]) {
        authorName = authorResult.rows[0].name;
        authorPhoto = authorResult.rows[0].logo_url;
      }
    }

    // Send notification to question author
    if (question.author_id !== userId || question.author_type !== userType) {
      try {
        await pushService.sendPushNotification(
          pool,
          question.author_id,
          question.author_type,
          "Your question was answered! 🎉",
          `${authorName || "Someone"} answered your question`,
          {
            type: "qna_answered",
            postId: question.post_id,
            questionId: parseInt(questionId),
            answerId: answer.id,
          }
        );
      } catch (e) {
        console.error("[QnA] Failed to send answer notification:", e);
      }
    }

    console.log(`[QnA] Answer ${answer.id} posted to question ${questionId}`);

    res.status(201).json({
      success: true,
      answer: {
        id: answer.id,
        question_id: parseInt(questionId),
        author_id: userId,
        author_type: userType,
        author_name: authorName,
        author_photo_url: authorPhoto,
        content: content.trim(),
        media_urls,
        is_best_answer: false,
        created_at: answer.created_at,
      },
    });
  } catch (error) {
    console.error("[QnA] Error answering question:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Mark answer as best answer
 * PATCH /answers/:answerId/best
 */
const markBestAnswer = async (req, res) => {
  try {
    const { answerId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { is_best = true } = req.body;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get answer and verify ownership
    const answerResult = await pool.query(
      `SELECT a.id, a.question_id, q.post_id, p.author_id, p.author_type
       FROM qna_answers a
       JOIN qna_questions q ON a.question_id = q.id
       JOIN posts p ON q.post_id = p.id
       WHERE a.id = $1`,
      [answerId]
    );

    if (answerResult.rows.length === 0) {
      return res.status(404).json({ error: "Answer not found" });
    }

    const answer = answerResult.rows[0];

    // Only post author can mark best answer
    if (answer.author_id !== userId || answer.author_type !== userType) {
      return res.status(403).json({
        error: "Only the Q&A host can mark best answers",
      });
    }

    // If marking as best, unmark others first
    if (is_best) {
      await pool.query(
        `UPDATE qna_answers SET is_best_answer = false 
         WHERE question_id = $1`,
        [answer.question_id]
      );
    }

    // Update this answer
    await pool.query(
      `UPDATE qna_answers SET is_best_answer = $1 WHERE id = $2`,
      [is_best, answerId]
    );

    res.json({
      success: true,
      is_best_answer: is_best,
    });
  } catch (error) {
    console.error("[QnA] Error marking best answer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =============================================================================
// MODERATION
// =============================================================================

/**
 * Moderate a question (pin, lock, hide)
 * PATCH /questions/:questionId
 */
const moderateQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { is_pinned, is_locked, is_hidden } = req.body;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get question and verify user is post author
    const questionResult = await pool.query(
      `SELECT q.id, q.post_id, p.author_id, p.author_type
       FROM qna_questions q
       JOIN posts p ON q.post_id = p.id
       WHERE q.id = $1`,
      [questionId]
    );

    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: "Question not found" });
    }

    const question = questionResult.rows[0];

    // Only post author can moderate
    if (question.author_id !== userId || question.author_type !== userType) {
      return res.status(403).json({
        error: "Only the Q&A host can moderate questions",
      });
    }

    // Build update
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (is_pinned !== undefined) {
      updates.push(`is_pinned = $${paramIndex++}`);
      values.push(is_pinned);
    }
    if (is_locked !== undefined) {
      updates.push(`is_locked = $${paramIndex++}`);
      values.push(is_locked);
    }
    if (is_hidden !== undefined) {
      updates.push(`is_hidden = $${paramIndex++}`);
      values.push(is_hidden);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }

    values.push(questionId);

    await pool.query(
      `UPDATE qna_questions SET ${updates.join(
        ", "
      )} WHERE id = $${paramIndex}`,
      values
    );

    res.json({
      success: true,
      message: "Question updated",
    });
  } catch (error) {
    console.error("[QnA] Error moderating question:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =============================================================================
// EXPERTS
// =============================================================================

/**
 * Add a designated expert
 * POST /posts/:postId/experts
 */
const addExpert = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { expert_id, expert_type } = req.body;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!expert_id || !expert_type) {
      return res.status(400).json({ error: "Expert ID and type are required" });
    }

    // Verify user is post author
    const postResult = await pool.query(
      `SELECT author_id, author_type FROM posts 
       WHERE id = $1 AND post_type = 'qna'`,
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Q&A post not found" });
    }

    const post = postResult.rows[0];
    if (post.author_id !== userId || post.author_type !== userType) {
      return res.status(403).json({
        error: "Only the Q&A host can add experts",
      });
    }

    // Add expert
    try {
      await pool.query(
        `INSERT INTO qna_experts (post_id, user_id, user_type, added_by_id, added_by_type)
         VALUES ($1, $2, $3, $4, $5)`,
        [postId, expert_id, expert_type, userId, userType]
      );
    } catch (e) {
      if (e.code === "23505") {
        // Unique constraint violation
        return res.status(400).json({ error: "Expert already added" });
      }
      throw e;
    }

    // Get expert info
    let expertName = null;
    let expertPhoto = null;

    if (expert_type === "member") {
      const expertResult = await pool.query(
        "SELECT name, profile_photo_url FROM members WHERE id = $1",
        [expert_id]
      );
      if (expertResult.rows[0]) {
        expertName = expertResult.rows[0].name;
        expertPhoto = expertResult.rows[0].profile_photo_url;
      }
    } else if (expert_type === "community") {
      const expertResult = await pool.query(
        "SELECT name, logo_url FROM communities WHERE id = $1",
        [expert_id]
      );
      if (expertResult.rows[0]) {
        expertName = expertResult.rows[0].name;
        expertPhoto = expertResult.rows[0].logo_url;
      }
    }

    console.log(
      `[QnA] Added expert ${expert_type}:${expert_id} to post ${postId}`
    );

    res.status(201).json({
      success: true,
      expert: {
        id: expert_id,
        type: expert_type,
        name: expertName,
        photo_url: expertPhoto,
      },
    });
  } catch (error) {
    console.error("[QnA] Error adding expert:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Remove a designated expert
 * DELETE /posts/:postId/experts/:expertId
 */
const removeExpert = async (req, res) => {
  try {
    const { postId, expertId } = req.params;
    const { expert_type } = req.query;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify user is post author
    const postResult = await pool.query(
      `SELECT author_id, author_type FROM posts 
       WHERE id = $1 AND post_type = 'qna'`,
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Q&A post not found" });
    }

    const post = postResult.rows[0];
    if (post.author_id !== userId || post.author_type !== userType) {
      return res.status(403).json({
        error: "Only the Q&A host can remove experts",
      });
    }

    // Remove expert
    const deleteResult = await pool.query(
      `DELETE FROM qna_experts 
       WHERE post_id = $1 AND user_id = $2 AND user_type = $3`,
      [postId, expertId, expert_type || "member"]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Expert not found" });
    }

    res.json({
      success: true,
      message: "Expert removed",
    });
  } catch (error) {
    console.error("[QnA] Error removing expert:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get designated experts for a Q&A post
 * GET /posts/:postId/experts
 */
const getExperts = async (req, res) => {
  try {
    const { postId } = req.params;

    const result = await pool.query(
      `SELECT 
        e.user_id as id,
        e.user_type as type,
        e.created_at,
        CASE 
          WHEN e.user_type = 'member' THEN m.name
          WHEN e.user_type = 'community' THEN c.name
        END as name,
        CASE 
          WHEN e.user_type = 'member' THEN m.profile_photo_url
          WHEN e.user_type = 'community' THEN c.logo_url
        END as photo_url
       FROM qna_experts e
       LEFT JOIN members m ON e.user_type = 'member' AND e.user_id = m.id
       LEFT JOIN communities c ON e.user_type = 'community' AND e.user_id = c.id
       WHERE e.post_id = $1
       ORDER BY e.created_at ASC`,
      [postId]
    );

    res.json({
      success: true,
      experts: result.rows,
    });
  } catch (error) {
    console.error("[QnA] Error getting experts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  createQnAPost,
  submitQuestion,
  getQuestions,
  upvoteQuestion,
  removeUpvote,
  answerQuestion,
  markBestAnswer,
  moderateQuestion,
  addExpert,
  removeExpert,
  getExperts,
};
