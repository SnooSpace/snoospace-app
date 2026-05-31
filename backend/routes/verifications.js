const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const verificationsController = require('../controllers/verificationsController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only mp4, mov, and webm video files are allowed'), false);
    }
  },
});

// IMPORTANT: /admin and /me must come before /:verId to avoid route collision
router.get('/me', authMiddleware, verificationsController.getMyVerification);
router.get('/admin', adminAuthMiddleware, verificationsController.adminGetAll);
router.patch('/admin/:verId', adminAuthMiddleware, verificationsController.adminReview);
router.post('/', authMiddleware, upload.single('video'), verificationsController.submitVerification);

module.exports = router;
