/**
 * Video Compressor Utility
 *
 * Wraps react-native-compressor to transcode videos on-device before upload.
 * Caps at 1080p width with CRF 28 (medium quality) — cuts raw file size
 * by ~60-70% with minimal visible quality loss.
 *
 * Used by: cloudinary.js (feed post uploads), upload.js (chat media uploads)
 */
import { Video } from 'react-native-compressor';

/**
 * Compress a video before uploading to Cloudinary.
 *
 * @param {string} uri - Local file URI from expo-media-library
 * @param {function} [onProgress] - Progress callback (0.0 → 1.0)
 * @returns {Promise<string>} Compressed video URI (local temp file)
 */
export async function compressVideo(uri, onProgress) {
  try {
    console.log('[videoCompressor] Starting compression:', uri.substring(0, 80));
    const startTime = Date.now();

    const compressedUri = await Video.compress(
      uri,
      {
        compressionMethod: 'auto',   // hardware encoder when available
        maxSize: 1080,               // cap at 1080p width
        // 'medium' ≈ CRF 28 — balanced quality/size for social video
        quality: 'medium',
      },
      (progress) => {
        onProgress?.(progress);
      },
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[videoCompressor] Compression complete in ${elapsed}s:`, compressedUri.substring(0, 80));

    return compressedUri;
  } catch (error) {
    // If compression fails (e.g., codec not supported), fall back to raw URI
    // so the upload still works — just larger.
    console.warn('[videoCompressor] Compression failed, using original:', error.message);
    return uri;
  }
}
