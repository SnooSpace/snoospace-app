const pushService = require('../services/pushService');
const notificationService = require('../services/notificationService');

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

    const countR = await pool.query(`SELECT created_by, title, like_count FROM open_plans WHERE id = $1`, [planId]);
    const plan = countR.rows[0];

    // Send notification to plan host (if not self)
    if (plan && plan.created_by !== userId) {
      // Get liker name
      const likerR = await pool.query(`SELECT name FROM members WHERE id = $1`, [userId]);
      const likerName = likerR.rows[0]?.name || 'Someone';

      try {
        // 1. In-app DB notification
        await notificationService.createSimpleNotification(pool, {
          recipientId: plan.created_by,
          recipientType: 'member',
          actorId: userId,
          actorType: 'member',
          type: 'plan_like',
          payload: {
            planId,
            planTitle: plan.title,
            actorName: likerName,
          },
        });

        // 2. Push notification
        await pushService.sendPushNotification(
          pool,
          plan.created_by,
          'member',
          'Plan Liked ❤️',
          `${likerName} liked your plan: "${plan.title}"`,
          {
            type: 'plan_like',
            planId,
          }
        );
      } catch (err) {
        console.warn('[likePlan] Failed to send notification:', err.message);
      }
    }

    res.json({ liked: true, like_count: plan?.like_count ?? 0 });
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

    const countR = await pool.query(`SELECT created_by, like_count FROM open_plans WHERE id = $1`, [planId]);
    const plan = countR.rows[0];

    // Deactivate/delete notification
    if (plan) {
      try {
        await pool.query(
          `DELETE FROM notifications 
           WHERE recipient_id = $1 AND recipient_type = 'member' 
             AND actor_id = $2 AND actor_type = 'member' 
             AND type = 'plan_like' 
             AND (payload->>'planId')::int = $3`,
          [plan.created_by, userId, planId]
        );
      } catch (err) {
        console.warn('[unlikePlan] Failed to remove notification:', err.message);
      }
    }

    res.json({ liked: false, like_count: plan?.like_count ?? 0 });
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
    const planR = await pool.query(`SELECT created_by, title FROM open_plans WHERE id = $1`, [planId]);
    if (planR.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    const plan = planR.rows[0];

    const insertR = await pool.query(
      `INSERT INTO open_plan_comments (plan_id, user_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [planId, userId, content.trim()]
    );
    const comment = insertR.rows[0];

    const memberR = await pool.query(
      `SELECT id, name, profile_photo_url FROM members WHERE id = $1`,
      [userId]
    );
    const commenterName = memberR.rows[0]?.name || 'Someone';

    // Notify host if commenter is not the host
    if (plan.created_by !== userId) {
      try {
        // 1. In-app DB notification
        await notificationService.createSimpleNotification(pool, {
          recipientId: plan.created_by,
          recipientType: 'member',
          actorId: userId,
          actorType: 'member',
          type: 'plan_comment',
          payload: {
            planId,
            planTitle: plan.title,
            actorName: commenterName,
            commentText: content.trim().substring(0, 100),
          },
        });

        // 2. Push notification
        await pushService.sendPushNotification(
          pool,
          plan.created_by,
          'member',
          'New Plan Comment 💬',
          `${commenterName} commented: "${content.trim().substring(0, 50)}${content.trim().length > 50 ? '...' : ''}"`,
          {
            type: 'plan_comment',
            planId,
          }
        );
      } catch (err) {
        console.warn('[addComment] Failed to send notification:', err.message);
      }
    }

    res.status(201).json({
      comment: {
        ...comment,
        commenter_id: memberR.rows[0]?.id,
        commenter_name: commenterName,
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
      pool.query(`SELECT created_by FROM open_plans WHERE id = $1`),
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

// ---------------------------------------------------------------------------
// POST /plans/:planId/share
// ---------------------------------------------------------------------------
async function sharePlan(req, res) {
  try {
    const pool = req.app.locals.pool;
    const planId = parseInt(req.params.planId, 10);
    const { recipients, shareType, message } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;

    if (!['internal', 'copy_link'].includes(shareType)) {
      return res.status(400).json({ error: 'Invalid share type' });
    }

    // Ensure share_count column exists (self-healing)
    await pool.query(`ALTER TABLE open_plans ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0`).catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS open_plan_shares (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER REFERENCES open_plans(id) ON DELETE CASCADE,
        sharer_id INTEGER NOT NULL,
        sharer_type TEXT NOT NULL,
        share_type TEXT NOT NULL,
        recipient_id INTEGER,
        recipient_type TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});

    // Verify plan exists
    const planCheck = await pool.query(
      `SELECT op.id, op.title, op.activity_type, op.custom_activity_label, op.scheduled_at,
              op.location_public, op.created_by,
              m.name AS host_name, m.profile_photo_url AS host_photo
       FROM open_plans op
       INNER JOIN members m ON op.created_by = m.id
       WHERE op.id = $1`,
      [planId]
    );

    if (planCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = planCheck.rows[0];

    if (shareType === 'copy_link') {
      await pool.query(
        `INSERT INTO open_plan_shares (plan_id, sharer_id, sharer_type, share_type)
         VALUES ($1, $2, $3, $4)`,
        [planId, userId, userType, 'copy_link']
      );

      await pool.query(
        `UPDATE open_plans SET share_count = COALESCE(share_count, 0) + 1 WHERE id = $1`,
        [planId]
      );

      const updated = await pool.query('SELECT share_count FROM open_plans WHERE id = $1', [planId]);
      return res.json({ success: true, shareCount: updated.rows[0]?.share_count || 1 });
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients required for internal sharing' });
    }

    const planPreview = {
      planId: plan.id,
      title: plan.title,
      activityType: plan.activity_type,
      customActivityLabel: plan.custom_activity_label,
      scheduledAt: plan.scheduled_at,
      locationPublic: plan.location_public,
      hostName: plan.host_name,
      hostPhoto: plan.host_photo,
      created_by: plan.created_by,
    };

    const getOrCreateConversation = async (p1Id, p1Type, p2Id, p2Type) => {
      const id1 = Number(p1Id); const id2 = Number(p2Id);
      let a1Id, a1Type, a2Id, a2Type;
      if (id1 < id2 || (id1 === id2 && p1Type < p2Type)) {
        a1Id = p1Id; a1Type = p1Type; a2Id = p2Id; a2Type = p2Type;
      } else {
        a1Id = p2Id; a1Type = p2Type; a2Id = p1Id; a2Type = p1Type;
      }
      const ins = await pool.query(
        `INSERT INTO conversations (participant1_id, participant1_type, participant2_id, participant2_type)
         VALUES ($1, $2, $3, $4) ON CONFLICT (participant1_id, participant1_type, participant2_id, participant2_type) DO NOTHING RETURNING id`,
        [a1Id, a1Type, a2Id, a2Type]
      );
      if (ins.rows.length > 0) return ins.rows[0].id;
      const sel = await pool.query(
        `SELECT id FROM conversations WHERE participant1_id=$1 AND participant1_type=$2
         AND participant2_id=$3 AND participant2_type=$4`,
        [a1Id, a1Type, a2Id, a2Type]
      );
      return sel.rows[0].id;
    };

    const blockedRecipients = [];
    const messageText = message || 'Shared a plan';

    for (const recipient of recipients) {
      if (recipient.type === 'group') {
        const convId = recipient.conversationId;
        if (!convId) { blockedRecipients.push(recipient.id); continue; }
        const cpCheck = await pool.query(
          `SELECT cp.role, c.messaging_restricted FROM conversations c
           JOIN conversation_participants cp ON cp.conversation_id = c.id
             AND cp.participant_id = $1 AND cp.participant_type = $2
           WHERE c.id = $3 AND c.is_group = true`,
          [userId, userType, convId]
        );
        if (cpCheck.rows.length === 0) { blockedRecipients.push(recipient.id); continue; }
        const { role, messaging_restricted } = cpCheck.rows[0];
        if (messaging_restricted && role !== 'admin') { blockedRecipients.push(recipient.id); continue; }
        await pool.query(
          `INSERT INTO messages (conversation_id, sender_id, sender_type, message_text, message_type, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [convId, userId, userType, messageText, 'plan_share', JSON.stringify(planPreview)]
        );
        await pool.query(`UPDATE conversations SET last_message_at = NOW() WHERE id = $1`, [convId]);
        await pool.query(
          `INSERT INTO open_plan_shares (plan_id, sharer_id, sharer_type, share_type, recipient_id, recipient_type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [planId, userId, userType, 'internal', convId, 'group']
        );
        continue;
      }

      const conversationId = await getOrCreateConversation(userId, userType, recipient.id, recipient.type);
      await pool.query(`UPDATE conversations SET last_message_at = NOW() WHERE id = $1`, [conversationId]);
      await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, sender_type, message_text, message_type, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [conversationId, userId, userType, messageText, 'plan_share', JSON.stringify(planPreview)]
      );
      await pool.query(
        `INSERT INTO open_plan_shares (plan_id, sharer_id, sharer_type, share_type, recipient_id, recipient_type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [planId, userId, userType, 'internal', recipient.id, recipient.type]
      );
    }

    const successCount = recipients.length - blockedRecipients.length;
    if (successCount === 0) {
      return res.status(403).json({ error: 'Sharing is restricted. Only admins can share here.' });
    }

    await pool.query(
      `UPDATE open_plans SET share_count = COALESCE(share_count, 0) + $1 WHERE id = $2`,
      [successCount, planId]
    );
    const updated = await pool.query('SELECT share_count FROM open_plans WHERE id = $1', [planId]);

    res.json({
      success: true,
      shareCount: updated.rows[0]?.share_count || successCount,
      recipientCount: successCount,
      blockedCount: blockedRecipients.length,
    });
  } catch (e) {
    console.error('Error sharing plan:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  likePlan,
  unlikePlan,
  recordView,
  getComments,
  addComment,
  deleteComment,
  togglePlanInterest,
  getInterestedPlans,
  sharePlan,
};
