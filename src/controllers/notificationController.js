const Notification = require('../models/Notification');

// Create a notification
exports.createNotification = async ({ userId, title, body, type = 'info' }) => {
  const notification = new Notification({
    user: userId,
    title,
    body,
    type
  });
  await notification.save();
};

// Get all notifications for a user
exports.getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
  const { id } = req.params;
  
  try {
    const notification = await Notification.findOne({ _id: id, user: req.user._id });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to mark as read' });
  }
};
