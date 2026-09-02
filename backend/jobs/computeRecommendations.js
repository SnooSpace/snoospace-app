/**
 * computeRecommendations.js — "People You Should Meet" Batch Job
 *
 * Runs daily (via schedulerService cron at 5am).
 * For every active user:
 *   1. Gate candidates via SQL (hard filters — no scoring yet)
 *   2. Score each candidate across 10 weighted signals
 *   3. Pick top reasons (max 2) for UI display
 *   4. Upsert into recommended_matches
 *   5. Cache top 30 into Redis (key: user:{id}:recs, TTL 24h)
 *
 * All weights and caps are read from config/recommendationConfig.js —
 * never hardcoded here. Retune by editing the config.
 *
 * Signal 10 (co_attendee_rating) logs each candidate's individual contribution
 * to stdout during the first weeks post-launch so it can be monitored before
 * trusting it silently. Set cfg.weights.co_attendee_rating = 0 to disable.
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
 * Combines:
 *   1. Same-city candidates (up to SAME_CITY_CANDIDATE_LIMIT, default 250)
 *   2. Cross-city candidates who follow at least one shared community with the viewer
 *      (up to CROSS_CITY_CANDIDATE_LIMIT, default 50)
 *
 * Gates applied to both branches:
 *   - Not the user themselves
 *   - Active within ACTIVE_WITHIN_DAYS (session.last_used_at)
 *   - Not already in a circle (either direction)
 *   - No pending circle request (either direction)
 *   - Not blocked (either direction)
 *   - Not dismissed within DISMISSAL_COOLDOWN_DAYS
 *   - Not a creator-mode account (those use a separate follow model)
 *   - Not a profile belonging to the same account-switcher group as the
 *     requesting user (identified by shared email across members/communities/
 *     sponsors/venues — the same email the client-side switcher uses)
 */
