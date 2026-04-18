/**
 * Cloudinary Video Utilities
 *
 * Transforms raw Cloudinary video URLs into HLS streaming URLs
 * with optimizations for instant playback on mobile devices.
 */

/**
 * Convert a raw Cloudinary video URL to an optimized HLS streaming URL
 *
 * @param {string} url - Raw Cloudinary video URL (e.g., .mp4, .mov)
 * @returns {string|null} - HLS manifest URL (.m3u8) or null if not a Cloudinary URL
 */
const toHlsUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  if (!url.includes("cloudinary.com")) return null;

  // Insert streaming profile transformation
  // sp_auto: Auto-generates ABR ladder (240p → 1080p)
  // f_auto: Optimal format per device (webm on Android, mp4 on iOS)
  // q_auto:eco: Balanced quality/size for mobile networks
  return url
    .replace("/upload/", "/upload/sp_auto/")
    .replace(/\.(mp4|mov|webm|avi|mkv)$/i, ".m3u8");
};

/**
 * Convert a Cloudinary video URL to an optimized thumbnail URL
 * Gets the first frame of the video as a JPEG
 *
 * @param {string} url - Raw Cloudinary video URL
 * @param {Object} options - Thumbnail options
 * @param {number} options.width - Target width (default: 400)
 * @param {number} options.quality - JPEG quality (default: auto)
 * @returns {string|null} - Thumbnail URL (.jpg) or null if not valid
 */
const toThumbnailUrl = (url, options = {}) => {
  if (!url || typeof url !== "string") return null;
  if (!url.includes("cloudinary.com")) return null;

  const { width = 400 } = options;

  // so_0: Start offset 0 (first frame)
  // f_jpg: Force JPEG format
  // q_auto: Auto quality
  // w_X: Width (height auto-calculated to maintain aspect ratio)
  return url
    .replace("/upload/", `/upload/so_0,f_jpg,q_auto,w_${width}/`)
    .replace(/\.(mp4|mov|webm|avi|mkv|m3u8)$/i, ".jpg");
};

/**
 * Generate all video metadata from a raw Cloudinary URL
 * Returns HLS URL, thumbnail, and preserves original URL as fallback
 *
 * @param {string} rawUrl - Raw Cloudinary video URL
 * @param {number|null} aspectRatio - Known aspect ratio (width/height)
 * @returns {Object} Video metadata object
 */
const generateVideoMetadata = (rawUrl, aspectRatio = null) => {
  if (!rawUrl || !rawUrl.includes("cloudinary.com")) {
    return {
      video_url: rawUrl,
      video_hls_url: null,
      video_thumbnail: null,
      video_aspect_ratio: aspectRatio,
    };
  }

  return {
    video_url: rawUrl, // Original URL (fallback)
    video_hls_url: toHlsUrl(rawUrl), // HLS streaming URL (preferred)
    video_thumbnail: toThumbnailUrl(rawUrl), // First frame thumbnail
    video_aspect_ratio: aspectRatio, // Pre-calculated aspect ratio
  };
};

/**
 * Extract video index from media_types array
 *
 * @param {Array} mediaTypes - Array of media types ('image' | 'video')
 * @returns {number} - Index of first video, or -1 if no video found
 */
const findVideoIndex = (mediaTypes) => {
  if (!Array.isArray(mediaTypes)) return -1;
  return mediaTypes.findIndex((type) => type === "video");
};

module.exports = {
  toHlsUrl,
  toThumbnailUrl,
  generateVideoMetadata,
  findVideoIndex,
};
