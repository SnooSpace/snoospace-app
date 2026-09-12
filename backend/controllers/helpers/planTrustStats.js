/**
 * computeTrustStats
 *
 * Derives the four trust-stats fields surfaced on Open Plans:
 *   member_since       – "MMM YYYY" string derived from created_at
 *   events_joined_count – COUNT of event_registrations for this member
 *   top_interests      – first 3 items from members.interests (display-ready strings)
 *   activity_level     – tier label: "New" | "Low" | "Active" | "Very Active"
 *                        (based on posts-per-month since joining; raw post_count is
 *                        used only internally and is never returned to the caller)
 *
 * @param {import('pg').Pool} pool
 * @param {number}            memberId
 * @param {object|null}       [prefetchedRow]  Optional already-fetched row with at least
 *                                             { created_at, interests }.  When provided
 *                                             the SELECT on members is skipped entirely,
 *                                             avoiding a redundant round-trip for callers
 *                                             (e.g. getPlanById which already fetches the
 *                                             host row in its main Promise.all).
 * @returns {Promise<{
 *   member_since: string,
 *   events_joined_count: number,
 *   top_interests: string[],
 *   activity_level: 'New'|'Low'|'Active'|'Very Active'
 * }>}
 */
async function computeTrustStats(pool, memberId, prefetchedRow = null) {
  // ── Member row (skip SELECT when caller already has it) ─────────────────────
  let memberRow = prefetchedRow;
  if (!memberRow) {
    const r = await pool.query(
      `SELECT created_at, interests FROM members WHERE id = $1`,
      [memberId]
    );
    memberRow = r.rows[0] || {};
  }

  const createdAt = memberRow.created_at ? new Date(memberRow.created_at) : new Date();

  // ── Events joined + post count in parallel ───────────────────────────────────
  const [eventsR, postsR] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS count
       FROM event_registrations
       WHERE member_id = $1
         AND registration_status IN ('registered', 'attended', 'confirmed')`,
      [memberId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count
       FROM posts
       WHERE author_id = $1
         AND author_type = 'member'`,
      [memberId]
    ),
  ]);

  const eventsJoinedCount = eventsR.rows[0]?.count ?? 0;
  const postCount         = postsR.rows[0]?.count ?? 0; // used for tier only; never returned

  // ── Activity Level tier ──────────────────────────────────────────────────────
  // Thresholds:
  //   New       – account < 30 days (avoids near-zero denominator edge case)
  //   Low       – < 2 posts / month since joining
  //   Active    – 2–8 posts / month
  //   Very Active – > 8 posts / month
  const accountAgeDays   = (Date.now() - createdAt.getTime()) / 86_400_000;
  const accountAgeMonths = accountAgeDays / 30;

  let activityLevel;
  if (accountAgeDays < 30) {
    activityLevel = 'New';
  } else {
    const postsPerMonth = accountAgeMonths > 0 ? postCount / accountAgeMonths : 0;
    if (postsPerMonth > 8)       activityLevel = 'Very Active';
    else if (postsPerMonth >= 2) activityLevel = 'Active';
    else                         activityLevel = 'Low';
  }

  // ── Member since string ──────────────────────────────────────────────────────
  const memberSince = createdAt.toLocaleDateString('en-US', {
    month: 'short',
    year:  'numeric',
  });

  // ── Top interests (cap at 3) ─────────────────────────────────────────────────
  let rawInterests = memberRow.interests;
  if (typeof rawInterests === 'string') {
    try { rawInterests = JSON.parse(rawInterests); } catch { rawInterests = []; }
  }
  const topInterests = Array.isArray(rawInterests) ? rawInterests.slice(0, 3) : [];

  // ── Return ONLY the clean computed fields ────────────────────────────────────
  // Raw post_count, created_at, and the full interests array are intentionally
  // absent from the returned shape so callers cannot accidentally forward them.
  return {
    member_since:        memberSince,
    events_joined_count: eventsJoinedCount,
    top_interests:       topInterests,
    activity_level:      activityLevel,
  };
}

module.exports = { computeTrustStats };
