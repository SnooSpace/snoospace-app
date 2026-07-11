const multer = require("multer");
const uploadMiddleware = multer({ storage: multer.memoryStorage() });
const {
  cloudinary,
  uploadImage,
  deleteImage,
} = require("../config/cloudinary");
const path = require("path");
const fs = require("fs");

// Ensure the local resume upload directory exists
const RESUME_DIR = path.join(__dirname, "../uploads/resumes");
fs.mkdirSync(RESUME_DIR, { recursive: true });

/**
 * Upload resume (PDF) — stored locally in uploads/resumes/
 * Used by applicants during opportunity application.
 * Returns just the filename (no path) which proxyResume serves directly.
 */
const uploadResume = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(403).json({ error: "Authentication required" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    // Validate PDF type
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Only PDF files are accepted" });
    }

    // Validate file size server-side (10MB cap)
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: "Resume must be under 10MB." });
    }

    // Save to local disk — filename only stored in DB, not full path
    const filename = `resume_${userId}_${Date.now()}.pdf`;
    const filePath = path.join(RESUME_DIR, filename);

    await fs.promises.writeFile(filePath, req.file.buffer);

    return res.status(200).json({
      success: true,
      url: filename,                     // stored in opportunity_applications.resume_url
      filename: req.file.originalname,
      size_bytes: req.file.size,
    });
  } catch (err) {
    console.error("uploadResume error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};


/**
 * Upload event banner image
 */
const uploadEventBanner = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const communityId = req.body.communityId;

    if (!communityId) {
      return res.status(400).json({ error: 'communityId is required' });
    }

    if (!req.user?.id || req.user?.type !== 'community') {
      return res.status(403).json({ error: 'Only community accounts can upload event banners' });
    }

    if (!req.body.image) {
      return res.status(400).json({ error: "No image provided" });
    }

    // Upload to Cloudinary
    const result = await uploadImage(req.body.image, {
      folder: "snoospace/events/banners",
      transformation: [
        { width: 1200, height: 600, crop: "limit" },
        { quality: "auto:good" },
      ],
    });

    res.json({
      success: true,
      data: {
        url: result.url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
      },
    });
  } catch (error) {
    console.error("Error uploading banner:", error);
    res.status(500).json({ error: "Failed to upload banner image" });
  }
};

/**
 * Upload event gallery images
 */
const uploadEventGallery = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const communityId = req.body.communityId;

    if (!communityId) {
      return res.status(400).json({ error: 'communityId is required' });
    }

    if (!req.user?.id || req.user?.type !== 'community') {
      return res.status(403).json({ error: 'Only community accounts can upload event gallery images' });
    }

    if (!req.body.images || !Array.isArray(req.body.images)) {
      return res.status(400).json({ error: "No images provided" });
    }

    if (req.body.images.length > 20) {
      return res.status(400).json({ error: "Maximum 20 images allowed" });
    }

    // Upload all images to Cloudinary
    const uploadPromises = req.body.images.map((image) =>
      uploadImage(image, {
        folder: "snoospace/events/gallery",
        transformation: [
          { width: 1000, height: 1000, crop: "limit" },
          { quality: "auto:good" },
        ],
      }),
    );

    const results = await Promise.all(uploadPromises);

    res.json({
      success: true,
      data: results.map((r) => ({
        url: r.url,
        public_id: r.public_id,
        width: r.width,
        height: r.height,
      })),
    });
  } catch (error) {
    console.error("Error uploading gallery:", error);
    res.status(500).json({ error: "Failed to upload gallery images" });
  }
};

/**
 * Upload performer/featured account photo
 */
const uploadPerformerPhoto = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const communityId = req.body.communityId;

    if (!communityId) {
      return res.status(400).json({ error: 'communityId is required' });
    }

    if (!req.user?.id || req.user?.type !== 'community') {
      return res.status(403).json({ error: 'Only community accounts can upload performer photos' });
    }

    if (!req.body.image) {
      return res.status(400).json({ error: "No image provided" });
    }

    // Upload to Cloudinary
    const result = await uploadImage(req.body.image, {
      folder: "snoospace/events/performers",
      transformation: [
        { width: 500, height: 500, crop: "fill", gravity: "face" },
        { quality: "auto:good" },
      ],
    });

    res.json({
      success: true,
      data: {
        url: result.url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
      },
    });
  } catch (error) {
    console.error("Error uploading performer photo:", error);
    res.status(500).json({ error: "Failed to upload performer photo" });
  }
};

/**
 * Upload open-plan banner (any authenticated member)
 * POST /upload/plan-banner
 * Body: { image: "data:image/...;base64,..." }
 */
const uploadPlanBanner = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(403).json({ error: 'Authentication required' });
    }

    if (!req.body.image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const result = await uploadImage(req.body.image, {
      folder: 'snoospace/plans/banners',
      transformation: [
        { width: 1200, height: 600, crop: 'limit' },
        { quality: 'auto:good' },
      ],
    });

    res.json({
      success: true,
      data: {
        url: result.url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
      },
    });
  } catch (error) {
    console.error('Error uploading plan banner:', error);
    res.status(500).json({ error: 'Failed to upload banner image' });
  }
};


const deleteUploadedImage = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { publicId } = req.params;
    // communityId can be passed as query param ?communityId=X or in body
    const communityId = req.query.communityId || req.body?.communityId;

    if (!communityId) {
      return res.status(400).json({ error: 'communityId is required' });
    }

    if (!req.user?.id || req.user?.type !== 'community') {
      return res.status(403).json({ error: 'Only community accounts can delete images' });
    }

    if (!publicId) {
      return res.status(400).json({ error: "No public ID provided" });
    }

    // Delete from Cloudinary
    const result = await deleteImage(publicId);

    res.json({
      success: true,
      message: "Image deleted successfully",
      result,
    });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ error: "Failed to delete image" });
  }
};

/**
 * Upload college logo (Admin only)
 * POST /admin/upload/college-logo
 */
const uploadCollegeLogo = async (req, res) => {
  try {
    if (!req.body.image) {
      return res.status(400).json({ error: "No image provided" });
    }

    // Upload to Cloudinary
    const result = await uploadImage(req.body.image, {
      folder: "snoospace/colleges/logos",
      transformation: [
        { width: 400, height: 400, crop: "limit" },
        { quality: "auto:good" },
      ],
    });

    res.json({
      success: true,
      data: {
        url: result.url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
      },
    });
  } catch (error) {
    console.error("Error uploading college logo:", error);
    res.status(500).json({ error: "Failed to upload college logo" });
  }
};

module.exports = {
  uploadEventBanner,
  uploadEventGallery,
  uploadPerformerPhoto,
  uploadPlanBanner,
  deleteUploadedImage,
  uploadCollegeLogo,
  uploadResume,
  // resumeUploadMiddleware: used by routes/index.js — preserved for backward compat
  resumeUploadMiddleware: uploadMiddleware.single("file"),
};
