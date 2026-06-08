const { createPool } = require("../config/db");

const pool = createPool();

// Ensure all engagement columns and tables exist on opportunities (idempotent, runs once at startup)
const ensureOpportunityColumns = async () => {
  try {
    await pool.query(`
      ALTER TABLE opportunities
        ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS save_count INTEGER DEFAULT 0
    `);
    // Ensure engagement tables exist so EXISTS() subqueries never crash
    await pool.query(`
      CREATE TABLE IF NOT EXISTS opportunity_likes (
        id SERIAL PRIMARY KEY,
        opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
        liker_id INTEGER NOT NULL,
        liker_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(opportunity_id, liker_id, liker_type)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS opportunity_saves (
        id SERIAL PRIMARY KEY,
        opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
        saver_id INTEGER NOT NULL,
        saver_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(opportunity_id, saver_id, saver_type)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS opportunity_views (
        id SERIAL PRIMARY KEY,
        opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
        viewer_id INTEGER NOT NULL,
        viewer_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(opportunity_id, viewer_id, viewer_type)
      )
    `);
  } catch (e) {
    console.warn("[opportunityController] ensureOpportunityColumns warning:", e.message);
  }
};
ensureOpportunityColumns();

// ============================================
// CREATE OPPORTUNITY
// ============================================
const createOpportunity = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    // Only communities can create opportunities (for now)
    if (!userId || (userType !== "community" && userType !== "member")) {
      return res
        .status(403)
        .json({ error: "Authentication required to create opportunities" });
    }

    const {
      title,
      opportunity_types,
      work_type,
      work_mode,
      event_id,
      experience_level,
      availability,
      turnaround,
      timezone,
      expires_at,
      payment_type,
      budget_range,
      payment_nature,
      trial_type,
      eligibility_mode,
      visibility,
      notify_talent,
      requires_resume,
      skill_groups,
      questions,
      status, // 'draft' or 'active'
      about_role,
      responsibilities,
      who_can_apply,
      gains,
    } = req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (
      !opportunity_types ||
      !Array.isArray(opportunity_types) ||
      opportunity_types.length === 0
    ) {
      return res
        .status(400)
        .json({ error: "At least one opportunity type is required" });
    }

    if (opportunity_types.length > 5) {
      return res
        .status(400)
        .json({ error: "Maximum 5 opportunity types allowed" });
    }

    if (!availability || !turnaround) {
      return res
        .status(400)
        .json({ error: "Availability and turnaround are required" });
    }

    // Insert opportunity
    const query = `
      INSERT INTO opportunities (
        title, creator_id, creator_type, status,
        opportunity_types, work_type, work_mode, event_id,
        experience_level, availability, turnaround, timezone, expires_at,
        payment_type, budget_range, payment_nature, trial_type,
        eligibility_mode, visibility, notify_talent, requires_resume,
        about_role, responsibilities, who_can_apply, gains
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING *
    `;

    const values = [
      title.trim(),
      userId,
      userType,
      status || "draft",
      opportunity_types,
      work_type || "one_time",
      work_mode || "remote",
      event_id || null,
      experience_level || "any",
      availability,
      turnaround,
      timezone || null,
      expires_at || null,
      payment_type || "fixed",
      budget_range || null,
      payment_nature || "paid",
      payment_nature === "trial" ? (trial_type || "paid_trial") : null,
      eligibility_mode || "any_one",
      visibility || "public",
      notify_talent !== false,
      requires_resume === true,
      about_role || null,
      responsibilities || [],
      who_can_apply || [],
      gains || [],
    ];

    const result = await pool.query(query, values);
    const opportunityId = result.rows[0].id;

    // Insert skill groups
    if (
      skill_groups &&
      Array.isArray(skill_groups) &&
      skill_groups.length > 0
    ) {
      const skillInserts = skill_groups.map((group, index) =>
        pool.query(
          `INSERT INTO opportunity_skill_groups (opportunity_id, role, tools, sample_type, display_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            opportunityId,
            group.role,
            group.tools || [],
            group.sample_type || null,
            index,
          ],
        ),
      );
      await Promise.all(skillInserts);
    }

    // Insert questions
    if (questions && Array.isArray(questions) && questions.length > 0) {
      // Enforce limits
      if (questions.length > 4) {
        return res
          .status(400)
          .json({ error: "Maximum 4 custom questions allowed" });
      }

      const requiredCount = questions.filter((q) => q.required).length;
      if (requiredCount > 2) {
        return res
          .status(400)
          .json({ error: "Maximum 2 required questions allowed" });
      }

      const questionInserts = questions.map((q, index) =>
        pool.query(
          `INSERT INTO opportunity_questions (opportunity_id, question_type, prompt, required, display_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            opportunityId,
            q.question_type || "short_text",
            q.prompt,
            q.required || false,
            index,
          ],
        ),
      );
      await Promise.all(questionInserts);
    }

    // Fetch the complete opportunity with related data
    const opportunity = await getOpportunityById(opportunityId);

    res.status(201).json({
      success: true,
      opportunity,
      message:
        status === "active"
          ? "Opportunity published successfully"
          : "Draft saved successfully",
    });
  } catch (error) {
    console.error("Error creating opportunity:", error);
    res
      .status(500)
      .json({ error: "Failed to create opportunity", details: error.message });
  }
};

// ============================================
// GET OPPORTUNITIES (Creator's list)
// ============================================
const getOpportunities = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { status } = req.query; // 'active', 'closed', 'draft'

    let statusFilter = "";
    const params = [userId, userType];

    if (status) {
      statusFilter = "AND o.status = $3";
      params.push(status);
    }

    const query = `
      SELECT 
        o.id,
        o.title,
        o.status,
        o.opportunity_types,
        o.work_type,
        o.work_mode,
        o.payment_type,
        o.payment_nature,
        o.trial_type,
        o.budget_range,
        o.visibility,
        o.applicant_count,
        o.availability,
        o.experience_level,
        o.expires_at,
        o.closed_at,
        o.created_at,
        o.updated_at,
        o.creator_id,
        o.creator_type,
        COALESCE(o.is_pinned, FALSE) as is_pinned,
        COALESCE(o.like_count, 0) as like_count,
        COALESCE(o.view_count, 0) as view_count,
        COALESCE(o.comment_count, 0) as comment_count,
        COALESCE(o.save_count, 0) as save_count,
        COALESCE(o.share_count, 0) as share_count,
        COALESCE(
          (SELECT COUNT(*) FROM opportunity_applications oa 
           WHERE oa.opportunity_id = o.id AND oa.status = 'shortlisted'),
          0
        ) as shortlisted_count
      FROM opportunities o
      WHERE o.creator_id = $1 AND o.creator_type = $2
      ${statusFilter}
      ORDER BY COALESCE(o.is_pinned, FALSE) DESC, o.created_at DESC
    `;

    const result = await pool.query(query, params);

    // Build a set of liked/saved opportunity IDs for this user (safe: tables may not exist yet)
    const opportunityIds = result.rows.map((r) => r.id);
    let likedSet = new Set();
    let savedSet = new Set();
    if (opportunityIds.length > 0) {
      try {
        const likedRes = await pool.query(
          `SELECT opportunity_id FROM opportunity_likes
           WHERE opportunity_id = ANY($1) AND liker_id = $2 AND liker_type = $3`,
          [opportunityIds, userId, userType]
        );
        likedRes.rows.forEach((r) => likedSet.add(r.opportunity_id));
      } catch (_) { /* table may not exist yet */ }
      try {
        const savedRes = await pool.query(
          `SELECT opportunity_id FROM opportunity_saves
           WHERE opportunity_id = ANY($1) AND saver_id = $2 AND saver_type = $3`,
          [opportunityIds, userId, userType]
        );
        savedRes.rows.forEach((r) => savedSet.add(r.opportunity_id));
      } catch (_) { /* table may not exist yet */ }
    }

    // Batch-fetch skill groups for all opportunities in a single query (eliminates N+1)
    const oppIds = result.rows.map((r) => r.id);
    let allSkillGroups = [];
    if (oppIds.length > 0) {
      const sgBatch = await pool.query(
        `SELECT opportunity_id, role, tools, sample_type FROM opportunity_skill_groups 
         WHERE opportunity_id = ANY($1) ORDER BY display_order`,
        [oppIds],
      );
      allSkillGroups = sgBatch.rows;
    }
    const skillGroupsByOpp = {};
    for (const sg of allSkillGroups) {
      if (!skillGroupsByOpp[sg.opportunity_id]) skillGroupsByOpp[sg.opportunity_id] = [];
      skillGroupsByOpp[sg.opportunity_id].push(sg);
    }

    const opportunities = result.rows.map((opp) => ({
      ...opp,
      is_liked: likedSet.has(opp.id),
      is_saved: savedSet.has(opp.id),
      skill_groups: skillGroupsByOpp[opp.id] || [],
    }));

    res.json({
      success: true,
      opportunities,
    });
  } catch (error) {
    console.error("Error getting opportunities:", error);
    res.status(500).json({ error: "Failed to get opportunities" });
  }
};

