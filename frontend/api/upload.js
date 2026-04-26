// Cloudinary config
const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

/**
 * Upload event banner to Cloudinary (direct upload)
 * @param {string} imageUri - Local image URI
 * @returns {Promise<object>} Upload result with URL and public_id
 */
export async function uploadEventBanner(imageUri) {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'event-banner.jpg',
    });
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('cloud_name', CLOUD_NAME);
    formData.append('folder', 'snoospace/events/banners');

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error('Event banner upload error:', error);
    throw error;
  }
}

/**
 * Upload event gallery images to Cloudinary (direct upload)
 * @param {Array<string>} imageUris - Array of local image URIs
 * @returns {Promise<Array>} Array of upload results
 */
export async function uploadEventGallery(imageUris) {
  const uploadPromises = imageUris.map(async (uri) => {
    const formData = new FormData();
    formData.append('file', {
      uri: uri,
      type: 'image/jpeg',
      name: 'gallery-image.jpg',
    });
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('cloud_name', CLOUD_NAME);
    formData.append('folder', 'snoospace/events/gallery');

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  });

  return Promise.all(uploadPromises);
}

/**
 * Upload performer photo to Cloudinary (direct upload)
 * @param {string} imageUri - Local image URI
 * @returns {Promise<object>} Upload result with URL and public_id
 */
export async function uploadPerformerPhoto(imageUri) {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'performer-photo.jpg',
    });
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('cloud_name', CLOUD_NAME);
    formData.append('folder', 'snoospace/events/performers');

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error('Performer photo upload error:', error);
    throw error;
  }
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

/**
 * Upload chat media (image or video) to Cloudinary
 * @param {string} uri - Local file URI from expo-media-library
 * @param {'image'|'video'} type
 * @param {{ onProgress?: (progress: number) => void }} opts
 * @returns {Promise<{ url, public_id, resource_type, duration?, width?, height?, thumbnail_url? }>}
 */
export async function uploadChatMedia(uri, type = 'image', { onProgress } = {}) {
  const resourceType = type === 'video' ? 'video' : 'image';
  const folder = 'snoospace/chat/media';

  // ── MIME type detection ──────────────────────────────────────────────────────
  // Android MediaLibrary URIs are `content://...` with no extension, so we
  // cannot rely on file extension alone. We detect from the URI when possible
  // and fall back to a safe default for the given resource type.
  const rawExt = uri.split('?')[0].split('.').pop()?.toLowerCase();
  const videoMimeMap = { mp4: 'video/mp4', mov: 'video/quicktime', '3gp': 'video/3gpp', webm: 'video/webm', mkv: 'video/x-matroska' };
  const imageMimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };
  const mimeType = type === 'video'
    ? (videoMimeMap[rawExt] || 'video/mp4')   // safe fallback — mp4 is most common
    : (imageMimeMap[rawExt] || 'image/jpeg');

  const fileName = type === 'video'
    ? `chat-video-${Date.now()}.mp4`
    : `chat-image-${Date.now()}.${rawExt && imageMimeMap[rawExt] ? rawExt : 'jpg'}`;

  const formData = new FormData();
  formData.append('file', { uri, type: mimeType, name: fileName });
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);
  // NOTE: Do NOT append `eager` here unless your Cloudinary upload preset
  // explicitly has "eager transformations" enabled — unsigned presets reject it with 400.

  console.log('[uploadChatMedia] Starting upload:', { type, resourceType, mimeType, fileName, uri: uri.substring(0, 80) });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded / e.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const result = JSON.parse(xhr.responseText);
        console.log('[uploadChatMedia] Upload success:', { url: result.secure_url, duration: result.duration });
        resolve({
          url:           result.secure_url,
          public_id:     result.public_id,
          resource_type: result.resource_type,
          duration:      result.duration || null,
          width:         result.width || null,
          height:        result.height || null,
          thumbnail_url: null, // eager disabled; generate thumbnail on-demand via Cloudinary URL transforms
        });
      } else {
        // Surface Cloudinary's actual error message to help debugging
        let cloudinaryError = `Upload failed: ${xhr.status}`;
        try {
          const errBody = JSON.parse(xhr.responseText);
          cloudinaryError = `Upload failed: ${xhr.status} — ${errBody?.error?.message || xhr.responseText}`;
        } catch (_) {}
        console.error('[uploadChatMedia] Cloudinary error:', cloudinaryError);
        reject(new Error(cloudinaryError));
      }
    };

    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.send(formData);
  });
}
