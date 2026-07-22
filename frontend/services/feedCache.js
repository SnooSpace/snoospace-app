/**
 * feedCache.js — MMKV-backed persistent feed snapshot for cold-start hydration.
 *
 * MMKV reads are synchronous, so calling loadFeedSnapshot() at the top of
 * HomeFeedScreen's mount path gives FlashList real content at frame 0 — before
 * any network call resolves.
 *
 * Key: 'feed_snapshot_v1'
 * Payload: { posts, events, opportunities } — only the fields needed to render
 * initial cards (no heavy video metadata).
 *
 * NOTE: react-native-mmkv is NOT in this project's dependencies. We use
 * AsyncStorage as a synchronous-equivalent alternative with JSON serialization,
 * but expose the same save/load API so the caller is future-proof.
 *
 * ─── Why not MMKV right now? ────────────────────────────────────────────────
 * react-native-mmkv requires a native module rebuild (expo-build-properties or
 * its own config plugin). The project runs via expo-dev-client, so adding a
 * new native module requires a new dev client build. To avoid blocking this
 * Phase 1 sprint, we implement the same API using AsyncStorage (already
 * installed) and mark the MMKV migration path clearly below.
 *
 * The key difference: AsyncStorage reads are async, so we cannot call this
 * synchronously at component render. We instead call it inside useEffect before
 * loadInitialData() kicks off, which still captures the frame-0 skeleton →
 * cached-content transition (much faster than waiting for network).
 *
 * ─── MMKV migration path (future) ──────────────────────────────────────────
 * 1. `npx expo install react-native-mmkv`
 * 2. Add the MMKV config plugin to app.json plugins array.
 * 3. Build a new dev client.
 * 4. Replace the AsyncStorage calls below with:
 *      import { MMKV } from 'react-native-mmkv';
 *      const storage = new MMKV({ id: 'feed-cache' });
 *      storage.set(FEED_CACHE_KEY, JSON.stringify(payload));   // sync write
 *      const raw = storage.getString(FEED_CACHE_KEY);          // sync read
 * 5. loadFeedSnapshot() can then be called synchronously before useState init.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const FEED_CACHE_KEY = "feed_snapshot_v1";

/**
 * Fields to keep per post. Strips heavy fields (video metadata, large blobs)
 * that are not needed for first-frame card rendering.
 *
 * Keep: id, itemType, media_types, author_*, content, like_count, comment_count,
 *        share_count, is_liked, is_saved, is_following, created_at, tagged_entities,
 *        thumbnail_url (for video cards), and the top-level shape fields.
 *
 * Strip: anything that's already lazy-loaded by the card on mount (full video URLs,
 *        analytics metadata, challenge submission arrays, etc.)
 */
function trimPost(post) {
  if (!post) return null;
  return {
    id: post.id,
    itemType: post.itemType,
    content: post.content,
    media_types: post.media_types,
    media_urls: post.media_urls,
    thumbnail_url: post.thumbnail_url,
    author_id: post.author_id,
    author_type: post.author_type,
    author_name: post.author_name,
    author_username: post.author_username,
    author_photo: post.author_photo,
    like_count: post.like_count,
    comment_count: post.comment_count,
    share_count: post.share_count,
    save_count: post.save_count,
    is_liked: post.is_liked,
    is_saved: post.is_saved,
    is_following: post.is_following,
    post_type: post.post_type,
    created_at: post.created_at,
    tagged_entities: post.tagged_entities,
    public_view_count: post.public_view_count,
  };
}

function trimEvent(event) {
  if (!event) return null;
  return {
    id: event.id,
    itemType: event.itemType,
    title: event.title,
    description: event.description,
    cover_image: event.cover_image,
    start_date: event.start_date,
    end_date: event.end_date,
    location: event.location,
    organizer_name: event.organizer_name,
    organizer_photo: event.organizer_photo,
    organizer_id: event.organizer_id,
    organizer_type: event.organizer_type,
    price: event.price,
    is_interested: event.is_interested,
    interest_count: event.interest_count,
    category: event.category,
  };
}

function trimOpportunity(opp) {
  if (!opp) return null;
  return {
    id: opp.id,
    itemType: opp.itemType,
    title: opp.title,
    description: opp.description,
    cover_image: opp.cover_image,
    creator_name: opp.creator_name,
    creator_photo: opp.creator_photo,
    creator_id: opp.creator_id,
    like_count: opp.like_count,
    comment_count: opp.comment_count,
    is_liked: opp.is_liked,
    is_saved: opp.is_saved,
    deadline: opp.deadline,
    category: opp.category,
    status: opp.status,
  };
}

/**
 * Persist a feed snapshot after a successful network load.
 * Only keeps the first 20 posts, 5 events, and 5 opportunities to bound payload size.
 *
 * @param {Array} posts
 * @param {Array} events
 * @param {Array} opportunities
 */
export async function saveFeedSnapshot(posts = [], events = [], opportunities = []) {
  try {
    const payload = {
      posts: posts.slice(0, 20).map(trimPost).filter(Boolean),
      events: events.slice(0, 5).map(trimEvent).filter(Boolean),
      opportunities: opportunities.slice(0, 5).map(trimOpportunity).filter(Boolean),
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify(payload));
  } catch (e) {
    // Non-fatal — cold start will just show skeletons instead
    console.warn("[feedCache] Failed to save feed snapshot:", e);
  }
}

/**
 * Load the persisted feed snapshot.
 * Returns null if no snapshot exists, is unreadable, or is older than 24 hours.
 *
 * @returns {Promise<{ posts: Array, events: Array, opportunities: Array } | null>}
 */
export async function loadFeedSnapshot() {
  try {
    const raw = await AsyncStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.posts)) return null;

    // Discard snapshots older than 24 hours to avoid stale content on first frame
    const MAX_AGE_MS = 24 * 60 * 60 * 1000;
    if (parsed.savedAt && Date.now() - parsed.savedAt > MAX_AGE_MS) {
      console.log("[feedCache] Snapshot too old, ignoring");
      return null;
    }

    return {
      posts: parsed.posts || [],
      events: parsed.events || [],
      opportunities: parsed.opportunities || [],
    };
  } catch (e) {
    console.warn("[feedCache] Failed to load feed snapshot:", e);
    return null;
  }
}

/**
 * Clear the cached snapshot. Call after account switch to prevent cross-account leakage.
 */
export async function clearFeedSnapshot() {
  try {
    await AsyncStorage.removeItem(FEED_CACHE_KEY);
  } catch (e) {
    console.warn("[feedCache] Failed to clear feed snapshot:", e);
  }
}