// ============================================
// GET OPPORTUNITY DETAIL
// ============================================
const getOpportunityDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    const opportunity = await getOpportunityById(id);

    if (!opportunity) {
      return res.status(404).json({ error: "Opportunity not found" });
    }

    // Check access
    const isCreator =
      opportunity.creator_id === userId &&
      opportunity.creator_type === userType;
    const isPublic =
      opportunity.visibility === "public" && opportunity.status === "active";

    if (!isCreator && !isPublic) {
      return res.status(403).json({ error: "Access denied" });
    }

    // If creator, include applications summary
    if (isCreator) {
      const applicationsResult = await pool.query(
        `SELECT 
          status,
          COUNT(*) as count
         FROM opportunity_applications
         WHERE opportunity_id = $1
         GROUP BY status`,
        [id],
      );

      opportunity.application_stats = applicationsResult.rows.reduce(
        (acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        },
        { pending: 0, shortlisted: 0, rejected: 0, withdrawn: 0 },
      );
    }

    // Check if the current user has already applied (non-creators only)
    let hasApplied = false;
    if (!isCreator && userId && userType === "member") {
      try {
        const appliedCheck = await pool.query(
          `SELECT id FROM opportunity_applications 
           WHERE opportunity_id = $1 AND applicant_id = $2 AND applicant_type = $3
           LIMIT 1`,
          [id, userId, userType],
        );
        hasApplied = appliedCheck.rows.length > 0;
      } catch (_) {
        // table may not exist yet, default to false
      }
    }

    res.json({
      success: true,
      opportunity,
      is_creator: isCreator,
      has_applied: hasApplied,
    });
  } catch (error) {
    console.error("Error getting opportunity detail:", error);
    res.status(500).json({ error: "Failed to get opportunity" });
  }
};

