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
    `SELECT c.name FROM (
       SELECT following_id AS community_id FROM follows WHERE follower_id = $1 AND follower_type = 'member' AND following_type = 'community'
       UNION
       SELECT community_id FROM community_member_circles WHERE member_id = $1
     ) m1
     JOIN (
       SELECT following_id AS community_id FROM follows WHERE follower_id = $2 AND follower_type = 'member' AND following_type = 'community'
       UNION
       SELECT community_id FROM community_member_circles WHERE member_id = $2
     ) m2 ON m1.community_id = m2.community_id
     JOIN communities c ON c.id = m1.community_id
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
    `SELECT DISTINCT c.id, c.name, c.logo_url FROM (
       SELECT following_id AS community_id FROM follows WHERE follower_id = $1 AND follower_type = 'member' AND following_type = 'community'
       UNION
       SELECT community_id FROM community_member_circles WHERE member_id = $1
     ) m1
     JOIN (
       SELECT following_id AS community_id FROM follows WHERE follower_id = $2 AND follower_type = 'member' AND following_type = 'community'
       UNION
       SELECT community_id FROM community_member_circles WHERE member_id = $2
     ) m2 ON m1.community_id = m2.community_id
     JOIN communities c ON c.id = m1.community_id`,
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
      target_community_ids, // array of community IDs for community_members scoping; [] / absent = broad
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
      'sports', 'study', 'cowork', 'food', 'gaming', 'games', 'other',
      'cafe', 'walk', 'pet_friendly', 'pet_gathering', 'hangout', 'rides',
      'creative', 'gym', 'yoga', 'live_music', 'movies', 'bar',
      'house_party', 'club', 'hiking', 'shopping',
      'bowling', 'gokarting', 'go_karting', 'indoorgames', 'indoor_games',
      'pilates', 'swimming',
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

    // Validate target_community_ids if provided
    const communityIds = Array.isArray(target_community_ids)
      ? target_community_ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id))
      : [];

    const client = await pool.connect();
    let newPlan;
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO open_plans (
           created_by, title, activity_type, custom_activity_label,
           cost_type, cost_amount_paise, visibility,
           gender_preference, location_public, location_private,
           scheduled_at, expires_at, max_accepted, is_recurring, recurrence_interval,
           banner_image_url
         ) VALUES (
           $1, $2, $3, $4,
           $5, $6, $7,
           $8, $9, $10,
           $11, $11::timestamptz + INTERVAL '24 hours', $12, $13, $14, $15
         ) RETURNING *`,
        [
          userId,
          title.trim(),
          activity_type,
          custom_activity_label || null,
          cost_type,
          cost_amount_paise || null,
          visibility,
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
      newPlan = result.rows[0];

      // Insert community targeting rows (multi-community visibility)
      if (communityIds.length > 0) {
        const vals = communityIds.map((cid, i) => `($1, $${i + 2})`).join(', ');
        await client.query(
          `INSERT INTO open_plan_visible_communities (plan_id, community_id) VALUES ${vals}
           ON CONFLICT DO NOTHING`,
          [newPlan.id, ...communityIds]
        );
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    res.status(201).json({ plan: newPlan });
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
    const activityType = req.query.activityType || req.query.activity_type || null;

    // Fetch viewer's gender for filter
    const memberR = await pool.query(`SELECT gender FROM members WHERE id = $1`, [userId]);
    const viewerGender = memberR.rows[0]?.gender || null;

    const params = [userId, userId, viewerGender, limit + 1];
    const cursorClause = cursor ? `AND op.id < $${params.push(cursor)}` : '';
    const activityClause = (activityType && activityType !== 'all')
      ? `AND op.activity_type = $${params.push(activityType)}`
      : '';

    const query = `
      SELECT op.*
      FROM open_plans op
      WHERE op.status = 'active'
        AND op.expires_at > NOW()
        AND op.scheduled_at > NOW()
        ${cursorClause}
        ${activityClause}
        -- Block filter (both directions)
        AND op.created_by NOT IN (
          SELECT blocked_id FROM user_blocks WHERE blocker_id = $1
          UNION
          SELECT blocker_id FROM user_blocks WHERE blocked_id = $1
        )
        -- Visibility filter
        AND (
          -- Host always sees their own plan regardless of visibility setting
          op.created_by = $1
          OR op.visibility = 'everyone'
          OR (
            op.visibility = 'community_members'
            -- No scoped communities → broad: viewer shares any community with host
            AND NOT EXISTS (SELECT 1 FROM open_plan_visible_communities WHERE plan_id = op.id)
            AND EXISTS (
              SELECT 1 FROM (
                SELECT following_id AS community_id FROM follows WHERE follower_id = $2 AND follower_type = 'member' AND following_type = 'community'
                UNION
                SELECT community_id FROM community_member_circles WHERE member_id = $2
              ) viewer_comms
              JOIN (
                SELECT following_id AS community_id FROM follows WHERE follower_id = op.created_by AND follower_type = 'member' AND following_type = 'community'
                UNION
                SELECT community_id FROM community_member_circles WHERE member_id = op.created_by
              ) host_comms ON viewer_comms.community_id = host_comms.community_id
            )
          )
          OR (
            op.visibility = 'community_members'
            -- Has scoped communities → targeted: viewer follows/is-member-of any of them
            AND EXISTS (SELECT 1 FROM open_plan_visible_communities WHERE plan_id = op.id)
            AND (
              EXISTS (
                SELECT 1 FROM follows
                WHERE follower_id = $2
                  AND follower_type = 'member'
                  AND following_id IN (SELECT community_id FROM open_plan_visible_communities WHERE plan_id = op.id)
                  AND following_type = 'community'
                  AND is_superseded_by_circle = false
              )
              OR EXISTS (
                SELECT 1 FROM community_member_circles
                WHERE member_id = $2
                  AND community_id IN (SELECT community_id FROM open_plan_visible_communities WHERE plan_id = op.id)
              )
            )
          )
        )
        -- Gender filter (creator always sees their own plan)
        AND (
          op.gender_preference = 'all'
          OR op.gender_preference = $3
          OR op.created_by = $1
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
            `SELECT id, name, is_verified, verification_tier, profile_photo_url FROM members WHERE id = $1`,
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

    // ── Visibility-gated fetch ──────────────────────────────────────────────────
    // Reuses the exact same three-branch visibility logic as getPlans (L220-245).
    // Host bypass (created_by = $2) mirrors the intent of getPlans' gender filter
    // bypass (op.created_by = $1) so creators always see their own plans.
    // Returns 404 — not 403 — to avoid confirming a plan's existence to a blocked viewer,
    // consistent with how getPlans silently omits restricted plans from results.
    const planR = await pool.query(
      `SELECT * FROM open_plans
       WHERE id = $1
         AND (
           -- Host always sees their own plan regardless of visibility setting
           created_by = $2
           OR visibility = 'everyone'
           OR (
             visibility = 'community_members'
             -- No scoped communities → broad: viewer shares any community with host
             AND NOT EXISTS (SELECT 1 FROM open_plan_visible_communities opvc WHERE opvc.plan_id = open_plans.id)
             AND EXISTS (
               SELECT 1 FROM (
                 SELECT following_id AS community_id FROM follows WHERE follower_id = $2 AND follower_type = 'member' AND following_type = 'community'
                 UNION
                 SELECT community_id FROM community_member_circles WHERE member_id = $2
               ) viewer_comms
               JOIN (
                 SELECT following_id AS community_id FROM follows WHERE follower_id = open_plans.created_by AND follower_type = 'member' AND following_type = 'community'
                 UNION
                 SELECT community_id FROM community_member_circles WHERE member_id = open_plans.created_by
               ) host_comms ON viewer_comms.community_id = host_comms.community_id
             )
           )
           OR (
             visibility = 'community_members'
             -- Has scoped communities → targeted: viewer follows/is-member-of any of them
             AND EXISTS (SELECT 1 FROM open_plan_visible_communities opvc WHERE opvc.plan_id = open_plans.id)
             AND (
               EXISTS (
                 SELECT 1 FROM follows
                 WHERE follower_id = $2
                   AND follower_type = 'member'
                   AND following_id IN (SELECT community_id FROM open_plan_visible_communities WHERE plan_id = open_plans.id)
                   AND following_type = 'community'
                   AND is_superseded_by_circle = false
               )
               OR EXISTS (
                 SELECT 1 FROM community_member_circles
                 WHERE member_id = $2
                   AND community_id IN (SELECT community_id FROM open_plan_visible_communities WHERE plan_id = open_plans.id)
               )
             )
           )
         )`,
      [planId, userId]
    );
    if (planR.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    const plan = planR.rows[0];

    const [acceptedCount, myStatus, hostR, sharedCommunities, commentsR, approvedR, pendingCount] = await Promise.all([
      getAcceptedCount(pool, planId),
      getMyRequestStatus(pool, planId, userId),
      pool.query(`SELECT id, name, is_verified, verification_tier, profile_photo_url, created_at FROM members WHERE id = $1`, [plan.created_by]),
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

    const stringFields = ['title', 'custom_activity_label', 'cost_type', 'location_public', 'location_private', 'banner_image_url', 'visibility', 'gender_preference'];
    const updates = [];
    const values = [];
    let idx = 1;

    // Validate visibility and gender if provided
    if (req.body.visibility !== undefined) {
      const validVisibilities = ['community_members', 'everyone'];
      if (!validVisibilities.includes(req.body.visibility)) {
        return res.status(400).json({ error: `visibility must be one of: ${validVisibilities.join(', ')}` });
      }
    }
    if (req.body.gender_preference !== undefined) {
      const validGenders = ['all', 'Female', 'Male', 'Non-binary'];
      if (!validGenders.includes(req.body.gender_preference)) {
        return res.status(400).json({ error: `gender_preference must be one of: ${validGenders.join(', ')}` });
      }
    }

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
      // Also extend the expiry window: 24 hours after the event
      const expiresAt = new Date(scheduledDate.getTime() + 24 * 60 * 60 * 1000);
      updates.push(`expires_at = $${idx++}`);
      values.push(expiresAt.toISOString());
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

    if (updates.length === 0 && req.body.target_community_ids === undefined) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const client = await pool.connect();
    let updatedPlan;
    try {
      await client.query('BEGIN');

      if (updates.length > 0) {
        const updateValues = [...values, planId, userId];
        const result = await client.query(
          `UPDATE open_plans SET ${updates.join(', ')} WHERE id = $${idx++} AND created_by = $${idx} RETURNING *`,
          updateValues
        );
        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Plan not found or not authorized' });
        }
        updatedPlan = result.rows[0];
      } else {
        // Only targeting update — verify ownership
        const owns = await client.query(
          'SELECT id FROM open_plans WHERE id = $1 AND created_by = $2',
          [planId, userId]
        );
        if (owns.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Plan not found or not authorized' });
        }
        updatedPlan = owns.rows[0];
      }

      // --- target_community_ids: replace all targeting rows atomically ---
      if (req.body.target_community_ids !== undefined) {
        const communityIds = Array.isArray(req.body.target_community_ids)
          ? req.body.target_community_ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id))
          : [];
        await client.query(
          'DELETE FROM open_plan_visible_communities WHERE plan_id = $1',
          [planId]
        );
        if (communityIds.length > 0) {
          const vals = communityIds.map((cid, i) => `($1, $${i + 2})`).join(', ');
          await client.query(
            `INSERT INTO open_plan_visible_communities (plan_id, community_id) VALUES ${vals}
             ON CONFLICT DO NOTHING`,
            [planId, ...communityIds]
          );
        }
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    res.json({ plan: updatedPlan });
  } catch (err) {
    console.error('[plansController.updatePlan]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// DELETE /plans/:planId  (delete/cancel)
// ---------------------------------------------------------------------------
async function cancelPlan(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const planId = parseInt(req.params.planId, 10);

    // Fetch the plan first (must exist, belong to this user, and be active/closed/completed/cancelled).
    // 'completed' plans are past plans auto-marked by the DB cron after scheduled_at + 24h.
    // 'cancelled' plans are those already cancelled; allowing delete here will run a hard delete.
    const planR = await pool.query(
      `SELECT * FROM open_plans WHERE id = $1 AND created_by = $2 AND status IN ('active', 'closed', 'completed', 'cancelled')`,
      [planId, userId]
    );
    if (planR.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found, not authorized, or not active' });
    }
    const plan = planR.rows[0];

    // If the plan is already 'cancelled', perform a hard/permanent delete
    if (plan.status === 'cancelled') {
      await pool.query(
        `DELETE FROM open_plans WHERE id = $1`,
        [planId]
      );
      return res.json({ success: true, deleted: true });
    }

    // Guard: cannot delete if anyone has already been accepted
    const acceptedCount = await getAcceptedCount(pool, planId);
    if (acceptedCount > 0) {
      return res.status(400).json({
        error: 'plan_has_accepted_attendees',
        message: 'Cannot delete this plan — people have already joined.',
      });
    }

    // Mark plan as cancelled
    await pool.query(
      `UPDATE open_plans SET status = 'cancelled' WHERE id = $1`,
      [planId]
    );

    // Fetch host name and all pending requesters to notify
    const [hostR, pendingR] = await Promise.all([
      pool.query(`SELECT name FROM members WHERE id = $1`, [userId]),
      pool.query(
        `SELECT requester_id FROM open_plan_requests WHERE plan_id = $1 AND status = 'pending'`,
        [planId]
      ),
    ]);
    const hostName = hostR.rows[0]?.name || 'Someone';

    // Notify pending requesters that the plan was removed
    for (const requester of pendingR.rows) {
      try {
        await pushService.sendPushNotification(
          pool, requester.requester_id, 'member',
          'Plan Removed 😔',
          `The plan "${plan.title}" has been removed by the host.`,
          { type: 'plan_cancelled', planId }
        );
      } catch (e) {
        console.warn('[cancelPlan] Push failed for pending requester', requester.requester_id, e.message);
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
