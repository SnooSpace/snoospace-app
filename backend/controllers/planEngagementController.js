// ---------------------------------------------------------------------------
// POST /plans/:planId/likes
// ---------------------------------------------------------------------------
async function likePlan(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const planId = parseInt(req.params.planId, 10);

    await pool.query(
      `INSERT INTO open_plan_likes (plan_id, user_id) VALUES ($1, $2) ON CONFLICT (plan_id, user_id) DO NOTHING`,
      [planId, userId]
    );

    const countR = await pool.query(`SELECT like_count FROM open_plans WHERE id = $1`, [planId]);
    res.json({ liked: true, like_count: countR.rows[0]?.like_count ?? 0 });
  } catch (err) {
    console.error('[planEngagementController.likePlan]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// DELETE /plans/:planId/likes
// ---------------------------------------------------------------------------
async function unlikePlan(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const planId = parseInt(req.params.planId, 10);

    await pool.query(
      `DELETE FROM open_plan_likes WHERE plan_id = $1 AND user_id = $2`,
      [planId, userId]
    );

    const countR = await pool.query(`SELECT like_count FROM open_plans WHERE id = $1`, [planId]);
    res.json({ liked: false, like_count: countR.rows[0]?.like_count ?? 0 });
  } catch (err) {
    console.error('[planEngagementController.unlikePlan]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// POST /plans/:planId/views
// ---------------------------------------------------------------------------
async function recordView(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const planId = parseInt(req.params.planId, 10);

    // ON CONFLICT DO NOTHING — trigger only fires on INSERT, not conflict
    await pool.query(
      `INSERT INTO open_plan_views (plan_id, viewer_id) VALUES ($1, $2) ON CONFLICT (plan_id, viewer_id) DO NOTHING`,
      [planId, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[planEngagementController.recordView]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// GET /plans/:planId/comments
// ---------------------------------------------------------------------------
async function getComments(req, res) {
  try {
    const pool = req.app.locals.pool;
    const planId = parseInt(req.params.planId, 10);

    const result = await pool.query(
      `SELECT c.id, c.content, c.created_at, c.updated_at,
              m.id as commenter_id, m.name as commenter_name, m.profile_photo_url as commenter_photo
       FROM open_plan_comments c
       JOIN members m ON m.id = c.user_id
       WHERE c.plan_id = $1 AND c.is_deleted = false
       ORDER BY c.created_at ASC`,
      [planId]
    );

    res.json({ comments: result.rows });
  } catch (err) {
    console.error('[planEngagementController.getComments]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// POST /plans/:planId/comments
// ---------------------------------------------------------------------------
async function addComment(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const planId = parseInt(req.params.planId, 10);
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'content is required' });
    }
    if (content.trim().length > 500) {
      return res.status(400).json({ error: 'content must be 500 characters or less' });
    }

    // Verify plan exists
    const planR = await pool.query(`SELECT id FROM open_plans WHERE id = $1`, [planId]);
    if (planR.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });

    const insertR = await pool.query(
      `INSERT INTO open_plan_comments (plan_id, user_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [planId, userId, content.trim()]
    );
    const comment = insertR.rows[0];

    const memberR = await pool.query(
      `SELECT id, name, profile_photo_url FROM members WHERE id = $1`,
      [userId]
    );

    res.status(201).json({
      comment: {
        ...comment,
        commenter_id: memberR.rows[0]?.id,
        commenter_name: memberR.rows[0]?.name,
        commenter_photo: memberR.rows[0]?.profile_photo_url,
      },
    });
  } catch (err) {
    console.error('[planEngagementController.addComment]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// DELETE /plans/:planId/comments/:cmtId
// ---------------------------------------------------------------------------
async function deleteComment(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const planId = parseInt(req.params.planId, 10);
    const cmtId = parseInt(req.params.cmtId, 10);

    // Fetch comment and plan host
    const [commentR, planR] = await Promise.all([
      pool.query(`SELECT user_id FROM open_plan_comments WHERE id = $1 AND plan_id = $2 AND is_deleted = false`, [cmtId, planId]),
      pool.query(`SELECT created_by FROM open_plans WHERE id = $1`, [planId]),
    ]);

    if (commentR.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });

    const isAuthor = commentR.rows[0].user_id === userId;
    const isHost = planR.rows[0]?.created_by === userId;

    if (!isAuthor && !isHost) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    // Soft delete — trigger handles comment_count sync
    await pool.query(
      `UPDATE open_plan_comments SET is_deleted = true, content = null WHERE id = $1`,
      [cmtId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[planEngagementController.deleteComment]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// POST /plans/:planId/interest  — toggle save/unsave
// ---------------------------------------------------------------------------
async function togglePlanInterest(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const planId = parseInt(req.params.planId, 10);

    const existing = await pool.query(
      `SELECT 1 FROM open_plan_interests WHERE plan_id = $1 AND user_id = $2`,
      [planId, userId]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `DELETE FROM open_plan_interests WHERE plan_id = $1 AND user_id = $2`,
        [planId, userId]
      );
      return res.json({ success: true, is_interested: false });
    } else {
      await pool.query(
        `INSERT INTO open_plan_interests (plan_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [planId, userId]
      );
      return res.json({ success: true, is_interested: true });
    }
  } catch (err) {
    console.error('[planEngagementController.togglePlanInterest]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// GET /users/me/plans/interested
// ---------------------------------------------------------------------------
async function getInterestedPlans(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT op.*,
         (SELECT COUNT(*)::int FROM open_plan_requests WHERE plan_id = op.id AND status = 'approved') as accepted_count,
         json_build_object(
           'id', m.id,
           'name', m.name,
           'is_verified', m.is_verified,
           'profile_photo_url', m.profile_photo_url
         ) as host_profile,
         opi.created_at as saved_at
       FROM open_plan_interests opi
       JOIN open_plans op ON op.id = opi.plan_id
       JOIN members m ON m.id = op.created_by
       WHERE opi.user_id = $1
       ORDER BY opi.created_at DESC`,
      [userId]
    );

    res.json({ plans: result.rows });
  } catch (err) {
    console.error('[planEngagementController.getInterestedPlans]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

module.exports = { likePlan, unlikePlan, recordView, getComments, addComment, deleteComment, togglePlanInterest, getInterestedPlans };