async function fetchCandidates(pool, userId, userCity, userEmail, userCommunityIds = []) {
  const communityIdsArray = [...userCommunityIds];

  const { rows } = await pool.query(
    `
    WITH same_city_candidates AS (
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
        (m.location->>'lng')::float  AS lng,
        true AS is_same_city,
        MAX(s.last_used_at) AS last_active
      FROM members m
      JOIN sessions s
        ON s.user_id = m.id
       AND s.last_used_at > NOW() - ($2 || ' days')::INTERVAL
      WHERE m.id != $1
        AND LOWER(TRIM(m.location->>'city')) = LOWER(TRIM($3))
        AND (m.is_creator_mode_enabled IS NULL OR m.is_creator_mode_enabled = false)
        AND LOWER(TRIM(m.email)) != LOWER(TRIM($6))
        AND NOT EXISTS (
          SELECT 1 FROM circles c
          WHERE (c.user_a_id = LEAST($1::bigint, m.id) AND c.user_b_id = GREATEST($1::bigint, m.id))
        )
        AND NOT EXISTS (
          SELECT 1 FROM circle_requests cr
          WHERE cr.status = 'pending'
            AND ((cr.sender_id = $1 AND cr.receiver_id = m.id)
              OR (cr.sender_id = m.id AND cr.receiver_id = $1))
        )
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks ub
          WHERE (ub.blocker_id = $1 AND ub.blocked_id = m.id)
             OR (ub.blocker_id = m.id AND ub.blocked_id = $1)
        )
        AND NOT EXISTS (
          SELECT 1 FROM dismissed_recommendations dr
          WHERE dr.user_id = $1
            AND dr.candidate_id = m.id
            AND dr.dismissed_at > NOW() - ($4 || ' days')::INTERVAL
        )
      GROUP BY m.id
      ORDER BY last_active DESC
      LIMIT $5
    ),
    cross_city_candidates AS (
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
        (m.location->>'lng')::float  AS lng,
        false AS is_same_city,
        MAX(s.last_used_at) AS last_active
      FROM members m
      JOIN sessions s
        ON s.user_id = m.id
       AND s.last_used_at > NOW() - ($2 || ' days')::INTERVAL
      JOIN follows f_cand
        ON f_cand.follower_id = m.id
       AND f_cand.follower_type = 'member'
       AND f_cand.following_type = 'community'
       AND f_cand.following_id = ANY($7::bigint[])
      WHERE m.id != $1
        AND (m.location->>'city' IS NULL OR LOWER(TRIM(m.location->>'city')) != LOWER(TRIM($3)))
        AND (m.is_creator_mode_enabled IS NULL OR m.is_creator_mode_enabled = false)
        AND LOWER(TRIM(m.email)) != LOWER(TRIM($6))
        AND NOT EXISTS (
          SELECT 1 FROM circles c
          WHERE (c.user_a_id = LEAST($1::bigint, m.id) AND c.user_b_id = GREATEST($1::bigint, m.id))
        )
        AND NOT EXISTS (
          SELECT 1 FROM circle_requests cr
          WHERE cr.status = 'pending'
            AND ((cr.sender_id = $1 AND cr.receiver_id = m.id)
              OR (cr.sender_id = m.id AND cr.receiver_id = $1))
        )
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks ub
          WHERE (ub.blocker_id = $1 AND ub.blocked_id = m.id)
             OR (ub.blocker_id = m.id AND ub.blocked_id = $1)
        )
        AND NOT EXISTS (
          SELECT 1 FROM dismissed_recommendations dr
          WHERE dr.user_id = $1
            AND dr.candidate_id = m.id
            AND dr.dismissed_at > NOW() - ($4 || ' days')::INTERVAL
        )
      GROUP BY m.id
      ORDER BY last_active DESC
      LIMIT $8
    )
    SELECT * FROM same_city_candidates
    UNION ALL
    SELECT * FROM cross_city_candidates
    `,
    [
      userId,
      cfg.ACTIVE_WITHIN_DAYS,
      userCity,
      cfg.DISMISSAL_COOLDOWN_DAYS,
      cfg.SAME_CITY_CANDIDATE_LIMIT || 250,
      userEmail || '',
      communityIdsArray,
      cfg.CROSS_CITY_CANDIDATE_LIMIT || 50,
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

/** Load all community IDs followed by this user (follows with following_type = 'community'). */
async function loadUserCommunities(pool, userId) {
  const { rows } = await pool.query(
    `SELECT following_id AS community_id
     FROM follows
     WHERE follower_id = $1 AND follower_type = 'member'
       AND following_type = 'community'`,
    [userId]
  );
  return new Set(rows.map(r => String(r.community_id)));
}

/** Load all accepted circle community IDs for this user (community_member_circles). */
async function loadUserCircleCommunities(pool, userId) {
  const { rows } = await pool.query(
    `SELECT community_id
     FROM community_member_circles
     WHERE member_id = $1`,
    [userId]
  );
  return new Set(rows.map(r => String(r.community_id)));
}

/** For each community in a set, get member count from follows. Returns Map<communityId, count>. */
async function loadCommunityMemberCounts(pool, communityIds) {
  if (communityIds.size === 0) return new Map();
  const ids = [...communityIds];
  const { rows } = await pool.query(
    `SELECT following_id AS community_id, COUNT(*) AS cnt
     FROM follows
     WHERE following_id = ANY($1)
       AND following_type = 'community'
       AND follower_type = 'member'
     GROUP BY following_id`,
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

/**
 * Load the Spotify top_artists array for a user.
 * Returns an array of { id, name, rank } objects, or null if the user has no
 * Spotify profile (not connected). Null is the sentinel for "skip this signal",
 * which is explicitly neutral (0 score) — not negative.
 */
async function loadUserSpotifyArtists(pool, userId) {
  const { rows } = await pool.query(
    `SELECT top_artists FROM spotify_profile WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  if (rows.length === 0 || !Array.isArray(rows[0].top_artists)) return null;
  return rows[0].top_artists;
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

/**
 * Compute Spotify top-artist overlap signal between two users.
 *
 * For each shared artist (matched by Spotify artist `id`), computes:
 *   contribution = (11 - rank_A) + (11 - rank_B)
 * where ranks are 1–10 (rank 1 = highest). A shared #1 artist contributes 20,
 * a shared #10 artist contributes 2.
 *
 * Raw sum is normalized by dividing by MAX_RAW_PER_ARTIST (20 = max single-artist
 * contribution, for two rank-1 overlapping artists), then capped at 1.0 so it
 * fits the same [0,1] scale as other signals.
 *
 * Returns:
 *   { score: number (0–1), topArtistName: string|null }
 * If either user has no Spotify profile (null), returns { score: 0, topArtistName: null }
 * — absence of data is explicitly neutral, not negative.
 */
function computeSpotifyArtistOverlap(userArtists, candidateArtists) {
  if (!userArtists || !candidateArtists) return { score: 0, topArtistName: null };

  // Build a map of artist_id → rank for the user
  const userMap = new Map();
  for (const a of userArtists) {
    if (a.id) userMap.set(a.id, { rank: a.rank || 10, name: a.name || '' });
  }

  const MAX_RAW_PER_ARTIST = 20; // (11 - 1) + (11 - 1) for two rank-1 artists

  let rawScore = 0;
  let topArtistName = null;
  let topContribution = 0;

  for (const ca of candidateArtists) {
    if (!ca.id || !userMap.has(ca.id)) continue;
    const { rank: rankA, name } = userMap.get(ca.id);
    const rankB = ca.rank || 10;
    const contribution = (11 - Math.min(rankA, 10)) + (11 - Math.min(rankB, 10));
    rawScore += contribution;
    if (contribution > topContribution) {
      topContribution = contribution;
      topArtistName = name || ca.name || null;
    }
  }

  if (rawScore === 0) return { score: 0, topArtistName: null };

  // Normalize: divide by max possible single-artist contribution, cap at 1.0
  const score = Math.min(rawScore / MAX_RAW_PER_ARTIST, 1.0);
  return { score, topArtistName };
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
    attendedEvents,             // Set<string> eventId user attended
    communities,                // Set<string> communityId user follows
    userCircleCommunities,      // Set<string> communityId user is in circle with
    sparks,                     // [{spark_id, label, category, spark_type, usage_count}]
    adopterCounts,              // Map<interest_label, count>
    eventAttendeeCounts,        // Map<eventId, attendeeCount>
    communityMemberCounts,      // Map<communityId, memberCount>
    userCity,
    userEmail,                  // email — switcher-group gate
    userSpotifyArtists,         // array|null — null if not connected
  } = sharedData;

  // Convert string community IDs to integers for PostgreSQL $7::bigint[] parameter
  const userCommunityIdsArray = Array.from(communities).map(id => parseInt(id, 10));

  const candidates = await fetchCandidates(
    pool,
    userId,
    userCity,
    userEmail,
    userCommunityIdsArray
  );
  if (candidates.length === 0) return 0;

  const userLat = parseFloat(userData.lat);
  const userLng = parseFloat(userData.lng);

  let scored = 0;

  for (const candidate of candidates) {
    try {
      // Short-circuit Spotify signal: only load candidate artists if user has Spotify connected.
      const candidateSpotifyArtistsPromise = userSpotifyArtists
        ? loadUserSpotifyArtists(pool, candidate.id)
        : Promise.resolve(null);

      // Load candidate-specific data (these are per-pair)
      const [
        candidateEvents,
        candidateCommunities,
        candidateCircleCommunities,
        candidateSparks,
        mutualCirclesCount,
        candidateSpotifyArtists,
      ] = await Promise.all([
        loadUserAttendedEvents(pool, candidate.id),
        loadUserCommunities(pool, candidate.id),
        loadUserCircleCommunities(pool, candidate.id),
        loadUserSparks(pool, candidate.id),
        loadMutualCirclesCount(pool, userId, candidate.id),
        candidateSpotifyArtistsPromise,
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
          bestEventName = eid; // placeholder — resolved below
        }
      }

      // ── Signal 2: Shared communities (Broadened follows + Circle bonus) ───
      let sharedCommunityScore = 0;
      let sharedCommunityBaseScore = 0; // Pre-circle-bonus base score for Part B threshold check
      let bestCommunityId = null;
      let bestCommunityScore = 0;

      for (const cid of communities) {
        if (!candidateCommunities.has(cid)) continue;
        const memberCount = communityMemberCounts.get(cid) || 1;
        const rarityW = rarityWeight(memberCount);
        sharedCommunityBaseScore += rarityW;

        // +0.2 bonus if either viewer or candidate has an accepted circle invite in this community
        const hasCircleInvite =
          userCircleCommunities.has(cid) || candidateCircleCommunities.has(cid);
        const termScore = rarityW * (1 + (hasCircleInvite ? 0.2 : 0.0));

        sharedCommunityScore += termScore;
        if (termScore > bestCommunityScore) {
          bestCommunityScore = termScore;
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
      let candDistKm = null;
      const candLat = parseFloat(candidate.lat);
      const candLng = parseFloat(candidate.lng);

      if (!isNaN(userLat) && !isNaN(userLng) && !isNaN(candLat) && !isNaN(candLng)) {
        candDistKm = haversineKm(userLat, userLng, candLat, candLng);
        proximity = proximityDecay(candDistKm);
      }

      // ── Signal 9: Verification tier ───────────────────────────────────────
      const tierValue = cfg.verification_tier_values[candidate.verification_tier || 'none'] || 0;
      const verificationBoost = Math.min(tierValue, cfg.caps.verification);

      // ── Signal 10: Positive co-attendee rating (open plan) ──────────────
      let coAttendeeSignal = 0;
      if (cfg.weights.co_attendee_rating > 0) {
        const coRatingResult = await pool.query(
          `SELECT 1 FROM open_plan_attendee_ratings opar
           WHERE opar.rater_id  = $1
             AND opar.rated_user_id = $2
             AND opar.rating IN ('absolutely', 'probably')
             AND opar.created_at > NOW() - INTERVAL '180 days'
           LIMIT 1`,
          [userId, candidate.id]
        );
        coAttendeeSignal = coRatingResult.rows.length > 0 ? 1 : 0;
      }

      // ── Signal 11: Spotify top-artist overlap ───────────────────────────
      const spotifyResult = cfg.weights.spotify_artist_overlap > 0
        ? computeSpotifyArtistOverlap(userSpotifyArtists, candidateSpotifyArtists)
        : { score: 0, topArtistName: null };

      // ── Total weighted score ────────────────────────────────────────────────
      const W = cfg.weights;
      const s1  = W.shared_events           * sharedEventScore;
      const s2  = W.shared_communities      * sharedCommunityScore;
      const s3  = W.mutual_circles          * mutualCapped;
      const s4  = W.sparks                  * sparkResult.score;
      const s5  = W.same_college            * sameCollege;
      const s6  = W.occupation              * occupationMatch;
      const s7  = W.shared_interests        * interestResult.score;
      const s8  = W.proximity               * proximity;
      const s9  = W.verification            * verificationBoost;
      const s10 = W.co_attendee_rating      * coAttendeeSignal;
      const s11 = W.spotify_artist_overlap  * spotifyResult.score;
      const totalScore = s1 + s2 + s3 + s4 + s5 + s6 + s7 + s8 + s9 + s10 + s11;

      // Q4 per-signal logging: log Signal 10 contribution individually
      if (s10 > 0) {
        console.log(
          `[Recs:Signal10] user=${userId} candidate=${candidate.id} ` +
          `s10_contribution=${s10.toFixed(4)} total=${totalScore.toFixed(4)} ` +
          `(s1=${s1.toFixed(3)} s2=${s2.toFixed(3)} s3=${s3.toFixed(3)})`
        );
      }
      if (s11 > 0) {
        console.log(
          `[Recs:Signal11] user=${userId} candidate=${candidate.id} ` +
          `artist="${spotifyResult.topArtistName}" raw=${spotifyResult.score.toFixed(3)} ` +
          `s11=${s11.toFixed(4)} total=${totalScore.toFixed(4)}`
        );
      }

      // ── Tier Qualification (Part B) ─────────────────────────────────────────
      let matchTier = 1;
      if (!candidate.is_same_city) {
        // Cross-city candidate: kept ONLY if base community overlap score > 0.15
        if (sharedCommunityBaseScore <= 0.15) {
          continue; // Dropped entirely
        }
        matchTier = 2;
      }

      if (totalScore <= 0) continue; // skip zero-score candidates

      // ── Top reasons ───────────────────────────────────────────────────────
      const contributions = [
        {
          type: 'shared_event',
          weightedScore: W.shared_events * sharedEventScore,
          label: bestEventName,
          _rawId: bestEventName,
        },
        {
          type: 'shared_community',
          weightedScore: W.shared_communities * sharedCommunityScore,
          label: bestCommunityId,
          _rawId: bestCommunityId,
        },
        {
          type: 'mutual_circles',
          weightedScore: W.mutual_circles * mutualCapped,
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
          label: null,
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
        {
          type: 'co_attendee_rating',
          weightedScore: s10,
          label: coAttendeeSignal ? 'You rated them positively after meeting' : null,
        },
        {
          type: 'shared_artist',
          weightedScore: s11,
          label: spotifyResult.topArtistName
            ? `You both like ${spotifyResult.topArtistName}`
            : null,
        },
      ];

      // Resolve names for top contributions before building reasons
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

      // ── Upsert into recommended_matches with match_tier and distance_km ────
      await pool.query(
        `INSERT INTO recommended_matches (user_id, candidate_id, total_score, top_reasons, match_tier, distance_km, computed_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id, candidate_id) DO UPDATE SET
           total_score  = EXCLUDED.total_score,
           top_reasons  = EXCLUDED.top_reasons,
           match_tier   = EXCLUDED.match_tier,
           distance_km  = EXCLUDED.distance_km,
           computed_at  = NOW()`,
        [userId, candidate.id, totalScore, JSON.stringify(topReasons), matchTier, candDistKm]
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
      const [attendedEvents, communities, userCircleCommunities, sparks, userSpotifyArtists] = await Promise.all([
        loadUserAttendedEvents(pool, user.id),
        loadUserCommunities(pool, user.id),
        loadUserCircleCommunities(pool, user.id),
        loadUserSparks(pool, user.id),
        loadUserSpotifyArtists(pool, user.id),  // null if not connected
      ]);

      if (userSpotifyArtists) {
        console.log(`[RecsJob] user=${user.id} spotify_artists=${userSpotifyArtists.length}`);
      }

      // Pre-load attendee/member counts for all user's events and communities
      // (avoids N queries inside the candidate loop)
      const [eventAttendeeCounts, communityMemberCounts] = await Promise.all([
        loadEventAttendeeCounts(pool, attendedEvents),
        loadCommunityMemberCounts(pool, communities),
      ]);

      const sharedData = {
        attendedEvents,
        communities,
        userCircleCommunities,
        sparks,
        adopterCounts,
        eventAttendeeCounts,
        communityMemberCounts,
        userCity: user.city,
        userEmail: user.email,   // switcher-group gate
        userSpotifyArtists,      // null if not connected (Signal 11)
      };

      // Score all candidates for this user
      const candidatesScored = await scoreUserCandidates(pool, user.id, user, sharedData);
      totalCandidatesScored += candidatesScored;

      // Cache top REDIS_CACHE_SIZE results in Redis with Tier 2 reservation (last 5 slots)
      if (candidatesScored > 0) {
        const { rows: allMatches } = await pool.query(
          `SELECT
             rm.candidate_id,
             rm.total_score,
             rm.match_tier,
             rm.distance_km,
             rm.top_reasons,
             m.name,
             m.nickname,
             m.username,
             m.profile_photo_url,
             m.occupation,
             m.verification_tier
           FROM recommended_matches rm
           JOIN members m ON m.id = rm.candidate_id
           WHERE rm.user_id = $1`,
          [user.id]
        );

        const tier1 = allMatches
          .filter(r => r.match_tier === 1)
          .sort((a, b) => b.total_score - a.total_score);

        const tier2 = allMatches
          .filter(r => r.match_tier === 2)
          .sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));

        const tier2Count = Math.min(tier2.length, 5);
        const tier1Slots = cfg.REDIS_CACHE_SIZE - tier2Count;

        let selectedTier1 = tier1.slice(0, tier1Slots);
        let selectedTier2 = tier2.slice(0, tier2Count);

        // If Tier 1 has fewer than 25, let Tier 2 fill remaining slots up to 30
        if (selectedTier1.length + selectedTier2.length < cfg.REDIS_CACHE_SIZE && tier2.length > selectedTier2.length) {
          const extraNeeded = cfg.REDIS_CACHE_SIZE - (selectedTier1.length + selectedTier2.length);
          const extraTier2 = tier2.slice(tier2Count, tier2Count + extraNeeded);
          selectedTier2 = [...selectedTier2, ...extraTier2];
        }

        const topMatches = [...selectedTier1, ...selectedTier2];
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
