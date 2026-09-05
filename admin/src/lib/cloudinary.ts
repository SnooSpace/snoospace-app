/**
 * Cloudinary URL helpers for admin portal.
 */

const DEFAULT_CLOUD_NAME = "dulhurgt7";

/**
 * Converts a video storage path (Cloudinary public_id or full URL) into a playable video URL.
 * 
 * @param videoStoragePath - Cloudinary public_id or full HTTP(S) URL
 * @returns Playable video URL
 */
export function getVerificationVideoUrl(videoStoragePath: string | null | undefined): string {
  if (!videoStoragePath) return "";

  const trimmed = videoStoragePath.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || DEFAULT_CLOUD_NAME;
  // If the path already includes .mp4 or another extension, do not double-append
  const cleanPath = trimmed.replace(/\.(mp4|mov|webm)$/i, "");
  return `https://res.cloudinary.com/${cloudName}/video/upload/${cleanPath}.mp4`;
}

/**
 * Helper for image URLs. Passthrough identity function for now, allowing
 * future thumbnail transforms (e.g. w_400, f_auto) to be centralized here.
 * 
 * @param url - Remote image URL
 * @returns Processed image URL
 */
export function getCloudinaryImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  return url.trim();
}
