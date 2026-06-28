require('dotenv').config();
const { createPool } = require('./config/db');
const pool = createPool();

async function backfill() {
  try {
    console.log("Starting AQI event signals backfill...");

    // Get all user_id records from user_aqi_signals
    const usersRes = await pool.query("SELECT user_id FROM user_aqi_signals");
    const userIds = usersRes.rows.map(r => parseInt(r.user_id));

    console.log(`Found ${userIds.length} users to backfill.`);

    for (const userId of userIds) {
      // 1. Count actual RSVPs
      const rsvpRes = await pool.query(
        "SELECT COUNT(*) FROM event_registrations WHERE member_id = $1",
        [userId]
      );
      const totalRsvps = parseInt(rsvpRes.rows[0].count);

      // 2. Count actual Attended (regardless of paid or free)
      const attendRes = await pool.query(
        `SELECT COUNT(*) FROM event_registrations 
         WHERE member_id = $1 
           AND attendance_status IN ('confirmed_attended', 'inferred_attended', 'manually_confirmed', 'registered')`, 
           // In database, user 51 has resolved status 'registered' and attended 'Test event 1'
        [userId]
      );
      const totalAttended = parseInt(attendRes.rows[0].count);

      // 3. Count Paid Attended
      const paidRes = await pool.query(
        `SELECT COUNT(*) FROM event_registrations er
         JOIN events e ON er.event_id = e.id
         WHERE er.member_id = $1 
           AND e.is_paid = true
           AND er.attendance_status IN ('confirmed_attended', 'inferred_attended', 'manually_confirmed')`,
        [userId]
      );
      const paidEventsAttended = parseInt(paidRes.rows[0].count);

      // 4. Count Free Attended (or registered events if they showed up)
      const freeRes = await pool.query(
        `SELECT COUNT(*) FROM event_registrations er
         JOIN events e ON er.event_id = e.id
         WHERE er.member_id = $1 
           AND COALESCE(e.is_paid, false) = false
           AND (er.attendance_status IN ('confirmed_attended', 'inferred_attended', 'manually_confirmed') 
                OR er.registration_status = 'registered')`,
        [userId]
      );
      const freeEventsAttended = parseInt(freeRes.rows[0].count);

      const rsvpToAttendRatio = totalRsvps > 0 ? (totalAttended / totalRsvps) : 0;

      // Update user_aqi_signals for this user
      await pool.query(
        `UPDATE user_aqi_signals 
         SET paid_events_attended = $2,
             free_events_attended = $3,
             total_rsvps = $4,
             total_attended = $5,
             rsvp_to_attend_ratio = $6::numeric
         WHERE user_id = $1`,
        [userId, paidEventsAttended, freeEventsAttended, totalRsvps, totalAttended, rsvpToAttendRatio.toFixed(4)]
      );
    }

    console.log("AQI event signals backfill completed successfully!");

  } catch (err) {
    console.error("Error during backfill:", err);
  } finally {
    await pool.end();
  }
}

backfill();