// ============================================
// UPDATE OPPORTUNITY
// ============================================
const updateOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    // Check ownership
    const ownerCheck = await pool.query(
      `SELECT id, status FROM opportunities WHERE id = $1 AND creator_id = $2 AND creator_type = $3`,
      [id, userId, userType],
    );

    if (ownerCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Opportunity not found or access denied" });
    }

    const {
      title,
      opportunity_types,
      work_type,
      work_mode,
      event_id,
      experience_level,
      availability,
      turnaround,
      timezone,
      expires_at,
      payment_type,
      budget_range,
      payment_nature,
      trial_type,
      eligibility_mode,
      visibility,
      notify_talent,
      requires_resume,
      skill_groups,
      questions,
      status,
      about_role,
      responsibilities,
      who_can_apply,
      gains,
    } = req.body;

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    const addUpdate = (field, value) => {
      if (value !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    };

    addUpdate("title", title?.trim());
    addUpdate("opportunity_types", opportunity_types);
    addUpdate("work_type", work_type);
    addUpdate("work_mode", work_mode);
    addUpdate("event_id", event_id);
    addUpdate("experience_level", experience_level);
    addUpdate("availability", availability);
    addUpdate("turnaround", turnaround);
    addUpdate("timezone", timezone);
    addUpdate("expires_at", expires_at);
    addUpdate("payment_type", payment_type);
    addUpdate("budget_range", budget_range);
    addUpdate("payment_nature", payment_nature);
    addUpdate("eligibility_mode", eligibility_mode);
    addUpdate("visibility", visibility);
    addUpdate("notify_talent", notify_talent);
    addUpdate("requires_resume", requires_resume);
    addUpdate("status", status);
    addUpdate("about_role", about_role);
    addUpdate("responsibilities", responsibilities);
    addUpdate("who_can_apply", who_can_apply);
    addUpdate("gains", gains);
    addUpdate("trial_type", trial_type);

    if (updates.length > 0) {
      values.push(id);
      const query = `
        UPDATE opportunities 
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      await pool.query(query, values);
    }

    // Update skill groups if provided
    if (skill_groups && Array.isArray(skill_groups)) {
      // Delete existing and re-insert
      await pool.query(
        `DELETE FROM opportunity_skill_groups WHERE opportunity_id = $1`,
        [id],
      );

      const skillInserts = skill_groups.map((group, index) =>
        pool.query(
          `INSERT INTO opportunity_skill_groups (opportunity_id, role, tools, sample_type, display_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, group.role, group.tools || [], group.sample_type || null, index],
        ),
      );
      await Promise.all(skillInserts);
    }

    // Update questions if provided
    if (questions && Array.isArray(questions)) {
      if (questions.length > 4) {
        return res
          .status(400)
          .json({ error: "Maximum 4 custom questions allowed" });
      }

      const requiredCount = questions.filter((q) => q.required).length;
      if (requiredCount > 2) {
        return res
          .status(400)
          .json({ error: "Maximum 2 required questions allowed" });
      }

      // Delete existing and re-insert
      await pool.query(
        `DELETE FROM opportunity_questions WHERE opportunity_id = $1`,
        [id],
      );

      const questionInserts = questions.map((q, index) =>
        pool.query(
          `INSERT INTO opportunity_questions (opportunity_id, question_type, prompt, required, display_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            id,
            q.question_type || "short_text",
            q.prompt,
            q.required || false,
            index,
          ],
        ),
      );
      await Promise.all(questionInserts);
    }

    const opportunity = await getOpportunityById(id);

    res.json({
      success: true,
      opportunity,
      message: "Opportunity updated successfully",
    });
  } catch (error) {
    console.error("Error updating opportunity:", error);
    res.status(500).json({ error: "Failed to update opportunity" });
  }
};

// ============================================
// CLOSE/DELETE OPPORTUNITY
// ============================================
const closeOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { action } = req.query; // 'close' or 'delete'

    // Check ownership
    const ownerCheck = await pool.query(
      `SELECT id, status FROM opportunities WHERE id = $1 AND creator_id = $2 AND creator_type = $3`,
      [id, userId, userType],
    );

    if (ownerCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Opportunity not found or access denied" });
    }

    if (action === "delete") {
      // Hard delete (cascades to skill_groups, questions, applications)
      await pool.query(`DELETE FROM opportunities WHERE id = $1`, [id]);
      res.json({
        success: true,
        message: "Opportunity deleted successfully",
      });
    } else {
      // Soft close
      await pool.query(
        `UPDATE opportunities SET status = 'closed', closed_at = NOW() WHERE id = $1`,
        [id],
      );
      res.json({
        success: true,
        message: "Opportunity closed successfully",
      });
    }
  } catch (error) {
    console.error("Error closing/deleting opportunity:", error);
    res.status(500).json({ error: "Failed to close/delete opportunity" });
  }
};

// ============================================
// DISCOVER OPPORTUNITIES (Public browse)
// ============================================
const discoverOpportunities = async (req, res) => {
  try {
    const { role, payment_type, work_mode, limit = 20, offset = 0 } = req.query;

    let filters = [`o.status = 'active'`, `o.visibility = 'public'`];
    const params = [];
    let paramIndex = 1;

    if (role) {
      filters.push(`$${paramIndex} = ANY(o.opportunity_types)`);
      params.push(role);
      paramIndex++;
    }

    if (payment_type) {
      filters.push(`o.payment_type = $${paramIndex}`);
      params.push(payment_type);
      paramIndex++;
    }

    if (work_mode) {
      filters.push(`o.work_mode = $${paramIndex}`);
      params.push(work_mode);
      paramIndex++;
    }

    params.push(parseInt(limit), parseInt(offset));

    const query = `
      SELECT 
        o.id,
        o.title,
        o.opportunity_types,
        o.work_type,
        o.work_mode,
        o.payment_type,
        o.payment_nature,
        o.trial_type,
        o.budget_range,
        o.experience_level,
        o.created_at,
        o.creator_id,
        o.creator_type,
        o.expires_at,
        o.closed_at,
        CASE 
          WHEN o.creator_type = 'community' THEN c.name
          WHEN o.creator_type = 'member' THEN m.name
        END as creator_name,
        CASE 
          WHEN o.creator_type = 'community' THEN c.logo_url
          WHEN o.creator_type = 'member' THEN m.profile_photo_url
        END as creator_photo,
        CASE 
          WHEN o.creator_type = 'community' THEN c.username
          WHEN o.creator_type = 'member' THEN m.username
        END as creator_username
      FROM opportunities o
      LEFT JOIN communities c ON o.creator_id::integer = c.id AND o.creator_type = 'community'
      LEFT JOIN members m ON o.creator_id::integer = m.id AND o.creator_type = 'member'
      WHERE ${filters.join(" AND ")}
      ORDER BY o.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await pool.query(query, params);

    // Batch-fetch skill groups for all opportunities in a single query (eliminates N+1)
    const discoverOppIds = result.rows.map((r) => r.id);
    let discoverSkillGroups = [];
    if (discoverOppIds.length > 0) {
      const sgBatch = await pool.query(
        `SELECT opportunity_id, role, tools, sample_type FROM opportunity_skill_groups 
         WHERE opportunity_id = ANY($1) ORDER BY display_order`,
        [discoverOppIds],
      );
      discoverSkillGroups = sgBatch.rows;
    }
    const discoverSGByOpp = {};
    for (const sg of discoverSkillGroups) {
      if (!discoverSGByOpp[sg.opportunity_id]) discoverSGByOpp[sg.opportunity_id] = [];
      discoverSGByOpp[sg.opportunity_id].push(sg);
    }

    const opportunities = result.rows.map((opp) => ({
      ...opp,
      skill_groups: discoverSGByOpp[opp.id] || [],
    }));

    res.json({
      success: true,
      opportunities,
    });
  } catch (error) {
    console.error("Error discovering opportunities:", error);
    res.status(500).json({ error: "Failed to get opportunities" });
  }
};

// ============================================
// HELPER: Get opportunity by ID with all related data
// ============================================
const getOpportunityById = async (id) => {
  const oppResult = await pool.query(
    `SELECT 
      o.*,
      CASE 
        WHEN o.creator_type = 'community' THEN c.name
        WHEN o.creator_type = 'member' THEN m.name
      END as creator_name,
      CASE 
        WHEN o.creator_type = 'community' THEN c.logo_url
        WHEN o.creator_type = 'member' THEN m.profile_photo_url
      END as creator_photo,
      CASE 
        WHEN o.creator_type = 'community' THEN c.username
        WHEN o.creator_type = 'member' THEN m.username
      END as creator_username
    FROM opportunities o
    LEFT JOIN communities c ON o.creator_id::integer = c.id AND o.creator_type = 'community'
    LEFT JOIN members m ON o.creator_id::integer = m.id AND o.creator_type = 'member'
    WHERE o.id = $1`,
    [id],
  );

  if (oppResult.rows.length === 0) {
    return null;
  }

  const opportunity = oppResult.rows[0];

  // Fetch skill groups
  const skillGroupsResult = await pool.query(
    `SELECT id, role, tools, sample_type, display_order 
     FROM opportunity_skill_groups 
     WHERE opportunity_id = $1 
     ORDER BY display_order`,
    [id],
  );
  opportunity.skill_groups = skillGroupsResult.rows;

  // Fetch questions
  const questionsResult = await pool.query(
    `SELECT id, question_type, prompt, required, display_order 
     FROM opportunity_questions 
     WHERE opportunity_id = $1 
     ORDER BY display_order`,
    [id],
  );
  opportunity.questions = questionsResult.rows;

  return opportunity;
};

// ============================================
// APPLY TO OPPORTUNITY
// ============================================
const applyToOpportunity = async (req, res) => {
  try {
    const userId = parseInt(req.user?.id, 10);
    const userType = req.user?.type;

    if (!userId || isNaN(userId) || userType !== "member") {
      return res
        .status(403)
        .json({ error: "Only members can apply to opportunities" });
    }

    const {
      opportunity_id,
      applied_role,
      portfolio_link,
      portfolio_note,
      responses,
      intro_pitch,
      portfolio_links,
      resume_url,
      resume_filename,
      resume_size_bytes,
      applicant_questions,
    } = req.body;

    if (!opportunity_id || !applied_role) {
      return res
        .status(400)
        .json({ error: "Opportunity ID and role are required" });
    }

    // Check opportunity exists and is active
    const oppCheck = await pool.query(
      `SELECT id, status, opportunity_types FROM opportunities WHERE id = $1`,
      [opportunity_id],
    );

    if (oppCheck.rows.length === 0) {
      return res.status(404).json({ error: "Opportunity not found" });
    }

    const opp = oppCheck.rows[0];
    if (opp.status !== "active") {
      return res.status(400).json({
        error: "This opportunity is no longer accepting applications",
      });
    }

    if (!opp.opportunity_types.includes(applied_role)) {
      return res
        .status(400)
        .json({ error: "Invalid role for this opportunity" });
    }

    // Check if already applied
    const existingApp = await pool.query(
      `SELECT id FROM opportunity_applications WHERE opportunity_id = $1 AND applicant_id = $2`,
      [opportunity_id, userId],
    );

    if (existingApp.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "You have already applied to this opportunity" });
    }

    // Insert application
    const appResult = await pool.query(
      `INSERT INTO opportunity_applications (
        opportunity_id, applicant_id, applicant_type, applied_role, portfolio_link, portfolio_note, 
        intro_pitch, portfolio_links, resume_url, resume_filename, resume_size_bytes, applicant_questions
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        opportunity_id,
        userId,
        userType,
        applied_role,
        portfolio_link || null,
        portfolio_note || null,
        intro_pitch || null,
        Array.isArray(portfolio_links) ? portfolio_links.filter(Boolean) : [],
        resume_url || null,
        resume_filename || null,
        resume_size_bytes || null,
        Array.isArray(applicant_questions) ? applicant_questions.filter(Boolean) : [],
      ],
    );

    const applicationId = appResult.rows[0].id;

    // Insert responses if any
    if (responses && Array.isArray(responses) && responses.length > 0) {
      const responseInserts = responses.map((r) =>
        pool.query(
          `INSERT INTO opportunity_application_responses (application_id, question_id, response_text)
           VALUES ($1, $2, $3)`,
          [applicationId, r.question_id, r.answer || ""],
        ),
      );
      await Promise.all(responseInserts);
    }

    res.status(201).json({
      success: true,
      application: appResult.rows[0],
      message: "Application submitted successfully",
    });
  } catch (error) {
    console.error("Error applying to opportunity:", error);
    res.status(500).json({ error: "Failed to submit application" });
  }
};

// ============================================
// GET APPLICATIONS (Creator view)
// ============================================
const getApplications = async (req, res) => {
  try {
    const { id: opportunityId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { status, role } = req.query;

    // Verify ownership
    const ownerCheck = await pool.query(
      `SELECT id FROM opportunities WHERE id = $1 AND creator_id = $2 AND creator_type = $3`,
      [opportunityId, userId, userType],
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    let filters = [`oa.opportunity_id = $1`];
    const params = [opportunityId];
    let paramIndex = 2;

    if (status) {
      filters.push(`oa.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (role) {
      filters.push(`oa.applied_role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    const query = `
      SELECT 
        oa.*,
        m.name as applicant_name,
        m.username as applicant_username,
        m.profile_photo_url as applicant_photo
      FROM opportunity_applications oa
      JOIN members m ON oa.applicant_id = m.id
      WHERE ${filters.join(" AND ")}
      ORDER BY oa.created_at DESC
    `;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      applications: result.rows,
    });
  } catch (error) {
    console.error("Error getting applications:", error);
    res.status(500).json({ error: "Failed to get applications" });
  }
};

// ============================================
// GET APPLICATION DETAIL
// ============================================
const getApplicationDetail = async (req, res) => {
  try {
    const { id: applicationId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    const query = `
      SELECT 
        oa.*,
        oa.resume_filename,
        oa.resume_size_bytes,
        m.name as applicant_name,
        m.username as applicant_username,
        m.profile_photo_url as applicant_photo,
        m.bio as applicant_bio,
        o.title as opportunity_title,
        o.creator_id,
        o.creator_type
      FROM opportunity_applications oa
      JOIN members m ON oa.applicant_id = m.id
      JOIN opportunities o ON oa.opportunity_id = o.id
      WHERE oa.id = $1
    `;

    const result = await pool.query(query, [applicationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Application not found" });
    }

    const application = result.rows[0];

    // Check access: creator or applicant
    const isCreator =
      application.creator_id === userId &&
      application.creator_type === userType;
    const isApplicant =
      application.applicant_id === userId && userType === "member";

    if (!isCreator && !isApplicant) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Fetch responses — LEFT JOIN from questions so ALL creator questions appear
    // even if the applicant left an answer blank or the INSERT failed.
    const responsesResult = await pool.query(
      `SELECT
         oq.id            AS question_id,
         oq.prompt,
         oq.question_type,
         oq.required,
         oq.display_order,
         oar.id           AS response_id,
         oar.response_text
       FROM opportunity_questions oq
       LEFT JOIN opportunity_application_responses oar
         ON oar.question_id = oq.id AND oar.application_id = $1
       WHERE oq.opportunity_id = (
         SELECT opportunity_id FROM opportunity_applications WHERE id = $1
       )
       ORDER BY oq.display_order`,
      [applicationId],
    );

    application.responses = responsesResult.rows;

    res.json({
      success: true,
      application,
      is_creator: isCreator,
    });
  } catch (error) {
    console.error("Error getting application detail:", error);
    res.status(500).json({ error: "Failed to get application" });
  }
};

// ============================================
// UPDATE APPLICATION STATUS
// ============================================
const updateApplicationStatus = async (req, res) => {
  try {
    const { id: applicationId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { status, creator_note } = req.body;

    // Validate status
    const validStatuses = ["pending", "shortlisted", "rejected", "withdrawn"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Get application and verify ownership
    const appQuery = await pool.query(
      `SELECT oa.*, o.creator_id, o.creator_type
       FROM opportunity_applications oa
       JOIN opportunities o ON oa.opportunity_id = o.id
       WHERE oa.id = $1`,
      [applicationId],
    );

    if (appQuery.rows.length === 0) {
      return res.status(404).json({ error: "Application not found" });
    }

    const app = appQuery.rows[0];
    const isCreator =
      app.creator_id === userId && app.creator_type === userType;
    const isApplicant = app.applicant_id === userId && userType === "member";

    // Only creator can shortlist/reject, only applicant can withdraw
    if (status === "withdrawn" && !isApplicant) {
      return res.status(403).json({ error: "Only the applicant can withdraw" });
    }
    if ((status === "shortlisted" || status === "rejected") && !isCreator) {
      return res
        .status(403)
        .json({ error: "Only the creator can update status" });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (creator_note !== undefined && isCreator) {
      updates.push(`creator_note = $${paramIndex}`);
      values.push(creator_note);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }

    values.push(applicationId);
    const updateQuery = `
      UPDATE opportunity_applications
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);

    res.json({
      success: true,
      application: result.rows[0],
      message: `Application ${status || "updated"} successfully`,
    });
  } catch (error) {
    console.error("Error updating application:", error);
    res.status(500).json({ error: "Failed to update application" });
  }
};

// ============================================
// GET OPPORTUNITIES FROM FOLLOWED COMMUNITIES (For Home Feed)
// ============================================
const getFollowedOpportunities = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "member") {
      return res.status(403).json({ error: "Only members can access this" });
    }

    const { limit = 5 } = req.query;

    // Get opportunities from communities the user follows
    const query = `
      SELECT 
        o.id,
        o.title,
        o.opportunity_types,
        o.work_type,
        o.work_mode,
        o.payment_type,
        o.payment_nature,
        o.trial_type,
        o.budget_range,
        o.expires_at,
        o.closed_at,
        COALESCE(o.applicant_count, 0) as applicant_count,
        COALESCE(o.like_count, 0) as like_count,
        COALESCE(o.view_count, 0) as view_count,
        COALESCE(o.comment_count, 0) as comment_count,
        COALESCE(o.save_count, 0) as save_count,
        COALESCE(o.share_count, 0) as share_count,
        o.created_at,
        o.creator_id,
        o.creator_type,
        c.name as creator_name,
        c.logo_url as creator_photo,
        c.username as creator_username
      FROM opportunities o
      JOIN follows f ON f.following_id = o.creator_id::integer AND f.following_type = 'community'
      JOIN communities c ON o.creator_id::integer = c.id
      WHERE o.status = 'active'
        AND o.creator_type = 'community'
        AND f.follower_id = $1
        AND f.follower_type = $2
      ORDER BY o.created_at DESC
      LIMIT $3
    `;

    console.log("[getFollowedOpportunities] userId:", userId, "userType:", userType, "limit:", limit);
    const result = await pool.query(query, [userId, userType, parseInt(limit)]);
    console.log(
      "[getFollowedOpportunities] Found opportunities:",
      result.rows.length,
    );

    // Build liked/saved sets (safe: tables may not exist yet)
    const opportunityIds = result.rows.map((r) => r.id);
    let likedSet = new Set();
    let savedSet = new Set();
    if (opportunityIds.length > 0) {
      try {
        const likedRes = await pool.query(
          `SELECT opportunity_id FROM opportunity_likes
           WHERE opportunity_id = ANY($1) AND liker_id = $2 AND liker_type = $3`,
          [opportunityIds, userId, userType]
        );
        likedRes.rows.forEach((r) => likedSet.add(r.opportunity_id));
      } catch (_) { /* table may not exist yet */ }
      try {
        const savedRes = await pool.query(
          `SELECT opportunity_id FROM opportunity_saves
           WHERE opportunity_id = ANY($1) AND saver_id = $2 AND saver_type = $3`,
          [opportunityIds, userId, userType]
        );
        savedRes.rows.forEach((r) => savedSet.add(r.opportunity_id));
      } catch (_) { /* table may not exist yet */ }
    }

    // Batch-fetch skill groups for all opportunities in a single query (eliminates N+1)
    const followedOppIds = result.rows.map((r) => r.id);
    let followedSkillGroups = [];
    if (followedOppIds.length > 0) {
      const sgBatch = await pool.query(
        `SELECT opportunity_id, role, tools, sample_type FROM opportunity_skill_groups 
         WHERE opportunity_id = ANY($1) ORDER BY display_order`,
        [followedOppIds],
      );
      followedSkillGroups = sgBatch.rows;
    }
    const followedSGByOpp = {};
    for (const sg of followedSkillGroups) {
      if (!followedSGByOpp[sg.opportunity_id]) followedSGByOpp[sg.opportunity_id] = [];
      followedSGByOpp[sg.opportunity_id].push(sg);
    }

    // Fetch skill groups for each opportunity (include tools so frontend can show skill chips)
    const opportunities = result.rows.map((opp) => {
      const skillGroups = followedSGByOpp[opp.id] || [];
      return {
        ...opp,
        is_liked: likedSet.has(opp.id),
        is_saved: savedSet.has(opp.id),
        skill_groups: skillGroups,
        // Keep legacy 'roles' field for backward compatibility
        roles: skillGroups.map((r) => r.role),
      };
    });

    console.log(
      "[getFollowedOpportunities] skill_groups sample:",
      JSON.stringify(opportunities[0]?.skill_groups?.slice(0, 2)),
    );

    res.json({
      success: true,
      opportunities,
    });
  } catch (error) {
    console.error("Error getting followed opportunities:", error);
    res.status(500).json({ error: "Failed to get opportunities" });
  }
};

