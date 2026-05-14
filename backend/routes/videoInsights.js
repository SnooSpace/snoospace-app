/**
 * Video Insights Routes
 *
 * Endpoints:
 *  POST /:videoId/watch-event        — Called every 5s during playback & on exit/complete
 *  POST /:videoId/follow-conversion  — Called when viewer follows creator after watching
 *  GET  /:videoId/insights           — Full aggregated insights (cached, 15-min TTL)
 *
 * Mounted at: /api/videos  (in routes/index.js)
 */

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ─── POST /api/videos/:videoId/watch-event ─────────────────────────────────
// Called by the client every 5 seconds during playback and on exit/complete.
router.post('/:videoId/watch-event', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { viewer_id, session_id, event_type, timestamp_seconds, source } = req.body;

    if (!session_id || !event_type || timestamp_seconds === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: session_id, event_type, timestamp_seconds',
      });
    }

    const { error } = await supabase.from('video_watch_events').insert({
      id: crypto.randomUUID(),
      video_id: parseInt(videoId),
      viewer_id: viewer_id ? parseInt(viewer_id) : null,
      session_id,
      event_type,
      timestamp_seconds: parseFloat(timestamp_seconds),
      source: source || 'for_you',
    });

    if (error) throw error;
    return res.status(201).json({ success: true });
  } catch (err) {
    console.error('[watch-event]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/videos/:videoId/follow-conversion ───────────────────────────
// Called when viewer follows the creator. Backend checks the 30-min window.
router.post('/:videoId/follow-conversion', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { viewer_id, creator_id } = req.body;

    if (!viewer_id || !creator_id) {
      return res.status(400).json({ error: 'Missing viewer_id or creator_id' });
    }

    // Check viewer watched this video in last 30 min
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentWatch } = await supabase
      .from('video_watch_events')
      .select('id')
      .eq('video_id', parseInt(videoId))
      .eq('viewer_id', parseInt(viewer_id))
      .gte('created_at', thirtyMinAgo)
      .limit(1);

    if (!recentWatch || recentWatch.length === 0) {
      return res.status(200).json({
        recorded: false,
        reason: 'No recent watch within 30 min',
      });
    }

    const { error } = await supabase
      .from('video_follow_conversions')
      .upsert(
        {
          id: crypto.randomUUID(),
          video_id: parseInt(videoId),
          viewer_id: parseInt(viewer_id),
          creator_id: parseInt(creator_id),
        },
        { onConflict: 'video_id,viewer_id' }
      );

    if (error) throw error;
    return res.status(201).json({ recorded: true });
  } catch (err) {
    console.error('[follow-conversion]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/videos/:videoId/insights ─────────────────────────────────────
// Returns full insights payload. Uses cache if fresh (< 15 min), else recomputes.
router.get('/:videoId/insights', async (req, res) => {
  try {
    const { videoId } = req.params;
    const vidId = parseInt(videoId);

    // Check cache freshness
    const { data: cached } = await supabase
      .from('video_insights_cache')
      .select('*')
      .eq('video_id', vidId)
      .single();

    const CACHE_TTL_MS = 15 * 60 * 1000;
    if (cached && (Date.now() - new Date(cached.updated_at).getTime()) < CACHE_TTL_MS) {
      return res.json({ success: true, data: cached, from_cache: true });
    }

    // Recompute
    const computed = await computeInsights(vidId);

    // Upsert to cache
    await supabase.from('video_insights_cache').upsert(
      { video_id: vidId, ...computed, updated_at: new Date().toISOString() },
      { onConflict: 'video_id' }
    );

    return res.json({ success: true, data: { video_id: vidId, ...computed }, from_cache: false });
  } catch (err) {
    console.error('[insights GET]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Helper: computeInsights(videoId) ──────────────────────────────────────
async function computeInsights(videoId) {
  // Fetch all raw data in parallel
  const [watchData, postData, likesData, commentsData, savesData, sharesData, followData] =
    await Promise.all([
      supabase.from('video_watch_events').select('*').eq('video_id', videoId),
      supabase
        .from('posts')
        .select('duration_seconds, like_count, share_count, created_at, user_id')
        .eq('id', videoId)
        .single(),
      supabase
        .from('post_likes')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', videoId),
      supabase
        .from('post_comments')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', videoId),
      supabase
        .from('post_saves')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', videoId),
      supabase
        .from('post_shares')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', videoId),
      supabase.from('video_follow_conversions').select('viewer_id').eq('video_id', videoId),
    ]);

  const events = watchData.data || [];
  const post = postData.data || {};
  const follows = followData.data || [];
  const videoDuration = post.duration_seconds || 42;

  // Engagement counts — prefer denormalized columns, fall back to COUNT queries
  const likesCount = post.like_count ?? (likesData.count || 0);
  const commentsCount = commentsData.count || 0;
  const savesCount = savesData.count || 0;
  const sharesCount = post.share_count ?? (sharesData.count || 0);
  // DM sends are internal shares tracked in post_shares with share_type='internal'
  const { count: dmCount } = await supabase
    .from('post_shares')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', videoId)
    .eq('share_type', 'internal');
  const dmSendsCount = dmCount || 0;

  // ── Sessions & views ──
  const sessions = groupBy(events, 'session_id');
  const sessionIds = Object.keys(sessions);
  const totalViews = sessionIds.length;
  const uniqueViewers = new Set(events.map((e) => e.viewer_id).filter(Boolean)).size;

  // ── Max timestamp reached per session ──
  const sessionMaxSeconds = sessionIds.map((sid) => {
    const es = sessions[sid];
    return Math.max(...es.map((e) => e.timestamp_seconds));
  });
  const totalWatchSeconds = sessionMaxSeconds.reduce((a, b) => a + b, 0);
  const avgWatchSeconds = totalViews > 0 ? totalWatchSeconds / totalViews : 0;
  const completionRate =
    totalViews > 0
      ? sessionMaxSeconds.filter((s) => s >= videoDuration * 0.95).length / totalViews
      : 0;

  // ── Hook rate (3-second retention) ──
  const hookRate =
    totalViews > 0
      ? sessionMaxSeconds.filter((s) => s >= 3).length / totalViews
      : 0;

  // ── Re-watch rate ──
  const viewerSessionCounts = {};
  events.forEach((e) => {
    if (e.viewer_id) {
      viewerSessionCounts[e.viewer_id] = viewerSessionCounts[e.viewer_id] || new Set();
      viewerSessionCounts[e.viewer_id].add(e.session_id);
    }
  });
  const rewatchRate =
    uniqueViewers > 0
      ? Object.values(viewerSessionCounts).reduce((a, s) => a + s.size, 0) / uniqueViewers
      : 1;

  // ── Retention curve (10 buckets) ──
  const buckets = 10;
  const retentionCurve = Array.from({ length: buckets + 1 }, (_, i) => {
    const targetSec = (i / buckets) * videoDuration;
    const reached = sessionMaxSeconds.filter((s) => s >= targetSec).length;
    return {
      pct: Math.round((i / buckets) * 100),
      seconds: Math.round(targetSec),
      retention: totalViews > 0 ? Math.round((reached / totalViews) * 100) : 0,
    };
  });

  // ── Midpoint drop ──
  const midIdx = Math.floor(buckets / 2);
  const midpointDrop =
    retentionCurve.length > midIdx + 1
      ? retentionCurve[midIdx - 1].retention - retentionCurve[midIdx + 1].retention
      : 0;

  // ── Most replayed moment ──
  const replayEvents = events.filter((e) => e.event_type === 'replay');
  const mostReplayed =
    replayEvents.length > 0
      ? modeValue(replayEvents.map((e) => Math.round(e.timestamp_seconds)))
      : Math.round(videoDuration * 0.2);

  // ── Largest single drop in retention ──
  const majorDropBucket = retentionCurve.slice(1).reduce(
    (worst, b, i) => {
      const prev = retentionCurve[i]; // slice(1) so index i maps to retentionCurve[i]
      const drop = (prev?.retention || 0) - b.retention;
      return drop > (worst.drop || 0) ? { ...b, drop } : worst;
    },
    {}
  );

  // ── ROR Score ──
  const normalize = (val, max) => (max > 0 ? Math.min(val / max, 1) : 0);
  const rorScore = Math.round(
    normalize(completionRate, 1) * 40 +
      normalize(savesCount, Math.max(totalViews * 0.1, 1)) * 25 +
      normalize(sharesCount, Math.max(totalViews * 0.05, 1)) * 20 +
      normalize(dmSendsCount, Math.max(totalViews * 0.02, 1)) * 15
  );

  // ── AQI Score ──
  const highIntentViewers = sessionIds.filter((sid) => {
    const maxSec = Math.max(...(sessions[sid] || []).map((e) => e.timestamp_seconds));
    return maxSec >= videoDuration * 0.8;
  }).length;
  const ghostViewers = sessionIds.filter((sid) => {
    const maxSec = Math.max(...(sessions[sid] || []).map((e) => e.timestamp_seconds));
    return maxSec < 3;
  }).length;
  const highIntentPct = totalViews > 0 ? Math.round((highIntentViewers / totalViews) * 100) : 0;
  const ghostViewerPct = totalViews > 0 ? Math.round((ghostViewers / totalViews) * 100) : 0;
  const aqiScore = Math.round(
    highIntentPct * 0.5 + (100 - ghostViewerPct) * 0.3 + Math.min(completionRate * 100, 100) * 0.2
  );

  // ── Traffic sources ──
  const sourceCounts = countByField(events, 'source');
  const trafficSources = normalizeDistribution(sourceCounts);

  // ── Hourly views ──
  const hourlyRaw = {};
  events.forEach((e) => {
    if (e.event_type === 'play') {
      const h = new Date(e.created_at).getHours();
      hourlyRaw[h] = (hourlyRaw[h] || 0) + 1;
    }
  });
  const hourlyViews = Array.from({ length: 24 }, (_, h) => ({ hour: h, views: hourlyRaw[h] || 0 }));
  const peakHour = hourlyViews.reduce((best, h) => (h.views > best.views ? h : best), hourlyViews[0]).hour;

  // ── Follow conversion ──
  const newFollowers = follows.length;
  const followConversionRate = totalViews > 0 ? newFollowers / totalViews : 0;

  // ── Reach ──
  const reachTotal = uniqueViewers;
  const communityBoostViews = events.filter((e) => e.source === 'community').length;

  // ── Non-follower reach: check which unique viewers follow the creator ──
  let reachNonFollowersPct = 0;
  const creatorId = postData.data?.user_id;
  const viewerIds = [...new Set(events.map((e) => e.viewer_id).filter(Boolean))];
  if (reachTotal > 0 && creatorId && viewerIds.length > 0) {
    const { count: followerViewers } = await supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('following_id', creatorId)
      .in('follower_id', viewerIds);
    const nonFollowerCount = reachTotal - (followerViewers || 0);
    reachNonFollowersPct = Math.round((nonFollowerCount / reachTotal) * 100);
  }

  // ── Viewer profile join for age, location, intent ──
  let ageBreakdown = {};
  let topLocations = [];
  let intentClassification = {};

  if (viewerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('users')
      .select('id, age_group, city, intent_type')
      .in('id', viewerIds);

    if (profiles && profiles.length > 0) {
      // Age breakdown
      const ageCounts = countByField(profiles, 'age_group');
      ageBreakdown = normalizeDistribution(ageCounts);

      // Top locations (top 5 cities)
      const cityCounts = countByField(profiles.filter(p => p.city), 'city');
      const cityTotal = Object.values(cityCounts).reduce((a, b) => a + b, 0);
      const sortedCities = Object.entries(cityCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);
      const topCitySum = sortedCities.reduce((a, [, v]) => a + v, 0);
      const otherCount = cityTotal - topCitySum;
      topLocations = sortedCities.map(([city, count]) => ({
        city,
        pct: Math.round((count / cityTotal) * 100),
      }));
      if (otherCount > 0 && cityTotal > 0) {
        topLocations.push({ city: 'Others', pct: Math.round((otherCount / cityTotal) * 100) });
      }

      // Intent classification
      const intentCounts = countByField(profiles.filter(p => p.intent_type), 'intent_type');
      intentClassification = normalizeDistribution(intentCounts);
    }
  }

  // ── Best time to post (2-hour window centred on peak hour) ──
  const peakStart = peakHour === 0 ? formatHour(23) : formatHour(Math.max(peakHour - 1, 0));
  const peakEnd = formatHour((peakHour + 1) % 24);
  const bestTimeToPost = totalViews > 0
    ? `${peakStart} – ${peakEnd}`
    : null;

  return {
    total_views: totalViews,
    unique_viewers: uniqueViewers,
    total_watch_seconds: Math.round(totalWatchSeconds),
    avg_watch_seconds: Math.round(avgWatchSeconds),
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
  };
}

// ─── Utility helpers ────────────────────────────────────────────────────────
function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key];
    acc[k] = acc[k] || [];
    acc[k].push(item);
    return acc;
  }, {});
}

function countByField(arr, field) {
  return arr.reduce((acc, item) => {
    const k = item[field] || 'unknown';
    acc[k] = (acc[k] || 0) + 1;
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

function modeValue(arr) {
  const freq = {};
  arr.forEach((v) => (freq[v] = (freq[v] || 0) + 1));
  return parseInt(Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || 0);
}

function formatHour(h) {
  if (h === 0) return '12:00 AM';
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

module.exports = router;
