const { createPool } = require("../config/db");

const pool = createPool();

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
      eligibility_mode,
      visibility,
      notify_talent,
      skill_groups,
      questions,
      status, // 'draft' or 'active'
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
        payment_type, budget_range, payment_nature,
        eligibility_mode, visibility, notify_talent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
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
      eligibility_mode || "any_one",
      visibility || "public",
      notify_talent !== false,
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
        o.budget_range,
        o.visibility,
        o.applicant_count,
        o.expires_at,
        o.closed_at,
        o.created_at,
        o.updated_at,
        COALESCE(
          (SELECT COUNT(*) FROM opportunity_applications oa 
           WHERE oa.opportunity_id = o.id AND oa.status = 'shortlisted'),
          0
        ) as shortlisted_count
      FROM opportunities o
      WHERE o.creator_id = $1 AND o.creator_type = $2
      ${statusFilter}
      ORDER BY o.created_at DESC
    `;

    const result = await pool.query(query, params);

    // Fetch skill groups for each opportunity
    const opportunities = await Promise.all(
      result.rows.map(async (opp) => {
        const skillGroupsResult = await pool.query(
          `SELECT role, tools, sample_type FROM opportunity_skill_groups 
           WHERE opportunity_id = $1 ORDER BY display_order`,
          [opp.id],
        );
        return {
          ...opp,
          skill_groups: skillGroupsResult.rows,
        };
      }),
    );

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

    res.json({
      success: true,
      opportunity,
      is_creator: isCreator,
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
      eligibility_mode,
      visibility,
      notify_talent,
      skill_groups,
      questions,
      status,
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
    addUpdate("status", status);

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
        o.budget_range,
        o.experience_level,
        o.created_at,
        o.creator_id,
        o.creator_type,
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

    // Fetch skill groups for each
    const opportunities = await Promise.all(
      result.rows.map(async (opp) => {
        const skillGroupsResult = await pool.query(
          `SELECT role, tools, sample_type FROM opportunity_skill_groups 
           WHERE opportunity_id = $1 ORDER BY display_order`,
          [opp.id],
        );
        return {
          ...opp,
          skill_groups: skillGroupsResult.rows,
        };
      }),
    );

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
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "member") {
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
      `INSERT INTO opportunity_applications (opportunity_id, applicant_id, applied_role, portfolio_link, portfolio_note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        opportunity_id,
        userId,
        applied_role,
        portfolio_link || null,
        portfolio_note || null,
      ],
    );

    const applicationId = appResult.rows[0].id;

    // Insert responses if any
    if (responses && Array.isArray(responses) && responses.length > 0) {
      const responseInserts = responses.map((r) =>
        pool.query(
          `INSERT INTO opportunity_application_responses (application_id, question_id, answer)
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

    // Fetch responses
    const responsesResult = await pool.query(
      `SELECT oar.*, oq.prompt, oq.question_type
       FROM opportunity_application_responses oar
       JOIN opportunity_questions oq ON oar.question_id = oq.id
       WHERE oar.application_id = $1`,
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
        o.budget_range,
        o.applicant_count,
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
        AND f.follower_type = 'member'
      ORDER BY o.created_at DESC
      LIMIT $2
    `;

    console.log("[getFollowedOpportunities] userId:", userId, "limit:", limit);
    const result = await pool.query(query, [userId, parseInt(limit)]);
    console.log(
      "[getFollowedOpportunities] Found opportunities:",
      result.rows.length,
    );

    // Fetch skill groups for each opportunity
    const opportunities = await Promise.all(
      result.rows.map(async (opp) => {
        const sgResult = await pool.query(
          `SELECT role FROM opportunity_skill_groups 
           WHERE opportunity_id = $1 ORDER BY display_order LIMIT 3`,
          [opp.id],
        );
        return {
          ...opp,
          roles: sgResult.rows.map((r) => r.role),
        };
      }),
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
  getFollowedOpportunities,
};
