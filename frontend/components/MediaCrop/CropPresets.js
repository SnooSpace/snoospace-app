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
    aspectRatio: [8, 5],
    minWidth: 400,
    minHeight: 250,
    recommendedWidth: 1280,
    recommendedHeight: 800,
    maxZoom: 5,
    showGrid: true,
    isCircular: false,
    safeZone: {
      left: 0.25,
      top: 0,
      right: 0.25,
      bottom: 0.25, // Avatar overlaps bottom centered area
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
  /**
   * Feed Post Landscape (Video/Photo 16:9)
   * Used for: Timeline posts (landscape orientation)
   * Note: For photos, we prefer 1.91:1 (FEED_LANDSCAPE_PHOTO), but this exists for video compatibility
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

  /**
   * Feed Post Landscape Photo (1.91:1)
   * Used for: Timeline photos (standard landscape link Preview ratio)
   */
  FEED_LANDSCAPE_PHOTO: {
    key: "feed_landscape_photo",
    label: "1.91:1",
    aspectRatio: [191, 100],
    minWidth: 600,
    minHeight: 315,
    recommendedWidth: 1080,
    recommendedHeight: 566,
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
    (k) => CROP_PRESETS[k].key === key,
  );
  return presetKey ? CROP_PRESETS[presetKey] : CROP_PRESETS.AVATAR;
};

/**
 * Create a custom preset for a video's natural aspect ratio.
 * This allows editing videos without forcing them into predefined aspect ratios.
 * @param {number} width - Video's natural width
 * @param {number} height - Video's natural height
 * @returns {Object} Custom preset configuration
 */
export const createNaturalVideoPreset = (width, height) => {
  const aspectRatio =
    width && height ? Math.round((width / height) * 1000) / 1000 : 16 / 9;

  return {
    key: "natural_video",
    label: "Original",
    aspectRatio: [width || 1920, height || 1080],
    minWidth: 320,
    minHeight: 320,
    recommendedWidth: width || 1920,
    recommendedHeight: height || 1080,
    maxZoom: 5,
    showGrid: true,
    isCircular: false,
    safeZone: null,
  };
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

/**
 * Get presets available for video cropping
 * @returns {Array} List of preset keys supported for video
 */
export const getVideoPresets = () => {
  return ["story", "feed_portrait", "feed_square", "feed_landscape"];
};

/**
 * Find the closest video preset based on a video's natural aspect ratio.
 * This ensures videos are displayed at their natural size without forced cropping.
 * @param {number} naturalWidth - Video's natural width
 * @param {number} naturalHeight - Video's natural height
 * @returns {string} Best matching preset key
 */
export const findClosestVideoPreset = (naturalWidth, naturalHeight) => {
  if (!naturalWidth || !naturalHeight) return "story"; // Default fallback

  const naturalRatio = naturalWidth / naturalHeight;

  // Define preset ratios
  const presetRatios = {
    story: 9 / 16, // 0.5625 (portrait 9:16)
    feed_portrait: 4 / 5, // 0.8 (portrait 4:5)
    feed_square: 1 / 1, // 1.0 (square)
    feed_landscape: 16 / 9, // 1.778 (landscape 16:9)
  };

  let closestPreset = "feed_square";
  let smallestDiff = Infinity;

  for (const [presetKey, ratio] of Object.entries(presetRatios)) {
    const diff = Math.abs(naturalRatio - ratio);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestPreset = presetKey;
    }
  }

  console.log("[CropPresets] findClosestVideoPreset:", {
    naturalWidth,
    naturalHeight,
    naturalRatio: naturalRatio.toFixed(3),
    closestPreset,
  });

  return closestPreset;
};

export default CROP_PRESETS;
