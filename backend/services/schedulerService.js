/**
 * Scheduler Service
 *
 * Handles scheduled notifications using node-cron:
 * - Event reminders (24h and 1h before event)
 * - Other scheduled tasks
 */

const cron = require("node-cron");
const notificationService = require("./notificationService");
const pushService = require("./pushService");

let pool = null;

/**
 * Initialize the scheduler with database pool
 * @param {Pool} dbPool - Database connection pool
 */
const init = (dbPool) => {
  pool = dbPool;
  console.log("[Scheduler] Initializing scheduler service...");

  // Run event reminder check every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    console.log("[Scheduler] Running event reminder check...");
    await sendEventReminders();
  });

  // Run attendance confirmation check every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    console.log("[Scheduler] Running attendance confirmation check...");
    await sendAttendanceConfirmations();
  });

  console.log("[Scheduler] Scheduler service initialized");
};

/**
 * Send event reminders for upcoming events
 * - 24h reminder: 24 hours before event start
 * - 1h reminder: 1 hour before event start
 */
const sendEventReminders = async () => {
  if (!pool) {
    console.error("[Scheduler] Pool not initialized");
    return;
  }

  try {
    const now = new Date();

    // 24-hour reminder window: events starting between 23h45m and 24h15m from now
    const hour24Start = new Date(now.getTime() + 23.75 * 60 * 60 * 1000);
    const hour24End = new Date(now.getTime() + 24.25 * 60 * 60 * 1000);

    // 1-hour reminder window: events starting between 45m and 1h15m from now
    const hour1Start = new Date(now.getTime() + 0.75 * 60 * 60 * 1000);
    const hour1End = new Date(now.getTime() + 1.25 * 60 * 60 * 1000);

    // Get events for 24h reminder
    const events24h = await pool.query(
      `SELECT e.id, e.title, e.start_datetime, e.community_id, c.name as community_name
       FROM events e
       JOIN communities c ON e.community_id = c.id
       WHERE e.start_datetime BETWEEN $1 AND $2
         AND e.is_published = true
         AND (e.is_cancelled = false OR e.is_cancelled IS NULL)`,
      [hour24Start.toISOString(), hour24End.toISOString()]
    );

    // Get events for 1h reminder
    const events1h = await pool.query(
      `SELECT e.id, e.title, e.start_datetime, e.community_id, c.name as community_name
       FROM events e
       JOIN communities c ON e.community_id = c.id
       WHERE e.start_datetime BETWEEN $1 AND $2
         AND e.is_published = true
         AND (e.is_cancelled = false OR e.is_cancelled IS NULL)`,
      [hour1Start.toISOString(), hour1End.toISOString()]
    );

    // Process 24h reminders
    for (const event of events24h.rows) {
      await sendRemindersForEvent(event, "24h");
    }

    // Process 1h reminders
    for (const event of events1h.rows) {
      await sendRemindersForEvent(event, "1h");
    }

    if (events24h.rows.length > 0 || events1h.rows.length > 0) {
      console.log(
        `[Scheduler] Processed ${events24h.rows.length} events for 24h reminder, ${events1h.rows.length} events for 1h reminder`
      );
    }
  } catch (error) {
    console.error("[Scheduler] Error in sendEventReminders:", error);
  }
};

/**
 * Send reminders for a specific event to all registered users
 * @param {Object} event - Event data
 * @param {string} reminderType - "24h" or "1h"
 */
