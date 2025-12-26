/**
 * Notification Service
 *
 * Centralized notification logic with:
 * - UPSERT pattern for singleton notifications (follow)
 * - Aggregation support for multi-actor notifications (like, comment)
 * - Environment-based suppression for dev/staging
 * - Soft delete for data integrity
 */

// Environment-based suppression
const shouldSuppressNotifications = () => {
  return process.env.SUPPRESS_NOTIFICATIONS === "true";
};

/**
 * Create or reactivate a follow notification
 * Uses UPSERT to ensure only ONE active notification per (actor, recipient)
 *
 * @param {Pool} pool - Database connection pool
 * @param {Object} params - Notification parameters
 * @param {number} params.recipientId - ID of user receiving notification
 * @param {string} params.recipientType - Type of recipient (member, community, etc)
 * @param {number} params.actorId - ID of user who performed action
 * @param {string} params.actorType - Type of actor
 * @param {Object} params.payload - Additional notification data
 * @returns {number|null} - Notification ID or null if suppressed
 */
const createFollowNotification = async (
  pool,
  { recipientId, recipientType, actorId, actorType, payload }
) => {
  if (shouldSuppressNotifications()) {
    console.log(
      "[NotificationService] Suppressed follow notification in current environment"
    );
    return null;
  }

  try {
    const query = `
      INSERT INTO notifications (
        recipient_id, recipient_type, actor_id, actor_type, 
        type, payload, is_active, is_read, updated_at
      )
      VALUES ($1, $2, $3, $4, 'follow', $5, TRUE, FALSE, NOW())
      ON CONFLICT (actor_id, actor_type, recipient_id, recipient_type, type)
        WHERE type IN ('follow') AND is_active = TRUE
      DO UPDATE SET
        is_active = TRUE,
        payload = EXCLUDED.payload,
        updated_at = NOW(),
        is_read = FALSE
      RETURNING id;
    `;

    const result = await pool.query(query, [
      recipientId,
      recipientType,
      actorId,
      actorType,
      JSON.stringify(payload || {}),
    ]);

    return result.rows[0]?.id || null;
  } catch (error) {
    console.error(
      "[NotificationService] Failed to create follow notification:",
      error
    );
    throw error;
  }
};

/**
 * Deactivate a follow notification (soft delete)
 * Called when user unfollows
 *
 * @param {Pool} pool - Database connection pool
 * @param {Object} params - Notification parameters
 */
const deactivateFollowNotification = async (
  pool,
  { recipientId, recipientType, actorId, actorType }
) => {
  try {
    const query = `
      UPDATE notifications
      SET is_active = FALSE, updated_at = NOW()
      WHERE recipient_id = $1
        AND recipient_type = $2
        AND actor_id = $3
        AND actor_type = $4
        AND type = 'follow'
        AND is_active = TRUE;
    `;

    await pool.query(query, [recipientId, recipientType, actorId, actorType]);
  } catch (error) {
    console.error(
      "[NotificationService] Failed to deactivate follow notification:",
      error
    );
    throw error;
  }
};

/**
 * Create or update an aggregated notification (like, comment on same post)
 * Aggregates multiple actors into a single notification
 *
 * @param {Pool} pool - Database connection pool
 * @param {Object} params - Notification parameters
 * @param {number} params.recipientId - ID of user receiving notification
 * @param {string} params.recipientType - Type of recipient
 * @param {number} params.actorId - ID of user who performed action
 * @param {string} params.actorType - Type of actor
 * @param {string} params.type - Notification type (like, comment)
 * @param {number} params.referenceId - Reference entity ID (post_id)
 * @param {string} params.referenceType - Reference entity type (post)
 * @param {Object} params.payload - Additional notification data
 */
const createAggregatedNotification = async (
  pool,
  {
    recipientId,
    recipientType,
    actorId,
    actorType,
    type,
    referenceId,
    referenceType,
    payload,
  }
) => {
  if (shouldSuppressNotifications()) {
    console.log(
      `[NotificationService] Suppressed ${type} notification in current environment`
    );
    return null;
  }

  try {
    // Try to update existing aggregated notification
    const updateQuery = `
      UPDATE notification_aggregates
      SET 
        actor_ids = CASE 
          WHEN NOT ($3 = ANY(actor_ids)) 
          THEN array_append(actor_ids, $3) 
          ELSE actor_ids 
        END,
        actor_types = CASE 
          WHEN NOT ($3 = ANY(actor_ids)) 
          THEN array_append(actor_types, $4) 
          ELSE actor_types 
        END,
        actor_count = CASE 
          WHEN NOT ($3 = ANY(actor_ids)) 
          THEN actor_count + 1 
          ELSE actor_count 
        END,
        latest_actor_id = $3,
        latest_actor_type = $4,
        payload = $7,
        is_read = FALSE,
        updated_at = NOW()
      WHERE recipient_id = $1
        AND recipient_type = $2
        AND type = $5
        AND reference_id = $6
        AND reference_type = $8
        AND is_active = TRUE
      RETURNING id;
    `;

    const updateResult = await pool.query(updateQuery, [
      recipientId,
      recipientType,
      actorId,
      actorType,
      type,
      referenceId,
      JSON.stringify(payload || {}),
      referenceType,
    ]);

    if (updateResult.rows.length > 0) {
      return updateResult.rows[0].id;
    }

    // No existing aggregation, create new one
    const insertQuery = `
      INSERT INTO notification_aggregates (
        recipient_id, recipient_type, type, reference_id, reference_type,
        actor_ids, actor_types, actor_count, latest_actor_id, latest_actor_type,
        payload, is_active, is_read
      )
      VALUES ($1, $2, $3, $4, $5, ARRAY[$6], ARRAY[$7], 1, $6, $7, $8, TRUE, FALSE)
      ON CONFLICT (recipient_id, recipient_type, type, reference_id, reference_type)
        WHERE is_active = TRUE
      DO UPDATE SET
        actor_ids = CASE 
          WHEN NOT ($6 = ANY(notification_aggregates.actor_ids)) 
          THEN array_append(notification_aggregates.actor_ids, $6) 
          ELSE notification_aggregates.actor_ids 
        END,
        actor_types = CASE 
          WHEN NOT ($6 = ANY(notification_aggregates.actor_ids)) 
          THEN array_append(notification_aggregates.actor_types, $7) 
          ELSE notification_aggregates.actor_types 
        END,
        actor_count = CASE 
          WHEN NOT ($6 = ANY(notification_aggregates.actor_ids)) 
          THEN notification_aggregates.actor_count + 1 
          ELSE notification_aggregates.actor_count 
        END,
        latest_actor_id = $6,
        latest_actor_type = $7,
        payload = $8,
        is_read = FALSE,
        updated_at = NOW()
      RETURNING id;
    `;

    const insertResult = await pool.query(insertQuery, [
      recipientId,
      recipientType,
      type,
      referenceId,
      referenceType,
      actorId,
      actorType,
      JSON.stringify(payload || {}),
    ]);

    return insertResult.rows[0]?.id || null;
  } catch (error) {
    console.error(
      `[NotificationService] Failed to create aggregated ${type} notification:`,
      error
    );
    throw error;
  }
};

