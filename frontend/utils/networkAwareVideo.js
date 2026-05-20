/**
 * Network-Aware Video Delivery
 *
 * Dynamically selects video delivery resolution based on connection quality.
 * Used by MediaViewerTimeline (fullscreen viewer) to avoid buffering on slow
 * connections while delivering sharp video on WiFi.
 *
 * Resolution map:
 *   WiFi          → 720p (w_720)
 *   4G/LTE        → 480p (w_480)
 *   3G/2G/unknown → 360p (w_360)
 */
import NetInfo from '@react-native-community/netinfo';

// Cache the result per app session — network type rarely changes mid-video
let cachedWidth = null;

/**
 * Get the optimal video width based on current network conditions.
 * Result is cached per session so we don't re-check for every video.
 *
 * @param {boolean} [forceRefresh=false] - Force re-checking network state
 * @returns {Promise<number>} Optimal width in pixels (720, 480, or 360)
 */
export async function getOptimalVideoWidth(forceRefresh = false) {
  if (cachedWidth && !forceRefresh) return cachedWidth;

  try {
    const state = await NetInfo.fetch();

    if (state.type === 'wifi' || state.type === 'ethernet') {
      cachedWidth = 720;
    } else if (state.type === 'cellular') {
      const gen = state.details?.cellularGeneration;
      if (gen === '4g' || gen === '5g') {
        cachedWidth = 480;
      } else {
        // 3g, 2g, or unknown cellular
        cachedWidth = 360;
      }
    } else {
      // VPN, bluetooth, other, or unknown — conservative default
      cachedWidth = 480;
    }

    console.log(`[networkAwareVideo] Network: ${state.type}/${state.details?.cellularGeneration || '-'} → w_${cachedWidth}`);
  } catch (error) {
    console.warn('[networkAwareVideo] Failed to check network, defaulting to 480:', error.message);
    cachedWidth = 480;
  }

  return cachedWidth;
}

/**
 * Subscribe to network changes and update cached width.
 * Call once on app startup (e.g., in App.js or a context provider).
 *
 * @returns {function} Unsubscribe function
 */
export function subscribeToNetworkChanges() {
  return NetInfo.addEventListener((state) => {
    const prevWidth = cachedWidth;

    if (state.type === 'wifi' || state.type === 'ethernet') {
      cachedWidth = 720;
    } else if (state.type === 'cellular') {
      const gen = state.details?.cellularGeneration;
      cachedWidth = (gen === '4g' || gen === '5g') ? 480 : 360;
    } else {
      cachedWidth = 480;
    }

    if (prevWidth !== cachedWidth) {
      console.log(`[networkAwareVideo] Network changed → w_${cachedWidth}`);
    }
  });
}
