/**
 * Video Insights Routes
 *
 * Endpoints:
 *  GET  /:videoId/insights  — Full aggregated insights (cached, 15-min TTL)
 *
 * Mounted at: /api/videos  (in routes/index.js)
 *
 * Uses the PostgreSQL pool (same connection as the rest of the app).
 * Reads from: posts, post_likes, post_comments, post_saves, post_shares,
 *             unique_view_events, repeat_view_events, follows, members
 */

const express = require('express');
const router = express.Router();
const { createPool } = require('../config/db');

const pool = createPool();

// ─── GET /api/videos/:videoId/insights ──────────────────────────────────────
router.get('/:videoId/insights', async (req, res) => {
  try {
    const videoId = parseInt(req.params.videoId);
    if (isNaN(videoId)) return res.status(400).json({ error: 'Invalid videoId' });

    const computed = await computeInsights(videoId);
    return res.json({ success: true, data: { video_id: videoId, ...computed } });
  } catch (err) {
    console.error('[insights GET]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Helper: computeInsights(videoId) ───────────────────────────────────────
async function computeInsights(videoId) {
  const client = await pool.connect();
  try {
    // ── 1. Post base data ──────────────────────────────────────────────────
    const postRes = await client.query(
      `SELECT author_id, author_type, duration_seconds, like_count, share_count,
              comment_count, created_at
       FROM posts WHERE id = $1`,
      [videoId]
    );
    const post = postRes.rows[0] || {};
    // Use actual duration; fall back to 0 if not set (avoids fabricated metrics)
    const videoDuration = post.duration_seconds || 0;

    // ── 2. Engagement counts (direct from tables, not denormalised columns) ──
    const [likesRes, commentsRes, savesRes, sharesRes, dmSharesRes] = await Promise.all([
      client.query(
        'SELECT COUNT(*)::int AS cnt FROM post_likes WHERE post_id = $1',
        [videoId]
      ),
      client.query(
        'SELECT COUNT(*)::int AS cnt FROM post_comments WHERE post_id = $1 AND parent_comment_id IS NULL',
        [videoId]
      ),
      client.query(
        'SELECT COUNT(*)::int AS cnt FROM post_saves WHERE post_id = $1',
        [videoId]
      ),
      client.query(
        "SELECT COUNT(*)::int AS cnt FROM post_shares WHERE post_id = $1 AND share_type != 'internal'",
        [videoId]
      ),
      client.query(
        "SELECT COUNT(*)::int AS cnt FROM post_shares WHERE post_id = $1 AND share_type = 'internal'",
        [videoId]
      ),
    ]);

    const likesCount = likesRes.rows[0]?.cnt ?? post.like_count ?? 0;
    const commentsCount = commentsRes.rows[0]?.cnt ?? post.comment_count ?? 0;
    const savesCount = savesRes.rows[0]?.cnt ?? 0;
    const sharesCount = sharesRes.rows[0]?.cnt ?? post.share_count ?? 0;
    const dmSendsCount = dmSharesRes.rows[0]?.cnt ?? 0;

    // ── 3. Views — from unique_view_events + repeat_view_events ──────────
    const uniqueViewsRes = await client.query(
      `SELECT user_id, user_type, dwell_time_ms, COALESCE(view_source, trigger_type, 'feed') AS view_source
       FROM unique_view_events WHERE post_id = $1`,
      [videoId]
    );
    const repeatViewsRes = await client.query(
      `SELECT user_id, user_type, dwell_time_ms
       FROM repeat_view_events WHERE post_id = $1`,
      [videoId]
    );

    const uniqueViewers = uniqueViewsRes.rows.length;
    const totalViews = uniqueViewers + repeatViewsRes.rows.length;

    // ── 4. Watch time — sum from BOTH unique and repeat events ───────────
    // Cap individual dwell_time to videoDuration (a viewer can't watch more than the video per session)
    const videoDurationMs = videoDuration > 0 ? videoDuration * 1000 : null;

    const capDwell = (dwellMs) => {
      if (!dwellMs || dwellMs <= 0) return 0;
      if (videoDurationMs && dwellMs > videoDurationMs) return videoDurationMs;
      return dwellMs;
    };

    let totalDwellMs = 0;
    let uniqueDwellCount = 0;
    for (const row of uniqueViewsRes.rows) {
      const capped = capDwell(row.dwell_time_ms);
      totalDwellMs += capped;
      if (capped > 0) uniqueDwellCount++;
    }
    for (const row of repeatViewsRes.rows) {
      totalDwellMs += capDwell(row.dwell_time_ms);
    }

    const totalWatchSeconds = totalDwellMs / 1000;
    const avgWatchSeconds = uniqueDwellCount > 0
      ? (uniqueViewsRes.rows.reduce((sum, r) => sum + capDwell(r.dwell_time_ms), 0) / uniqueDwellCount) / 1000
      : 0;

    // ── 5. Completion & hook rates ─────────────────────────────────────────
    let completionRate = 0;
    let hookRate = 0;
    let completedCount = 0;

    if (videoDuration > 0) {
      // Completion: viewers whose dwell_time >= 90% of video duration
      const completionThresholdMs = Math.round(videoDuration * 0.9 * 1000);
      completedCount = uniqueViewsRes.rows.filter(
        r => capDwell(r.dwell_time_ms) >= completionThresholdMs
      ).length;
      completionRate = uniqueViewers > 0 ? completedCount / uniqueViewers : 0;

      // Hook rate (3-second): viewers whose dwell_time >= 3000ms
      const hookThresholdMs = Math.min(3000, videoDuration * 1000); // Don't exceed video length
      const hookedCount = uniqueViewsRes.rows.filter(
        r => capDwell(r.dwell_time_ms) >= hookThresholdMs
      ).length;
      hookRate = uniqueViewers > 0 ? hookedCount / uniqueViewers : 0;
    }

    // ── 6. Re-watch rate = total_views / unique_viewers ───────────────────
    const rewatchRate = uniqueViewers > 0 ? totalViews / uniqueViewers : 1;

    // ── 7. Retention curve (10 buckets, approximated from dwell times) ────
    const buckets = 10;
    const retentionCurve = [];

    if (videoDuration > 0) {
      for (let i = 0; i <= buckets; i++) {
        const targetMs = Math.round((i / buckets) * videoDuration * 1000);
        const reached = uniqueViewsRes.rows.filter(
          r => capDwell(r.dwell_time_ms) >= targetMs
        ).length;
        retentionCurve.push({
          pct: Math.round((i / buckets) * 100),
          seconds: Math.round((i / buckets) * videoDuration),
          retention: uniqueViewers > 0 ? Math.round((reached / uniqueViewers) * 100) : 0,
        });
      }
    } else {
      // No duration — generate flat curve
      for (let i = 0; i <= buckets; i++) {
        retentionCurve.push({ pct: Math.round((i / buckets) * 100), seconds: 0, retention: 0 });
      }
    }

    // Midpoint drop
    const midIdx = Math.floor(buckets / 2);
    const midpointDrop =
      retentionCurve.length > midIdx + 1
        ? retentionCurve[midIdx - 1].retention - retentionCurve[midIdx + 1].retention
        : 0;

    // Major drop bucket
    const majorDropBucket = retentionCurve.slice(1).reduce(
      (worst, b, i) => {
        const prev = retentionCurve[i];
        const drop = (prev?.retention || 0) - b.retention;
        return drop > (worst.drop || 0) ? { ...b, drop } : worst;
      },
      {}
    );

    // Most replayed moment (estimate: dwell_time_ms midpoint)
    const mostReplayed = uniqueViewers > 0
      ? Math.round(avgWatchSeconds * 0.2)
      : Math.round(videoDuration * 0.2);

    // ── 8. Follow conversions (table may not exist yet, fail gracefully) ───
    let newFollowers = 0;
    try {
      const followConvRes = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM video_follow_conversions WHERE video_id = $1`,
        [videoId]
      );
      newFollowers = followConvRes.rows[0]?.cnt || 0;
    } catch (_) {
      // table doesn't exist yet — that's fine
    }
    const followConversionRate = totalViews > 0 ? newFollowers / totalViews : 0;

    // ── 9. Reach & non-followers ─────────────────────────────────────────
    const reachTotal = uniqueViewers;
    let reachNonFollowersPct = 0;

    if (reachTotal > 0 && post.author_id) {
      const viewerIds = uniqueViewsRes.rows.map(r => r.user_id).filter(Boolean);
      if (viewerIds.length > 0) {
        const followerRes = await client.query(
          `SELECT COUNT(*)::int AS cnt FROM follows
           WHERE following_id = $1
             AND follower_id = ANY($2::bigint[])`,
          [post.author_id, viewerIds]
        );
        const followerViewers = followerRes.rows[0]?.cnt || 0;
        reachNonFollowersPct = Math.round(((reachTotal - followerViewers) / reachTotal) * 100);
      }
    }

    // Community boost views — views from community page source
    const communityBoostViews = uniqueViewsRes.rows.filter(
      r => r.view_source === 'community'
    ).length;

    // ── 10. Hourly view distribution ─────────────────────────────────────
    const hourlyRes = await client.query(
      `SELECT EXTRACT(HOUR FROM qualified_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,
              COUNT(*)::int AS views
       FROM unique_view_events WHERE post_id = $1
       GROUP BY 1 ORDER BY 1`,
      [videoId]
    );
    const hourlyMap = {};
    hourlyRes.rows.forEach(r => { hourlyMap[r.hour] = r.views; });
    const hourlyViews = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      views: hourlyMap[h] || 0,
    }));
    const peakHour = hourlyViews.reduce(
      (best, h) => (h.views > best.views ? h : best),
      hourlyViews[0]
    ).hour;

    // ── 11. Traffic sources — prefer view_source, fall back to trigger_type ─
    const sourceCounts = {};
    uniqueViewsRes.rows.forEach(r => {
      const source = r.view_source || 'feed';
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });
    const trafficSources = normalizeDistribution(sourceCounts);

    // ── 12. Audience demographics (from viewer member profiles) ──────────
    let ageBreakdown = {};
    let topLocations = [];
    let intentClassification = {};

    const viewerMemberIds = uniqueViewsRes.rows
      .filter(r => r.user_type === 'member' || !r.user_type)
      .map(r => r.user_id)
      .filter(Boolean);

    if (viewerMemberIds.length > 0) {
      const profilesRes = await client.query(
        `SELECT id,
                CASE
                  WHEN EXTRACT(YEAR FROM AGE(dob)) BETWEEN 13 AND 17 THEN '13-17'
                  WHEN EXTRACT(YEAR FROM AGE(dob)) BETWEEN 18 AND 24 THEN '18-24'
                  WHEN EXTRACT(YEAR FROM AGE(dob)) BETWEEN 25 AND 34 THEN '25-34'
                  WHEN EXTRACT(YEAR FROM AGE(dob)) BETWEEN 35 AND 44 THEN '35-44'
                  WHEN EXTRACT(YEAR FROM AGE(dob)) >= 45 THEN '45+'
                  ELSE NULL
                END AS age_group,
                location->>'city' AS city,
                location->>'lat' AS lat,
                location->>'lng' AS lng
         FROM members WHERE id = ANY($1::bigint[])`,
        [viewerMemberIds]
      );

      const profiles = profilesRes.rows;
      if (profiles.length > 0) {
        // Age breakdown
        const ageCounts = countByField(profiles.filter(p => p.age_group), 'age_group');
        ageBreakdown = normalizeDistribution(ageCounts);

        // Top locations — attempt reverse geocoding for profiles with lat/lng but no city
        const resolvedProfiles = await Promise.all(profiles.map(async (p) => {
          if (p.city) return p;
          if (p.lat && p.lng) {
            try {
              const resolvedCity = await reverseGeocodeCity(parseFloat(p.lat), parseFloat(p.lng));
              if (resolvedCity) {
                // Cache the resolved city back to the member's location
                try {
                  await client.query(
                    `UPDATE members SET location = jsonb_set(
                       COALESCE(location, '{}'::jsonb),
                       '{city}',
                       $1::jsonb
                     ) WHERE id = $2 AND (location->>'city' IS NULL OR location->>'city' = '')`,
                    [JSON.stringify(resolvedCity), p.id]
                  );
                } catch (_) { /* non-fatal cache update */ }
                return { ...p, city: resolvedCity };
              }
            } catch (_) { /* reverse geocode failed, skip */ }
          }
          return p;
        }));

        const cityCounts = countByField(resolvedProfiles.filter(p => p.city), 'city');
        const cityTotal = Object.values(cityCounts).reduce((a, b) => a + b, 0);
        const sortedCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
        const topCitySum = sortedCities.reduce((a, [, v]) => a + v, 0);
        const otherCount = cityTotal - topCitySum;
        topLocations = sortedCities.map(([city, count]) => ({
          city,
          pct: Math.round((count / cityTotal) * 100),
        }));
        if (otherCount > 0 && cityTotal > 0) {
          topLocations.push({ city: 'Others', pct: Math.round((otherCount / cityTotal) * 100) });
        }
      }
    }

    // ── 12b. Intent classification (dwell-time based) ─────────────────────
    if (videoDuration > 0 && uniqueViewers > 0) {
      const thresh25 = videoDuration * 0.25 * 1000;
      const thresh75 = videoDuration * 0.75 * 1000;

      let casualCount = 0;
      let interestedCount = 0;
      let highIntentCount = 0;

      for (const row of uniqueViewsRes.rows) {
        const dwell = capDwell(row.dwell_time_ms);
        if (dwell >= thresh75) {
          highIntentCount++;
        } else if (dwell >= thresh25) {
          interestedCount++;
        } else {
          casualCount++;
        }
      }

      intentClassification = {
        casual: Math.round((casualCount / uniqueViewers) * 100),
        interested: Math.round((interestedCount / uniqueViewers) * 100),
        high_intent: Math.round((highIntentCount / uniqueViewers) * 100),
      };
    }

    // ── 13. ROR & AQI scores ─────────────────────────────────────────────
    const normalize = (val, max) => (max > 0 ? Math.min(val / max, 1) : 0);
    const rorScore = Math.round(
      normalize(completionRate, 1) * 40 +
      normalize(savesCount, Math.max(totalViews * 0.1, 1)) * 25 +
      normalize(sharesCount, Math.max(totalViews * 0.05, 1)) * 20 +
      normalize(dmSendsCount, Math.max(totalViews * 0.02, 1)) * 15
    );

    // High-intent viewers: dwell_time >= 80% of video duration
    const highIntentMs = videoDuration > 0 ? Math.round(videoDuration * 0.8 * 1000) : 999999;
    const highIntentViewers = uniqueViewsRes.rows.filter(
      r => capDwell(r.dwell_time_ms) >= highIntentMs
    ).length;

    // Ghost viewers: dwell_time < 3s
    const ghostViewers = uniqueViewsRes.rows.filter(
      r => !r.dwell_time_ms || capDwell(r.dwell_time_ms) < 3000
    ).length;

    const highIntentPct = uniqueViewers > 0 ? Math.round((highIntentViewers / uniqueViewers) * 100) : 0;
    const ghostViewerPct = uniqueViewers > 0 ? Math.round((ghostViewers / uniqueViewers) * 100) : 0;
    const aqiScore = Math.round(
      highIntentPct * 0.5 +
      (100 - ghostViewerPct) * 0.3 +
      Math.min(completionRate * 100, 100) * 0.2
    );

    // ── 14. Best time to post ─────────────────────────────────────────────
    const peakStart = peakHour === 0 ? formatHour(23) : formatHour(Math.max(peakHour - 1, 0));
    const peakEnd = formatHour((peakHour + 1) % 24);
    const bestTimeToPost = totalViews > 0 ? `${peakStart} – ${peakEnd}` : null;

    // ── 15. Dynamic AI insight text ───────────────────────────────────────
    const aiInsight = generateAiInsight({
      completionRate,
      hookRate,
      rewatchRate,
      majorDropAtSeconds: majorDropBucket.seconds || 0,
      videoDuration,
      totalViews,
      uniqueViewers,
    });

    return {
      total_views: totalViews,
      unique_viewers: uniqueViewers,
      total_watch_seconds: Math.round(totalWatchSeconds),
      avg_watch_seconds: Math.round(avgWatchSeconds),
      video_duration_seconds: videoDuration,
      completion_rate: Math.round(completionRate * 100) / 100,
      hook_rate: Math.round(hookRate * 100) / 100,
      rewatch_rate: Math.round(rewatchRate * 10) / 10,
      likes_count: likesCount,
      comments_count: commentsCount,
      saves_count: savesCount,
      shares_count: sharesCount,
      dm_sends_count: dmSendsCount,
      new_followers: newFollowers,
      follow_conversion_rate: Math.round(followConversionRate * 10000) / 100,
      ror_score: rorScore,
      aqi_score: aqiScore,
      high_intent_pct: highIntentPct,
      ghost_viewer_pct: ghostViewerPct,
      reach_total: reachTotal,
      reach_non_followers_pct: reachNonFollowersPct,
      community_boost_views: communityBoostViews,
      peak_hour: peakHour,
      best_time_to_post: bestTimeToPost,
      midpoint_drop_pct: Math.round(midpointDrop),
      major_drop_at_seconds: majorDropBucket.seconds || 0,
      rewatched_moment_seconds: mostReplayed,
      traffic_sources: trafficSources,
      age_breakdown: ageBreakdown,
      top_locations: topLocations,
      intent_classification: intentClassification,
      hourly_views: hourlyViews,
      retention_curve: retentionCurve,
      ai_insight: aiInsight,
    };
  } finally {
    client.release();
  }
}

// ─── Dynamic AI Insight Generator ────────────────────────────────────────────
function generateAiInsight({ completionRate, hookRate, rewatchRate, majorDropAtSeconds, videoDuration, totalViews, uniqueViewers }) {
  if (totalViews === 0) {
    return 'No views yet — share your video to start getting insights.';
  }

  if (videoDuration === 0) {
    return 'Video duration data is missing — insights will be more accurate once duration is recorded.';
  }

  const parts = [];

  // Hook analysis
  if (hookRate >= 0.8) {
    parts.push('Strong opening — most viewers stayed past the first 3 seconds.');
  } else if (hookRate >= 0.5) {
    parts.push('Decent hook — about half your viewers stayed past 3 seconds. Try a stronger opening to improve.');
  } else if (hookRate > 0) {
    parts.push('Weak hook — most viewers dropped off in the first 3 seconds. Consider a more attention-grabbing start.');
  }

  // Completion analysis
  if (completionRate >= 0.7) {
    parts.push(`Great completion rate (${Math.round(completionRate * 100)}%) — your content keeps viewers watching.`);
  } else if (completionRate >= 0.3) {
    parts.push(`Moderate completion rate (${Math.round(completionRate * 100)}%) — some viewers drop off before the end.`);
  } else if (completionRate > 0) {
    parts.push(`Low completion rate (${Math.round(completionRate * 100)}%) — viewers aren't reaching the end. Consider shorter content or better pacing.`);
  }

  // Drop-off analysis
  if (majorDropAtSeconds > 0 && videoDuration > 0) {
    parts.push(`Biggest drop-off at ${padTime(majorDropAtSeconds)} — check for pacing issues around that mark.`);
  }

  // Rewatch analysis
  if (rewatchRate >= 1.5) {
    parts.push(`High rewatch rate (${rewatchRate.toFixed(1)}x) — viewers are coming back for more.`);
  }

  return parts.length > 0 ? parts.join(' ') : 'Gathering more data for detailed insights.';
}

// ─── Reverse Geocode helper (Nominatim) ─────────────────────────────────────
async function reverseGeocodeCity(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SnooSpace/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    return data?.address?.city || data?.address?.town || data?.address?.county || null;
  } catch {
    return null;
  }
}

// ─── Utility helpers ─────────────────────────────────────────────────────────
function countByField(arr, field) {
  return arr.reduce((acc, item) => {
    const k = item[field];
    if (k) acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

function normalizeDistribution(counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return counts;
  const result = {};
  for (const [k, v] of Object.entries(counts)) {
    result[k] = Math.round((v / total) * 100);
  }
  return result;
}

function formatHour(h) {
  if (h === 0) return '12:00 AM';
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

function padTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

module.exports = router;