/**
 * Remove an actor from an aggregated notification
 * Called when user unlikes a post, for example
 *
 * @param {Pool} pool - Database connection pool
 * @param {Object} params - Notification parameters
 */
const removeFromAggregatedNotification = async (
  pool,
  { recipientId, recipientType, actorId, type, referenceId, referenceType }
) => {
  try {
    // First, try to remove actor from the array
    const result = await pool.query(
      `
      UPDATE notification_aggregates
      SET 
        actor_ids = array_remove(actor_ids, $3),
        actor_count = actor_count - 1,
        updated_at = NOW()
      WHERE recipient_id = $1
        AND recipient_type = $2
        AND type = $4
        AND reference_id = $5
        AND reference_type = $6
        AND is_active = TRUE
        AND $3 = ANY(actor_ids)
      RETURNING id, actor_count;
    `,
      [recipientId, recipientType, actorId, type, referenceId, referenceType]
    );

    // If actor_count is now 0, deactivate the notification
    if (result.rows.length > 0 && result.rows[0].actor_count <= 0) {
      await pool.query(
        `
        UPDATE notification_aggregates
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1;
      `,
        [result.rows[0].id]
      );
    }
  } catch (error) {
    console.error(
      `[NotificationService] Failed to remove from aggregated ${type} notification:`,
      error
    );
    throw error;
  }
};

/**
 * Create a simple notification (non-singleton, non-aggregated)
 * Use for one-off notifications like mentions, event updates, etc.
 *
 * @param {Pool} pool - Database connection pool
 * @param {Object} params - Notification parameters
 */
const createSimpleNotification = async (
  pool,
  { recipientId, recipientType, actorId, actorType, type, payload }
) => {
  if (shouldSuppressNotifications()) {
    console.log(
      `[NotificationService] Suppressed ${type} notification in current environment`
    );
    return null;
  }

  try {
    const query = `
      INSERT INTO notifications (
        recipient_id, recipient_type, actor_id, actor_type, 
        type, payload, is_active, is_read, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, FALSE, NOW())
      RETURNING id;
    `;

    const result = await pool.query(query, [
      recipientId,
      recipientType,
      actorId,
      actorType,
      type,
      JSON.stringify(payload || {}),
    ]);

    return result.rows[0]?.id || null;
  } catch (error) {
    console.error(
      `[NotificationService] Failed to create ${type} notification:`,
      error
    );
    throw error;
  }
};

/**
 * Deactivate a simple notification by criteria
 *
 * @param {Pool} pool - Database connection pool
 * @param {Object} params - Criteria for finding notification to deactivate
 */
const deactivateNotification = async (
  pool,
  {
    recipientId,
    recipientType,
    actorId,
    actorType,
    type,
    referenceId = null,
    referenceType = null,
  }
) => {
  try {
    let query = `
      UPDATE notifications
      SET is_active = FALSE, updated_at = NOW()
      WHERE recipient_id = $1
        AND recipient_type = $2
        AND actor_id = $3
        AND actor_type = $4
        AND type = $5
        AND is_active = TRUE
    `;
    const params = [recipientId, recipientType, actorId, actorType, type];

    // Add reference filters if provided (for like notifications tied to a post)
    if (referenceId && referenceType) {
      query += ` AND payload->>'referenceId' = $6 AND payload->>'referenceType' = $7`;
      params.push(String(referenceId), referenceType);
    }

    await pool.query(query, params);
  } catch (error) {
    console.error(
      `[NotificationService] Failed to deactivate ${type} notification:`,
      error
    );
    throw error;
  }
};

module.exports = {
  createFollowNotification,
  deactivateFollowNotification,
  createAggregatedNotification,
  removeFromAggregatedNotification,
  createSimpleNotification,
  deactivateNotification,
  shouldSuppressNotifications,
};
