// Cloudinary config - add these to your .env file
const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export const uploadImage = async (imageUri, onProgress) => {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'image.jpg',
    });
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('cloud_name', CLOUD_NAME);

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
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
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
