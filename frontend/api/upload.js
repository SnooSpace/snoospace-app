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
 * Enforces: images ≤ 50MB, videos ≤ 100MB and ≤ 60 seconds duration.
 * @param {string} uri - Local file URI from expo-image-picker
 * @param {'image'|'video'} type
 * @param {{ onProgress?: (progress: number) => void }} opts
 * @returns {Promise<{ url: string, public_id: string, resource_type: string, duration?: number, width?: number, height?: number }>}
 */
export async function uploadChatMedia(uri, type = 'image', { onProgress } = {}) {
  const resourceType = type === 'video' ? 'video' : 'image';
  const folder = 'snoospace/chat/media';
  const fileName = type === 'video' ? `chat-video-${Date.now()}.mp4` : `chat-image-${Date.now()}.jpg`;
  const mimeType = type === 'video' ? 'video/mp4' : 'image/jpeg';

  const formData = new FormData();
  formData.append('file', { uri, type: mimeType, name: fileName });
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('cloud_name', CLOUD_NAME);
  formData.append('folder', folder);
  // Ask Cloudinary to auto-compress videos and generate a poster thumbnail
  if (type === 'video') {
    formData.append('resource_type', 'video');
    formData.append('eager', 'so_0,w_480,h_480,c_limit,q_auto');
  }

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
        resolve({
          url:           result.secure_url,
          public_id:     result.public_id,
          resource_type: result.resource_type,
          duration:      result.duration || null,
          width:         result.width || null,
          height:        result.height || null,
          thumbnail_url: result.eager?.[0]?.secure_url || null,
        });
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.send(formData);
  });
}
