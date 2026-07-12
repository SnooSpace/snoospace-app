/**
 * computeRecommendations.js — "People You Should Meet" Batch Job
 *
 * Runs daily (via schedulerService cron at 5am).
 * For every active user:
 *   1. Gate candidates via SQL (hard filters — no scoring yet)
 *   2. Score each candidate across 9 weighted signals
 *   3. Pick top reasons (max 2) for UI display
 *   4. Upsert into recommended_matches
 *   5. Cache top 30 into Redis (key: user:{id}:recs, TTL 24h)
 *
 * All weights and caps are read from config/recommendationConfig.js —
 * never hardcoded here. Retune by editing the config.
 */

'use strict';

const cfg = require('../config/recommendationConfig');
const { setUserRecs } = require('../services/redisService');

// ── Math helpers ──────────────────────────────────────────────────────────────

/** Rarity weight: 1 / log2(count + 2) — always positive, decays as count grows */
function rarityWeight(count) {
  return 1 / Math.log2((count || 0) + 2);
}

/** Haversine distance in km between two lat/lng points */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Proximity decay: 1 / (1 + distance_km) */
function proximityDecay(distKm) {
  return 1 / (1 + distKm);
}

// ── Candidate gate ────────────────────────────────────────────────────────────

/**
 * Fetches the gated candidate pool for a given user via SQL.
 * All hard filters applied here — no scoring yet.
 *
 * Gates applied:
 *   - Not the user themselves
 *   - Same city (case-insensitive, from location->>'city')
 *   - Active within ACTIVE_WITHIN_DAYS (session.last_used_at)
 *   - Not already in a circle (either direction)
 *   - No pending circle request (either direction)
 *   - Not blocked (either direction)
 *   - Not dismissed within DISMISSAL_COOLDOWN_DAYS
 *   - Not a creator-mode account (those use a separate follow model)
 *   - Not a profile belonging to the same account-switcher group as the
 *     requesting user (identified by shared email across members/communities/
 *     sponsors/venues — the same email the client-side switcher uses)
 *
 * Returns up to CANDIDATE_POOL_LIMIT rows ordered by most-recently-active.
 */
async function fetchCandidates(pool, userId, userCity, userEmail) {
  const { rows } = await pool.query(
    `
    SELECT
      m.id,
      m.name,
      m.nickname,
      m.username,
      m.profile_photo_url,
      m.occupation,
      m.campus_id,
      m.verification_tier,
      m.interests,
      m.location,
      (m.location->>'lat')::float  AS lat,
      (m.location->>'lng')::float  AS lng
    FROM members m
    -- Activity gate: at least one session within N days
    JOIN sessions s
      ON s.user_id = m.id
     AND s.last_used_at > NOW() - ($2 || ' days')::INTERVAL
    WHERE m.id != $1
      -- Same city gate (case-insensitive)
      AND LOWER(TRIM(m.location->>'city')) = LOWER(TRIM($3))
      -- Not a creator-mode account
      AND (m.is_creator_mode_enabled IS NULL OR m.is_creator_mode_enabled = false)
      -- Account-switcher group gate: exclude any member profile that shares
      -- the requesting user's email (same real-world person, different profile type)
      AND LOWER(TRIM(m.email)) != LOWER(TRIM($6))
      -- Not already in circle (either direction)
      AND NOT EXISTS (
        SELECT 1 FROM circles c
        WHERE (c.user_a_id = LEAST($1::bigint, m.id) AND c.user_b_id = GREATEST($1::bigint, m.id))
      )
      -- No pending circle request (either direction)
      AND NOT EXISTS (
        SELECT 1 FROM circle_requests cr
        WHERE cr.status = 'pending'
          AND ((cr.sender_id = $1 AND cr.receiver_id = m.id)
            OR (cr.sender_id = m.id AND cr.receiver_id = $1))
      )
      -- Not blocked (either direction)
      AND NOT EXISTS (
        SELECT 1 FROM user_blocks ub
        WHERE (ub.blocker_id = $1 AND ub.blocked_id = m.id)
           OR (ub.blocker_id = m.id AND ub.blocked_id = $1)
      )
      -- Not recently dismissed
      AND NOT EXISTS (
        SELECT 1 FROM dismissed_recommendations dr
        WHERE dr.user_id = $1
          AND dr.candidate_id = m.id
          AND dr.dismissed_at > NOW() - ($4 || ' days')::INTERVAL
      )
    GROUP BY m.id
    ORDER BY MAX(s.last_used_at) DESC
    LIMIT $5
    `,
    [
      userId,
      cfg.ACTIVE_WITHIN_DAYS,
      userCity,
      cfg.DISMISSAL_COOLDOWN_DAYS,
      cfg.CANDIDATE_POOL_LIMIT,
      userEmail || '',   // $6 — switcher-group email exclusion
    ]
  );

  return rows;
}