const sendRemindersForEvent = async (event, reminderType) => {
  try {
    const reminderColumn =
      reminderType === "24h" ? "reminder_24h_sent_at" : "reminder_1h_sent_at";

    // Get registered users who haven't received this reminder yet
    const usersResult = await pool.query(
      `SELECT er.id as registration_id, er.member_id, m.name as member_name
       FROM event_registrations er
       JOIN members m ON er.member_id = m.id
       WHERE er.event_id = $1
         AND er.registration_status = 'registered'
         AND (er.${reminderColumn} IS NULL)`,
      [event.id]
    );

    if (usersResult.rows.length === 0) {
      return;
    }

    const notificationType =
      reminderType === "24h" ? "event_reminder_24h" : "event_reminder_1h";
    const pushTitle =
      reminderType === "24h" ? "Event Tomorrow! 📅" : "Starting Soon! ⏰";
    const pushBody =
      reminderType === "24h"
        ? `${event.title} is happening tomorrow!`
        : `${event.title} starts in about 1 hour!`;

    // Format event time for notification
    const eventDate = new Date(event.start_datetime);
    const formattedDate = eventDate.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    const formattedTime = eventDate.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    // Send notifications and mark as sent
    for (const user of usersResult.rows) {
      try {
        // In-app notification
        await notificationService.createSimpleNotification(pool, {
          recipientId: user.member_id,
          recipientType: "member",
          actorId: event.community_id,
          actorType: "community",
          type: notificationType,
          payload: {
            eventId: event.id,
            eventTitle: event.title,
            communityName: event.community_name,
            eventDate: formattedDate,
            eventTime: formattedTime,
            startDateTime: event.start_datetime,
          },
        });

        // Push notification
        await pushService.sendPushNotification(
          pool,
          user.member_id,
          "member",
          pushTitle,
          pushBody,
          {
            type: notificationType,
            eventId: event.id,
          }
        );

        // Mark reminder as sent
        await pool.query(
          `UPDATE event_registrations SET ${reminderColumn} = NOW() WHERE id = $1`,
          [user.registration_id]
        );
      } catch (userError) {
        console.warn(
          `[Scheduler] Failed to send ${reminderType} reminder to user ${user.member_id}:`,
          userError.message
        );
      }
    }

    console.log(
      `[Scheduler] Sent ${reminderType} reminders to ${usersResult.rows.length} users for event "${event.title}"`
    );
  } catch (error) {
    console.error(
      `[Scheduler] Error sending reminders for event ${event.id}:`,
      error
    );
  }
};

/**
 * Manually trigger reminder check (for testing)
 */
const triggerReminderCheck = async () => {
  console.log("[Scheduler] Manually triggering reminder check...");
  await sendEventReminders();
};

/**
 * Send attendance confirmation notifications
 * Triggers ~1 hour after event end for registered users who haven't confirmed attendance
 */
const sendAttendanceConfirmations = async () => {
  if (!pool) {
    console.error("[Scheduler] Pool not initialized");
    return;
  }

  try {
    const now = new Date();

    // Window: events that ended between 45m and 1h15m ago
    const endedAfter = new Date(now.getTime() - 1.25 * 60 * 60 * 1000);
    const endedBefore = new Date(now.getTime() - 0.75 * 60 * 60 * 1000);

    // Get recently ended events (using end_datetime or start_datetime + 1h as fallback)
    const eventsResult = await pool.query(
      `SELECT e.id, e.title, e.community_id, c.name as community_name,
              COALESCE(e.end_datetime, e.start_datetime + INTERVAL '1 hour') as effective_end
       FROM events e
       JOIN communities c ON e.community_id = c.id
       WHERE (COALESCE(e.end_datetime, e.start_datetime + INTERVAL '1 hour') BETWEEN $1 AND $2)
         AND e.is_published = true
         AND (e.is_cancelled = false OR e.is_cancelled IS NULL)`,
      [endedAfter.toISOString(), endedBefore.toISOString()]
    );

    let totalSent = 0;

    for (const event of eventsResult.rows) {
      // Get registered users who haven't confirmed attendance yet
      const usersResult = await pool.query(
        `SELECT er.id as registration_id, er.member_id, m.name as member_name
         FROM event_registrations er
         JOIN members m ON er.member_id = m.id
         WHERE er.event_id = $1
           AND er.registration_status IN ('registered', 'attended', 'confirmed')
           AND er.attendance_status IS NULL
           AND er.attendance_confirmed_at IS NULL`,
        [event.id]
      );

      if (usersResult.rows.length === 0) continue;

      for (const user of usersResult.rows) {
        try {
          // In-app notification
          await notificationService.createSimpleNotification(pool, {
            recipientId: user.member_id,
            recipientType: "member",
            actorId: event.community_id,
            actorType: "community",
            type: "attendance_confirmation",
            payload: {
              eventId: event.id,
              eventTitle: event.title,
              communityName: event.community_name,
            },
          });

          // Push notification
          await pushService.sendPushNotification(
            pool,
            user.member_id,
            "member",
            "Did you attend? 🎫",
            `Let us know if you attended ${event.title}`,
            {
              type: "attendance_confirmation",
              eventId: event.id,
            }
          );

          totalSent++;
        } catch (userError) {
          console.warn(
            `[Scheduler] Failed to send attendance confirmation to user ${user.member_id}:`,
            userError.message
          );
        }
      }
    }

    if (totalSent > 0) {
      console.log(
        `[Scheduler] Sent ${totalSent} attendance confirmation notifications for ${eventsResult.rows.length} events`
      );
    }
  } catch (error) {
    console.error("[Scheduler] Error in sendAttendanceConfirmations:", error);
  }
};

module.exports = {
  init,
  sendEventReminders,
  triggerReminderCheck,
  sendAttendanceConfirmations,
};
