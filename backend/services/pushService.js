/**
 * Push Notification Service
 *
 * Integrates with Expo Push API to send push notifications.
 * Handles batching, receipts, and error handling.
 */

const { Expo } = require("expo-server-sdk");
const NotificationTypes = require("../config/notificationTypes");
const { shouldSuppressCreatorSocial } = require("./notificationService");

// Create a new Expo SDK client
const expo = new Expo();

/**
 * Send push notifications to multiple users
 *
 * @param {Pool} pool - Database connection pool
 * @param {Array} notifications - Array of notification objects
 * @param {number} notifications[].userId - User ID to send notification to
 * @param {string} notifications[].userType - User type (member, community, sponsor, venue)
 * @param {string} notifications[].title - Notification title
 * @param {string} notifications[].body - Notification body text
 * @param {Object} notifications[].data - Additional data payload
 * @returns {Object} - Results summary { sent, failed, errors }
 */
const sendPushNotifications = async (pool, notifications) => {
  if (!notifications || notifications.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  try {
    // 1. Collect all user IDs and types to fetch tokens in bulk
    const userKeys = notifications
      .filter((n) => n.userId && n.userType)
      .map((n) => `(${Number(n.userId)}, '${n.userType.replace(/'/g, "''")}')`);
    const uniqueKeys = [...new Set(userKeys)];

    // 2. Fetch active push tokens for all users, including their usernames
    // and the total count of active accounts associated with each push token on their device
    const tokenQuery = `
      SELECT pt.user_id, pt.user_type, pt.expo_push_token,
        CASE
          WHEN pt.user_type = 'member' THEN m.username
          WHEN pt.user_type = 'community' THEN c.username
          WHEN pt.user_type = 'sponsor' THEN s.username
          WHEN pt.user_type = 'venue' THEN v.username
          ELSE NULL
        END AS recipient_username,
        (SELECT COUNT(*)::int FROM push_tokens pt2 WHERE pt2.expo_push_token = pt.expo_push_token AND pt2.is_active = true) AS device_account_count
      FROM push_tokens pt
      LEFT JOIN members m ON pt.user_type = 'member' AND pt.user_id = m.id
      LEFT JOIN communities c ON pt.user_type = 'community' AND pt.user_id = c.id
      LEFT JOIN sponsors s ON pt.user_type = 'sponsor' AND pt.user_id = s.id
      LEFT JOIN venues v ON pt.user_type = 'venue' AND pt.user_id = v.id
      WHERE pt.is_active = true
        AND (pt.user_id, pt.user_type) IN (${uniqueKeys.join(", ")})
    `;
    const tokenResult = await pool.query(tokenQuery);

    // Create a map of userId:userType -> { tokens: [tokens], username: string, deviceAccountCount: number }
    const tokenMap = {};
    for (const row of tokenResult.rows) {
      const key = `${row.user_id}:${row.user_type}`;
      if (!tokenMap[key]) {
        tokenMap[key] = {
          tokens: [],
          username: row.recipient_username,
          deviceAccountCount: row.device_account_count || 1
        };
      }
      tokenMap[key].tokens.push(row.expo_push_token);
    }

    // 2b. Fetch disabled notification preferences in bulk
    const disabledPrefsQuery = `
      SELECT user_id, user_type, category
      FROM user_notification_preferences
      WHERE enabled = false
        AND (user_id, user_type) IN (${uniqueKeys.join(", ")})
    `;
    const disabledPrefsResult = await pool.query(disabledPrefsQuery);
    
    // Build a lookup set of "userId:userType:category" for disabled categories
    const disabledSet = new Set();
    for (const row of disabledPrefsResult.rows) {
      disabledSet.add(`${row.user_id}:${row.user_type}:${row.category}`);
    }

    // 3. Build Expo messages
    const messages = [];
    const errors = [];

    for (const notif of notifications) {
      const key = `${notif.userId}:${notif.userType}`;
      const tokenInfo = tokenMap[key];
      const tokens = tokenInfo ? tokenInfo.tokens : [];
      const recipientUsername = tokenInfo ? tokenInfo.username : null;
      const deviceAccountCount = tokenInfo ? tokenInfo.deviceAccountCount : 1;

      if (tokens.length === 0) {
        // User has no active push tokens
        continue;
      }

      // Resolve category and channel based on type registry
      let type = notif.data?.type;
      let category = "system";
      let channel = "system";

      // Special case: Detect DM
      if (notif.data?.screen === "Chat" || notif.data?.chatId) {
        type = "dm";
      }

      if (type && NotificationTypes[type]) {
        category = NotificationTypes[type].category;
        channel = NotificationTypes[type].channel;
      }

      // Check user preferences
      const prefKey = `${notif.userId}:${notif.userType}:${category}`;
      if (disabledSet.has(prefKey)) {
        // Skip push notification if user has disabled this category
        continue;
      }

      // Check special creator_social preference for follow/circle requests
      if (["follow", "creator_follow_received", "circle_request_received"].includes(type)) {
        const actorId = notif.data?.actorId;
        const actorType = notif.data?.actorType;
        if (actorId && actorType) {
          try {
            const isSuppressed = await shouldSuppressCreatorSocial(pool, notif.userId, notif.userType, actorId, actorType);
            if (isSuppressed) {
              console.log(`[PushService] Suppressing creator connection push notification from ${actorType}_${actorId} to ${notif.userType}_${notif.userId}`);
              continue;
            }
          } catch (err) {
            console.error("[PushService] shouldSuppressCreatorSocial check failed:", err.message);
          }
        }
      }

      for (const token of tokens) {
        // Validate token format
        if (!Expo.isExpoPushToken(token)) {
          errors.push({
            userId: notif.userId,
            userType: notif.userType,
            error: `Invalid push token: ${token}`,
          });
          continue;
        }

        let title = notif.title || "SnooSpace";
        let body = notif.body || "";

        // If the user has 2 or more accounts registered on this device,
        // format the notification to show the recipient username as the title.
        if (deviceAccountCount >= 2 && recipientUsername) {
          title = `@${recipientUsername}`;
          body = notif.title ? `${notif.title}: ${notif.body || ""}` : (notif.body || "");
        }

        messages.push({
          to: token,
          sound: "default",
          title,
          body,
          data: {
            ...notif.data,
            notificationType: type || "general",
            category: category,
            recipientId: notif.userId,
            recipientType: notif.userType,
          },
          channelId: channel,
        });
      }
    }

    if (messages.length === 0) {
      console.log("[PushService] No valid push tokens found for notifications");
      return { sent: 0, failed: 0, errors };
    }

    // 4. Send notifications in batches
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("[PushService] Error sending chunk:", error.message);
        errors.push({ error: error.message, chunk: chunk.length });
      }
    }

    // 5. Count successes and failures
    let sent = 0;
    let failed = 0;

    for (const ticket of tickets) {
      if (ticket.status === "ok") {
        sent++;
      } else {
        failed++;
        errors.push({
          error: ticket.message || "Unknown error",
          details: ticket.details,
        });
      }
    }

    console.log(
      `[PushService] Sent ${sent} push notifications, ${failed} failed`
    );

    // 6. Handle receipts in background (non-blocking)
    // In production, you'd want to store tickets and check receipts later
    if (tickets.length > 0) {
      setImmediate(() => handleReceipts(tickets));
    }

    return { sent, failed, errors };
  } catch (error) {
    console.error("[PushService] Error in sendPushNotifications:", error);
    return { sent: 0, failed: 0, errors: [{ error: error.message }] };
  }
};

