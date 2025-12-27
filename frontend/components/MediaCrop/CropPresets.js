/**
 * CropPresets.js
 * Standardized crop presets for all media types in the app.
 * Each preset defines aspect ratio, constraints, and visual settings.
 */

// Preset type definitions
export const CROP_PRESETS = {
  /**
   * Avatar / Profile Picture
   * Used for: Member, Community, Sponsor, Venue profile photos
   */
  AVATAR: {
    key: "avatar",
    label: "Profile",
    aspectRatio: [1, 1],
    minWidth: 200,
    minHeight: 200,
    recommendedWidth: 400,
    recommendedHeight: 400,
    maxZoom: 5,
    showGrid: true,
    isCircular: true, // Display circular mask preview
    safeZone: null,
  },

  /**
   * Banner / Header
   * Used for: Community profiles, headers
   * Has safe zone on left side where avatar overlaps
   */
  BANNER: {
    key: "banner",
    label: "Banner",
    aspectRatio: [3, 1],
    minWidth: 600,
    minHeight: 200,
    recommendedWidth: 1200,
    recommendedHeight: 400,
    maxZoom: 5,
    showGrid: true,
    isCircular: false,
    safeZone: {
      left: 0.2, // 20% from left is reserved for avatar overlap
      top: 0,
      right: 0,
      bottom: 0,
    },
  },

  /**
   * Banner Square (1:1)
   * Used for: Event banner carousel - fixed 1:1 with no aspect ratio toggle
   */
  BANNER_SQUARE: {
    key: "banner_square",
    label: "Banner",
    aspectRatio: [1, 1],
    minWidth: 400,
    minHeight: 400,
    recommendedWidth: 1080,
    recommendedHeight: 1080,
    maxZoom: 5,
    showGrid: true,
    isCircular: false,
    safeZone: null,
  },

  /**
   * Event Card
   * Used for: Event listings, event headers
   */
  EVENT: {
    key: "event",
    label: "Event",
    aspectRatio: [16, 9],
    minWidth: 640,
    minHeight: 360,
    recommendedWidth: 1280,
    recommendedHeight: 720,
    maxZoom: 5,
    showGrid: true,
    isCircular: false,
    safeZone: null,
  },

  /**
   * Story / Fullscreen
   * Used for: Story posts, fullscreen media
   */
  STORY: {
    key: "story",
    label: "Story",
    aspectRatio: [9, 16],
    minWidth: 540,
    minHeight: 960,
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    maxZoom: 5,
    showGrid: true,
    isCircular: false,
    safeZone: {
      left: 0,
      top: 0.15, // 15% from top for UI elements
      right: 0,
      bottom: 0.15, // 15% from bottom for UI elements
    },
  },

  /**
   * Feed Post Square (Default)
   * Used for: Timeline posts
   */
  FEED_SQUARE: {
    key: "feed_square",
    label: "1:1",
    aspectRatio: [1, 1],
    minWidth: 600,
    minHeight: 600,
    recommendedWidth: 1080,
    recommendedHeight: 1080,
    maxZoom: 5,
    showGrid: true,
    isCircular: false,
    safeZone: null,
  },

  /**
   * Feed Post Portrait
   * Used for: Timeline posts (portrait orientation)
   */
  FEED_PORTRAIT: {
    key: "feed_portrait",
    label: "4:5",
    aspectRatio: [4, 5],
    minWidth: 600,
    minHeight: 750,
    recommendedWidth: 1080,
    recommendedHeight: 1350,
    maxZoom: 5,
    showGrid: true,
    isCircular: false,
    safeZone: null,
  },

  /**
   * Feed Post Landscape
   * Used for: Timeline posts (landscape orientation)
   */
  FEED_LANDSCAPE: {
    key: "feed_landscape",
    label: "16:9",
    aspectRatio: [16, 9],
    minWidth: 640,
    minHeight: 360,
    recommendedWidth: 1280,
    recommendedHeight: 720,
    maxZoom: 5,
    showGrid: true,
    isCircular: false,
    safeZone: null,
  },
};

/**
 * Get preset by key
 * @param {string} key - Preset key (e.g., 'avatar', 'banner')
 * @returns {Object} Preset configuration
 */
export const getPreset = (key) => {
  const presetKey = Object.keys(CROP_PRESETS).find(
    (k) => CROP_PRESETS[k].key === key
  );
  return presetKey ? CROP_PRESETS[presetKey] : CROP_PRESETS.AVATAR;
};

/**
 * Get aspect ratio as decimal
 * @param {Array} aspectRatio - [width, height] ratio
 * @returns {number} Decimal ratio (width/height)
 */
export const getAspectRatioDecimal = (aspectRatio) => {
  return aspectRatio[0] / aspectRatio[1];
};

/**
 * Calculate frame dimensions based on preset and screen width
 * @param {Object} preset - Crop preset
 * @param {number} screenWidth - Available screen width
 * @param {number} maxHeight - Maximum height constraint
 * @returns {Object} { frameWidth, frameHeight }
 */
export const calculateFrameDimensions = (preset, screenWidth, maxHeight) => {
  const padding = 40; // 20px on each side
  const maxWidth = screenWidth - padding;
  const ratio = getAspectRatioDecimal(preset.aspectRatio);

  let frameWidth = maxWidth;
  let frameHeight = frameWidth / ratio;

  // If height exceeds max, constrain by height instead
  if (frameHeight > maxHeight) {
    frameHeight = maxHeight;
    frameWidth = frameHeight * ratio;
  }

  return { frameWidth, frameHeight };
};

export default CROP_PRESETS;
