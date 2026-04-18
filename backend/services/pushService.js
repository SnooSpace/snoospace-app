/**
 * Push Notification Service
 *
 * Integrates with Expo Push API to send push notifications.
 * Handles batching, receipts, and error handling.
 */

const { Expo } = require("expo-server-sdk");

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
    const userKeys = notifications.map((n) => `(${n.userId}, '${n.userType}')`);
    const uniqueKeys = [...new Set(userKeys)];

    // 2. Fetch active push tokens for all users
    const tokenQuery = `
      SELECT user_id, user_type, expo_push_token
      FROM push_tokens
      WHERE is_active = true
        AND (user_id, user_type) IN (${uniqueKeys.join(", ")})
    `;
    const tokenResult = await pool.query(tokenQuery);

    // Create a map of userId:userType -> [tokens]
    const tokenMap = {};
    for (const row of tokenResult.rows) {
      const key = `${row.user_id}:${row.user_type}`;
      if (!tokenMap[key]) {
        tokenMap[key] = [];
      }
      tokenMap[key].push(row.expo_push_token);
    }

    // 3. Build Expo messages
    const messages = [];
    const errors = [];

    for (const notif of notifications) {
      const key = `${notif.userId}:${notif.userType}`;
      const tokens = tokenMap[key] || [];

      if (tokens.length === 0) {
        // User has no active push tokens
        continue;
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

        messages.push({
          to: token,
          sound: "default",
          title: notif.title,
          body: notif.body,
          data: {
            ...notif.data,
            notificationType: notif.data?.type || "general",
          },
          channelId: "default",
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
