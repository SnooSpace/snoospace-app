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
    aspectRatio,         // [cappedWidth, cappedHeight] from the preset
    originalWidth: metaOrigWidth,
    originalHeight: metaOrigHeight,
    videoPixelWidth,
    videoPixelHeight,
  } = cropMeta;

  // videoPixelWidth/Height are the actual video file dimensions (e.g., 1080×2340).
  const originalWidth = videoPixelWidth || metaOrigWidth;
  const originalHeight = videoPixelHeight || metaOrigHeight;

  if (!displayWidth || !displayHeight || !originalWidth || !originalHeight) {
    console.warn("[CloudinaryVideo] Missing dimensions, skipping crop:", cropMeta);
    return null;
  }

  // --- Derive the actual crop FRAME dimensions ---
  //
  // In the new CropView:
  //   displayWidth  = CropView frameWidth  (e.g. 335px)
  //   displayHeight = full natural video height at frameWidth scale
  //                   (e.g. 782px for a 9:21 video in a 9:16 frame — much taller than frameHeight)
  //
  // The visible crop window is defined by the PRESET's aspect ratio, NOT displayHeight.
  // We derive frameHeight from displayWidth + stored aspectRatio.
  let frameWidth = displayWidth;
  let frameHeight;

  if (Array.isArray(aspectRatio) && aspectRatio[0] > 0 && aspectRatio[1] > 0) {
    // Use the preset's aspect ratio to compute the exact visible window height
    frameHeight = Math.round(frameWidth * (aspectRatio[1] / aspectRatio[0]));
  } else if (typeof aspectRatio === "number" && aspectRatio > 0) {
    frameHeight = Math.round(frameWidth / aspectRatio);
  } else {
    // Fallback: assume frameHeight = displayHeight (old behaviour, no pan room)
    frameHeight = displayHeight;
  }

  // --- Map CropView coordinates to source video pixel coordinates ---
  //
  // At scale=1 (no user zoom), the VideoView is sized to displayWidth × displayHeight.
  // The crop frame shows a window of frameWidth × frameHeight centered in that view.
  // When the user pans (translateX, translateY), the window shifts relative to the video.
  //
  // Pan semantics: positive translateY = video moves DOWN = we see the TOP of the video.
  //   Centre of visible window in display-space: (displayWidth/2 - translateX, displayHeight/2 - translateY)
  //
  // With user zoom (scale > 1), the video is also scaled, so all display coords scale by `scale`.

  // Top-left of the visible frame in display-space at the given scale+pan:
  const frameLeftInDisplay = (displayWidth * scale - frameWidth) / 2 - translateX;
  const frameTopInDisplay  = (displayHeight * scale - frameHeight) / 2 - translateY;

  // Scale factor from display-space → source pixel space
  const pixelsPerDisplayX = originalWidth  / (displayWidth  * scale);
  const pixelsPerDisplayY = originalHeight / (displayHeight * scale);

  let originX   = frameLeftInDisplay  * pixelsPerDisplayX;
  let originY   = frameTopInDisplay   * pixelsPerDisplayY;
  let cropWidth  = frameWidth          * pixelsPerDisplayX;
  let cropHeight = frameHeight         * pixelsPerDisplayY;

  // Clamp to valid bounds
  originX    = Math.max(0, Math.min(originX,    originalWidth  - 1));
  originY    = Math.max(0, Math.min(originY,    originalHeight - 1));
  cropWidth  = Math.max(1, Math.min(cropWidth,  originalWidth  - originX));
  cropHeight = Math.max(1, Math.min(cropHeight, originalHeight - originY));

  const x = Math.round(originX);
  const y = Math.round(originY);
  const w = Math.round(cropWidth);
  const h = Math.round(cropHeight);

  const aspectRatioOut = w / h;

  console.log("[CloudinaryVideo] cropMetadataToCloudinary:", {
    input: { scale, translateX, translateY, displayWidth, displayHeight, frameWidth, frameHeight, originalWidth, originalHeight },
    output: { x, y, w, h, aspectRatio: aspectRatioOut.toFixed(3) },
  });

  return { x, y, w, h, aspectRatio: aspectRatioOut };
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

  // so_auto: Cloudinary picks the most visually interesting frame
  // f_jpg: Force JPEG format
  // q_auto: Auto quality
  // w_X: Width (height auto-calculated to maintain aspect ratio)
  // Crop is applied first, then thumbnail extraction
  const baseTransforms = `so_auto,f_jpg,q_auto,w_${width}`;
  const transforms = cropTransform
    ? `${cropTransform}/${baseTransforms}`
    : baseTransforms;

  return url
    .replace("/upload/", `/upload/${transforms}/`)
    .replace(/\.(mp4|mov|webm|avi|mkv|m3u8)$/i, ".jpg");
};

