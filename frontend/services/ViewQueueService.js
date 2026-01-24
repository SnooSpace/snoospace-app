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
import { apiPost } from "../api/client";
import { getAuthToken } from "../api/auth";

const QUEUE_STORAGE_KEY = "qualified_view_queue";
const VIEWED_POSTS_KEY = "viewed_posts_cache";
const BATCH_INTERVAL = 5000; // 5 seconds
const MAX_BATCH_SIZE = 50;

class ViewQueueService {
  constructor() {
    this.pendingQueue = [];
    this.viewedPostsCache = new Set(); // Advisory local cache
    this.batchTimer = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the service - load persisted data
   */
  async init() {
    if (this.isInitialized) return;

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
      ...metadata,
    });

    // Persist changes
    await this.persistData();

    // Flush immediately if queue is large
    if (this.pendingQueue.length >= MAX_BATCH_SIZE) {
      this.flushQueue();
    }

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
      const token = await getAuthToken();
      if (!token) {
        // Not authenticated, put batch back
        this.pendingQueue = [...batch, ...this.pendingQueue];
        return;
      }

      const response = await apiPost(
        "/posts/views/batch",
        { views: batch },
        15000,
        token,
      );

      // Server returns which posts were accepted as unique
      // Update local cache with server truth
      if (response.accepted && Array.isArray(response.accepted)) {
        response.accepted.forEach((id) => {
          this.viewedPostsCache.add(String(id));
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
}

// Export singleton instance
export const viewQueueService = new ViewQueueService();

// Initialize on import
viewQueueService.init().catch(console.error);

export default viewQueueService;
