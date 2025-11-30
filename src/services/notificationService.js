const Notification = require('../models/Notification');

// Service to create a notification for a user
exports.sendNotification = async ({ userId, title, body, type = 'info' }) => {
  try {
    await Notification.create({
      user: userId,
      title,
      body,
      type
    });
  } catch (err) {
    console.error('Error sending notification:', err);
  }
};
