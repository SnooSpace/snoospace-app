/**
 * Cloudinary Video Utilities
 *
 * Transforms raw Cloudinary video URLs into HLS streaming URLs
 * with optimizations for instant playback on mobile devices.
 * Supports server-side crop via crop_metadata from CropScreen.
 */

/**
 * Convert crop metadata from CropScreen into Cloudinary c_crop parameters.
 *
 * The CropScreen stores:
 *   - scale: additional zoom factor (1.0 = no extra zoom)
 *   - translateX, translateY: pan offset in display-pixel space
 *   - displayWidth, displayHeight: video size in the crop frame (px)
 *   - originalWidth, originalHeight: actual video pixel dimensions
 *
 * These are the same coordinates that `calculateCropRegion()` in CropUtils.js
 * converts for images — replicated here on the backend for videos.
 *
 * @param {Object} cropMeta - Crop metadata object from the frontend
 * @returns {Object|null} { x, y, w, h, aspectRatio } in original video pixels, or null
 */
const cropMetadataToCloudinary = (cropMeta) => {
  if (!cropMeta || cropMeta.mediaType !== "video") return null;

  // If user never modified the crop, no Cloudinary transform needed
  const hasUserCrop =
    cropMeta.hasUserCrop === true ||
    (cropMeta.scale != null && Math.abs(cropMeta.scale - 1) > 0.01) ||
    Math.abs(cropMeta.translateX || 0) > 0.5 ||
    Math.abs(cropMeta.translateY || 0) > 0.5;

  if (!hasUserCrop) return null;

  const {
    scale = 1,
    translateX = 0,
    translateY = 0,
    displayWidth,
    displayHeight,
    originalWidth: metaOrigWidth,
    originalHeight: metaOrigHeight,
    videoPixelWidth,
    videoPixelHeight,
  } = cropMeta;

  // videoPixelWidth/Height are the actual video file dimensions (e.g., 1080×2340).
  // originalWidth/Height from CropScreen are frame dimensions (not file pixels).
  // Fall back to originalWidth/Height for backward compatibility with old data.
  const originalWidth = videoPixelWidth || metaOrigWidth;
  const originalHeight = videoPixelHeight || metaOrigHeight;

  // Need all dimension fields to compute the crop region
  if (!displayWidth || !displayHeight || !originalWidth || !originalHeight) {
    return null;
  }

  // --- Replicate CropUtils.calculateCropRegion logic ---

  // displayScale: how much the original video was scaled to fill the crop frame
  // In CropView for videos: imageWidth = frameWidth, so displayWidth = frameWidth * initialScale
  // initialScale = calculateInitialScale({imageWidth: frameW, imageHeight: frameH, frameW, frameH}) = 1
  // So displayWidth ≈ frameWidth, displayHeight ≈ frameHeight
  const displayScale = displayWidth / originalWidth;

  // userZoom: additional zoom the user applied on top of the fill-scale
  // effectiveScale = displayScale * userZoom => userZoom = scale (since displayScale ≈ 1 for video)
  // But we need to be precise: effectiveScale = displayScale * scale
  const effectiveScale = displayScale * scale;

  // The actual displayed size at the time of interaction
  const actualDisplayedWidth = displayWidth * scale;
  const actualDisplayedHeight = displayHeight * scale;

  // Frame position in displayed coordinates
  // (frame is the visible area; displayWidth/Height is the frame size at scale=1)
  const frameWidth = displayWidth;
  const frameHeight = displayHeight;
  const frameLeftInDisplayed =
    (actualDisplayedWidth - frameWidth) / 2 - translateX;
  const frameTopInDisplayed =
    (actualDisplayedHeight - frameHeight) / 2 - translateY;

  // Convert from displayed coordinates to original video pixel coordinates
  const scaleToOriginalX = originalWidth / actualDisplayedWidth;
  const scaleToOriginalY = originalHeight / actualDisplayedHeight;

  let originX = frameLeftInDisplayed * scaleToOriginalX;
  let originY = frameTopInDisplayed * scaleToOriginalY;
  let cropWidth = frameWidth * scaleToOriginalX;
  let cropHeight = frameHeight * scaleToOriginalY;

  // Clamp to valid bounds
  originX = Math.max(0, Math.min(originX, originalWidth - 1));
  originY = Math.max(0, Math.min(originY, originalHeight - 1));
  cropWidth = Math.max(1, Math.min(cropWidth, originalWidth - originX));
  cropHeight = Math.max(1, Math.min(cropHeight, originalHeight - originY));

  // Round to integers (Cloudinary requires whole pixels)
  const x = Math.round(originX);
  const y = Math.round(originY);
  const w = Math.round(cropWidth);
  const h = Math.round(cropHeight);

  // Calculate the new aspect ratio from the cropped dimensions
  const aspectRatio = w / h;

  console.log("[CloudinaryVideo] cropMetadataToCloudinary:", {
    input: { scale, translateX, translateY, displayWidth, displayHeight, originalWidth, originalHeight },
    output: { x, y, w, h, aspectRatio: aspectRatio.toFixed(3) },
  });

  return { x, y, w, h, aspectRatio };
};

