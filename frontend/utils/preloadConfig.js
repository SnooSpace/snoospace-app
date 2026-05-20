/**
 * Preload Configuration
 *
 * Determines how many videos ahead/behind to preload in the feed
 * based on device memory. Low-RAM Android devices get reduced or
 * disabled preloading to avoid OOM crashes.
 *
 * Memory tiers:
 *   >= 4GB RAM → preload 2 videos ahead
 *   >= 2GB RAM → preload 1 video ahead
 *   <  2GB RAM → preload disabled (0)
 */
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Cache the result — totalMemory doesn't change at runtime
let cachedMaxPreloadDistance = null;

/**
 * Get the maximum number of videos to preload ahead/behind
 * the currently visible post in the feed.
 *
 * @returns {Promise<number>} 0 (disabled), 1, or 2
 */
export async function getMaxPreloadDistance() {
  if (cachedMaxPreloadDistance !== null) return cachedMaxPreloadDistance;

  try {
    const totalMemory = Device.totalMemory; // bytes (synchronous on native)

    if (!totalMemory) {
      // Expo Go or web — can't determine memory, use conservative default
      cachedMaxPreloadDistance = 1;
      console.log('[preloadConfig] Memory unknown, defaulting to preload distance 1');
      return cachedMaxPreloadDistance;
    }

    const totalGB = totalMemory / (1024 * 1024 * 1024);

    if (totalGB >= 4) {
      cachedMaxPreloadDistance = 2;
    } else if (totalGB >= 2) {
      cachedMaxPreloadDistance = 1;
    } else {
      cachedMaxPreloadDistance = 0; // disabled — budget phone
    }

    console.log(`[preloadConfig] Device RAM: ${totalGB.toFixed(1)}GB → maxPreloadDistance: ${cachedMaxPreloadDistance}`);
  } catch (error) {
    console.warn('[preloadConfig] Error reading device memory:', error.message);
    cachedMaxPreloadDistance = 1; // safe default
  }

  return cachedMaxPreloadDistance;
}

/**
 * Synchronous getter for use in render paths after initial async call.
 * Returns null if not yet initialized — caller should fall back to 1.
 */
export function getMaxPreloadDistanceSync() {
  return cachedMaxPreloadDistance;
}
