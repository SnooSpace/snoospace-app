/**
 * imageUtils.js
 *
 * Shared Cloudinary image transform utilities for the SnooSpace feed.
 *
 * Design principles:
 * - Callers pass the LOGICAL (density-independent) display width in dp.
 *   This function multiplies by PixelRatio.get() to produce the correct
 *   physical pixel count for the current device — so it stays sharp on
 *   3x flagship screens without over-fetching on 2x devices.
 * - Only transforms actual Cloudinary delivery URLs (res.cloudinary.com).
 *   Every other URL (ui-avatars.com, via.placeholder.com, local require(),
 *   etc.) is returned untouched.
 * - Uses c_limit (never upscales), f_auto (WebP/AVIF where supported),
 *   q_auto:good (biases toward visual fidelity over file size).
 * - Idempotent: inserting the same transform twice is prevented.
 */
import { PixelRatio } from 'react-native';

/**
 * Returns a Cloudinary-resized image URL sized for the device's pixel ratio.
 *
 * @param {string} url    - Original image URL (any source).
 * @param {Object} opts
 * @param {number} opts.width    - LOGICAL display width in dp (not pre-multiplied).
 *                                 PixelRatio.get() is applied internally.
 * @param {string} [opts.quality='auto:good'] - Cloudinary q_ value.
 * @returns {string} Transformed URL, or the original URL if not transformable.
 */
export function getOptimizedImageUrl(url, { width, quality = 'auto:good' } = {}) {
  if (!url || typeof url !== 'string') return url;
  // Only transform genuine Cloudinary delivery URLs.
  if (!url.includes('res.cloudinary.com') && !url.includes('cloudinary.com')) {
    return url;
  }
  // Multiply logical width by device pixel ratio to get physical pixel count.
  const pixelWidth = Math.round(width * PixelRatio.get());
  const transform  = `w_${pixelWidth},c_limit,f_auto,q_${quality}`;

  if (url.includes('/image/upload/')) {
    // Guard: don't double-insert if this exact transform is already present.
    if (url.includes(`/image/upload/${transform}/`)) return url;
    return url.replace('/image/upload/', `/image/upload/${transform}/`);
  }
  // Fallback for non-standard /upload/ shapes (e.g. unsigned delivery type).
  if (url.includes('/upload/')) {
    if (url.includes(`/upload/${transform}/`)) return url;
    return url.replace('/upload/', `/upload/${transform}/`);
  }
  // Unexpected Cloudinary URL shape — return unmodified rather than corrupt it.
  return url;
}