/**
 * Build the Cloudinary crop transformation string
 * @param {Object} crop - { x, y, w, h } from cropMetadataToCloudinary
 * @returns {string} e.g. "c_crop,x_50,y_100,w_800,h_1000"
 */
const buildCropTransform = (crop) => {
  if (!crop) return "";
  return `c_crop,x_${crop.x},y_${crop.y},w_${crop.w},h_${crop.h}`;
};

/**
 * Convert a raw Cloudinary video URL to an optimized HLS streaming URL
 *
 * @param {string} url - Raw Cloudinary video URL (e.g., .mp4, .mov)
 * @param {string} cropTransform - Optional Cloudinary crop transform string
 * @returns {string|null} - HLS manifest URL (.m3u8) or null if not a Cloudinary URL
 */
const toHlsUrl = (url, cropTransform = "") => {
  if (!url || typeof url !== "string") return null;
  if (!url.includes("cloudinary.com")) return null;

  // Insert streaming profile transformation
  // sp_auto: Auto-generates ABR ladder (240p → 1080p)
  // Crop is applied BEFORE the streaming profile so the ABR ladder
  // is generated from the already-cropped dimensions.
  const transforms = cropTransform
    ? `${cropTransform}/sp_auto`
    : "sp_auto";

  return url
    .replace("/upload/", `/upload/${transforms}/`)
    .replace(/\.(mp4|mov|webm|avi|mkv)$/i, ".m3u8");
};

/**
 * Convert a Cloudinary video URL to an optimized thumbnail URL
 * Gets the first frame of the video as a JPEG
 *
 * @param {string} url - Raw Cloudinary video URL
 * @param {Object} options - Thumbnail options
 * @param {number} options.width - Target width (default: 400)
 * @param {string} options.cropTransform - Optional crop transform string
 * @returns {string|null} - Thumbnail URL (.jpg) or null if not valid
 */
const toThumbnailUrl = (url, options = {}) => {
  if (!url || typeof url !== "string") return null;
  if (!url.includes("cloudinary.com")) return null;

  const { width = 400, cropTransform = "" } = options;

  // so_0: Start offset 0 (first frame)
  // f_jpg: Force JPEG format
  // q_auto: Auto quality
  // w_X: Width (height auto-calculated to maintain aspect ratio)
  // Crop is applied first, then thumbnail extraction
  const baseTransforms = `so_0,f_jpg,q_auto,w_${width}`;
  const transforms = cropTransform
    ? `${cropTransform}/${baseTransforms}`
    : baseTransforms;

  return url
    .replace("/upload/", `/upload/${transforms}/`)
    .replace(/\.(mp4|mov|webm|avi|mkv|m3u8)$/i, ".jpg");
};

/**
 * Generate all video metadata from a raw Cloudinary URL
 * Returns HLS URL, thumbnail, and preserves original URL as fallback.
 * If cropMetadata is provided, applies server-side crop to the URLs
 * so the delivered stream is already cropped — no client-side transforms needed.
 *
 * @param {string} rawUrl - Raw Cloudinary video URL
 * @param {number|null} aspectRatio - Known aspect ratio (width/height)
 * @param {Object|null} cropMetadata - Optional crop metadata from CropScreen
 * @returns {Object} Video metadata object
 */
const generateVideoMetadata = (rawUrl, aspectRatio = null, cropMetadata = null) => {
  if (!rawUrl || !rawUrl.includes("cloudinary.com")) {
    return {
      video_url: rawUrl,
      video_hls_url: null,
      video_thumbnail: null,
      video_aspect_ratio: aspectRatio,
    };
  }

  // Compute Cloudinary crop parameters from crop metadata
  const crop = cropMetadataToCloudinary(cropMetadata);
  const cropTransform = buildCropTransform(crop);

  // If crop was applied, use the cropped aspect ratio (Instagram-style:
  // the feed shows exactly what the user framed)
  const finalAspectRatio = crop ? crop.aspectRatio : aspectRatio;

  return {
    video_url: rawUrl, // Original URL (fallback)
    video_hls_url: toHlsUrl(rawUrl, cropTransform), // HLS with crop baked in
    video_thumbnail: toThumbnailUrl(rawUrl, { cropTransform }), // Thumbnail with crop
    video_aspect_ratio: finalAspectRatio, // Cropped aspect ratio
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
  cropMetadataToCloudinary,
  buildCropTransform,
};
