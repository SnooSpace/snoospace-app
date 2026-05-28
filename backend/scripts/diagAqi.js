require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { createPool } = require("../config/db");
const p = createPool();

async function run() {
  const rows = await p.query(`
    SELECT
      u.user_id,
      u.aqi_score,
      u.aqi_score_4w_ago,
      u.aqi_score - u.aqi_score_4w_ago AS delta,
      u.aqi_tier,
      u.aqi_trajectory,
      u.total_behavior_events,
      u.paid_events_attended,
      u.total_rsvps,
      u.total_attended,
      u.rsvp_to_attend_ratio,
      u.content_depth_score,
      u.professional_hours_ratio,
      u.onboarding_weight,
      u.behavior_weight,
      u.last_calculated_at,
      m.name,
      (SELECT COUNT(*) FROM user_behavior_events WHERE user_id = u.user_id) AS raw_event_count
    FROM user_aqi_signals u
    JOIN members m ON m.id = u.user_id
    ORDER BY u.user_id
  `);
  rows.rows.forEach((r) => {
    console.log("─".repeat(50));
    console.log("User:", r.user_id, "|", r.name);
    console.log(
      "  AQI score:        ",
      r.aqi_score,
      "→ Tier",
      r.aqi_tier,
      "|",
      r.aqi_trajectory,
    );
    console.log(
      "  4w snapshot:      ",
      r.aqi_score_4w_ago,
      "  delta:",
      parseFloat(r.delta).toFixed(2),
    );
    console.log(
      "  total events:     ",
      r.total_behavior_events,
      "(raw behavior rows:",
      r.raw_event_count,
      ")",
    );
    console.log("  paid_events:      ", r.paid_events_attended);
    console.log("  total_rsvps:      ", r.total_rsvps);
    console.log("  total_attended:   ", r.total_attended);
    console.log("  rsvp_ratio:       ", r.rsvp_to_attend_ratio);
    console.log("  content_depth:    ", r.content_depth_score);
    console.log("  prof_hours:       ", r.professional_hours_ratio);
    console.log(
      "  onboard/behavior: ",
      parseFloat(r.onboarding_weight).toFixed(3),
      "/",
      parseFloat(r.behavior_weight).toFixed(3),
    );
    console.log("  last_calculated:  ", r.last_calculated_at);
  });
  await p.end();
}
run().catch((e) => {
  console.error(e.message);
  p.end();
});
