/**
 * ViewQueueService
 *
 * Manages qualified view submissions with:
 * - Local deduplication (advisory, server is source of truth)
 * - Offline persistence via AsyncStorage
 * - Batched submissions to reduce network calls
 * - Separate tracking for repeat/engaged views (private analytics)
 *
 * IMPORTANT: Server-side deduplication with UNIQUE(post_id, user_id, user_type)
 * is the source of truth. Local cache is advisory only.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import * as Crypto from "expo-crypto";
import { apiPost, apiPatch } from "../api/client";
import { getAuthToken } from "../api/auth";
import EventBus from "../utils/EventBus";

const QUEUE_STORAGE_KEY = "qualified_view_queue";
const VIEWED_POSTS_KEY = "viewed_posts_cache";
const BATCH_INTERVAL = 5000; // 5 seconds
const MAX_BATCH_SIZE = 50;

class ViewQueueService {
  constructor() {
    this.pendingQueue = [];
    this.viewedPostsCache = new Set(); // Advisory local cache
    this.unseenInSessionSet = new Set(); // In-memory session deduplication for unseen impressions
    this.discoveryServeInSessionSet = new Set(); // In-memory dedup for discovery_serve stamps
    this.sessionId = Crypto.randomUUID(); // In-memory cold start session ID (UUID v4)
    this.batchTimer = null;
    this.isInitialized = false;
    this._cachedToken = null; // Auth token cache — avoids AsyncStorage hit on every impression
    this._tokenFetchPromise = null; // Deduplicates concurrent token fetches
  }

  /**
   * Warm the auth token cache. Called from HomeFeedScreen on mount and on
   * account switch so impressions never have to wait for AsyncStorage.
   */
  setCachedToken(token) {
    this._cachedToken = token;
  }

  /**
   * Get the cached token, fetching once if not yet available.
   * Deduplicates concurrent calls via a shared promise.
   */
  async _getToken() {
    if (this._cachedToken) return this._cachedToken;
    if (this._tokenFetchPromise) return this._tokenFetchPromise;
    this._tokenFetchPromise = getAuthToken().then((t) => {
      this._cachedToken = t;
      this._tokenFetchPromise = null;
      return t;
    });
    return this._tokenFetchPromise;
  }

  /**
   * Get current in-memory session ID
   */
  getSessionId() {
    return this.sessionId;
  }

  /**
   * Initialize the service - load persisted data
   */
  async init() {
    if (this.isInitialized) return;
    console.log(`[SESSION] New session started: ${this.sessionId}`);

    try {
      // Load pending queue from storage (for offline support)
      const storedQueue = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (storedQueue) {
        this.pendingQueue = JSON.parse(storedQueue);
      }

      // Load viewed posts cache (advisory)
      const storedViewed = await AsyncStorage.getItem(VIEWED_POSTS_KEY);
      if (storedViewed) {
        this.viewedPostsCache = new Set(JSON.parse(storedViewed));
      }
    } catch (e) {
      console.error("[ViewQueueService] Failed to load stored data:", e);
    }

    // Start batch timer
    this.startBatchTimer();

    // Listen for app state changes
    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange,
    );

    this.isInitialized = true;
  }

  /**
   * Check if a post has been viewed (advisory, not authoritative)
   */
  hasViewed(postId) {
    return this.viewedPostsCache.has(String(postId));
  }

  /**
   * Add a qualified view to the queue
   */
  async addQualifiedView(postId, metadata = {}) {
    const postIdStr = String(postId);

    // Check local cache (advisory)
    if (this.viewedPostsCache.has(postIdStr)) {
      // Already in local cache, treat as repeat view
      this.addRepeatView(postId, "revisit");
      return false;
    }

    // Add to local cache
    this.viewedPostsCache.add(postIdStr);

    // Add to pending queue
    this.pendingQueue.push({
      postId,
      type: "qualified",
      timestamp: Date.now(),
      viewSource: metadata.viewSource || null,
      ...metadata,
    });

    // Persist changes
    await this.persistData();

    // Flush soon — server confirmation triggers the UI count increment.
    // Using a short delay (500ms) to batch rapid-fire views from multiple
    // posts becoming visible simultaneously, while still feeling responsive.
    if (this.pendingQueue.length >= MAX_BATCH_SIZE) {
      this.flushQueue();
    } else if (!this._immediateFlushTimer) {
      this._immediateFlushTimer = setTimeout(() => {
        this._immediateFlushTimer = null;
        this.flushQueue();
      }, 500);
    }

    // NOTE: We do NOT optimistically increment the view count here.
    // The EventBus notification fires in flushQueue() only after the
    // server confirms the view was accepted (not a duplicate).

    return true;
  }

  /**
   * Add a repeat/engaged view (private analytics only)
   */
  addRepeatView(postId, engagementType) {
    this.pendingQueue.push({
      postId,
      type: "repeat",
      engagementType,
      timestamp: Date.now(),
    });

    // No need to persist repeat views immediately
    // They'll be included in the next batch
  }

  /**
   * Persist queue and cache to AsyncStorage
   */
  async persistData() {
    try {
      await AsyncStorage.setItem(
        QUEUE_STORAGE_KEY,
        JSON.stringify(this.pendingQueue),
      );
      await AsyncStorage.setItem(
        VIEWED_POSTS_KEY,
        JSON.stringify([...this.viewedPostsCache]),
      );
    } catch (e) {
      console.error("[ViewQueueService] Failed to persist data:", e);
    }
  }

  /**
   * Start the batch submission timer
   */
  startBatchTimer() {
    if (this.batchTimer) return;

    this.batchTimer = setInterval(() => {
      this.flushQueue();
    }, BATCH_INTERVAL);
  }

  /**
   * Stop the batch timer
   */
  stopBatchTimer() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Flush pending views to server
   */
  async flushQueue() {
    if (this.pendingQueue.length === 0) return;

    const batch = this.pendingQueue.splice(0, MAX_BATCH_SIZE);

    try {
      const token = await this._getToken();
      if (!token) {
        // Not authenticated, put batch back
        this.pendingQueue = [...batch, ...this.pendingQueue];
        return;
      }

      const response = await apiPost(
        "/posts/views/batch",
        { views: batch, sessionId: this.sessionId },
        15000,
        token,
      );

      // Server returns which posts were accepted as unique
      // Update local cache with server truth and notify UI
      if (response.accepted_details && Array.isArray(response.accepted_details)) {
        response.accepted_details.forEach((item) => {
          const id = typeof item === "object" ? item.postId : item;
          const viewCount = typeof item === "object" ? item.viewCount : undefined;
          this.viewedPostsCache.add(String(id));
          EventBus.emit("post-view-updated", { postId: id, viewCount });
        });
      } else if (response.accepted && Array.isArray(response.accepted)) {
        response.accepted.forEach((id) => {
          this.viewedPostsCache.add(String(id));
          // Only increment the visible count for server-confirmed new views
          EventBus.emit("post-view-updated", { postId: id });
        });
      }

      // Also add duplicates to cache (already viewed on another device)
      if (response.duplicate && Array.isArray(response.duplicate)) {
        response.duplicate.forEach((id) => {
          this.viewedPostsCache.add(String(id));
        });
      }

      // Clear persisted queue on success
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify([]));
      await this.persistData();
    } catch (e) {
      console.error("[ViewQueueService] Failed to submit batch:", e);
      // Put batch back in queue for retry
      this.pendingQueue = [...batch, ...this.pendingQueue];
      await this.persistData();
    }
  }

  /**
   * Handle app state changes
   */
  handleAppStateChange = async (nextState) => {
    if (nextState === "background" || nextState === "inactive") {
      // App going to background - flush immediately and stop timer
      await this.flushQueue();
      this.stopBatchTimer();
    } else if (nextState === "active") {
      // App coming to foreground - restart timer
      this.startBatchTimer();
    }
  };

  /**
   * Cleanup on app termination
   */
  cleanup() {
    this.stopBatchTimer();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
  }

  /**
   * Reset view cache on account switch.
   * Flushes pending views for the outgoing account, then clears
   * the local viewed-posts cache so the new account starts fresh.
   */
  async resetForAccountSwitch() {
    // Flush any pending views for the current (old) account
    await this.flushQueue();
    // Clear the in-memory cache
    this.viewedPostsCache = new Set();
    this.unseenInSessionSet = new Set();
    this.discoveryServeInSessionSet = new Set();
    this.pendingQueue = [];
    // Clear the persisted cache
    try {
      await AsyncStorage.setItem(VIEWED_POSTS_KEY, JSON.stringify([]));
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify([]));
    } catch (e) {
      console.error("[ViewQueueService] Failed to clear cache on account switch:", e);
    }
    console.log("[ViewQueueService] Cache reset for account switch");
  }

  /**
   * Update dwell time for an existing unique view event.
   * Called when video playback ends or component unmounts.
   * Fire-and-forget — failures are silently ignored.
   */
  async updateDwellTime(postId, dwellTimeMs) {
    if (!postId || !dwellTimeMs || dwellTimeMs <= 0) return;
    try {
      const token = await this._getToken();
      if (!token) return;
      await apiPatch(
        `/posts/views/${postId}/dwell`,
        { dwellTimeMs: Math.round(dwellTimeMs) },
        10000,
        token,
      );
    } catch (e) {
      // Fire-and-forget — don't block on failures
      console.warn('[ViewQueueService] updateDwellTime failed:', e?.message);
    }
  }

  /**
   * Record that a discovery post was served to this user this session.
   * Batched via the existing pendingQueue → /posts/views/batch.
   * The backend 'discovery_serve' type handler stamps first_discovered_at
   * (idempotent COALESCE) in post_impression_state for trickle pacing.
   */
  recordDiscoveryServe(postId) {
    if (!postId) return;
    const postIdStr = String(postId);

    // Skip synthetic IDs (e.g. "sub_8")
    const numericPostId = parseInt(postId, 10);
    if (isNaN(numericPostId) || String(numericPostId) !== postIdStr) return;

    // Session-level dedup — never stamp the same post twice per cold start
    if (this.discoveryServeInSessionSet.has(postIdStr)) return;
    this.discoveryServeInSessionSet.add(postIdStr);

    this.pendingQueue.push({
      postId: numericPostId,
      type: 'discovery_serve',
      timestamp: Date.now(),
    });
    // Picked up by the existing 5s batch interval — no immediate flush needed
  }

  /**
   * Record that a discovery opportunity was served to this user this session.
   * Sibling to recordDiscoveryServe — handles UUID opportunity IDs (not integers).
   * The backend 'discovery_opp_serve' type handler stamps first_discovered_at
   * (idempotent COALESCE) in opportunity_impression_state for trickle pacing.
   */
  recordDiscoveryOppServe(opportunityId) {
    if (!opportunityId) return;
    const oppIdStr = String(opportunityId);

    // Session-level dedup — never stamp the same opportunity twice per cold start
    if (this.discoveryServeInSessionSet.has(`opp_${oppIdStr}`)) return;
    this.discoveryServeInSessionSet.add(`opp_${oppIdStr}`);

    this.pendingQueue.push({
      postId: oppIdStr,  // UUID string — backend accepts via $3 parameter
      type: 'discovery_opp_serve',
      timestamp: Date.now(),
    });
    // Picked up by the existing 5s batch interval — no immediate flush needed
  }

  /**
   * Record an unseen impression event (scrolled past without qualifying).
   * Write-only tracking for Phase 1 lifecycle system.
   * DO NOT MODIFY — Posts path is unchanged.
   */
  recordUnseenImpression(postId) {
    if (!postId) return;
    const postIdStr = String(postId);

    // Skip synthetic IDs (e.g. sub_8)
    const numericPostId = parseInt(postId, 10);
    if (isNaN(numericPostId) || String(numericPostId) !== postIdStr) return;

    // Check in-memory session deduplication (synchronous — safe to call from scroll callbacks)
    if (this.unseenInSessionSet.has(postIdStr)) return;
    // Skip if already qualified / viewed
    if (this.hasViewed(postId)) return;

    // Mark synchronously to deduplicate before the async work runs
    this.unseenInSessionSet.add(postIdStr);
    console.log(`[UNSEEN] Recorded unseen impression for post ${postId} (session: ${this.sessionId})`);

    // Defer the network call entirely off the scroll thread.
    // Using setTimeout so this never blocks onViewableItemsChanged.
    setTimeout(async () => {
      try {
        const token = await this._getToken();
        if (!token) return;

        await apiPost(
          "/posts/views/unseen",
          { postId: numericPostId, sessionId: this.sessionId },
          10000,
          token,
        );
      } catch (e) {
        console.warn("[ViewQueueService] Failed to record unseen impression:", e?.message);
      }
    }, 0);
  }

  /**
   * Record an unseen impression for an Event (integer event_id).
   * Phase 2b — routes to POST /events/views/unseen.
   * Uses a separate session Set to avoid key collisions with Posts.
   */
  recordEventUnseen(eventId) {
    if (!eventId) return;
    const numericEventId = parseInt(eventId, 10);
    if (isNaN(numericEventId)) return;
    const key = String(numericEventId);

    if (!this.eventUnseenInSessionSet) this.eventUnseenInSessionSet = new Set();
    if (this.eventUnseenInSessionSet.has(key)) return;
    this.eventUnseenInSessionSet.add(key);

    console.log(`[UNSEEN-EVENT] Recording unseen for event ${numericEventId} (session: ${this.sessionId})`);

    setTimeout(async () => {
      try {
        const token = await this._getToken();
        if (!token) return;
        await apiPost(
          "/events/views/unseen",
          { eventId: numericEventId, sessionId: this.sessionId },
          10000,
          token,
        );
      } catch (e) {
        console.warn("[ViewQueueService] Failed to record unseen event impression:", e?.message);
      }
    }, 0);
  }

  /**
   * Record an unseen impression for an Opportunity (UUID opportunity_id).
   * Phase 2b — routes to POST /opportunities/views/unseen.
   * UUID is passed as-is — no parseInt guard. Uses a separate session Set.
   */
  recordOpportunityUnseen(opportunityId) {
    if (!opportunityId) return;
    const key = String(opportunityId);

    if (!this.opportunityUnseenInSessionSet) this.opportunityUnseenInSessionSet = new Set();
    if (this.opportunityUnseenInSessionSet.has(key)) return;
    this.opportunityUnseenInSessionSet.add(key);

    console.log(`[UNSEEN-OPP] Recording unseen for opportunity ${opportunityId} (session: ${this.sessionId})`);

    setTimeout(async () => {
      try {
        const token = await this._getToken();
        if (!token) return;
        await apiPost(
          "/opportunities/views/unseen",
          { opportunityId, sessionId: this.sessionId },
          10000,
          token,
        );
      } catch (e) {
        console.warn("[ViewQueueService] Failed to record unseen opportunity impression:", e?.message);
      }
    }, 0);
  }
}

// Export singleton instance
export const viewQueueService = new ViewQueueService();

// Initialize on import
viewQueueService.init().catch(console.error);

export default viewQueueService;
