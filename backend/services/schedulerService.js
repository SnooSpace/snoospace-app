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
const { runDemographicLearningJob } = require("../jobs/learnDemographicScores");
const { runBehaviorEventRetention } = require("../jobs/behaviorEventRetention");
const { runRecommendationsJob } = require("../jobs/computeRecommendations");
const {
  resolvePostEventAttendance,
  analysePostEventEcho,
} = require("../utils/postEventAttendanceResolver");

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

  // Run ticket reservation cleanup every minute
  cron.schedule("* * * * *", async () => {
    await cleanupExpiredReservations();
  });

  // Run weekly demographic learning job every Sunday at 3am
  cron.schedule("0 3 * * 0", async () => {
    console.log("[Scheduler] Running weekly demographic learning job...");
    await runDemographicLearningJob(pool);
  });

  // Run behavior event retention every Sunday at 4am (after the 3am learning job)
  // Deletes raw events older than 90 days once they've been processed
  cron.schedule("0 4 * * 0", async () => {
    console.log("[Scheduler] Running behavior event retention job...");
    await runBehaviorEventRetention(pool);
  });

  // ── Daily at 5am: compute "People You Should Meet" recommendations ─────────
  // Runs after the weekly learning job (Sunday) or independently on other days.
  // Generates candidates, scores them, upserts into recommended_matches,
  // and caches top 30 per user in Redis (TTL 24h).
  cron.schedule("0 5 * * *", async () => {
    if (!pool) return;
    console.log("[Scheduler] Running daily recommendations job...");
    await runRecommendationsJob(pool);
  });

  // ── Hourly: resolve attendance for events that ended in the last 1–3 hours ──
  // Runs at the top of every hour. Finds events that ended between 1h and 3h ago
  // with unresolved registrations, and runs the attendance inference logic.
  cron.schedule("0 * * * *", async () => {
    if (!pool) return;
    try {
      const recentlyEnded = await pool.query(`
        SELECT DISTINCT e.id
        FROM events e
        WHERE COALESCE(e.end_datetime, e.start_datetime + INTERVAL '2 hours')
              BETWEEN NOW() - INTERVAL '3 hours' AND NOW() - INTERVAL '1 hour'
          AND NOT EXISTS (
            SELECT 1 FROM event_registrations er
            WHERE er.event_id = e.id
              AND er.attendance_status != 'registered'
            LIMIT 1
          )
          AND EXISTS (
            SELECT 1 FROM event_registrations er2
            WHERE er2.event_id = e.id
              AND er2.attendance_status = 'registered'
            LIMIT 1
          )
      `);
      for (const row of recentlyEnded.rows) {
        await resolvePostEventAttendance(pool, row.id).catch(err =>
          console.error(`[Scheduler] Attendance resolver failed for event ${row.id}:`, err.message)
        );
      }
      if (recentlyEnded.rows.length > 0) {
        console.log(`[Scheduler] Resolved attendance for ${recentlyEnded.rows.length} event(s)`);
      }
    } catch (err) {
      console.error("[Scheduler] Post-event resolution job error:", err.message);
    }
  });

  // ── Every 6h: analyse post-event echo windows that have closed ──────────────
  // Finds 48h observation windows that opened after an event and have now closed.
  cron.schedule("0 */6 * * *", async () => {
    if (!pool) return;
    try {
      const windows = await pool.query(`
        SELECT
          ube.user_id,
          (ube.metadata->>'event_id')::int     AS event_id,
          ube.occurred_at                       AS window_start,
          (ube.metadata->>'window_ends_at')::timestamptz AS window_end,
          e.community_id,
          e.category
        FROM user_behavior_events ube
        JOIN events e ON e.id = (ube.metadata->>'event_id')::int
        WHERE ube.event_type = 'post_event_window_start'
          AND ube.occurred_at >= NOW() - INTERVAL '72 hours'
          AND (ube.metadata->>'window_ends_at')::timestamptz <= NOW()
          AND NOT EXISTS (
            SELECT 1 FROM user_behavior_events analysed
            WHERE analysed.user_id = ube.user_id
              AND analysed.event_type = 'post_event_echo_analysed'
              AND analysed.metadata->>'event_id' = ube.metadata->>'event_id'
          )
      `);
      for (const window of windows.rows) {
        await analysePostEventEcho(pool, window).catch(err =>
          console.error(`[Scheduler] Echo analysis failed for user ${window.user_id}:`, err.message)
        );
      }
      if (windows.rows.length > 0) {
        console.log(`[Scheduler] Analysed ${windows.rows.length} post-event echo window(s)`);
      }
    } catch (err) {
      console.error("[Scheduler] Echo analysis job error:", err.message);
    }
  });

  // ── Every 15 minutes: expire open plans past their scheduled time ──────────
  cron.schedule("*/15 * * * *", async () => {
    if (!pool) return;
    try {
      const result = await pool.query("SELECT expire_open_plans()");
      // Function returns void; no rows to log
    } catch (err) {
      console.error("[Scheduler] expire_open_plans error:", err.message);
    }
  });

  // ── Daily at 1am: generate next recurring plan instances ───────────────────
  cron.schedule("0 1 * * *", async () => {
    if (!pool) return;
    try {
      await pool.query("SELECT generate_recurring_plans()");
      console.log("[Scheduler] generate_recurring_plans ran successfully");
    } catch (err) {
      console.error("[Scheduler] generate_recurring_plans error:", err.message);
    }
  });

  // ── Daily at 2am: expire travel sparks past their end_date ─────────────────
  cron.schedule("0 2 * * *", async () => {
    if (!pool) return;
    try {
      const result = await pool.query(`
        UPDATE user_sparks
        SET is_expired = true
        WHERE end_date < CURRENT_DATE
          AND is_expired = false
      `);
      if (result.rowCount > 0) {
        console.log(`[Scheduler] Expired ${result.rowCount} travel spark(s)`);
      }
    } catch (err) {
      console.error("[Scheduler] Travel spark expiry error:", err.message);
    }
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

/**
 * Clean up expired ticket reservations
 * Runs every minute to release reserved tickets back to the pool
 * when users abandon checkout without completing or releasing
 */
const cleanupExpiredReservations = async () => {
  if (!pool) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get all expired reservations
    const expiredResult = await client.query(
      `SELECT id, ticket_type_id, quantity, session_id, member_id, event_id
       FROM ticket_reservations
       WHERE expires_at < NOW()`
    );

    if (expiredResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return;
    }

    console.log(
      `[Scheduler] Cleaning up ${expiredResult.rows.length} expired ticket reservations`
    );

    // Decrement reserved_count for each expired reservation
    for (const reservation of expiredResult.rows) {
      await client.query(
        `UPDATE ticket_types
         SET reserved_count = GREATEST(0, COALESCE(reserved_count, 0) - $1)
         WHERE id = $2`,
        [reservation.quantity, reservation.ticket_type_id]
      );
    }

    // Delete all expired reservations
    await client.query(
      `DELETE FROM ticket_reservations WHERE expires_at < NOW()`
    );

    await client.query("COMMIT");

    // Log unique sessions cleaned up
    const uniqueSessions = [
      ...new Set(expiredResult.rows.map((r) => r.session_id)),
    ];
    console.log(
      `[Scheduler] Released ${expiredResult.rows.length} expired reservations from ${uniqueSessions.length} sessions`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Scheduler] Error cleaning up expired reservations:", error);
  } finally {
    client.release();
  }
};

module.exports = {
  init,
  sendEventReminders,
  triggerReminderCheck,
  sendAttendanceConfirmations,
  cleanupExpiredReservations,
};