// ── Signal data loaders ───────────────────────────────────────────────────────

/** Load all events attended by this user (attended/confirmed only). */
async function loadUserAttendedEvents(pool, userId) {
  const { rows } = await pool.query(
    `SELECT event_id FROM event_registrations
     WHERE member_id = $1 AND registration_status = ANY($2)`,
    [userId, cfg.EVENT_ATTENDED_STATUSES]
  );
  return new Set(rows.map(r => String(r.event_id)));
}

/** For each event in a set, get attendee count. Returns Map<eventId, count>. */
async function loadEventAttendeeCounts(pool, eventIds) {
  if (eventIds.size === 0) return new Map();
  const ids = [...eventIds];
  const { rows } = await pool.query(
    `SELECT event_id, COUNT(*) AS cnt
     FROM event_registrations
     WHERE event_id = ANY($1) AND registration_status = ANY($2)
     GROUP BY event_id`,
    [ids, cfg.EVENT_ATTENDED_STATUSES]
  );
  return new Map(rows.map(r => [String(r.event_id), parseInt(r.cnt, 10)]));
}

/** Load all community circles (accepted memberships) for this user. */
async function loadUserCommunities(pool, userId) {
  const { rows } = await pool.query(
    `SELECT community_id FROM community_member_circles WHERE member_id = $1`,
    [userId]
  );
  return new Set(rows.map(r => String(r.community_id)));
}

/** For each community in a set, get member count. Returns Map<communityId, count>. */
async function loadCommunityMemberCounts(pool, communityIds) {
  if (communityIds.size === 0) return new Map();
  const ids = [...communityIds];
  const { rows } = await pool.query(
    `SELECT community_id, COUNT(*) AS cnt
     FROM community_member_circles
     WHERE community_id = ANY($1)
     GROUP BY community_id`,
    [ids]
  );
  return new Map(rows.map(r => [String(r.community_id), parseInt(r.cnt, 10)]));
}

/** Load all sparks for a user: returns [{spark_id, category, spark_type, usage_count, label}]. */
async function loadUserSparks(pool, userId) {
  const { rows } = await pool.query(
    `SELECT s.id AS spark_id, s.label, s.category, s.spark_type, s.usage_count
     FROM user_sparks us
     JOIN sparks s ON s.id = us.spark_id
     WHERE us.user_id = $1 AND us.is_expired = false`,
    [userId]
  );
  return rows;
}

/**
 * Count mutual circle connections (2nd-degree): users in circle with BOTH
 * the target user AND the candidate.
 */
