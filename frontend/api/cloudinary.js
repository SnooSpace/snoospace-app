// Cloudinary config - add these to your .env file
const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export const uploadImage = async (imageUri, onProgress) => {
  try {
    const formData = new FormData();
    formData.append("file", {
      uri: imageUri,
      type: "image/jpeg",
      name: "image.jpg",
    });
    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("cloud_name", CLOUD_NAME);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
};

export const uploadMultipleImages = async (imageUris, onProgress) => {
  const uploadPromises = imageUris.map(async (uri, index) => {
    try {
      const url = await uploadImage(uri);
      if (onProgress) {
        onProgress(index, 100);
      }
      return url;
    } catch (error) {
      console.error(`Failed to upload image ${index}:`, error);
      throw error;
    }
  });

  return Promise.all(uploadPromises);
};

/**
 * Upload a video to Cloudinary
 * @param {string} videoUri - Local video URI
 * @param {function} onProgress - Optional progress callback
 * @returns {Promise<{url: string, thumbnail: string}>} - Video URL and thumbnail URL
 */
export const uploadVideo = async (videoUri, onProgress) => {
  try {
    const formData = new FormData();
    formData.append("file", {
      uri: videoUri,
      type: "video/mp4",
      name: "video.mp4",
    });
    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("cloud_name", CLOUD_NAME);
    formData.append("resource_type", "video");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
      {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Video upload failed: ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();

    // Generate thumbnail URL from video URL
    // Cloudinary auto-generates thumbnails: replace file extension with .jpg
    const thumbnailUrl = result.secure_url.replace(/\.[^.]+$/, ".jpg");

    return {
      url: result.secure_url,
      thumbnail: thumbnailUrl,
      duration: result.duration,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.error("Cloudinary video upload error:", error);
    throw error;
  }
};

/**
 * Upload multiple media files (images or videos)
 * @param {Array<{uri: string, type: 'image' | 'video'}>} mediaItems
 * @param {function} onProgress - Optional progress callback
 * @returns {Promise<Array<{url: string, type: string, thumbnail?: string}>>}
 */
export const uploadMultipleMedia = async (mediaItems, onProgress) => {
  const uploadPromises = mediaItems.map(async (item, index) => {
    try {
      if (item.type === "video") {
        const result = await uploadVideo(item.uri);
        if (onProgress) onProgress(index, 100);
        return { url: result.url, type: "video", thumbnail: result.thumbnail };
      } else {
        const url = await uploadImage(item.uri);
        if (onProgress) onProgress(index, 100);
        return { url, type: "image" };
      }
    } catch (error) {
      console.error(`Failed to upload media ${index}:`, error);
      throw error;
    }
  });

  return Promise.all(uploadPromises);
};
