const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { proofGate } = require('../middleware/proofGate');
const plansController = require('../controllers/plansController');

router.post('/', authMiddleware, proofGate, plansController.createPlan);
router.get('/', authMiddleware, plansController.getPlans);
router.get('/:planId', authMiddleware, plansController.getPlanById);
router.patch('/:planId', authMiddleware, plansController.updatePlan);
router.delete('/:planId', authMiddleware, plansController.cancelPlan);
router.post('/:planId/close', authMiddleware, plansController.closePlan);

module.exports = router;
