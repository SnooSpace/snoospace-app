const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const blocksController = require('../controllers/blocksController');

// IMPORTANT: /me/blocks must come before /:userId/block to avoid route collision
router.get('/me/blocks', authMiddleware, blocksController.getBlocks);
router.post('/:userId/block', authMiddleware, blocksController.blockUser);
router.delete('/:userId/block', authMiddleware, blocksController.unblockUser);

module.exports = router;
