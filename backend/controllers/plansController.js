const pushService = require('../services/pushService');

// ---------------------------------------------------------------------------
// Helper: get accepted count for a plan
// ---------------------------------------------------------------------------
async function getAcceptedCount(pool, planId) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS count FROM open_plan_requests WHERE plan_id = $1 AND status = 'approved'`,
    [planId]
  );
  return r.rows[0].count;
}

// ---------------------------------------------------------------------------
// Helper: get pending count for a plan
// ---------------------------------------------------------------------------
async function getPendingCount(pool, planId) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS count FROM open_plan_requests WHERE plan_id = $1 AND status = 'pending'`,
    [planId]
  );
  return r.rows[0].count;
}

// ---------------------------------------------------------------------------
// Helper: get current user's request status for a plan
// ---------------------------------------------------------------------------
async function getMyRequestStatus(pool, planId, userId) {
  const r = await pool.query(
    `SELECT status FROM open_plan_requests WHERE plan_id = $1 AND requester_id = $2 LIMIT 1`,
    [planId, userId]
  );
  return r.rows[0]?.status || null;
}

// ---------------------------------------------------------------------------
// Helper: get first shared community name between two members
// ---------------------------------------------------------------------------
async function getSharedCommunityName(pool, memberId1, memberId2) {
  const r = await pool.query(
    `SELECT c.name FROM follows f1
     JOIN follows f2
       ON f1.following_id = f2.following_id
      AND f1.following_type = 'community'
      AND f2.following_type = 'community'
     JOIN communities c ON c.id = f1.following_id
     WHERE f1.follower_id = $1 AND f1.follower_type = 'member'
       AND f2.follower_id = $2 AND f2.follower_type = 'member'
     LIMIT 1`,
    [memberId1, memberId2]
  );
  return r.rows[0]?.name || null;
}

// ---------------------------------------------------------------------------
// Helper: get all shared communities between two members
// ---------------------------------------------------------------------------
async function getSharedCommunities(pool, memberId1, memberId2) {
  const r = await pool.query(
    `SELECT c.id, c.name FROM follows f1
     JOIN follows f2
       ON f1.following_id = f2.following_id
      AND f1.following_type = 'community'
      AND f2.following_type = 'community'
     JOIN communities c ON c.id = f1.following_id
     WHERE f1.follower_id = $1 AND f1.follower_type = 'member'
       AND f2.follower_id = $2 AND f2.follower_type = 'member'`,
    [memberId1, memberId2]
  );
  return r.rows;
}

