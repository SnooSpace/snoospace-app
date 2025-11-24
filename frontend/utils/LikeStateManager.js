/**
 * LikeStateManager - In-memory cache for post like states
 * 
 * This is a workaround for backend API returning stale is_liked data.
 * When a user likes/unlikes a post, we cache the state here, and when
 * fetching posts from the API, we merge with the cached state to get
 * the correct is_liked value.
 */

class LikeStateManager {
  constructor() {
    // Map of postId -> { isLiked: boolean, timestamp: number }
    this.likeCache = new Map();
  }

  /**
   * Set the like state for a post
   * @param {string|number} postId - The post ID
   * @param {boolean} isLiked - Whether the post is liked
   */
  setLikeState(postId, isLiked) {
    console.log(`[LikeStateManager] Setting like state for post ${postId}:`, isLiked);
    this.likeCache.set(String(postId), {
      isLiked,
      timestamp: Date.now(),
    });
  }

  /**
   * Get the cached like state for a post
   * @param {string|number} postId - The post ID
   * @returns {boolean|null} - The cached like state, or null if not cached
   */
  getLikeState(postId) {
    const cached = this.likeCache.get(String(postId));
    if (!cached) return null;

    // Cache entries expire after 5 minutes to prevent stale data
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      console.log(`[LikeStateManager] Cache expired for post ${postId}`);
      this.likeCache.delete(String(postId));
      return null;
    }

    console.log(`[LikeStateManager] Retrieved cached like state for post ${postId}:`, cached.isLiked);
    return cached.isLiked;
  }

  /**
   * Clear the cached like state for a post
   * @param {string|number} postId - The post ID
   */
  clearLikeState(postId) {
    console.log(`[LikeStateManager] Clearing like state for post ${postId}`);
    this.likeCache.delete(String(postId));
  }

  /**
   * Clear all cached like states
   */
  clearAll() {
    console.log('[LikeStateManager] Clearing all cached like states');
    this.likeCache.clear();
  }

  /**
   * Merge cached like states with posts fetched from API
   * @param {Array} posts - Array of post objects from API
   * @returns {Array} - Posts with cached like states merged in
   */
  mergeLikeStates(posts) {
    if (!Array.isArray(posts)) return posts;

    return posts.map(post => {
      const cachedLikeState = this.getLikeState(post.id);
      
      // If we have a cached like state, override the API's is_liked value
      if (cachedLikeState !== null) {
        console.log(`[LikeStateManager] Overriding API is_liked for post ${post.id}: ${post.is_liked} -> ${cachedLikeState}`);
        return {
          ...post,
          is_liked: cachedLikeState,
          isLiked: cachedLikeState,
        };
      }
      
      return post;
    });
  }
}

// Export singleton instance
const likeStateManager = new LikeStateManager();
export default likeStateManager;
