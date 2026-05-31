const express = require('express');
const router = express.Router({ mergeParams: true });
const { authMiddleware } = require('../middleware/auth');
const planEngagementController = require('../controllers/planEngagementController');

router.post('/likes', authMiddleware, planEngagementController.likePlan);
router.delete('/likes', authMiddleware, planEngagementController.unlikePlan);
router.post('/views', authMiddleware, planEngagementController.recordView);
router.get('/comments', authMiddleware, planEngagementController.getComments);
router.post('/comments', authMiddleware, planEngagementController.addComment);
router.delete('/comments/:cmtId', authMiddleware, planEngagementController.deleteComment);

module.exports = router;