async function loadMutualCirclesCount(pool, userId, candidateId) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT shared.other_id) AS cnt
     FROM (
       -- All circle partners of userId
       SELECT CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END AS other_id
       FROM circles c WHERE c.user_a_id = $1 OR c.user_b_id = $1
     ) shared
     WHERE EXISTS (
       -- Check shared.other_id is also in circle with candidateId
       SELECT 1 FROM circles c2
       WHERE (c2.user_a_id = $2 AND c2.user_b_id = shared.other_id)
          OR (c2.user_a_id = shared.other_id AND c2.user_b_id = $2)
     )`,
    [userId, candidateId]
  );
  return parseInt(rows[0]?.cnt || 0, 10);
}

/**
 * Get all interest label → global adopter count.
 * Approximated by counting members whose interests JSONB contains each label.
 * This is run once per job cycle and shared across all user computations.
 */
async function loadInterestAdopterCounts(pool) {
  // interests is JSONB array of strings on members table
  const { rows } = await pool.query(
    `SELECT interest_label, COUNT(*) AS cnt
     FROM (
       SELECT jsonb_array_elements_text(interests) AS interest_label
       FROM members
       WHERE interests IS NOT NULL AND jsonb_typeof(interests) = 'array'
     ) expanded
     GROUP BY interest_label`
  );
  return new Map(rows.map(r => [r.interest_label, parseInt(r.cnt, 10)]));
}

// ── Signal scoring ────────────────────────────────────────────────────────────

/**
 * Compute spark_signal between two users' spark arrays.
 *
 * Social/activity/learning/travel: same-tag overlap, rarity-weighted by usage_count
 * Professional: complementary seeking↔offering pairs only — same-type pairs → 0
 *   "Open to Collaborations" (spark_type=NULL) matches any professional spark
 *
 * Returns { score, bestSparkLabel } where bestSparkLabel is the highest-contributing spark label
 * for the non-professional buckets (used in top_reasons). For professional pairs,
 * returns a neutral label ("Compatible professional goals").
 */
function computeSparkSignal(userSparks, candidateSparks) {
  let totalScore = 0;
  let bestScore  = 0;
  let bestLabel  = null;
  let bestIsProfessional = false;

  const PROF = cfg.PROFESSIONAL_BUCKET;

  for (const us of userSparks) {
    for (const cs of candidateSparks) {
      if (us.category !== cs.category) continue; // must be same category

      if (us.category === PROF) {
        // Professional: complementary seeking↔offering match
        // spark_type NULL means "Open to Collaborations" — matches any professional
        const isComplementary =
          (us.spark_type === null || cs.spark_type === null) ||  // one side is open
          (us.spark_type === 'seeking'  && cs.spark_type === 'offering') ||
          (us.spark_type === 'offering' && cs.spark_type === 'seeking');

        if (!isComplementary) continue; // same-type = 0

        // Rarity weight based on usage_count of both sparks
        const weight = (rarityWeight(us.usage_count) + rarityWeight(cs.usage_count)) / 2;
        totalScore += weight;
        if (weight > bestScore) {
          bestScore = weight;
          bestIsProfessional = true;
          bestLabel = 'Compatible professional goals'; // neutral label per spec
        }
      } else {
        // Social/activity/learning/travel: same-tag overlap
        if (us.spark_id !== cs.spark_id) continue; // must be the exact same spark

        const weight = rarityWeight(us.usage_count);
        totalScore += weight;
        if (weight > bestScore) {
          bestScore = weight;
          bestIsProfessional = false;
          bestLabel = us.label;
        }
      }
    }
  }

  return { score: totalScore, bestLabel, isProfessional: bestIsProfessional };
}

/**
 * Compute shared_interest_signal between two users.
 * Returns { score, rarestLabel } — label of the rarest shared interest.
 * Returns { score: 0 } if fewer than SHARED_INTEREST_MIN shared.
 */
function computeSharedInterestSignal(userInterests, candidateInterests, adopterCounts) {
  // interests are JSONB arrays of strings on members
  const userSet = new Set(Array.isArray(userInterests) ? userInterests : []);
  const shared = (Array.isArray(candidateInterests) ? candidateInterests : [])
    .filter(i => userSet.has(i));

  if (shared.length < cfg.SHARED_INTEREST_MIN) return { score: 0, rarestLabel: null };

  let totalScore = 0;
  let rarestScore = Infinity;
  let rarestLabel = null;

  for (const interest of shared) {
    const count = adopterCounts.get(interest) || 1;
    const w = rarityWeight(count);
    totalScore += w;
    if (count < rarestScore) {
      rarestScore = count;
      rarestLabel = interest;
    }
  }

  return { score: totalScore, rarestLabel };
}

// ── Top reasons builder ───────────────────────────────────────────────────────

/**
 * Given all signal contributions for a candidate pair, select the top 1–2
 * highest-contributing signals and map them to UI labels.
 *
 * Each signal contribution: { type, weightedScore, label }
 * Returns [{type, label}] — max 2 entries.
 */
function buildTopReasons(contributions) {
  // Sort by weighted score descending
  const sorted = contributions
    .filter(c => c.weightedScore > 0 && c.label)
    .sort((a, b) => b.weightedScore - a.weightedScore);

  return sorted.slice(0, 2).map(c => ({ type: c.type, label: c.label }));
}

// ── Per-user scoring pipeline ─────────────────────────────────────────────────

/**
 * Score all candidates for a single user and upsert results.
 * Returns count of candidates scored.
 */
async function scoreUserCandidates(pool, userId, userData, sharedData) {
  const {
    attendedEvents,        // Set<eventId> user attended
    communities,           // Set<communityId> user is in
    sparks,               // [{spark_id, label, category, spark_type, usage_count}]
    adopterCounts,        // Map<interest_label, count>
    eventAttendeeCounts,  // Map<eventId, attendeeCount>
    communityMemberCounts, // Map<communityId, memberCount>
    userCity,
    userEmail,             // email — switcher-group gate
  } = sharedData;

  const candidates = await fetchCandidates(pool, userId, userCity, sharedData.userEmail);
  if (candidates.length === 0) return 0;

  let scored = 0;

  for (const candidate of candidates) {
    try {
      // Load candidate-specific data (these are per-pair)
      const [
        candidateEvents,
        candidateCommunities,
        candidateSparks,
        mutualCirclesCount,
      ] = await Promise.all([
        loadUserAttendedEvents(pool, candidate.id),
        loadUserCommunities(pool, candidate.id),
        loadUserSparks(pool, candidate.id),
        loadMutualCirclesCount(pool, userId, candidate.id),
      ]);

      // ── Signal 1: Shared events ──────────────────────────────────────────
      let sharedEventScore = 0;
      let bestEventName = null;
      let bestEventScore = 0;

      for (const eid of attendedEvents) {
        if (!candidateEvents.has(eid)) continue;
        const attendeeCount = eventAttendeeCounts.get(eid) || 1;
        const w = rarityWeight(attendeeCount);
        sharedEventScore += w;
        if (w > bestEventScore) {
          bestEventScore = w;
          // We'll resolve the event name after scoring if it's a top reason
          bestEventName = eid; // placeholder — resolved below
        }
      }

      // ── Signal 2: Shared communities ─────────────────────────────────────
      let sharedCommunityScore = 0;
      let bestCommunityId = null;
      let bestCommunityScore = 0;

      for (const cid of communities) {
        if (!candidateCommunities.has(cid)) continue;
        const memberCount = communityMemberCounts.get(cid) || 1;
        const w = rarityWeight(memberCount);
        sharedCommunityScore += w;
        if (w > bestCommunityScore) {
          bestCommunityScore = w;
          bestCommunityId = cid;
        }
      }

      // ── Signal 3: Mutual circles ──────────────────────────────────────────
      const mutualCapped = Math.min(mutualCirclesCount, cfg.caps.mutual_circles);

      // ── Signal 4: Sparks ─────────────────────────────────────────────────
      const sparkResult = computeSparkSignal(sparks, candidateSparks);

      // ── Signal 5: Same college ────────────────────────────────────────────
      const sameCollege =
        userData.campus_id &&
        candidate.campus_id &&
        String(userData.campus_id) === String(candidate.campus_id)
          ? 1
          : 0;

      // ── Signal 6: Occupation (conditional on professional spark) ──────────
      const hasProfessionalSpark =
        sparks.some(s => s.category === cfg.PROFESSIONAL_BUCKET) ||
        candidateSparks.some(s => s.category === cfg.PROFESSIONAL_BUCKET);

      const occupationMatch =
        hasProfessionalSpark &&
        userData.occupation &&
        candidate.occupation &&
        userData.occupation.toLowerCase() === candidate.occupation.toLowerCase()
          ? 1
          : 0;

      // ── Signal 7: Shared interests ────────────────────────────────────────
      const interestResult = computeSharedInterestSignal(
        userData.interests,
        candidate.interests,
        adopterCounts
      );

      // ── Signal 8: Proximity ───────────────────────────────────────────────
      let proximity = 0;
      const userLat  = parseFloat(userData.lat);
      const userLng  = parseFloat(userData.lng);
      const candLat  = parseFloat(candidate.lat);
      const candLng  = parseFloat(candidate.lng);

      if (!isNaN(userLat) && !isNaN(userLng) && !isNaN(candLat) && !isNaN(candLng)) {
        const distKm = haversineKm(userLat, userLng, candLat, candLng);
        proximity = proximityDecay(distKm);
      }

      // ── Signal 9: Verification tier ───────────────────────────────────────
      const tierValue = cfg.verification_tier_values[candidate.verification_tier || 'none'] || 0;
      const verificationBoost = Math.min(tierValue, cfg.caps.verification);

      // ── Total weighted score ──────────────────────────────────────────────
      const W = cfg.weights;
      const totalScore =
        W.shared_events        * sharedEventScore     +
        W.shared_communities   * sharedCommunityScore  +
        W.mutual_circles       * mutualCapped          +
        W.sparks               * sparkResult.score     +
        W.same_college         * sameCollege           +
        W.occupation           * occupationMatch       +
        W.shared_interests     * interestResult.score  +
        W.proximity            * proximity             +
        W.verification         * verificationBoost;

      if (totalScore <= 0) continue; // skip zero-score candidates

      // ── Top reasons ───────────────────────────────────────────────────────
      // Build list of all contributions for reason selection
      const contributions = [
        {
          type: 'shared_event',
          weightedScore: W.shared_events * sharedEventScore,
          label: bestEventName, // resolved to name below if selected
          _rawId: bestEventName,
        },
        {
          type: 'shared_community',
          weightedScore: W.shared_communities * sharedCommunityScore,
          label: bestCommunityId, // resolved to name below if selected
          _rawId: bestCommunityId,
        },
        {
          type: 'mutual_circles',
          weightedScore: W.mutual_circles * mutualCapped,
          // Privacy: only include count, not names
          label: mutualCirclesCount > 0 ? `${mutualCirclesCount} mutual connection${mutualCirclesCount > 1 ? 's' : ''}` : null,
        },
        {
          type: 'shared_spark',
          weightedScore: W.sparks * sparkResult.score,
          label: sparkResult.bestLabel,
        },
        {
          type: 'same_college',
          weightedScore: W.same_college * sameCollege,
          label: null, // resolved to college name below if selected
          _needsCollegeName: sameCollege === 1,
          _campusId: userData.campus_id,
        },
        {
          type: 'occupation_match',
          weightedScore: W.occupation * occupationMatch,
          label: occupationMatch ? userData.occupation : null,
        },
        {
          type: 'shared_interest',
          weightedScore: W.shared_interests * interestResult.score,
          label: interestResult.rarestLabel,
        },
      ];

      // Resolve names for top contributions before building reasons
      // We only fetch names for signals that might actually be top-2
      const sorted = [...contributions]
        .filter(c => c.weightedScore > 0)
        .sort((a, b) => b.weightedScore - a.weightedScore)
        .slice(0, 2);

      for (const c of sorted) {
        if (c.type === 'shared_event' && c._rawId) {
          const r = await pool.query(
            `SELECT title FROM events WHERE id = $1`, [c._rawId]
          ).catch(() => null);
          c.label = r?.rows?.[0]?.title || 'a shared event';
        }
        if (c.type === 'shared_community' && c._rawId) {
          const r = await pool.query(
            `SELECT name FROM communities WHERE id = $1`, [c._rawId]
          ).catch(() => null);
          c.label = r?.rows?.[0]?.name || 'a shared community';
        }
        if (c.type === 'same_college' && c._needsCollegeName && c._campusId) {
          const r = await pool.query(
            `SELECT name FROM campuses WHERE id = $1`, [c._campusId]
          ).catch(() => null);
          c.label = r?.rows?.[0]?.name || 'the same college';
        }
      }

      const topReasons = buildTopReasons(sorted);

      // ── Upsert into recommended_matches ───────────────────────────────────
      await pool.query(
        `INSERT INTO recommended_matches (user_id, candidate_id, total_score, top_reasons, computed_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, candidate_id) DO UPDATE SET
           total_score  = EXCLUDED.total_score,
           top_reasons  = EXCLUDED.top_reasons,
           computed_at  = NOW()`,
        [userId, candidate.id, totalScore, JSON.stringify(topReasons)]
      );

      scored++;
    } catch (candidateErr) {
      // Non-fatal: log and continue with next candidate
      console.error(
        `[RecsJob] Error scoring candidate ${candidate.id} for user ${userId}:`,
        candidateErr.message
      );
    }
  }

  return scored;
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Runs the full recommendations batch job.
 * Called by schedulerService every day at 5am.
 * @param {Pool} pool — pg Pool instance
 */
async function runRecommendationsJob(pool) {
  const jobStart = Date.now();
  console.log('[RecsJob] ═══ Starting daily recommendations job ═══');

  // Step 0: Load global shared data (one-time per job cycle)
  const adopterCounts = await loadInterestAdopterCounts(pool);
  console.log(`[RecsJob] Loaded ${adopterCounts.size} interest adopter counts`);

  // Step 1: Get all active users to process
  const { rows: activeUsers } = await pool.query(
    `SELECT DISTINCT
       m.id,
       m.email,
       m.occupation,
       m.campus_id,
       m.verification_tier,
       m.interests,
       m.location,
       (m.location->>'lat')::float  AS lat,
       (m.location->>'lng')::float  AS lng,
       LOWER(TRIM(m.location->>'city')) AS city
     FROM members m
     JOIN sessions s ON s.user_id = m.id
     WHERE s.last_used_at > NOW() - ($1 || ' days')::INTERVAL
       AND m.location IS NOT NULL
       AND m.location->>'city' IS NOT NULL
       AND (m.is_creator_mode_enabled IS NULL OR m.is_creator_mode_enabled = false)`,
    [cfg.ACTIVE_WITHIN_DAYS]
  );

  console.log(`[RecsJob] Processing ${activeUsers.length} active users`);

  let totalCandidatesScored = 0;
  let usersProcessed = 0;
  let usersSkipped = 0;

  for (const user of activeUsers) {
    const userStart = Date.now();
    try {
      if (!user.city) {
        usersSkipped++;
        continue;
      }

      // Load user-level signal data
      const [attendedEvents, communities, sparks] = await Promise.all([
        loadUserAttendedEvents(pool, user.id),
        loadUserCommunities(pool, user.id),
        loadUserSparks(pool, user.id),
      ]);

      // Pre-load attendee/member counts for all user's events and communities
      // (avoids N queries inside the candidate loop)
      const [eventAttendeeCounts, communityMemberCounts] = await Promise.all([
        loadEventAttendeeCounts(pool, attendedEvents),
        loadCommunityMemberCounts(pool, communities),
      ]);

      const sharedData = {
        attendedEvents,
        communities,
        sparks,
        adopterCounts,
        eventAttendeeCounts,
        communityMemberCounts,
        userCity: user.city,
        userEmail: user.email,   // switcher-group gate
      };

      // Score all candidates for this user
      const candidatesScored = await scoreUserCandidates(pool, user.id, user, sharedData);
      totalCandidatesScored += candidatesScored;

      // Cache top REDIS_CACHE_SIZE results in Redis
      if (candidatesScored > 0) {
        const { rows: topMatches } = await pool.query(
          `SELECT
             rm.candidate_id,
             rm.total_score,
             rm.top_reasons,
             m.name,
             m.nickname,
             m.username,
             m.profile_photo_url,
             m.occupation,
             m.verification_tier
           FROM recommended_matches rm
           JOIN members m ON m.id = rm.candidate_id
           WHERE rm.user_id = $1
           ORDER BY rm.total_score DESC
           LIMIT $2`,
          [user.id, cfg.REDIS_CACHE_SIZE]
        );

        await setUserRecs(user.id, topMatches);
      }

      const elapsed = Date.now() - userStart;
      console.log(
        `[RecsJob] user=${user.id} candidates_scored=${candidatesScored} elapsed=${elapsed}ms`
      );

      usersProcessed++;

      // Progress log every 100 users
      if (usersProcessed % 100 === 0) {
        console.log(`[RecsJob] Progress: ${usersProcessed}/${activeUsers.length} users done`);
      }
    } catch (userErr) {
      console.error(`[RecsJob] Error processing user ${user.id}:`, userErr.message);
      usersSkipped++;
    }
  }

  const totalElapsed = Math.round((Date.now() - jobStart) / 1000);
  console.log(
    `[RecsJob] ═══ Job complete: ${usersProcessed} users processed, ` +
    `${usersSkipped} skipped, ${totalCandidatesScored} total candidates scored, ` +
    `${totalElapsed}s elapsed ═══`
  );
}

module.exports = { runRecommendationsJob };
