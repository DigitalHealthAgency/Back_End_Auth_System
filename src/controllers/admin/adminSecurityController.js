// src/controllers/admin/adminSecurityController.js
const User = require('../../models/User');
const SecurityEvent = require('../../models/securityEvent');

/**
 * Get security statistics for admin dashboard
 * @route GET /api/admin/security/stats
 * @access DHA System Administrator only
 */
exports.getSecurityStats = async (req, res) => {
  try {
    // Get current timestamp
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get failed login attempts in last 24 hours
    const failedLogins24h = await SecurityEvent.countDocuments({
      action: { $regex: /Failed Login|Invalid Credentials/i },
      createdAt: { $gte: last24Hours }
    });

    // Get suspicious activities (multiple failed logins, unusual IPs, etc.)
    const suspiciousActivities = await SecurityEvent.countDocuments({
      action: { $in: ['Account Locked', 'Suspicious Activity Detected', 'IP Blocked', 'Multiple Failed Attempts'] },
      createdAt: { $gte: last24Hours }
    });

    // Get active sessions count (users with active sessions)
    const usersWithSessions = await User.countDocuments({
      'sessions.0': { $exists: true }
    });

    // Get 2FA compliance (users with 2FA enabled vs total users)
    const totalUsers = await User.countDocuments();
    const usersWithTwoFactor = await User.countDocuments({
      twoFactorEnabled: true
    });
    const twoFactorCompliance = totalUsers > 0
      ? Math.round((usersWithTwoFactor / totalUsers) * 100)
      : 0;

    // Get account lockouts count
    const accountLockouts = await User.countDocuments({
      lockedUntil: { $exists: true, $ne: null, $gt: now }
    });

    // Get recent security events
    const recentSecurityEvents = await SecurityEvent.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('action user ip createdAt details')
      .lean();

    // Get blocked IPs count
    const blockedIPs = await SecurityEvent.distinct('ip', {
      action: { $in: ['IP Blocked', 'IP Temporarily Blocked'] }
    });

    res.status(200).json({
      success: true,
      data: {
        failedLogins24h,
        suspiciousActivities,
        activeSessions: usersWithSessions,
        twoFactorCompliance,
        usersWithTwoFactor,
        totalUsers,
        blockedIPsCount: blockedIPs.length,
        accountLockouts,
        recentEvents: recentSecurityEvents,
        timestamp: now
      }
    });
  } catch (error) {
    console.error('[ADMIN SECURITY STATS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get security statistics',
      error: error.message
    });
  }
};

/**
 * Get audit logs with filtering
 * @route GET /api/admin/security/audit-logs
 * @access DHA System Administrator only
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      action,
      userId,
      startDate,
      endDate,
      severity
    } = req.query;

    // Build query
    const query = {};

    if (action) {
      query.action = action;
    }

    if (userId) {
      query.user = userId;
    }

    if (severity) {
      query.severity = severity;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      SecurityEvent.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'email firstName lastName organizationName type')
        .lean(),
      SecurityEvent.countDocuments(query)
    ]);

    // Format logs for display
    const formattedLogs = logs.map(log => ({
      id: log._id,
      action: log.action,
      user: log.user
        ? (log.user.type === 'individual'
            ? `${log.user.firstName} ${log.user.lastName}`
            : log.user.organizationName)
        : log.targetEmail || 'Unknown',
      email: log.user?.email || log.targetEmail || 'N/A',
      resource: log.details?.resource || log.ip || 'N/A',
      severity: log.severity || 'medium',
      timestamp: log.createdAt,
      details: log.details,
      ip: log.ip,
      device: log.device
    }));

    res.status(200).json({
      success: true,
      data: formattedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[ADMIN AUDIT LOGS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get audit logs',
      error: error.message
    });
  }
};

/**
 * Get failed login attempts
 * @route GET /api/admin/security/failed-logins
 * @access DHA System Administrator only
 */
exports.getFailedLogins = async (req, res) => {
  try {
    const { hours = 24, page = 1, limit = 20 } = req.query;

    const timeThreshold = new Date(Date.now() - hours * 60 * 60 * 1000);

    const query = {
      action: { $in: ['Failed Login', 'Authentication Failed', 'Multiple Failed Attempts'] },
      createdAt: { $gte: timeThreshold }
    };

    const skip = (page - 1) * limit;
    const [attempts, total] = await Promise.all([
      SecurityEvent.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'email firstName lastName organizationName type')
        .lean(),
      SecurityEvent.countDocuments(query)
    ]);

    // Format attempts for display
    const formattedAttempts = attempts.map(attempt => ({
      id: attempt._id,
      action: attempt.action,
      user: attempt.user
        ? (attempt.user.type === 'individual'
            ? `${attempt.user.firstName} ${attempt.user.lastName}`
            : attempt.user.organizationName)
        : attempt.targetEmail || 'Unknown',
      email: attempt.user?.email || attempt.targetEmail || 'N/A',
      ip: attempt.ip,
      device: attempt.device,
      severity: attempt.severity,
      timestamp: attempt.createdAt,
      details: attempt.details
    }));

    res.status(200).json({
      success: true,
      data: formattedAttempts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[ADMIN FAILED LOGINS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get failed login attempts',
      error: error.message
    });
  }
};
