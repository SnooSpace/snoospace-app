const express = require('express');
const router = express.Router({ mergeParams: true });
const { authMiddleware } = require('../middleware/auth');
const { proofGate } = require('../middleware/proofGate');
const planRequestsController = require('../controllers/planRequestsController');

router.post('/', authMiddleware, proofGate, planRequestsController.sendRequest);
router.get('/', authMiddleware, planRequestsController.getRequests);
router.patch('/:reqId', authMiddleware, planRequestsController.updateRequest);
router.delete('/:reqId', authMiddleware, planRequestsController.withdrawRequest);

module.exports = router;