// ============================================
// GET COMMUNITY'S PUBLIC OPPORTUNITIES
// Used by CommunityPublicProfileScreen to show opportunity cards
// ============================================
const getCommunityOpportunities = async (req, res) => {
  try {
    const { communityId } = req.params;
    const viewerId = req.user?.id || null;
    const viewerType = req.user?.type || null;

    const query = `
      SELECT 
        o.id,
        o.title,
        o.status,
        o.opportunity_types,
        o.work_type,
        o.work_mode,
        o.payment_type,
        o.payment_nature,
        o.trial_type,
        o.budget_range,
        o.availability,
        o.experience_level,
        o.expires_at,
        o.closed_at,
        o.created_at,
        o.creator_id,
        o.creator_type,
        COALESCE(o.applicant_count, 0) as applicant_count,
        COALESCE(o.like_count, 0) as like_count,
        COALESCE(o.view_count, 0) as view_count,
        COALESCE(o.comment_count, 0) as comment_count,
        COALESCE(o.save_count, 0) as save_count,
        COALESCE(o.share_count, 0) as share_count,
        o.is_pinned,
        c.name as creator_name,
        c.logo_url as creator_photo,
        c.username as creator_username,
        CASE WHEN $2::integer IS NOT NULL THEN EXISTS(
          SELECT 1 FROM opportunity_likes ol
          WHERE ol.opportunity_id = o.id AND ol.liker_id = $2 AND ol.liker_type = $3
        ) ELSE false END AS is_liked,
        CASE WHEN $2::integer IS NOT NULL THEN EXISTS(
          SELECT 1 FROM opportunity_saves os
          WHERE os.opportunity_id = o.id AND os.saver_id = $2 AND os.saver_type = $3
        ) ELSE false END AS is_saved
      FROM opportunities o
      LEFT JOIN communities c ON o.creator_id::integer = c.id
      WHERE o.creator_id = $1
        AND o.creator_type = 'community'
        AND o.status IN ('active', 'draft')
        AND o.visibility = 'public'
      ORDER BY COALESCE(o.is_pinned, FALSE) DESC, o.created_at DESC
    `;

    const result = await pool.query(query, [communityId, viewerId, viewerType]);


    // Batch-fetch skill groups (eliminates N+1)
    const communityOppIds = result.rows.map((r) => r.id);
    let communitySkillGroups = [];
    if (communityOppIds.length > 0) {
      const sgBatch = await pool.query(
        `SELECT opportunity_id, role, tools FROM opportunity_skill_groups 
         WHERE opportunity_id = ANY($1) ORDER BY display_order`,
        [communityOppIds],
      );
      communitySkillGroups = sgBatch.rows;
    }
    const communitySGByOpp = {};
    for (const sg of communitySkillGroups) {
      if (!communitySGByOpp[sg.opportunity_id]) communitySGByOpp[sg.opportunity_id] = [];
      communitySGByOpp[sg.opportunity_id].push(sg);
    }

    const opportunities = result.rows.map((opp) => ({
      ...opp,
      skill_groups: communitySGByOpp[opp.id] || [],
    }));

    res.json({ success: true, opportunities });
  } catch (error) {
    console.error("Error getting community opportunities:", error);
    res.status(500).json({ error: "Failed to get opportunities" });
  }
};

