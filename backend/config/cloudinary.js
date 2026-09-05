const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Upload image to Cloudinary
 * @param {string} filePath - Local file path or base64 string
 * @param {object} options - Upload options
 * @returns {Promise<object>} Upload result with URL and public_id
 */
async function uploadImage(filePath, options = {}) {
  try {
    const defaultOptions = {
      folder: 'snoospace/events',
      resource_type: 'auto',
      transformation: [
        { width: 1200, height: 800, crop: 'limit' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ],
      ...options
    };

    const result = await cloudinary.uploader.upload(filePath, defaultOptions);
    
    return {
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
}

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public_id
 * @param {object} [options] - Additional options passed to destroy
 * @returns {Promise<object>} Deletion result
 */
async function deleteImage(publicId, options = {}) {
  try {
    const result = await cloudinary.uploader.destroy(publicId, options);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete image from Cloudinary');
  }
}

/**
 * Delete video from Cloudinary
 * @param {string} publicId - Cloudinary public_id
 * @param {object} [options] - Additional options passed to destroy
 * @returns {Promise<object>} Deletion result
 */
async function deleteVideo(publicId, options = {}) {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'video',
      ...options,
    });
    return result;
  } catch (error) {
    console.error('Cloudinary delete video error:', error);
    throw new Error('Failed to delete video from Cloudinary');
  }
}

/**
 * Extract public_id from a Cloudinary URL or return string as-is if already a public_id
 * @param {string} urlOrId
 * @returns {string|null}
 */
function extractPublicId(urlOrId) {
  if (!urlOrId || typeof urlOrId !== 'string') return null;
  if (!urlOrId.includes('cloudinary.com')) {
    return urlOrId.trim();
  }
  const parts = urlOrId.split(/\/upload\//);
  if (parts.length < 2) return null;
  const afterUpload = parts[1];
  // Strip file extension
  const withoutExt = afterUpload.replace(/\.[^/.]+$/, '');
  // Strip transformations and version (e.g. v1234567890/ or c_fill,w_300/v1234567890/)
  const cleanPath = withoutExt.replace(/^(?:[a-zA-Z0-9_,-]+:[a-zA-Z0-9_,-]+\/)?(?:v\d+\/)?/, '');
  return cleanPath.trim() || null;
}

/**
 * Upload multiple images
 * @param {Array<string>} filePaths - Array of file paths
 * @param {object} options - Upload options
 * @returns {Promise<Array>} Array of upload results
 */
async function uploadMultipleImages(filePaths, options = {}) {
  try {
    const uploadPromises = filePaths.map(filePath => uploadImage(filePath, options));
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Multiple upload error:', error);
    throw new Error('Failed to upload multiple images');
  }
}

/**
 * Generate transformation URL
 * @param {string} publicId - Cloudinary public_id
 * @param {object} transformations - Transformation options
 * @returns {string} Transformed image URL
 */
function getTransformedUrl(publicId, transformations = {}) {
  return cloudinary.url(publicId, {
    secure: true,
    ...transformations
  });
}

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage,
  deleteVideo,
  extractPublicId,
  uploadMultipleImages,
  getTransformedUrl
};
