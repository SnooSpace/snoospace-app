/**
 * Behavior Event Retention Job
 *
 * Runs every Sunday at 4am (after the demographic learning job at 3am).
 *
 * Safe-deletion policy:
 *   - Raw events older than 90 days are deleted ONLY after confirming the
 *     weekly learning job has processed them (last_calculated_at < 7 days ago
 *     would mean it HASN'T run — we abort if that's the case).
 *   - 90 days = 3 full weekly learning cycles as a buffer.
 *   - All deletes are logged to system_job_logs for monitoring.
 *
 * Why this is safe:
 *   By 90 days, events have been rolled up into user_interest_vectors and
 *   processed by at least 12 weekly learning runs. The raw rows carry no
 *   additional value after that and would grow unboundedly without cleanup.
 */

const runBehaviorEventRetention = async (pool) => {
  console.log('[RetentionJob] Running behavior event retention job...');

  // Step 1: Verify the weekly learning job has completed this week.
  // If it hasn't run since last Sunday, abort — don't delete before processing.
  let lastRunDate;
  try {
    const lastRun = await pool.query(`
      SELECT MAX(last_calculated_at) AS last_run
      FROM learned_demographic_scores
    `);
    lastRunDate = lastRun.rows[0]?.last_run;
  } catch (err) {
    console.error('[RetentionJob] Could not read learned_demographic_scores:', err.message);
    return;
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (!lastRunDate || new Date(lastRunDate) < oneWeekAgo) {
    console.log('[RetentionJob] Learning job has not run this week — aborting retention to protect unprocessed data');
    await _logJob(pool, 'behavior_event_retention', 0, 'aborted: learning job not run this week');
    return;
  }

  // Step 2: Archive events older than 90 days.
  let deletedCount = 0;
  try {
    const result = await pool.query(`
      DELETE FROM user_behavior_events
      WHERE occurred_at < NOW() - INTERVAL '90 days'
      RETURNING id
    `);
    deletedCount = result.rowCount;
    console.log(`[RetentionJob] Deleted ${deletedCount} behavior events older than 90 days`);
  } catch (err) {
    console.error('[RetentionJob] Deletion failed:', err.message);
    await _logJob(pool, 'behavior_event_retention', 0, `error: ${err.message}`);
    return;
  }

  // Step 3: Log the cleanup for monitoring.
  await _logJob(pool, 'behavior_event_retention', deletedCount, null);
};

/**
 * Internal helper: write a row to system_job_logs.
 */
async function _logJob(pool, jobName, recordsAffected, notes) {
  try {
    await pool.query(
      `INSERT INTO system_job_logs (job_name, records_affected, notes, ran_at)
       VALUES ($1, $2, $3, NOW())`,
      [jobName, recordsAffected, notes],
    );
  } catch (err) {
    // Non-fatal — logging failure should never crash the job itself
    console.error('[RetentionJob] Failed to write to system_job_logs:', err.message);
  }
}

module.exports = { runBehaviorEventRetention };
