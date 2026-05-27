/**
 * backfillSignals.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time script: retroactively synthesises behavioral signals for ALL
 * interactions that happened BEFORE the signalEmitter was wired up.
 *
 * Sources backfilled:
 *   1. poll_votes           → poll_vote
 *   2. qna_questions        → qna_question
 *   3. qna_question_upvotes → qna_upvote
 *   4. challenge_participations → challenge_join
 *   5. challenge_submissions   → challenge_submit
 *   6. prompt_submissions      → prompt_submit
 *   7. post_likes              → post_like
 *   8. event_registrations     → event_rsvp | paid_event_attended
 *
 * Safe to re-run:
 *   • Checks user_behavior_events for existing signals with the same
 *     (user_id, event_type, metadata->>'sourceId') before inserting.
 *   • Skips if a matching signal already exists.
 *
 * Usage:
 *   cd c:\Dev\SnooSpace\backend
 *   node scripts/backfillSignals.js
 *
 * To dry-run without writing:
 *   DRY_RUN=1 node scripts/backfillSignals.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { createPool } = require('../config/db');

const DRY_RUN = process.env.DRY_RUN === '1';

const SIGNAL_STRENGTH_MAP = {
  event_rsvp:           1.0,
  paid_event_attended:  3.0,
  poll_vote:            0.8,
  qna_question:         0.7,
  qna_upvote:           0.4,
  challenge_join:       0.9,
  challenge_submit:     1.8,
  prompt_submit:        0.9,
  post_like:            0.3,
};

const pool = createPool();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getCategoryForPost(postId) {
  const r = await pool.query(
    `SELECT c.category
     FROM posts p
     JOIN communities c ON p.author_id = c.id AND p.author_type = 'community'
     WHERE p.id = $1 LIMIT 1`,
    [postId],
  );
  return r.rows[0]?.category || null;
}

async function getCategoryForEvent(eventId) {
  const r = await pool.query(
    `SELECT c.category
     FROM events e
     JOIN communities c ON e.community_id = c.id
     WHERE e.id = $1 LIMIT 1`,
    [eventId],
  );
  return r.rows[0]?.category || null;
}

/**
 * Idempotent signal emitter for backfill.
 * Uses a sourceId in metadata to deduplicate if re-run.
 */