// ============================================
// PIN / UNPIN OPPORTUNITY
// ============================================
const pinOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify ownership
    const check = await pool.query(
      `SELECT id FROM opportunities WHERE id = $1 AND creator_id = $2 AND creator_type = $3`,
      [id, userId, userType],
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Opportunity not found or access denied" });
    }

    // Add is_pinned column if not exists (idempotent)
    try {
      await pool.query(
        `ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE`,
      );
    } catch (e) { /* already exists */ }

    // Pin the requested opportunity (frontend manages the 3-pin cap)
    await pool.query(
      `UPDATE opportunities SET is_pinned = TRUE WHERE id = $1`,
      [id],
    );

    res.json({ success: true, pinned: true });
  } catch (error) {
    console.error("Error pinning opportunity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const unpinOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify ownership
    const check = await pool.query(
      `SELECT id FROM opportunities WHERE id = $1 AND creator_id = $2 AND creator_type = $3`,
      [id, userId, userType],
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Opportunity not found or access denied" });
    }

    await pool.query(
      `UPDATE opportunities SET is_pinned = FALSE WHERE id = $1`,
      [id],
    );

    res.json({ success: true, pinned: false });
  } catch (error) {
    console.error("Error unpinning opportunity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ============================================
// OPPORTUNITY ENGAGEMENT — Like / Save / View
// These act directly on the opportunities table (UUID ids),
// bypassing the posts table which only accepts integer ids.
// ============================================

/**
 * POST /opportunities/:id/like
 * Toggle like on an opportunity (idempotent — 400 if already liked).
 */
const likeOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || !userType) return res.status(401).json({ error: 'Authentication required' });

    // Ensure columns exist (safe to run repeatedly)
    await pool.query(`ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0`);

    // Use a dedicated table for opportunity likes
    await pool.query(`CREATE TABLE IF NOT EXISTS opportunity_likes (
      id SERIAL PRIMARY KEY,
      opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
      liker_id INTEGER NOT NULL,
      liker_type TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(opportunity_id, liker_id, liker_type)
    )`);

    const existing = await pool.query(
      `SELECT id FROM opportunity_likes WHERE opportunity_id = $1 AND liker_id = $2 AND liker_type = $3`,
      [id, userId, userType]
    );
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Already liked' });

    await pool.query(
      `INSERT INTO opportunity_likes (opportunity_id, liker_id, liker_type) VALUES ($1, $2, $3)`,
      [id, userId, userType]
    );
    const updated = await pool.query(
      `UPDATE opportunities SET like_count = COALESCE(like_count, 0) + 1 WHERE id = $1 RETURNING like_count`,
      [id]
    );
    res.json({ success: true, like_count: updated.rows[0]?.like_count || 0 });
  } catch (e) {
    console.error('Error liking opportunity:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /opportunities/:id/like
 * Remove a like from an opportunity.
 */
const unlikeOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || !userType) return res.status(401).json({ error: 'Authentication required' });

    const result = await pool.query(
      `DELETE FROM opportunity_likes WHERE opportunity_id = $1 AND liker_id = $2 AND liker_type = $3 RETURNING id`,
      [id, userId, userType]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Like not found' });

    const updated = await pool.query(
      `UPDATE opportunities SET like_count = GREATEST(0, COALESCE(like_count, 1) - 1) WHERE id = $1 RETURNING like_count`,
      [id]
    );
    res.json({ success: true, like_count: updated.rows[0]?.like_count || 0 });
  } catch (e) {
    console.error('Error unliking opportunity:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /opportunities/:id/save
 * Save an opportunity for later.
 */
const saveOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || !userType) return res.status(401).json({ error: 'Authentication required' });

    await pool.query(`CREATE TABLE IF NOT EXISTS opportunity_saves (
      id SERIAL PRIMARY KEY,
      opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
      saver_id INTEGER NOT NULL,
      saver_type TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(opportunity_id, saver_id, saver_type)
    )`);

    const existing = await pool.query(
      `SELECT id FROM opportunity_saves WHERE opportunity_id = $1 AND saver_id = $2 AND saver_type = $3`,
      [id, userId, userType]
    );
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Already saved' });

    await pool.query(
      `INSERT INTO opportunity_saves (opportunity_id, saver_id, saver_type) VALUES ($1, $2, $3)`,
      [id, userId, userType]
    );
    // Increment save_count
    await pool.query(
      `UPDATE opportunities SET save_count = COALESCE(save_count, 0) + 1 WHERE id = $1`,
      [id]
    );
    const updated = await pool.query(
      `SELECT save_count FROM opportunities WHERE id = $1`, [id]
    );
    res.json({ success: true, is_saved: true, save_count: updated.rows[0]?.save_count || 1 });
  } catch (e) {
    console.error('Error saving opportunity:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /opportunities/:id/save
 * Remove a saved opportunity.
 */
const unsaveOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || !userType) return res.status(401).json({ error: 'Authentication required' });

    const result = await pool.query(
      `DELETE FROM opportunity_saves WHERE opportunity_id = $1 AND saver_id = $2 AND saver_type = $3 RETURNING id`,
      [id, userId, userType]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Save not found' });
    // Decrement save_count
    await pool.query(
      `UPDATE opportunities SET save_count = GREATEST(0, COALESCE(save_count, 1) - 1) WHERE id = $1`,
      [id]
    );
    const updated = await pool.query(
      `SELECT save_count FROM opportunities WHERE id = $1`, [id]
    );
    res.json({ success: true, is_saved: false, save_count: updated.rows[0]?.save_count || 0 });
  } catch (e) {
    console.error('Error unsaving opportunity:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /opportunities/:id/view
 * Record a qualified view on an opportunity (once per user, lifetime).
 */
const viewOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || !userType) return res.status(401).json({ error: 'Authentication required' });

    await pool.query(`ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0`);
    await pool.query(`CREATE TABLE IF NOT EXISTS opportunity_views (
      id SERIAL PRIMARY KEY,
      opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
      viewer_id INTEGER NOT NULL,
      viewer_type TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(opportunity_id, viewer_id, viewer_type)
    )`);

    const existing = await pool.query(
      `SELECT id FROM opportunity_views WHERE opportunity_id = $1 AND viewer_id = $2 AND viewer_type = $3`,
      [id, userId, userType]
    );

    let isNew = false;
    if (existing.rows.length === 0) {
      try {
        await pool.query(
          `INSERT INTO opportunity_views (opportunity_id, viewer_id, viewer_type) VALUES ($1, $2, $3)`,
          [id, userId, userType]
        );
        await pool.query(
          `UPDATE opportunities SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1`,
          [id]
        );
        isNew = true;
      } catch (dupErr) {
        if (dupErr.code !== '23505') throw dupErr; // ignore unique constraint
      }
    }

    const row = await pool.query(`SELECT view_count FROM opportunities WHERE id = $1`, [id]);
    res.json({ success: true, is_new: isNew, view_count: row.rows[0]?.view_count || 0 });
  } catch (e) {
    console.error('Error recording opportunity view:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================
// OPPORTUNITY COMMENTS
// ============================================

/**
 * Ensures the opportunity_comments table exists (UUID-keyed, created lazily).
 */
const ensureOpportunityCommentsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS opportunity_comments (
      id            SERIAL PRIMARY KEY,
      opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
      commenter_id   INTEGER NOT NULL,
      commenter_type VARCHAR(20) NOT NULL CHECK (commenter_type IN ('member','community','sponsor','venue')),
      comment_text   TEXT NOT NULL,
      parent_comment_id INTEGER REFERENCES opportunity_comments(id) ON DELETE CASCADE,
      tagged_entities   JSONB,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const getOpportunityComments = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const userId   = req.user?.id;
    const userType = req.user?.type;

    await ensureOpportunityCommentsTable();

    // Verify opportunity exists
    const oppCheck = await pool.query('SELECT id, creator_id, creator_type FROM opportunities WHERE id = $1', [id]);
    if (oppCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    const opp = oppCheck.rows[0];

    await pool.query(`
      CREATE TABLE IF NOT EXISTS opportunity_comment_likes (
        id SERIAL PRIMARY KEY,
        opportunity_comment_id INTEGER NOT NULL REFERENCES opportunity_comments(id) ON DELETE CASCADE,
        liker_id INTEGER NOT NULL,
        liker_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(opportunity_comment_id, liker_id, liker_type)
      )
    `);

    const query = `
      SELECT
        c.*,
        CASE
          WHEN c.commenter_type = 'member'    THEN m.name
          WHEN c.commenter_type = 'community' THEN comm.name
          WHEN c.commenter_type = 'sponsor'   THEN s.brand_name
          WHEN c.commenter_type = 'venue'     THEN v.name
        END as commenter_name,
        CASE
          WHEN c.commenter_type = 'member'    THEN m.username
          WHEN c.commenter_type = 'community' THEN comm.username
          WHEN c.commenter_type = 'sponsor'   THEN s.username
          WHEN c.commenter_type = 'venue'     THEN v.username
        END as commenter_username,
        CASE
          WHEN c.commenter_type = 'member'    THEN m.profile_photo_url
          WHEN c.commenter_type = 'community' THEN comm.logo_url
          WHEN c.commenter_type = 'sponsor'   THEN s.logo_url
          WHEN c.commenter_type = 'venue'     THEN NULL
        END as commenter_photo_url,
        (SELECT COUNT(*)::int FROM opportunity_comment_likes ocl WHERE ocl.opportunity_comment_id = c.id) as like_count,
        CASE WHEN $4::integer IS NOT NULL THEN EXISTS(
          SELECT 1 FROM opportunity_comment_likes ocl
          WHERE ocl.opportunity_comment_id = c.id AND ocl.liker_id = $4 AND ocl.liker_type = $5
        ) ELSE false END AS is_liked
      FROM opportunity_comments c
      LEFT JOIN members     m    ON c.commenter_type = 'member'    AND c.commenter_id = m.id
      LEFT JOIN communities comm ON c.commenter_type = 'community' AND c.commenter_id = comm.id
      LEFT JOIN sponsors    s    ON c.commenter_type = 'sponsor'   AND c.commenter_id = s.id
      LEFT JOIN venues      v    ON c.commenter_type = 'venue'     AND c.commenter_id = v.id
      WHERE c.opportunity_id = $1 AND c.parent_comment_id IS NULL
      ORDER BY c.created_at ASC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [id, limit, offset, userId, userType]);

    const comments = await Promise.all(result.rows.map(async (comment) => {
      // Parse tagged_entities
      try {
        comment.tagged_entities = comment.tagged_entities
          ? (typeof comment.tagged_entities === 'string' ? JSON.parse(comment.tagged_entities) : comment.tagged_entities)
          : null;
      } catch { comment.tagged_entities = null; }

      // Fetch replies (depth 1)
      const repliesResult = await pool.query(`
        SELECT
          r.*,
          CASE WHEN r.commenter_type='member' THEN m.name WHEN r.commenter_type='community' THEN comm.name WHEN r.commenter_type='sponsor' THEN s.brand_name WHEN r.commenter_type='venue' THEN v.name END as commenter_name,
          CASE WHEN r.commenter_type='member' THEN m.username WHEN r.commenter_type='community' THEN comm.username WHEN r.commenter_type='sponsor' THEN s.username WHEN r.commenter_type='venue' THEN v.username END as commenter_username,
          CASE WHEN r.commenter_type='member' THEN m.profile_photo_url WHEN r.commenter_type='community' THEN comm.logo_url WHEN r.commenter_type='sponsor' THEN s.logo_url WHEN r.commenter_type='venue' THEN NULL END as commenter_photo_url,
          (SELECT COUNT(*)::int FROM opportunity_comment_likes ocl WHERE ocl.opportunity_comment_id = r.id) as like_count,
          CASE WHEN $2::integer IS NOT NULL THEN EXISTS(
            SELECT 1 FROM opportunity_comment_likes ocl
            WHERE ocl.opportunity_comment_id = r.id AND ocl.liker_id = $2 AND ocl.liker_type = $3
          ) ELSE false END AS is_liked
        FROM opportunity_comments r
        LEFT JOIN members m ON r.commenter_type='member' AND r.commenter_id=m.id
        LEFT JOIN communities comm ON r.commenter_type='community' AND r.commenter_id=comm.id
        LEFT JOIN sponsors s ON r.commenter_type='sponsor' AND r.commenter_id=s.id
        LEFT JOIN venues v ON r.commenter_type='venue' AND r.commenter_id=v.id
        WHERE r.parent_comment_id = $1
        ORDER BY r.created_at ASC
      `, [comment.id, userId, userType]);

      comment.replies = repliesResult.rows.map(r => {
        try { r.tagged_entities = r.tagged_entities ? (typeof r.tagged_entities==='string' ? JSON.parse(r.tagged_entities) : r.tagged_entities) : null; } catch { r.tagged_entities = null; }
        return r;
      });

      return comment;
    }));

    // Get the real total comment count (including replies)
    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS total FROM opportunity_comments WHERE opportunity_id = $1',
      [id]
    );
    const totalCommentCount = countResult.rows[0]?.total || 0;

    // Repair stale comment_count column if needed
    try {
      await pool.query(
        'UPDATE opportunities SET comment_count = $1 WHERE id = $2 AND COALESCE(comment_count, 0) != $1',
        [totalCommentCount, id]
      );
    } catch (_) { /* non-fatal */ }

    res.json({
      comments,
      post_author_id:   opp.creator_id,
      post_author_type: opp.creator_type,
      total_comment_count: totalCommentCount,
    });

  } catch (error) {
    console.error('Error getting opportunity comments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createOpportunityComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { commentText, taggedEntities } = req.body;
    const userId   = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!commentText || !commentText.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    await ensureOpportunityCommentsTable();

    // Verify opportunity exists
    const oppCheck = await pool.query('SELECT id FROM opportunities WHERE id = $1', [id]);
    if (oppCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const taggedEntitiesJson = taggedEntities && Array.isArray(taggedEntities) && taggedEntities.length > 0
      ? JSON.stringify(taggedEntities)
      : null;

    const result = await pool.query(
      `INSERT INTO opportunity_comments (opportunity_id, commenter_id, commenter_type, comment_text, tagged_entities)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [id, userId, userType, commentText.trim(), taggedEntitiesJson]
    );
    const comment = result.rows[0];

    // Increment comment_count on opportunities table
    await pool.query(
      `UPDATE opportunities SET comment_count = COALESCE(comment_count, 0) + 1 WHERE id = $1`,
      [id]
    ).catch(() => {}); // non-fatal if column doesn't exist yet

    res.status(201).json({
      success: true,
      comment: {
        id: comment.id,
        opportunity_id: id,
        commenter_id:   userId,
        commenter_type: userType,
        comment_text:   commentText.trim(),
        parent_comment_id: null,
        tagged_entities:   taggedEntities || null,
        created_at:     comment.created_at,
      },
    });
  } catch (error) {
    console.error('Error creating opportunity comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const replyToOpportunityComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { commentText, taggedEntities } = req.body;
    const userId   = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) return res.status(401).json({ error: 'Authentication required' });
    if (!commentText || !commentText.trim()) return res.status(400).json({ error: 'Comment text is required' });

    await ensureOpportunityCommentsTable();

    const parentResult = await pool.query(
      'SELECT opportunity_id FROM opportunity_comments WHERE id = $1',
      [commentId]
    );
    if (parentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Parent comment not found' });
    }
    const opportunityId = parentResult.rows[0].opportunity_id;

    const taggedEntitiesJson = taggedEntities && Array.isArray(taggedEntities) && taggedEntities.length > 0
      ? JSON.stringify(taggedEntities)
      : null;

    const result = await pool.query(
      `INSERT INTO opportunity_comments (opportunity_id, commenter_id, commenter_type, comment_text, parent_comment_id, tagged_entities)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [opportunityId, userId, userType, commentText.trim(), commentId, taggedEntitiesJson]
    );
    const comment = result.rows[0];

    await pool.query(
      `UPDATE opportunities SET comment_count = COALESCE(comment_count, 0) + 1 WHERE id = $1`,
      [opportunityId]
    ).catch(() => {});

    res.status(201).json({
      success: true,
      comment: {
        id: comment.id,
        opportunity_id: opportunityId,
        commenter_id:   userId,
        commenter_type: userType,
        comment_text:   commentText.trim(),
        parent_comment_id: parseInt(commentId),
        tagged_entities:   taggedEntities || null,
        created_at:     comment.created_at,
      },
    });
  } catch (error) {
    console.error('Error replying to opportunity comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteOpportunityComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId   = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) return res.status(401).json({ error: 'Authentication required' });

    await ensureOpportunityCommentsTable();

    const commentResult = await pool.query(
      `SELECT c.id, c.opportunity_id, c.commenter_id, c.commenter_type, o.creator_id, o.creator_type
       FROM opportunity_comments c
       JOIN opportunities o ON c.opportunity_id = o.id
       WHERE c.id = $1`,
      [commentId]
    );
    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const comment = commentResult.rows[0];
    const isCommentAuthor = String(comment.commenter_id) === String(userId) && comment.commenter_type === userType;
    const isOpportunityCreator = String(comment.creator_id) === String(userId) && comment.creator_type === userType;

    if (!isCommentAuthor && !isOpportunityCreator) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    await pool.query('DELETE FROM opportunity_comments WHERE id = $1', [commentId]);
    await pool.query(
      `UPDATE opportunities SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0) WHERE id = $1`,
      [comment.opportunity_id]
    ).catch(() => {});

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting opportunity comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const likeOpportunityComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS opportunity_comment_likes (
        id SERIAL PRIMARY KEY,
        opportunity_comment_id INTEGER NOT NULL REFERENCES opportunity_comments(id) ON DELETE CASCADE,
        liker_id INTEGER NOT NULL,
        liker_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(opportunity_comment_id, liker_id, liker_type)
      )
    `);

    const existing = await pool.query(
      `SELECT id FROM opportunity_comment_likes WHERE opportunity_comment_id = $1 AND liker_id = $2 AND liker_type = $3`,
      [commentId, userId, userType]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Already liked" });
    }

    await pool.query(
      `INSERT INTO opportunity_comment_likes (opportunity_comment_id, liker_id, liker_type) VALUES ($1, $2, $3)`,
      [commentId, userId, userType]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error liking opportunity comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const unlikeOpportunityComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    await pool.query(
      `DELETE FROM opportunity_comment_likes WHERE opportunity_comment_id = $1 AND liker_id = $2 AND liker_type = $3`,
      [commentId, userId, userType]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error unliking opportunity comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ============================================
// SHARE OPPORTUNITY
// POST /opportunities/:id/share
// ============================================
const shareOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const { recipients, shareType, message } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || !userType) return res.status(401).json({ error: 'Authentication required' });

    if (!['internal', 'copy_link'].includes(shareType)) {
      return res.status(400).json({ error: 'Invalid share type' });
    }

    // Verify opportunity exists
    const oppCheck = await pool.query(
      `SELECT o.id, o.title, o.opportunity_types, o.creator_id, o.creator_type,
              COALESCE(o.share_count, 0) as share_count
       FROM opportunities o WHERE o.id = $1`,
      [id]
    );
    if (oppCheck.rows.length === 0) return res.status(404).json({ error: 'Opportunity not found' });

    const opp = oppCheck.rows[0];

    // Fetch creator display info
    let creatorName = null;
    let creatorUsername = null;
    if (opp.creator_type === 'community') {
      const c = await pool.query('SELECT name, username FROM communities WHERE id = $1', [opp.creator_id]);
      creatorName = c.rows[0]?.name || null;
      creatorUsername = c.rows[0]?.username || null;
    } else if (opp.creator_type === 'member') {
      const m = await pool.query('SELECT name, username FROM members WHERE id = $1', [opp.creator_id]);
      creatorName = m.rows[0]?.name || null;
      creatorUsername = m.rows[0]?.username || null;
    }

    if (shareType === 'copy_link') {
      await pool.query(
        `UPDATE opportunities SET share_count = COALESCE(share_count, 0) + 1 WHERE id = $1`,
        [id]
      );
      const updated = await pool.query('SELECT share_count FROM opportunities WHERE id = $1', [id]);
      return res.json({ success: true, shareCount: updated.rows[0]?.share_count || 1 });
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients required for internal sharing' });
    }

    // Build the opportunity preview for message metadata
    const oppPreview = {
      opportunityId: opp.id,
      title: opp.title,
      opportunityTypes: opp.opportunity_types,
      creatorId: opp.creator_id,
      creatorType: opp.creator_type,
      creatorName,
      creatorUsername,
    };

    // Reuse the same conversation helper logic from shareController
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
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id`,
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
    const messageText = message || 'Shared an opportunity with you';

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
          [convId, userId, userType, messageText, 'opportunity_share', JSON.stringify(oppPreview)]
        );
        await pool.query(`UPDATE conversations SET last_message_at = NOW() WHERE id = $1`, [convId]);
        continue;
      }

      const conversationId = await getOrCreateConversation(userId, userType, recipient.id, recipient.type);
      await pool.query(`UPDATE conversations SET last_message_at = NOW() WHERE id = $1`, [conversationId]);
      await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, sender_type, message_text, message_type, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [conversationId, userId, userType, messageText, 'opportunity_share', JSON.stringify(oppPreview)]
      );
    }

    const successCount = recipients.length - blockedRecipients.length;
    if (successCount === 0) {
      return res.status(403).json({ error: 'Sharing is restricted. Only admins can share here.' });
    }

    await pool.query(
      `UPDATE opportunities SET share_count = COALESCE(share_count, 0) + $1 WHERE id = $2`,
      [successCount, id]
    );
    const updated = await pool.query('SELECT share_count FROM opportunities WHERE id = $1', [id]);

    res.json({
      success: true,
      shareCount: updated.rows[0]?.share_count || successCount,
      recipientCount: successCount,
      blockedCount: blockedRecipients.length,
    });
  } catch (e) {
    console.error('Error sharing opportunity:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================
// PROXY RESUME (Authenticated PDF download)
// Serves PDFs from the local uploads/resumes/ directory.
// Auth-gated — only the creator or applicant can download.
// ============================================
const path = require("path");
const fs = require("fs");
const RESUME_DIR = path.join(__dirname, "../uploads/resumes");

const proxyResume = async (req, res) => {
  try {
    const { id: applicationId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    // 1. Load the application row
    const result = await pool.query(
      `SELECT oa.resume_url, oa.resume_filename, oa.applicant_id, oa.applicant_type,
              o.creator_id, o.creator_type
       FROM opportunity_applications oa
       JOIN opportunities o ON oa.opportunity_id = o.id
       WHERE oa.id = $1`,
      [applicationId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Application not found" });
    }

    const app = result.rows[0];

    // 2. Auth check — only the opportunity creator or the applicant themselves
    const isCreator = String(app.creator_id) === String(userId) && app.creator_type === userType;
    const isApplicant = String(app.applicant_id) === String(userId) && userType === "member";

    if (!isCreator && !isApplicant) {
      return res.status(403).json({ error: "Access denied" });
    }

    // 3. Guard: missing URL
    if (!app.resume_url) {
      return res.status(410).json({
        error: "resume_reupload_required",
        message: "No resume attached to this application.",
      });
    }

    // 4. Detect legacy Cloudinary URLs (full https:// → blocked, re-upload needed)
    if (app.resume_url.startsWith("https://")) {
      return res.status(410).json({
        error: "resume_reupload_required",
        message: "This PDF was uploaded before a storage migration. The applicant needs to re-apply to attach a new resume.",
      });
    }

    // 5. Serve from local filesystem
    //    resume_url contains just the filename, e.g. "resume_51_1718000000000.pdf"
    const filePath = path.join(RESUME_DIR, app.resume_url);

    // Prevent path traversal attacks
    if (!filePath.startsWith(RESUME_DIR)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(410).json({
        error: "resume_reupload_required",
        message: "Resume file not found on server. The applicant may need to re-apply.",
      });
    }

    const filename = app.resume_filename || app.resume_url;
    const stat = fs.statSync(filePath);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", stat.size);

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error("[proxyResume] error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  createOpportunity,
  getOpportunities,
  getOpportunityDetail,
  updateOpportunity,
  closeOpportunity,
  discoverOpportunities,
  applyToOpportunity,
  getApplications,
  getApplicationDetail,
  updateApplicationStatus,
  proxyResume,
  getFollowedOpportunities,
  getCommunityOpportunities,
  pinOpportunity,
  unpinOpportunity,
  likeOpportunity,
  unlikeOpportunity,
  saveOpportunity,
  unsaveOpportunity,
  viewOpportunity,
  getOpportunityComments,
  createOpportunityComment,
  replyToOpportunityComment,
  deleteOpportunityComment,
  shareOpportunity,
  likeOpportunityComment,
  unlikeOpportunityComment,
};
