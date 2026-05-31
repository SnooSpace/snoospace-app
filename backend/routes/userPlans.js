const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const userPlansController = require('../controllers/userPlansController');

router.get('/hosted', authMiddleware, userPlansController.getHostedPlans);
router.get('/attending', authMiddleware, userPlansController.getAttendingPlans);

module.exports = router;
