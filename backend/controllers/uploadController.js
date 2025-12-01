const multer = require('multer');
const { cloudinary, uploadImage, deleteImage } = require('../config/cloudinary');

/**
 * Upload event banner image
 */
const uploadEventBanner = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'community') {
      return res.status(403).json({ error: 'Only communities can upload event banners' });
    }

    if (!req.body.image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Upload to Cloudinary
    const result = await uploadImage(req.body.image, {
      folder: 'snoospace/events/banners',
      transformation: [
        { width: 1200, height: 600, crop: 'limit' },
        { quality: 'auto:good' }
      ]
    });

    res.json({
      success: true,
      data: {
        url: result.url,
        public_id: result.public_id,
        width: result.width,
        height: result.height
      }
    });

  } catch (error) {
    console.error('Error uploading banner:', error);
    res.status(500).json({ error: 'Failed to upload banner image' });
  }
};

/**
 * Upload event gallery images
 */
const uploadEventGallery = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'community') {
      return res.status(403).json({ error: 'Only communities can upload event gallery images' });
    }

    if (!req.body.images || !Array.isArray(req.body.images)) {
      return res.status(400).json({ error: 'No images provided' });
    }

    if (req.body.images.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 images allowed' });
    }

    // Upload all images to Cloudinary
    const uploadPromises = req.body.images.map(image =>
      uploadImage(image, {
        folder: 'snoospace/events/gallery',
        transformation: [
          { width: 1000, height: 1000, crop: 'limit' },
          { quality: 'auto:good' }
        ]
      })
    );

    const results = await Promise.all(uploadPromises);

    res.json({
      success: true,
      data: results.map(r => ({
        url: r.url,
        public_id: r.public_id,
        width: r.width,
        height: r.height
      }))
    });

  } catch (error) {
    console.error('Error uploading gallery:', error);
    res.status(500).json({ error: 'Failed to upload gallery images' });
  }
};

/**
 * Upload performer/featured account photo
 */
const uploadPerformerPhoto = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'community') {
      return res.status(403).json({ error: 'Only communities can upload performer photos' });
    }

    if (!req.body.image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Upload to Cloudinary
    const result = await uploadImage(req.body.image, {
      folder: 'snoospace/events/performers',
      transformation: [
        { width: 500, height: 500, crop: 'fill', gravity: 'face' },
        { quality: 'auto:good' }
      ]
    });

    res.json({
      success: true,
      data: {
        url: result.url,
        public_id: result.public_id,
        width: result.width,
        height: result.height
      }
    });

  } catch (error) {
    console.error('Error uploading performer photo:', error);
    res.status(500).json({ error: 'Failed to upload performer photo' });
  }
};

/**
 * Delete image from Cloudinary
 */
const deleteUploadedImage = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { publicId } = req.params;

    if (!userId || userType !== 'community') {
      return res.status(403).json({ error: 'Only communities can delete images' });
    }

    if (!publicId) {
      return res.status(400).json({ error: 'No public ID provided' });
    }

    // Delete from Cloudinary
    const result = await deleteImage(publicId);

    res.json({
      success: true,
      message: 'Image deleted successfully',
      result
    });

  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
};

module.exports = {
  uploadEventBanner,
  uploadEventGallery,
  uploadPerformerPhoto,
  deleteUploadedImage
};