/**
 * Handle push notification receipts
 * Called asynchronously after sending notifications
 *
 * @param {Array} tickets - Expo push tickets
 */
const handleReceipts = async (tickets) => {
  try {
    // Filter tickets that have receipt IDs
    const receiptIds = tickets
      .filter((ticket) => ticket.id)
      .map((ticket) => ticket.id);

    if (receiptIds.length === 0) return;

    // Wait a bit for receipts to be available
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

    for (const chunk of receiptIdChunks) {
      try {
        const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

        for (const receiptId in receipts) {
          const receipt = receipts[receiptId];

          if (receipt.status === "error") {
            console.error(
              `[PushService] Receipt error for ${receiptId}:`,
              receipt.message
            );

            // Handle specific errors
            if (receipt.details?.error === "DeviceNotRegistered") {
              // TODO: Mark this token as inactive in the database
              console.log(
                "[PushService] Device not registered, should deactivate token"
              );
            }
          }
        }
      } catch (error) {
        console.error("[PushService] Error fetching receipts:", error.message);
      }
    }
  } catch (error) {
    console.error("[PushService] handleReceipts error:", error.message);
  }
};

/**
 * Send a single push notification to a user
 * Convenience wrapper around sendPushNotifications
 *
 * @param {Pool} pool - Database connection pool
 * @param {number} userId - User ID
 * @param {string} userType - User type
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data
 */
const sendPushNotification = async (
  pool,
  userId,
  userType,
  title,
  body,
  data = {}
) => {
  return sendPushNotifications(pool, [{ userId, userType, title, body, data }]);
};

/**
 * Send push notifications to multiple users with the same content
 *
 * @param {Pool} pool - Database connection pool
 * @param {Array} users - Array of { userId, userType }
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data
 */
const sendBulkPushNotifications = async (
  pool,
  users,
  title,
  body,
  data = {}
) => {
  const notifications = users.map((user) => ({
    userId: user.userId,
    userType: user.userType,
    title,
    body,
    data,
  }));
  return sendPushNotifications(pool, notifications);
};

module.exports = {
  sendPushNotifications,
  sendPushNotification,
  sendBulkPushNotifications,
};
