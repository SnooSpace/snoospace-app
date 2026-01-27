/**
 * LikeStateManager - In-memory cache for post like states
 *
 * CRITICAL: This cache is VIEWER-SCOPED to prevent cross-account state leakage.
 * Cache keys format: "{accountType}_{accountId}_{postId}"
 *
 * Examples:
 * - "member_28_109" (Member ID 28's like state for Post 109)
 * - "community_9_109" (Community ID 9's like state for Post 109)
 *
 * This ensures Account A's like states never leak to Account B.
 */

class LikeStateManager {
  constructor() {
    // Map of compositeKey -> { isLiked: boolean, timestamp: number }
    // compositeKey format: "{accountType}_{accountId}_{postId}"
    this.likeCache = new Map();
  }

  /**
   * Get current viewer identity
   * MUST be called for every cache operation
   * @returns {Promise<string|null>} - Composite key "{accountType}_{accountId}" or null
   */
  async getCurrentViewer() {
    try {
      // Dynamic import to avoid circular dependency
      const { getActiveAccount } = await import("../api/auth");
      const account = await getActiveAccount();

      if (!account || !account.type || !account.id) {
        console.warn("[LikeStateManager] No active account or missing type/id");
        return null;
      }

      return `${account.type}_${account.id}`;
    } catch (error) {
      console.error("[LikeStateManager] Error getting current viewer:", error);
      return null;
    }
  }

  /**
   * Set the like state for current viewer + post
   * @param {string|number} postId - The post ID
   * @param {boolean} isLiked - Whether the post is liked
   * @returns {Promise<void>}
   */
  async setLikeState(postId, isLiked) {
    const viewer = await this.getCurrentViewer();
    if (!viewer) {
      console.warn(
        "[LikeStateManager] No active account, cannot cache like state",
      );
      return;
    }

    const key = `${viewer}_${postId}`;
    console.log(`[LikeStateManager] Setting like state for ${key}:`, isLiked);

    this.likeCache.set(key, {
      isLiked,
      timestamp: Date.now(),
    });
  }

  /**
   * Get the cached like state for current viewer + post
   * @param {string|number} postId - The post ID
   * @returns {Promise<boolean|null>} - The cached like state, or null if not cached
   */
  async getLikeState(postId) {
    const viewer = await this.getCurrentViewer();
    if (!viewer) return null;

    const key = `${viewer}_${postId}`;
    const cached = this.likeCache.get(key);

    if (!cached) return null;

    // Cache entries expire after 5 minutes to prevent stale data
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      console.log(`[LikeStateManager] Cache expired for ${key}`);
      this.likeCache.delete(key);
      return null;
    }

    console.log(
      `[LikeStateManager] Retrieved cached like state for ${key}:`,
      cached.isLiked,
    );
    return cached.isLiked;
  }

  /**
   * Clear the cached like state for current viewer + post
   * @param {string|number} postId - The post ID
   * @returns {Promise<void>}
   */
  async clearLikeState(postId) {
    const viewer = await this.getCurrentViewer();
    if (!viewer) return;

    const key = `${viewer}_${postId}`;
    console.log(`[LikeStateManager] Clearing like state for ${key}`);
    this.likeCache.delete(key);
  }

  /**
   * Clear ALL cache entries for a specific account
   * MUST be called on account switch
   * @param {string} accountType - Account type (e.g., "member", "community")
   * @param {string|number} accountId - Account ID
   */
  clearAccountCache(accountType, accountId) {
    const prefix = `${accountType}_${accountId}_`;
    const keysToDelete = [];

    for (const key of this.likeCache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.likeCache.delete(key));
    console.log(
      `[LikeStateManager] Cleared ${keysToDelete.length} cache entries for ${prefix}`,
    );
  }

  /**
   * Clear all cached like states
   * Call on logout or when switching accounts as a safety measure
   */
  clearAll() {
    const size = this.likeCache.size;
    console.log(`[LikeStateManager] Clearing all ${size} cached like states`);
    this.likeCache.clear();
  }

  /**
   * Merge cached like states with posts fetched from API
   * @param {Array} posts - Array of post objects from API
   * @returns {Promise<Array>} - Posts with cached like states merged in
   */
  async mergeLikeStates(posts) {
    if (!Array.isArray(posts)) return posts;

    const viewer = await this.getCurrentViewer();
    if (!viewer) {
      console.warn(
        "[LikeStateManager] No active account, skipping cache merge",
      );
      return posts;
    }

    return posts.map((post) => {
      const key = `${viewer}_${post.id}`;
      const cached = this.likeCache.get(key);

      // Only use cached state if not expired
      if (cached && Date.now() - cached.timestamp <= 5 * 60 * 1000) {
        console.log(
          `[LikeStateManager] Applying cached state for ${key}: ${cached.isLiked}`,
        );
        return {
          ...post,
          is_liked: cached.isLiked,
          isLiked: cached.isLiked,
        };
      }

      return post;
    });
  }

  /**
   * Get cache metrics for debugging
   * @returns {Object} - Cache statistics
   */
  getMetrics() {
    const entries = Array.from(this.likeCache.entries());
    const byAccount = {};

    entries.forEach(([key, value]) => {
      // Extract account prefix from key (e.g., "member_28" from "member_28_109")
      const parts = key.split("_");
      if (parts.length >= 3) {
        const accountKey = `${parts[0]}_${parts[1]}`;
        byAccount[accountKey] = (byAccount[accountKey] || 0) + 1;
      }
    });

    return {
      totalEntries: entries.length,
      byAccount,
      oldestEntry:
        entries.length > 0
          ? Math.min(...entries.map(([_, v]) => v.timestamp))
          : null,
      newestEntry:
        entries.length > 0
          ? Math.max(...entries.map(([_, v]) => v.timestamp))
          : null,
    };
  }
}

// Export singleton instance
const likeStateManager = new LikeStateManager();
export default likeStateManager;
