const express = require('express');
const router = express.Router();
const { getUserNotifications, markAsRead } = require('../controllers/notificationController');
const protect = require('../middleware/authMiddleware');

// Get all notifications
router.get('/', protect, getUserNotifications);

// Mark one notification as read
router.patch('/:id/read', protect, markAsRead);

module.exports = router;