async function backfillSignal({ userId, userType, eventType, category, metadata, createdAt }) {
  if (!userId || !userType) return false;

  const strength = SIGNAL_STRENGTH_MAP[eventType] ?? 0.3;
  const sourceId = metadata?.sourceId;

  // Dedup check — skip if this exact interaction was already backfilled
  if (sourceId !== undefined) {
    const existing = await pool.query(
      `SELECT id FROM user_behavior_events
       WHERE user_id = $1 AND event_type = $2 AND metadata->>'sourceId' = $3
       LIMIT 1`,
      [userId, eventType, String(sourceId)],
    );
    if (existing.rows.length > 0) return false; // already recorded
  }

  if (DRY_RUN) return true; // report "would emit" without writing

  // Upsert aqi_signals row
  await pool.query(
    `INSERT INTO user_aqi_signals (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );

  // Insert behavior event (preserve original timestamp)
  await pool.query(
    `INSERT INTO user_behavior_events (user_id, event_type, category, metadata, signal_strength, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, eventType, category, JSON.stringify({ ...metadata, backfilled: true }), strength, createdAt || new Date()],
  );

  // Upsert interest vector
  if (category) {
    await pool.query(
      `INSERT INTO user_interest_vectors (user_id, category, raw_score, signal_count, last_signal_at)
       VALUES ($1, $2, $3, 1, $4)
       ON CONFLICT (user_id, category) DO UPDATE SET
         raw_score      = user_interest_vectors.raw_score + $3,
         signal_count   = user_interest_vectors.signal_count + 1,
         last_signal_at = GREATEST(user_interest_vectors.last_signal_at, $4)`,
      [userId, category.toLowerCase(), strength, createdAt || new Date()],
    );
  }

  // Increment total_behavior_events + recalculate weights
  await pool.query(
    `UPDATE user_aqi_signals SET
       total_behavior_events = total_behavior_events + 1,
       onboarding_weight     = GREATEST(0.02, 0.90 * EXP(-0.008 * (total_behavior_events + 1))),
       behavior_weight       = 1.0 - GREATEST(0.02, 0.90 * EXP(-0.008 * (total_behavior_events + 1))),
       last_active_at        = GREATEST(COALESCE(last_active_at, $2), $2),
       updated_at            = NOW()
     WHERE user_id = $1`,
    [userId, createdAt || new Date()],
  );

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-source backfillers
// ─────────────────────────────────────────────────────────────────────────────

async function backfillPollVotes() {
  const { rows } = await pool.query(
    `SELECT pv.voter_id as user_id, pv.voter_type as user_type,
            pv.post_id, pv.created_at
     FROM poll_votes pv
     ORDER BY pv.created_at ASC`,
  );
  let emitted = 0, skipped = 0;
  for (const r of rows) {
    const category = await getCategoryForPost(r.post_id);
    const ok = await backfillSignal({
      userId: r.user_id, userType: r.user_type,
      eventType: 'poll_vote', category,
      metadata: { postId: r.post_id, sourceId: `pollvote_${r.user_id}_${r.post_id}` },
      createdAt: r.created_at,
    });
    ok ? emitted++ : skipped++;
  }
  return { source: 'poll_votes', total: rows.length, emitted, skipped };
}

async function backfillQnaQuestions() {
  const { rows } = await pool.query(
    `SELECT q.author_id as user_id, q.author_type as user_type,
            q.post_id, q.id as question_id, q.created_at
     FROM qna_questions q
     ORDER BY q.created_at ASC`,
  );
  let emitted = 0, skipped = 0;
  for (const r of rows) {
    const category = await getCategoryForPost(r.post_id);
    const ok = await backfillSignal({
      userId: r.user_id, userType: r.user_type,
      eventType: 'qna_question', category,
      metadata: { postId: r.post_id, questionId: r.question_id, sourceId: `qnaq_${r.question_id}` },
      createdAt: r.created_at,
    });
    ok ? emitted++ : skipped++;
  }
  return { source: 'qna_questions', total: rows.length, emitted, skipped };
}

async function backfillQnaUpvotes() {
  const { rows } = await pool.query(
    `SELECT u.voter_id as user_id, u.voter_type as user_type,
            q.post_id, u.question_id, u.created_at
     FROM qna_question_upvotes u
     JOIN qna_questions q ON u.question_id = q.id
     ORDER BY u.created_at ASC`,
  );
  let emitted = 0, skipped = 0;
  for (const r of rows) {
    const category = await getCategoryForPost(r.post_id);
    const ok = await backfillSignal({
      userId: r.user_id, userType: r.user_type,
      eventType: 'qna_upvote', category,
      metadata: { questionId: r.question_id, postId: r.post_id, sourceId: `qnaupvote_${r.user_id}_${r.question_id}` },
      createdAt: r.created_at,
    });
    ok ? emitted++ : skipped++;
  }
  return { source: 'qna_question_upvotes', total: rows.length, emitted, skipped };
}

async function backfillChallengeJoins() {
  const { rows } = await pool.query(
    `SELECT cp.participant_id as user_id, cp.participant_type as user_type,
            cp.post_id, cp.id as participation_id, cp.created_at
     FROM challenge_participations cp
     ORDER BY cp.created_at ASC`,
  );
  let emitted = 0, skipped = 0;
  for (const r of rows) {
    const category = await getCategoryForPost(r.post_id);
    const ok = await backfillSignal({
      userId: r.user_id, userType: r.user_type,
      eventType: 'challenge_join', category,
      metadata: { postId: r.post_id, participationId: r.participation_id, sourceId: `challengejoin_${r.participation_id}` },
      createdAt: r.created_at,
    });
    ok ? emitted++ : skipped++;
  }
  return { source: 'challenge_participations', total: rows.length, emitted, skipped };
}

async function backfillChallengeSubmissions() {
  const { rows } = await pool.query(
    `SELECT cs.id as submission_id, cs.post_id,
            cp.participant_id as user_id, cp.participant_type as user_type,
            cs.created_at
     FROM challenge_submissions cs
     JOIN challenge_participations cp ON cs.participant_id = cp.id
     WHERE cs.status != 'withdrawn'
     ORDER BY cs.created_at ASC`,
  );
  let emitted = 0, skipped = 0;
  for (const r of rows) {
    const category = await getCategoryForPost(r.post_id);
    const ok = await backfillSignal({
      userId: r.user_id, userType: r.user_type,
      eventType: 'challenge_submit', category,
      metadata: { postId: r.post_id, submissionId: r.submission_id, sourceId: `challengesubmit_${r.submission_id}` },
      createdAt: r.created_at,
    });
    ok ? emitted++ : skipped++;
  }
  return { source: 'challenge_submissions', total: rows.length, emitted, skipped };
}

async function backfillPromptSubmissions() {
  const { rows } = await pool.query(
    `SELECT ps.id as submission_id, ps.post_id,
            ps.author_id as user_id, ps.author_type as user_type,
            ps.created_at
     FROM prompt_submissions ps
     WHERE ps.status != 'rejected'
     ORDER BY ps.created_at ASC`,
  );
  let emitted = 0, skipped = 0;
  for (const r of rows) {
    const category = await getCategoryForPost(r.post_id);
    const ok = await backfillSignal({
      userId: r.user_id, userType: r.user_type,
      eventType: 'prompt_submit', category,
      metadata: { postId: r.post_id, submissionId: r.submission_id, sourceId: `promptsubmit_${r.submission_id}` },
      createdAt: r.created_at,
    });
    ok ? emitted++ : skipped++;
  }
  return { source: 'prompt_submissions', total: rows.length, emitted, skipped };
}

async function backfillPostLikes() {
  const { rows } = await pool.query(
    `SELECT pl.liker_id as user_id, pl.liker_type as user_type,
            pl.post_id, pl.created_at
     FROM post_likes pl
     -- Skip self-likes (community liking own post)
     JOIN posts p ON pl.post_id = p.id
     WHERE NOT (pl.liker_id = p.author_id AND pl.liker_type = p.author_type)
     ORDER BY pl.created_at ASC`,
  );
  let emitted = 0, skipped = 0;
  for (const r of rows) {
    const category = await getCategoryForPost(r.post_id);
    const ok = await backfillSignal({
      userId: r.user_id, userType: r.user_type,
      eventType: 'post_like', category,
      metadata: { postId: r.post_id, sourceId: `postlike_${r.user_id}_${r.post_id}` },
      createdAt: r.created_at,
    });
    ok ? emitted++ : skipped++;
  }
  return { source: 'post_likes', total: rows.length, emitted, skipped };
}

async function backfillEventRegistrations() {
  const { rows } = await pool.query(
    `SELECT er.member_id as user_id, er.event_id,
            er.total_amount, er.created_at
     FROM event_registrations er
     WHERE er.registration_status = 'registered'
     ORDER BY er.created_at ASC`,
  );
  let emitted = 0, skipped = 0;
  for (const r of rows) {
    const isPaid = r.total_amount && parseFloat(r.total_amount) > 0;
    const category = await getCategoryForEvent(r.event_id);
    const ok = await backfillSignal({
      userId: r.user_id, userType: 'member',
      eventType: isPaid ? 'paid_event_attended' : 'event_rsvp', category,
      metadata: { eventId: r.event_id, totalAmount: r.total_amount || 0, sourceId: `evtreg_${r.user_id}_${r.event_id}` },
      createdAt: r.created_at,
    });
    ok ? emitted++ : skipped++;
  }
  return { source: 'event_registrations', total: rows.length, emitted, skipped };
}

// ─────────────────────────────────────────────────────────────────────────────
// AQI recalculation for all affected users
// ─────────────────────────────────────────────────────────────────────────────

async function recalculateAllAqi(affectedUserIds) {
  console.log(`\n🔄 Triggering AQI recalculation for ${affectedUserIds.size} users...`);

  // Instead of requiring the full demographic lookup (which might not exist in
  // all environments), we update the tier directly from the accumulated
  // behavior events as a simplified score boost.  The proper demographic AQI
  // will apply on next login / next signal cycle.
  let recalced = 0;
  for (const userId of affectedUserIds) {
    try {
      // Simple recalc: scale behavioural score from event count alone
      // (the full recalc runs async every 10 signals in production)
      const r = await pool.query(
        `SELECT total_behavior_events FROM user_aqi_signals WHERE user_id = $1`,
        [userId],
      );
      if (r.rows.length === 0) continue;

      const events = parseInt(r.rows[0].total_behavior_events) || 0;
      // Simplified behavioural score: log-scaled, caps at 60 (leaves room for demographics)
      const behaviouralScore = Math.min(60, Math.round(Math.log1p(events) * 12));

      let tier = 4;
      if (behaviouralScore >= 45) tier = 1;
      else if (behaviouralScore >= 30) tier = 2;
      else if (behaviouralScore >= 15) tier = 3;

      if (!DRY_RUN) {
        await pool.query(
          `UPDATE user_aqi_signals
           SET aqi_score       = GREATEST(COALESCE(aqi_score, 0), $2),
               aqi_tier        = LEAST(COALESCE(aqi_tier, 4), $3),
               aqi_trajectory  = 'rising',
               last_calculated_at = NOW(),
               updated_at      = NOW()
           WHERE user_id = $1`,
          [userId, behaviouralScore, tier],
        );
      }

      recalced++;
    } catch (err) {
      console.error(`  ⚠️  AQI recalc failed for user ${userId}:`, err.message);
    }
  }
  return recalced;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main runner
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SnooSpace AQI Signal Backfill');
  if (DRY_RUN) console.log('  ⚠️  DRY RUN MODE — no data will be written');
  console.log('═══════════════════════════════════════════════════════════\n');

  const affectedUsers = new Set();
  const results = [];

  const sources = [
    backfillPollVotes,
    backfillQnaQuestions,
    backfillQnaUpvotes,
    backfillChallengeJoins,
    backfillChallengeSubmissions,
    backfillPromptSubmissions,
    backfillPostLikes,
    backfillEventRegistrations,
  ];

  for (const fn of sources) {
    process.stdout.write(`  ⏳ ${fn.name}...`);
    try {
      const result = await fn();
      results.push(result);
      console.log(` ✅  total=${result.total}  emitted=${result.emitted}  skipped=${result.skipped}`);

      // We need to collect affected user IDs — re-query post-hoc for simplicity
      const { rows } = await pool.query(
        `SELECT DISTINCT user_id FROM user_behavior_events
         WHERE metadata->>'backfilled' = 'true'`,
      );
      rows.forEach((r) => affectedUsers.add(r.user_id));
    } catch (err) {
      console.error(` ❌  ${fn.name} failed:`, err.message);
    }
  }

  // ── Summary table ──────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────');
  console.log('  Source                   Total   Emitted  Skipped');
  console.log('─────────────────────────────────────────────────────────');
  let totalEmitted = 0;
  for (const r of results) {
    const src = r.source.padEnd(25);
    console.log(`  ${src}  ${String(r.total).padStart(5)}   ${String(r.emitted).padStart(7)}  ${String(r.skipped).padStart(7)}`);
    totalEmitted += r.emitted;
  }
  console.log('─────────────────────────────────────────────────────────');
  console.log(`  TOTAL signals emitted: ${totalEmitted}`);
  console.log(`  Affected users: ${affectedUsers.size}`);

  // ── AQI recalc ─────────────────────────────────────────────────────────────
  if (affectedUsers.size > 0) {
    const recalced = await recalculateAllAqi(affectedUsers);
    console.log(`  AQI recalculated for: ${recalced} users`);
  }

  console.log('\n✅  Backfill complete.\n');
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error in backfill:', err);
  process.exit(1);
});
