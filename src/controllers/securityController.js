const SecurityLog = require('../models/SecurityLog');
const { sendNotification } = require('../services/notificationService');

// Create a new log
exports.logSecurityEvent = async ({ userId, action, details = '', ip, device }) => {
  try {
    await SecurityLog.create({ user: userId, action, details, ip, device });
  } catch (err) {
    console.error('Failed to log security event:', err.message);
  }
};

// Fetch logs for a user
exports.getUserSecurityLogs = async (req, res) => {
  try {
    const logs = await SecurityLog.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ logs });
  } catch (err) {
    console.error('Error fetching logs:', err.message);
    res.status(500).json({ message: 'Failed to fetch logs' });
  }
};

// delete logs
exports.deleteUserSecurityLogs = async (req, res) => {
  try {
    await SecurityLog.deleteMany({ user: req.user._id });

   // Notify the user about the deletion
    await sendNotification({
      userId: req.user._id,
      title: 'Security Logs Deletion',
      body: 'All your security logs have been deleted.',
      type: 'info'
    });

    res.status(200).json({ message: 'Logs deleted successfully' });
  } catch (err) {
    console.error('Error deleting logs:', err.message);
    res.status(500).json({ message: 'Failed to delete logs' });
  }
};

// Delete log by ID
exports.deleteLogById = async (req, res) => {
  const { logId } = req.params;

  try {
    const log = await SecurityLog.findById(logId);
    if (!log) return res.status(404).json({ message: 'Log not found' });
    if (log.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized to delete this log' });
    }
    await log.remove();
    // Notify the user about the deletion
    await sendNotification({
      userId: req.user._id,
      title: 'Security Log Deletion',
      body: `Log with ID ${logId} has been deleted.`,
      type: 'info'
    });
    res.status(200).json({ message: 'Log deleted successfully' });
  }
  catch (err) {
    console.error('Error deleting log:', err.message);
    res.status(500).json({ message: 'Failed to delete log' });
  }
};

