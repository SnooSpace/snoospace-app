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
 * @returns {Promise<{url: string, hls_url: string, thumbnail: string, aspect_ratio: number}>} - Video metadata
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

    // Generate HLS streaming URL with Cloudinary streaming profile
    // sp_auto: Auto-generates adaptive bitrate ladder (240p → 1080p)
    const hlsUrl = result.secure_url
      .replace("/upload/", "/upload/sp_auto/")
      .replace(/\.[^.]+$/, ".m3u8");

    // Generate optimized thumbnail URL (first frame)
    const thumbnailUrl = result.secure_url
      .replace("/upload/", "/upload/so_0,f_jpg,q_auto,w_400/")
      .replace(/\.[^.]+$/, ".jpg");

    // Calculate aspect ratio
    const aspectRatio =
      result.width && result.height ? result.width / result.height : 1;

    return {
      url: result.secure_url, // Original MP4 (fallback)
      hls_url: hlsUrl, // HLS streaming URL (preferred)
      thumbnail: thumbnailUrl, // Optimized first-frame thumbnail
      duration: result.duration,
      width: result.width,
      height: result.height,
      aspect_ratio: aspectRatio, // Pre-calculated for container sizing
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
