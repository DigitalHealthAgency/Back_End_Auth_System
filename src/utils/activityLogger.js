const ActivityLog = require('../models/ActivityLog');

const logActivity = async ({
  user = null,
  action,
  description,
  details = {},
  ip = null,
  userAgent = null
}) => {
  try {
    await ActivityLog.create({
      user,
      action,
      description,
      details,
      ip,
      userAgent
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

module.exports = logActivity;