// ---------------------------------------------------------------------------
// POST /plans
// ---------------------------------------------------------------------------
async function createPlan(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;

    const {
      title,
      activity_type,
      custom_activity_label,
      cost_type,
      cost_amount_paise,
      visibility,
      scoped_community_id,
      gender_preference = 'all',
      location_public,
      location_private,
      scheduled_at,
      max_accepted = 5,
      is_recurring = false,
      recurrence_interval,
      banner_image_url,
    } = req.body;

    // --- Validations ---
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (title.trim().length > 100) {
      return res.status(400).json({ error: 'title must be 100 characters or less' });
    }
    const validActivityTypes = [
      'sports', 'study', 'food', 'gaming', 'other',
      'cafe', 'walk', 'pet_friendly', 'hangout', 'rides',
      'creative', 'gym', 'yoga', 'live_music', 'movies', 'bar',
    ];
    if (!validActivityTypes.includes(activity_type)) {
      return res.status(400).json({ error: `activity_type must be one of: ${validActivityTypes.join(', ')}` });
    }
    if (activity_type === 'other' && !custom_activity_label) {
      return res.status(400).json({ error: 'custom_activity_label is required when activity_type is "other"' });
    }
    if (custom_activity_label && custom_activity_label.length > 25) {
      return res.status(400).json({ error: 'custom_activity_label must be 25 characters or less' });
    }
    const validCostTypes = ['free', 'self_pay', 'split', 'entry_fee'];
    if (!validCostTypes.includes(cost_type)) {
      return res.status(400).json({ error: `cost_type must be one of: ${validCostTypes.join(', ')}` });
    }
    const validVisibilities = ['community_members', 'everyone'];
    if (!validVisibilities.includes(visibility)) {
      return res.status(400).json({ error: `visibility must be one of: ${validVisibilities.join(', ')}` });
    }
    const validGenders = ['all', 'Female', 'Male', 'Non-binary'];
    if (!validGenders.includes(gender_preference)) {
      return res.status(400).json({ error: `gender_preference must be one of: ${validGenders.join(', ')}` });
    }
    if (!scheduled_at) {
      return res.status(400).json({ error: 'scheduled_at is required' });
    }
    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      return res.status(400).json({ error: 'scheduled_at must be a valid future date' });
    }
    const maxAcceptedInt = parseInt(max_accepted, 10);
    if (isNaN(maxAcceptedInt) || maxAcceptedInt < 1 || maxAcceptedInt > 50) {
      return res.status(400).json({ error: 'max_accepted must be between 1 and 50' });
    }
    if (is_recurring && recurrence_interval !== 'weekly') {
      return res.status(400).json({ error: 'recurrence_interval must be weekly when is_recurring is true' });
    }

    const result = await pool.query(
      `INSERT INTO open_plans (
         created_by, title, activity_type, custom_activity_label,
         cost_type, cost_amount_paise, visibility, scoped_community_id,
         gender_preference, location_public, location_private,
         scheduled_at, expires_at, max_accepted, is_recurring, recurrence_interval,
         banner_image_url
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7, $8,
         $9, $10, $11,
         $12, $12::timestamptz + INTERVAL '1 hour', $13, $14, $15, $16
       ) RETURNING *`,
      [
        userId,
        title.trim(),
        activity_type,
        custom_activity_label || null,
        cost_type,
        cost_amount_paise || null,
        visibility,
        scoped_community_id ? parseInt(scoped_community_id, 10) : null,
        gender_preference,
        location_public || null,
        location_private || null,
        scheduled_at,
        maxAcceptedInt,
        !!is_recurring,
        recurrence_interval || null,
        banner_image_url || null,
      ]
    );

    res.status(201).json({ plan: result.rows[0] });
  } catch (err) {
    console.error('[plansController.createPlan]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// GET /plans
// ---------------------------------------------------------------------------
async function getPlans(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;

    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : null;

    // Fetch viewer's gender for filter
    const memberR = await pool.query(`SELECT gender FROM members WHERE id = $1`, [userId]);
    const viewerGender = memberR.rows[0]?.gender || null;

    const params = [userId, userId, viewerGender, limit + 1];
    const cursorClause = cursor ? `AND op.id < $${params.push(cursor)}` : '';

    const query = `
      SELECT op.*
      FROM open_plans op
      WHERE op.status = 'active'
        AND op.expires_at > NOW()
        ${cursorClause}
        -- Block filter (both directions)
        AND op.created_by NOT IN (
          SELECT blocked_id FROM user_blocks WHERE blocker_id = $1
          UNION
          SELECT blocker_id FROM user_blocks WHERE blocked_id = $1
        )
        -- Visibility filter
        AND (
          op.visibility = 'everyone'
          OR (
            op.visibility = 'community_members'
            AND op.scoped_community_id IS NULL
            AND EXISTS (
              SELECT 1 FROM follows f1
              JOIN follows f2
                ON f1.following_id = f2.following_id
               AND f1.following_type = 'community'
               AND f2.following_type = 'community'
              WHERE f1.follower_id = $2 AND f1.follower_type = 'member'
                AND f2.follower_id = op.created_by AND f2.follower_type = 'member'
            )
          )
          OR (
            op.visibility = 'community_members'
            AND op.scoped_community_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM follows
              WHERE follower_id = $2
                AND follower_type = 'member'
                AND following_id = op.scoped_community_id
                AND following_type = 'community'
            )
          )
        )
        -- Gender filter
        AND (
          op.gender_preference = 'all'
          OR op.gender_preference = $3
        )
      ORDER BY op.created_at DESC
      LIMIT $4
    `;

    const result = await pool.query(query, params);
    const rows = result.rows;
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();

    // Enrich each plan
    const plans = await Promise.all(
      rows.map(async (plan) => {
        const [acceptedCount, myStatus, sharedCommunityName, hostR, pendingCount] = await Promise.all([
          getAcceptedCount(pool, plan.id),
          getMyRequestStatus(pool, plan.id, userId),
          getSharedCommunityName(pool, userId, plan.created_by),
          pool.query(
            `SELECT id, name, is_verified, profile_photo_url FROM members WHERE id = $1`,
            [plan.created_by]
          ),
          getPendingCount(pool, plan.id),
        ]);
        return {
          ...plan,
          accepted_count: acceptedCount,
          my_request_status: myStatus,
          shared_community_name: sharedCommunityName,
          host_profile: hostR.rows[0] || null,
          pending_count: pendingCount,
        };
      })
    );

    const nextCursor = hasMore ? plans[plans.length - 1].id : null;
    res.json({ plans, next_cursor: nextCursor });
  } catch (err) {
    console.error('[plansController.getPlans]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// GET /plans/:planId
// ---------------------------------------------------------------------------
async function getPlanById(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const planId = parseInt(req.params.planId, 10);

    const planR = await pool.query(`SELECT * FROM open_plans WHERE id = $1`, [planId]);
    if (planR.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    const plan = planR.rows[0];

    const [acceptedCount, myStatus, hostR, sharedCommunities, commentsR, approvedR, pendingCount] = await Promise.all([
      getAcceptedCount(pool, planId),
      getMyRequestStatus(pool, planId, userId),
      pool.query(`SELECT id, name, is_verified, profile_photo_url, created_at FROM members WHERE id = $1`, [plan.created_by]),
      getSharedCommunities(pool, userId, plan.created_by),
      pool.query(
        `SELECT c.id, c.content, c.created_at, m.id as commenter_id, m.name as commenter_name, m.profile_photo_url as commenter_photo
         FROM open_plan_comments c
         JOIN members m ON m.id = c.user_id
         WHERE c.plan_id = $1 AND c.is_deleted = false
         ORDER BY c.created_at ASC LIMIT 3`,
        [planId]
      ),
      pool.query(
        `SELECT 1 FROM open_plan_requests WHERE plan_id = $1 AND requester_id = $2 AND status = 'approved' LIMIT 1`,
        [planId, userId]
      ),
      getPendingCount(pool, planId),
    ]);

    const isHost = plan.created_by === userId;
    const isApproved = approvedR.rows.length > 0;

    const response = {
      ...plan,
      location_private: (isHost || isApproved) ? plan.location_private : undefined,
      accepted_count: acceptedCount,
      my_request_status: myStatus,
      host_profile: hostR.rows[0] || null,
      shared_communities: sharedCommunities,
      comments_preview: commentsR.rows,
      pending_count: pendingCount,
    };

    res.json({ plan: response });
  } catch (err) {
    console.error('[plansController.getPlanById]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// PATCH /plans/:planId
// ---------------------------------------------------------------------------
async function updatePlan(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const planId = parseInt(req.params.planId, 10);

    const stringFields = ['title', 'custom_activity_label', 'cost_type', 'location_public', 'location_private', 'banner_image_url'];
    const updates = [];
    const values = [];
    let idx = 1;

    // --- Simple string / nullable fields ---
    for (const field of stringFields) {
      if (req.body[field] !== undefined) {
        if (field === 'title') {
          if (typeof req.body.title !== 'string' || req.body.title.trim().length === 0)
            return res.status(400).json({ error: 'title cannot be empty' });
          updates.push(`${field} = $${idx++}`);
          values.push(req.body[field].trim());
        } else {
          updates.push(`${field} = $${idx++}`);
          values.push(req.body[field]);
        }
      }
    }

    // --- cost_amount_paise ---
    if (req.body.cost_amount_paise !== undefined) {
      updates.push(`cost_amount_paise = $${idx++}`);
      values.push(req.body.cost_amount_paise || null);
    }

    // --- max_accepted ---
    if (req.body.max_accepted !== undefined) {
      const v = parseInt(req.body.max_accepted, 10);
      if (isNaN(v) || v < 1 || v > 50)
        return res.status(400).json({ error: 'max_accepted must be between 1 and 50' });
      updates.push(`max_accepted = $${idx++}`);
      values.push(v);
    }

    // --- scheduled_at ---
    if (req.body.scheduled_at !== undefined) {
      const scheduledDate = new Date(req.body.scheduled_at);
      if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date())
        return res.status(400).json({ error: 'scheduled_at must be a valid future date' });
      updates.push(`scheduled_at = $${idx++}`);
      values.push(req.body.scheduled_at);
      // Also extend the expiry window: 1 hour after the event
      updates.push(`expires_at = $${idx++}`);
      values.push(scheduledDate.toISOString());
    }

    // --- is_recurring + recurrence_interval ---
    if (req.body.is_recurring !== undefined) {
      const recurring = !!req.body.is_recurring;
      const interval = recurring ? (req.body.recurrence_interval || 'weekly') : null;
      if (recurring && interval !== 'weekly')
        return res.status(400).json({ error: 'recurrence_interval must be weekly when is_recurring is true' });
      updates.push(`is_recurring = $${idx++}`);
      values.push(recurring);
      updates.push(`recurrence_interval = $${idx++}`);
      values.push(interval);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    values.push(planId, userId);
    const result = await pool.query(
      `UPDATE open_plans SET ${updates.join(', ')} WHERE id = $${idx++} AND created_by = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Plan not found or not authorized' });
    res.json({ plan: result.rows[0] });
  } catch (err) {
    console.error('[plansController.updatePlan]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// DELETE /plans/:planId  (cancel)
// ---------------------------------------------------------------------------
async function cancelPlan(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const planId = parseInt(req.params.planId, 10);

    const planR = await pool.query(
      `UPDATE open_plans SET status = 'cancelled' WHERE id = $1 AND created_by = $2 AND status = 'active' RETURNING *`,
      [planId, userId]
    );
    if (planR.rows.length === 0) return res.status(404).json({ error: 'Plan not found, not authorized, or not active' });
    const plan = planR.rows[0];

    // Fetch host name and all approved attendees
    const [hostR, attendeesR] = await Promise.all([
      pool.query(`SELECT name FROM members WHERE id = $1`, [userId]),
      pool.query(`SELECT requester_id FROM open_plan_requests WHERE plan_id = $1 AND status = 'approved'`, [planId]),
    ]);
    const hostName = hostR.rows[0]?.name || 'Someone';

    // Non-fatal push notifications
    for (const attendee of attendeesR.rows) {
      try {
        await pushService.sendPushNotification(
          pool, attendee.requester_id, 'member',
          'Plan Cancelled 😔',
          `${hostName} cancelled the plan: ${plan.title}`,
          { type: 'plan_cancelled', planId }
        );
      } catch (e) {
        console.warn('[cancelPlan] Push failed for', attendee.requester_id, e.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[plansController.cancelPlan]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// POST /plans/:planId/close
// ---------------------------------------------------------------------------
async function closePlan(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const planId = parseInt(req.params.planId, 10);

    const result = await pool.query(
      `UPDATE open_plans SET status = 'closed' WHERE id = $1 AND created_by = $2 AND status = 'active' RETURNING *`,
      [planId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Plan not found, not authorized, or not active' });
    res.json({ plan: result.rows[0] });
  } catch (err) {
    console.error('[plansController.closePlan]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

module.exports = { createPlan, getPlans, getPlanById, updatePlan, cancelPlan, closePlan };
