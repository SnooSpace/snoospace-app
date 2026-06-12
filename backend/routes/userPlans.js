const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const userPlansController = require('../controllers/userPlansController');
const planEngagementController = require('../controllers/planEngagementController');

router.get('/hosted', authMiddleware, userPlansController.getHostedPlans);
router.get('/attending', authMiddleware, userPlansController.getAttendingPlans);
router.get('/interested', authMiddleware, planEngagementController.getInterestedPlans);

module.exports = router;
