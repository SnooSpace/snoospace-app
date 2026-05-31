const pushService = require('../services/pushService');

// ---------------------------------------------------------------------------
// POST /plans/:planId/requests
// ---------------------------------------------------------------------------
async function sendRequest(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const planId = parseInt(req.params.planId, 10);
    const note = req.body.note || null;

    if (note && note.length > 200) {
      return res.status(400).json({ error: 'note must be 200 characters or less' });
    }

    // 1. Plan must exist and be active
    const planR = await pool.query(`SELECT * FROM open_plans WHERE id = $1`, [planId]);
    if (planR.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    const plan = planR.rows[0];
    if (plan.status !== 'active') return res.status(400).json({ error: 'This plan is no longer accepting requests' });

    // 2. Cannot request own plan
    if (plan.created_by === userId) {
      return res.status(400).json({ error: 'You cannot request to join your own plan' });
    }

    // 3. No existing non-withdrawn request
    const existingR = await pool.query(
      `SELECT id FROM open_plan_requests WHERE plan_id = $1 AND requester_id = $2 AND status != 'withdrawn' LIMIT 1`,
      [planId, userId]
    );
    if (existingR.rows.length > 0) {
      return res.status(400).json({ error: 'You already have an active request for this plan' });
    }

    // 4. Block check (either direction)
    const blockR = await pool.query(
      `SELECT 1 FROM user_blocks
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [userId, plan.created_by]
    );
    if (blockR.rows.length > 0) {
      return res.status(403).json({ error: 'Cannot send a request to this user' });
    }

    // Insert request
    const insertR = await pool.query(
      `INSERT INTO open_plan_requests (plan_id, requester_id, note)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [planId, userId, note]
    );
    const request = insertR.rows[0];

    // Non-fatal push to host
    try {
      await pushService.sendPushNotification(
        pool, plan.created_by, 'member',
        'New Plan Request 👋',
        `New request to join your plan: ${plan.title}`,
        { type: 'plan_request', planId }
      );
    } catch (e) {
      console.warn('[sendRequest] Push to host failed:', e.message);
    }

    res.status(201).json({ request });
  } catch (err) {
    console.error('[planRequestsController.sendRequest]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// GET /plans/:planId/requests
// ---------------------------------------------------------------------------
async function getRequests(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const planId = parseInt(req.params.planId, 10);

    // Only host can view requests
    const planR = await pool.query(`SELECT created_by FROM open_plans WHERE id = $1`, [planId]);
    if (planR.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    if (planR.rows[0].created_by !== userId) return res.status(403).json({ error: 'Not authorized' });

    const statusFilter = req.query.status || 'pending';
    const params = [planId];
    const statusClause = statusFilter !== 'all' ? `AND r.status = $${params.push(statusFilter)}` : '';

    const requestsR = await pool.query(
      `SELECT r.*, m.name, m.profile_photo_url, m.is_verified, m.created_at as member_created_at
       FROM open_plan_requests r
       JOIN members m ON m.id = r.requester_id
       WHERE r.plan_id = $1 ${statusClause}
       ORDER BY r.requested_at ASC`,
      params
    );

    // Enrich each request with social proof data
    const requests = await Promise.all(
      requestsR.rows.map(async (row) => {
        const reqId = row.requester_id;

        const [postCountR, eventsR, socialR, sharedCommR, sharedEventsR] = await Promise.all([
          pool.query(
            `SELECT COUNT(*)::int as count FROM posts WHERE author_id = $1 AND author_type = 'member'`,
            [reqId]
          ),
          pool.query(
            `SELECT COUNT(*)::int as count FROM event_registrations WHERE member_id = $1`,
            [reqId]
          ),
          pool.query(
            `SELECT platform, platform_username FROM user_social_connections WHERE user_id = $1 AND is_active = true`,
            [reqId]
          ),
          pool.query(
            `SELECT c.id, c.name FROM follows f1
             JOIN follows f2
               ON f1.following_id = f2.following_id
              AND f1.following_type = 'community'
              AND f2.following_type = 'community'
             JOIN communities c ON c.id = f1.following_id
             WHERE f1.follower_id = $1 AND f1.follower_type = 'member'
               AND f2.follower_id = $2 AND f2.follower_type = 'member'`,
            [userId, reqId]
          ),
          pool.query(
            `SELECT e.id, e.title, e.event_date FROM events e
             JOIN event_registrations r1 ON r1.event_id = e.id AND r1.member_id = $1
             JOIN event_registrations r2 ON r2.event_id = e.id AND r2.member_id = $2
             ORDER BY e.event_date DESC LIMIT 3`,
            [userId, reqId]
          ),
        ]);

        return {
          id: row.id,
          plan_id: row.plan_id,
          status: row.status,
          note: row.note,
          requested_at: row.requested_at,
          responded_at: row.responded_at,
          requester: {
            id: reqId,
            name: row.name,
            profile_photo_url: row.profile_photo_url,
            is_verified: row.is_verified,
            created_at: row.member_created_at,
            post_count: postCountR.rows[0].count,
            events_attended_count: eventsR.rows[0].count,
            social_connections: socialR.rows,
            shared_communities: sharedCommR.rows,
            shared_events: sharedEventsR.rows,
          },
        };
      })
    );

    res.json({ requests });
  } catch (err) {
    console.error('[planRequestsController.getRequests]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// PATCH /plans/:planId/requests/:reqId
// ---------------------------------------------------------------------------
async function updateRequest(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const planId = parseInt(req.params.planId, 10);
    const reqId = parseInt(req.params.reqId, 10);
    const { status } = req.body;

    if (!['approved', 'declined', 'removed'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved, declined, or removed' });
    }

    // Fetch plan and verify host
    const planR = await pool.query(`SELECT * FROM open_plans WHERE id = $1`, [planId]);
    if (planR.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    const plan = planR.rows[0];
    if (plan.created_by !== userId) return res.status(403).json({ error: 'Not authorized' });

    // Fetch request
    const requestR = await pool.query(`SELECT * FROM open_plan_requests WHERE id = $1 AND plan_id = $2`, [reqId, planId]);
    if (requestR.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    const request = requestR.rows[0];

    const hostR = await pool.query(`SELECT name FROM members WHERE id = $1`, [userId]);
    const hostName = hostR.rows[0]?.name || 'Someone';

    // --- APPROVE ---
    if (status === 'approved') {
      // Capacity check
      const capacityR = await pool.query(
        `SELECT COUNT(*)::int as count FROM open_plan_requests WHERE plan_id = $1 AND status = 'approved'`,
        [planId]
      );
      if (capacityR.rows[0].count >= plan.max_accepted) {
        return res.status(400).json({ error: 'plan_at_capacity', message: 'This plan has reached its acceptance limit.' });
      }

      await pool.query(
        `UPDATE open_plan_requests SET status = 'approved', responded_at = NOW() WHERE id = $1`,
        [reqId]
      );

      // Find or create DM conversation (using the same participant1/participant2 schema as messageController)
      let conversationId;

      // Canonical ordering: lower id goes first to satisfy the unique constraint
      const id1 = Number(userId);
      const id2 = Number(request.requester_id);
      const [p1Id, p2Id] = id1 < id2 ? [id1, id2] : [id2, id1];

      // Try to find an existing DM first
      const existingConvR = await pool.query(
        `SELECT id FROM conversations
         WHERE is_group = false
           AND participant1_id = $1 AND participant1_type = 'member'
           AND participant2_id = $2 AND participant2_type = 'member'
         LIMIT 1`,
        [p1Id, p2Id]
      );

      if (existingConvR.rows.length > 0) {
        conversationId = existingConvR.rows[0].id;
      } else {
        // Create using the same schema as getOrCreateConversation in messageController
        const insertResult = await pool.query(
          `INSERT INTO conversations
             (is_group, participant1_id, participant1_type, participant2_id, participant2_type)
           VALUES (false, $1, 'member', $2, 'member')
           ON CONFLICT (participant1_id, participant1_type, participant2_id, participant2_type)
           DO NOTHING RETURNING id`,
          [p1Id, p2Id]
        );
        if (insertResult.rows.length > 0) {
          conversationId = insertResult.rows[0].id;
        } else {
          // Race condition: another request just created it
          const retryR = await pool.query(
            `SELECT id FROM conversations
             WHERE is_group = false
               AND participant1_id = $1 AND participant1_type = 'member'
               AND participant2_id = $2 AND participant2_type = 'member'
             LIMIT 1`,
            [p1Id, p2Id]
          );
          conversationId = retryR.rows[0].id;
        }
      }

      try {
        await pushService.sendPushNotification(
          pool, request.requester_id, 'member',
          'Request Approved! 🎉',
          `Your request was approved! Message ${hostName} for details.`,
          { type: 'plan_approved', planId, conversationId }
        );
      } catch (e) {
        console.warn('[updateRequest] Approve push failed:', e.message);
      }

      return res.json({ request: { ...request, status: 'approved', responded_at: new Date() }, conversation_id: conversationId });
    }

    // --- DECLINE ---
    if (status === 'declined') {
      await pool.query(
        `UPDATE open_plan_requests SET status = 'declined', responded_at = NOW() WHERE id = $1`,
        [reqId]
      );
      try {
        await pushService.sendPushNotification(
          pool, request.requester_id, 'member',
          'Request Update',
          `Your request to join "${plan.title}" was not accepted.`,
          { type: 'plan_declined', planId }
        );
      } catch (e) {
        console.warn('[updateRequest] Decline push failed:', e.message);
      }
      return res.json({ success: true });
    }

    // --- REMOVE ---
    if (status === 'removed') {
      if (request.status !== 'approved') {
        return res.status(400).json({ error: 'Can only remove an approved attendee' });
      }
      await pool.query(`UPDATE open_plan_requests SET status = 'removed' WHERE id = $1`, [reqId]);
      try {
        await pushService.sendPushNotification(
          pool, request.requester_id, 'member',
          'Removed from Plan',
          `You have been removed from the plan: ${plan.title}`,
          { type: 'plan_removed', planId }
        );
      } catch (e) {
        console.warn('[updateRequest] Remove push failed:', e.message);
      }
      return res.json({ success: true });
    }
  } catch (err) {
    console.error('[planRequestsController.updateRequest]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// DELETE /plans/:planId/requests/:reqId  (withdraw)
// ---------------------------------------------------------------------------
async function withdrawRequest(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const reqId = parseInt(req.params.reqId, 10);

    const result = await pool.query(
      `UPDATE open_plan_requests SET status = 'withdrawn'
       WHERE id = $1 AND requester_id = $2 AND status = 'pending'
       RETURNING id`,
      [reqId, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found, not authorized, or not in pending status' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[planRequestsController.withdrawRequest]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

module.exports = { sendRequest, getRequests, updateRequest, withdrawRequest };