/**
 * Generate a Low-Quality Image Placeholder (LQIP) URL from a Cloudinary video URL.
 * Produces a tiny (~2KB), heavily blurred JPEG that loads in <50ms even on 3G.
 * Used as an instant "content is there" placeholder while the real thumbnail loads.
 *
 * @param {string} url - Raw Cloudinary video URL
 * @param {string} cropTransform - Optional Cloudinary crop transform string
 * @returns {string|null} - LQIP URL (.jpg) or null if not valid
 */
const toLqipUrl = (url, cropTransform = "") => {
  if (!url || typeof url !== "string") return null;
  if (!url.includes("cloudinary.com")) return null;

  // w_40: 40px wide (tiny)
  // q_30: aggressive compression
  // e_blur:300: heavy Gaussian blur
  // so_auto: best frame (matches thumbnail)
  // f_jpg: force JPEG
  const baseTransforms = `so_auto,f_jpg,q_30,w_40,e_blur:300`;
  const transforms = cropTransform
    ? `${cropTransform}/${baseTransforms}`
    : baseTransforms;

  return url
    .replace("/upload/", `/upload/${transforms}/`)
    .replace(/\.(mp4|mov|webm|avi|mkv|m3u8)$/i, ".jpg");
};

/**
 * Generate all video metadata from a raw Cloudinary URL
 * Returns HLS URL, thumbnail, LQIP, and preserves original URL as fallback.
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
      video_lqip: null,
      video_aspect_ratio: aspectRatio,
    };
  }

  // Compute Cloudinary crop parameters from crop metadata
  const crop = cropMetadataToCloudinary(cropMetadata);
  const cropTransform = buildCropTransform(crop);

  console.log("[generateVideoMetadata] crop result:", {
    hasCropMeta: !!cropMetadata,
    hasUserCrop: cropMetadata?.hasUserCrop,
    scale: cropMetadata?.scale,
    translateX: cropMetadata?.translateX,
    translateY: cropMetadata?.translateY,
    cropApplied: !!crop,
    cropTransform: cropTransform || "(none)",
  });

  // If crop was applied, use the cropped aspect ratio
  const finalAspectRatio = crop ? crop.aspectRatio : aspectRatio;

  // IMPORTANT: Cloudinary free tier can extract frames (thumbnails) with
  // crop transforms, but CANNOT re-encode videos on-the-fly. So:
  //   - video_url = raw MP4 (always playable)
  //   - video_thumbnail = Cloudinary cropped JPEG (works!)
  //   - video_lqip = tiny blurred JPEG placeholder (~2KB, instant load)
  //   - video_crop_transform = crop metadata for client-side rendering
  // The frontend applies the crop visually via CSS transforms (scale + translate + overflow hidden).

  // HLS is gated behind an env flag — flip CLOUDINARY_HLS_ENABLED=true when
  // the Cloudinary plan supports sp_auto streaming profiles.
  const hlsEnabled = process.env.CLOUDINARY_HLS_ENABLED === 'true';

  const result = {
    video_url: rawUrl,                                      // ← raw MP4, always playable
    video_hls_url: hlsEnabled ? toHlsUrl(rawUrl, cropTransform) : null,
    video_thumbnail: toThumbnailUrl(rawUrl, { cropTransform }),
    video_lqip: toLqipUrl(rawUrl, cropTransform),
    video_aspect_ratio: finalAspectRatio,
    video_crop_transform: cropMetadata || null,             // ← passed to frontend for client-side crop
  };

  if (crop) {
    console.log("[generateVideoMetadata] CROP — client-side transform will be applied:", {
      scale: cropMetadata?.scale,
      translateX: cropMetadata?.translateX,
      translateY: cropMetadata?.translateY,
      thumb: result.video_thumbnail?.substring(0, 120) + "...",
      lqip: result.video_lqip?.substring(0, 120) + "...",
      finalAR: finalAspectRatio?.toFixed(3),
    });
  }

  return result;
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
  toLqipUrl,
  generateVideoMetadata,
  findVideoIndex,
  cropMetadataToCloudinary,
  buildCropTransform,
};
