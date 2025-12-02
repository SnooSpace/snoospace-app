import { apiPost, apiGet } from './client';
import { getAuthToken } from './auth';

/**
 * Upload event banner to Cloudinary
 * @param {string} imageUri - Local image URI
 * @returns {Promise<object>} Upload result with URL and public_id
 */
export async function uploadEventBanner(imageUri) {
  const token = await getAuthToken();
  
  // Convert image to base64
  const base64 = await fetch(imageUri)
    .then(res => res.blob())
    .then(blob => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }));

  return apiPost('/upload/event-banner', { image: base64 }, 30000, token);
}

/**
 * Upload event gallery images to Cloudinary
 * @param {Array<string>} imageUris - Array of local image URIs
 * @returns {Promise<object>} Upload result with array of URLs and public_ids
 */
export async function uploadEventGallery(imageUris) {
  const token = await getAuthToken();
  
  // Convert all images to base64
  const base64Images = await Promise.all(
    imageUris.map(imageUri =>
      fetch(imageUri)
        .then(res => res.blob())
        .then(blob => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }))
    )
  );

  return apiPost('/upload/event-gallery', { images: base64Images }, 60000, token);
}

/**
 * Upload performer photo to Cloudinary
 * @param {string} imageUri - Local image URI
 * @returns {Promise<object>} Upload result with URL and public_id
 */
export async function uploadPerformerPhoto(imageUri) {
  const token = await getAuthToken();
  
  const base64 = await fetch(imageUri)
    .then(res => res.blob())
    .then(blob => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }));

  return apiPost('/upload/performer-photo', { image: base64 }, 30000, token);
}

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<object>} Deletion result
 */
export async function deleteCloudinaryImage(publicId) {
  const token = await getAuthToken();
  return apiPost(`/upload/${publicId}`, {}, 15000, token);
}
