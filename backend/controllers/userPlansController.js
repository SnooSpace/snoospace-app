// ---------------------------------------------------------------------------
// GET /users/me/plans/hosted
// ---------------------------------------------------------------------------
async function getHostedPlans(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT op.*,
         (SELECT COUNT(*)::int FROM open_plan_requests WHERE plan_id = op.id AND status = 'approved') as accepted_count,
         (SELECT COUNT(*)::int FROM open_plan_requests WHERE plan_id = op.id AND status = 'pending')  as pending_count,
         json_build_object(
           'id', m.id,
           'name', m.name,
           'is_verified', m.is_verified,
           'profile_photo_url', m.profile_photo_url
         ) as host_profile
       FROM open_plans op
       JOIN members m ON m.id = op.created_by
       WHERE op.created_by = $1
         AND op.parent_plan_id IS NULL
       ORDER BY op.scheduled_at DESC`,
      [userId]
    );

    res.json({ plans: result.rows });
  } catch (err) {
    console.error('[userPlansController.getHostedPlans]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// GET /users/me/plans/attending
// ---------------------------------------------------------------------------
async function getAttendingPlans(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT op.*, opr.status as my_request_status,
         (SELECT COUNT(*)::int FROM open_plan_requests WHERE plan_id = op.id AND status = 'approved') as accepted_count,
         json_build_object(
           'id', m.id,
           'name', m.name,
           'is_verified', m.is_verified,
           'profile_photo_url', m.profile_photo_url
         ) as host_profile
       FROM open_plan_requests opr
       JOIN open_plans op ON op.id = opr.plan_id
       JOIN members m ON m.id = op.created_by
       WHERE opr.requester_id = $1 AND opr.status = 'approved'
       ORDER BY op.scheduled_at ASC`,
      [userId]
    );

    res.json({ plans: result.rows });
  } catch (err) {
    console.error('[userPlansController.getAttendingPlans]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

module.exports = { getHostedPlans, getAttendingPlans };
