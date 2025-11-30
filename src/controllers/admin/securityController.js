// controllers/securityController.js
const securityEventModel = require('../../models/securityEvent');

/**
 * Log a security-related event
 * @param {Object} eventData - Security event details
 * @param {String} eventData.userId - ID of user associated with event
 * @param {String} eventData.action - Security action type 
 * @param {String} [eventData.ip] - IP address from where action was taken
 * @param {String} [eventData.device] - Device information
 * @param {String} [eventData.adminId] - ID of admin who performed the action (if applicable)
 * @param {String} [eventData.reason] - Reason for the security action
 * @param {Object} [eventData.metadata] - Additional metadata
 * @returns {Promise} - Promise that resolves with the created security event
 */
exports.logsecurityEvent = async (eventData) => {
  try {
    const event = new securityEventModel({
      user: eventData.userId,
      action: eventData.action,
      ip: eventData.ip,
      device: eventData.device,
      adminId: eventData.adminId,
      reason: eventData.reason,
      metadata: eventData.metadata
    });

    return await event.save();
  } catch (error) {
    console.error('Error logging security event:', error);
    // Don't throw - we don't want logging failures to impact application flow
    return null;
  }
};

// Get security events for a specific user
exports.getUsersecurityEvents = async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const events = await securityEventModel.find({ user: userId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('adminId', 'name email');
      
    const total = await securityEventModel.countDocuments({ user: userId });
    
    res.status(200).json({
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching security events:', error);
    res.status(500).json({ message: 'Failed to fetch security events' });
  }
};