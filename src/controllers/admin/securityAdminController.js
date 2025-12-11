// src/controllers/admin/securityAdminController.js
const User = require('../../models/User');
const SecurityEvent = require('../../models/securityEvent');
const ActivityLog = require('../../models/ActivityLog');
// Note: Sessions are stored in User.sessions array, not a separate model

/**
 * Get security statistics dashboard
 * Admin only - comprehensive security metrics
 */
exports.getSecurityStats = async (req, res) => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

    // Failed logins in last 24 hours
    const failedLogins = await SecurityEvent.countDocuments({
      action: { $regex: /Failed Login|Authentication Failed/i },
      createdAt: { $gte: twentyFourHoursAgo }
    });

    // Active sessions count - count users with active sessions
    const activeSessions = await User.countDocuments({
      'sessions.0': { $exists: true }
    });

    // Blocked IPs count
    const blockedIPsList = await SecurityEvent.distinct('ip', {
      action: { $in: ['IP Blocked', 'IP Temporarily Blocked'] }
    });
    const blockedIPs = blockedIPsList.length;

    // 2FA compliance - ALL users, not just active
    const totalUsers = await User.countDocuments();
    const usersWithTwoFactor = await User.countDocuments({
      twoFactorEnabled: true
    });
    const twoFactorCompliance = totalUsers > 0
      ? Math.round((usersWithTwoFactor / totalUsers) * 100)
      : 0;

    // Account lockouts - users currently locked
    const accountLockouts = await User.countDocuments({
      lockedUntil: { $exists: true, $ne: null, $gt: now }
    });

    // Suspicious activities
    const suspiciousActivities = await SecurityEvent.countDocuments({
      action: { $in: ['Suspicious Activity Detected', 'Multiple Failed Attempts', 'Account Locked', 'IP Blocked'] },
      createdAt: { $gte: twentyFourHoursAgo }
    });

    res.status(200).json({
      success: true,
      data: {
        failedLogins24h: failedLogins,
        activeSessions,
        blockedIPsCount: blockedIPs,
        twoFactorCompliance,
        usersWithTwoFactor,
        totalUsers,
        accountLockouts,
        suspiciousActivities,
        timestamp: now
      }
    });
  } catch (error) {
    console.error('Error fetching security stats:', error);
    res.status(500).json({ message: 'Failed to fetch security statistics' });
  }
};

/**
 * Get failed login attempts
 * Admin only - view all failed login attempts
 */
exports.getFailedLogins = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = {
      action: { $in: ['Failed Login', 'Authentication Failed', 'Multiple Failed Attempts'] }
    };

    if (search) {
      query.$or = [
        { targetEmail: { $regex: search, $options: 'i' } },
        { ip: { $regex: search, $options: 'i' } }
      ];
    }

    const failedLogins = await SecurityEvent.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'email firstName lastName organizationName type')
      .lean();

    const total = await SecurityEvent.countDocuments(query);

    const formattedData = failedLogins.map(log => ({
      id: log._id.toString(),
      email: log.user?.email || log.targetEmail || 'Unknown',
      user: log.user
        ? (log.user.type === 'individual'
            ? `${log.user.firstName} ${log.user.lastName}`
            : log.user.organizationName)
        : log.targetEmail || 'Unknown',
      ipAddress: log.ip || 'Unknown',
      device: log.device || 'Unknown',
      timestamp: log.createdAt,
      action: log.action,
      details: log.details
    }));

    res.status(200).json({
      data: formattedData,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching failed logins:', error);
    res.status(500).json({ message: 'Failed to fetch failed login attempts' });
  }
};

/**
 * Get all active sessions
 * Admin only - view all user sessions
 */
exports.getAllActiveSessions = async (req, res) => {
  try {
    const search = req.query.search || '';
    const now = new Date();

    // Get all users with sessions
    const users = await User.find({
      sessions: { $exists: true, $ne: [] }
    })
      .select('firstName lastName email organizationName type sessions')
      .lean();

    let formattedSessions = [];

    // Flatten all sessions from all users
    users.forEach(user => {
      if (user.sessions && user.sessions.length > 0) {
        user.sessions.forEach(session => {
          const userName = user.type === 'individual'
            ? `${user.firstName} ${user.lastName}`
            : user.organizationName;

          // Determine session status based on creation time (sessions don't have lastActivity in User model)
          const sessionAge = (now - new Date(session.createdAt)) / (1000 * 60);
          let status = 'active';
          if (sessionAge > 30) status = 'idle';

          formattedSessions.push({
            id: session.sessionId,
            userId: user._id.toString(),
            user: userName,
            email: user.email,
            ipAddress: session.ip || 'Unknown',
            device: session.device || 'Unknown',
            location: session.location || 'Unknown',
            loginTime: session.createdAt,
            lastActivity: session.createdAt,
            status
          });
        });
      }
    });

    // Sort by login time (most recent first)
    formattedSessions.sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime));

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      formattedSessions = formattedSessions.filter(s =>
        s.user.toLowerCase().includes(searchLower) ||
        s.email.toLowerCase().includes(searchLower) ||
        s.ipAddress.includes(searchLower)
      );
    }

    res.status(200).json({
      data: formattedSessions,
      total: formattedSessions.length
    });
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    res.status(500).json({ message: 'Failed to fetch active sessions' });
  }
};

/**
 * Terminate a user session
 * Admin only - force terminate any user session
 */
exports.terminateSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Find user with this sessionId
    const user = await User.findOne({
      'sessions.sessionId': sessionId
    });

    if (!user) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Remove the session from user's sessions array
    user.sessions = user.sessions.filter(s => s.sessionId !== sessionId);
    await user.save();

    // Log the security event
    await SecurityEvent.create({
      user: user._id,
      action: 'session_terminated_by_admin',
      ip: req.ip,
      device: req.headers['user-agent'],
      adminId: req.user._id,
      reason: 'Admin terminated session',
      metadata: {
        sessionId,
        terminatedBy: req.user.email
      }
    });

    res.status(200).json({
      success: true,
      message: 'Session terminated successfully'
    });
  } catch (error) {
    console.error('Error terminating session:', error);
    res.status(500).json({ message: 'Failed to terminate session' });
  }
};

/**
 * Get blocked IPs
 * Admin only - view all blocked IP addresses
 */
exports.getBlockedIPs = async (req, res) => {
  try {
    const blockedEvents = await SecurityEvent.find({
      action: 'ip_blocked',
      'metadata.blocked': true
    })
      .sort({ createdAt: -1 })
      .lean();

    const formattedData = blockedEvents.map(event => ({
      id: event._id.toString(),
      ipAddress: event.metadata.ipAddress || event.ip,
      reason: event.metadata.reason || event.reason || 'Security violation',
      blockedAt: event.createdAt,
      blockedBy: event.metadata.blockedBy || 'System Auto-Block',
      expiresAt: event.metadata.expiresAt,
      permanent: !event.metadata.expiresAt
    }));

    res.status(200).json({
      data: formattedData,
      total: formattedData.length
    });
  } catch (error) {
    console.error('Error fetching blocked IPs:', error);
    res.status(500).json({ message: 'Failed to fetch blocked IPs' });
  }
};

/**
 * Unblock an IP address
 * Admin only - remove IP from blocklist
 */
exports.unblockIP = async (req, res) => {
  try {
    const { ipAddress } = req.params;

    // Update all blocking events for this IP
    await SecurityEvent.updateMany(
      {
        action: 'ip_blocked',
        $or: [
          { 'metadata.ipAddress': ipAddress },
          { ip: ipAddress }
        ]
      },
      {
        $set: { 'metadata.blocked': false }
      }
    );

    // Log the unblock event
    await SecurityEvent.create({
      action: 'ip_unblocked',
      ip: req.ip,
      device: req.headers['user-agent'],
      adminId: req.user._id,
      reason: 'Admin unblocked IP',
      metadata: {
        unblockedIP: ipAddress,
        unblockedBy: req.user.email
      }
    });

    res.status(200).json({
      success: true,
      message: `IP ${ipAddress} has been unblocked`
    });
  } catch (error) {
    console.error('Error unblocking IP:', error);
    res.status(500).json({ message: 'Failed to unblock IP address' });
  }
};

/**
 * Get whitelisted IPs
 * Admin only - view trusted IP addresses
 */
exports.getWhitelistedIPs = async (req, res) => {
  try {
    const whitelistEvents = await SecurityEvent.find({
      action: 'ip_whitelisted',
      'metadata.whitelisted': true
    })
      .sort({ createdAt: -1 })
      .populate('adminId', 'email firstName lastName')
      .lean();

    const formattedData = whitelistEvents.map(event => {
      const addedByName = event.adminId
        ? `${event.adminId.firstName} ${event.adminId.lastName}`
        : 'System Admin';

      return {
        id: event._id.toString(),
        ipAddress: event.metadata.ipAddress,
        description: event.metadata.description || 'No description',
        addedAt: event.createdAt,
        addedBy: addedByName
      };
    });

    res.status(200).json({
      data: formattedData,
      total: formattedData.length
    });
  } catch (error) {
    console.error('Error fetching whitelisted IPs:', error);
    res.status(500).json({ message: 'Failed to fetch whitelisted IPs' });
  }
};

/**
 * Add IP to whitelist
 * Admin only - whitelist a trusted IP
 */
exports.addWhitelistedIP = async (req, res) => {
  try {
    const { ipAddress, description } = req.body;

    if (!ipAddress) {
      return res.status(400).json({ message: 'IP address is required' });
    }

    // Check if already whitelisted
    const existing = await SecurityEvent.findOne({
      action: 'ip_whitelisted',
      'metadata.ipAddress': ipAddress,
      'metadata.whitelisted': true
    });

    if (existing) {
      return res.status(400).json({ message: 'IP address is already whitelisted' });
    }

    // Create whitelist event
    const whitelistEvent = await SecurityEvent.create({
      action: 'ip_whitelisted',
      ip: req.ip,
      device: req.headers['user-agent'],
      adminId: req.user._id,
      reason: 'Admin whitelisted IP',
      metadata: {
        ipAddress,
        description: description || 'Trusted IP',
        whitelisted: true
      }
    });

    res.status(201).json({
      success: true,
      message: `IP ${ipAddress} has been whitelisted`,
      data: {
        id: whitelistEvent._id.toString(),
        ipAddress,
        description: description || 'Trusted IP',
        addedAt: whitelistEvent.createdAt,
        addedBy: `${req.user.firstName} ${req.user.lastName}`
      }
    });
  } catch (error) {
    console.error('Error adding whitelisted IP:', error);
    res.status(500).json({ message: 'Failed to whitelist IP address' });
  }
};

/**
 * Remove IP from whitelist
 * Admin only - remove IP from trusted list
 */
exports.removeWhitelistedIP = async (req, res) => {
  try {
    const { id } = req.params;

    const whitelistEvent = await SecurityEvent.findById(id);
    if (!whitelistEvent) {
      return res.status(404).json({ message: 'Whitelisted IP not found' });
    }

    // Mark as not whitelisted
    whitelistEvent.metadata.whitelisted = false;
    await whitelistEvent.save();

    // Log removal
    await SecurityEvent.create({
      action: 'ip_whitelist_removed',
      ip: req.ip,
      device: req.headers['user-agent'],
      adminId: req.user._id,
      reason: 'Admin removed IP from whitelist',
      metadata: {
        removedIP: whitelistEvent.metadata.ipAddress,
        removedBy: req.user.email
      }
    });

    res.status(200).json({
      success: true,
      message: 'IP removed from whitelist'
    });
  } catch (error) {
    console.error('Error removing whitelisted IP:', error);
    res.status(500).json({ message: 'Failed to remove IP from whitelist' });
  }
};

/**
 * Export security logs
 * Admin only - export security data for compliance
 */
exports.exportSecurityLogs = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;

    const query = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (type) {
      const typeMap = {
        'failed_logins': 'Failed Login',
        'sessions': 'session_created',
        'blocked_ips': 'ip_blocked'
      };
      query.action = typeMap[type] || type;
    }

    const logs = await SecurityEvent.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'email firstName lastName')
      .populate('adminId', 'email')
      .lean();

    // Convert to CSV format
    const csvRows = [
      ['Timestamp', 'Action', 'User Email', 'IP Address', 'Device', 'Reason', 'Admin']
    ];

    logs.forEach(log => {
      const userEmail = log.user?.email || log.metadata?.email || 'Unknown';
      const adminEmail = log.adminId?.email || '';
      csvRows.push([
        log.createdAt.toISOString(),
        log.action,
        userEmail,
        log.ip || '',
        log.device || '',
        log.reason || '',
        adminEmail
      ]);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=security-logs-${Date.now()}.csv`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error exporting security logs:', error);
    res.status(500).json({ message: 'Failed to export security logs' });
  }
};

/**
 * Get suspicious activities with details
 * Admin only - view all suspicious activity events
 */
exports.getSuspiciousActivities = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const now = new Date();
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

    const query = {
      action: {
        $in: [
          'Suspicious Activity Detected',
          'Multiple Failed Attempts',
          'Account Locked',
          'IP Blocked',
          'Brute Force Detected',
          'Unusual Login Pattern',
          'Session Hijack Attempt'
        ]
      }
    };

    if (search) {
      query.$or = [
        { targetEmail: { $regex: search, $options: 'i' } },
        { ip: { $regex: search, $options: 'i' } }
      ];
    }

    const activities = await SecurityEvent.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'email firstName lastName organizationName type')
      .lean();

    const total = await SecurityEvent.countDocuments(query);
    const recent24h = await SecurityEvent.countDocuments({
      ...query,
      createdAt: { $gte: twentyFourHoursAgo }
    });

    const formattedData = activities.map(activity => ({
      id: activity._id.toString(),
      action: activity.action,
      user: activity.user
        ? (activity.user.type === 'individual'
            ? `${activity.user.firstName} ${activity.user.lastName}`
            : activity.user.organizationName)
        : activity.targetEmail || 'Unknown',
      email: activity.user?.email || activity.targetEmail || 'Unknown',
      ipAddress: activity.ip || 'Unknown',
      device: activity.device || 'Unknown',
      timestamp: activity.createdAt,
      severity: getSeverity(activity.action),
      details: activity.details || {}
    }));

    res.status(200).json({
      success: true,
      data: formattedData,
      stats: {
        total,
        recent24h
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching suspicious activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch suspicious activities'
    });
  }
};

/**
 * Get detailed audit log entry
 * Admin only - view single audit log with full details
 */
exports.getAuditLogDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const auditLog = await ActivityLog.findById(id)
      .populate('user', 'email firstName lastName organizationName type role')
      .lean();

    if (!auditLog) {
      return res.status(404).json({
        success: false,
        message: 'Audit log not found'
      });
    }

    const formattedData = {
      id: auditLog._id.toString(),
      timestamp: auditLog.createdAt,
      action: auditLog.action,
      description: auditLog.description,
      user: auditLog.user
        ? {
            id: auditLog.user._id,
            name: auditLog.user.type === 'individual'
              ? `${auditLog.user.firstName} ${auditLog.user.lastName}`
              : auditLog.user.organizationName,
            email: auditLog.user.email,
            role: auditLog.user.role
          }
        : null,
      ipAddress: auditLog.ip || 'Unknown',
      userAgent: auditLog.userAgent,
      details: auditLog.details || {},
      severity: getSeverityFromAction(auditLog.action)
    };

    res.status(200).json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error('Error fetching audit log details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit log details'
    });
  }
};

/**
 * Get audit logs with filtering and pagination
 * Admin only - view comprehensive audit trail
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const action = req.query.action || '';
    const severity = req.query.severity || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Build query
    const query = {};

    // Search across multiple fields
    if (search) {
      const users = await User.find({
        $or: [
          { email: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { organizationName: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = users.map(u => u._id);

      query.$or = [
        { user: { $in: userIds } },
        { action: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by action type
    if (action && action !== 'all') {
      query.action = action;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Fetch audit logs
    const auditLogs = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'email firstName lastName organizationName type')
      .lean();

    const total = await ActivityLog.countDocuments(query);

    // Map severity based on action type
    const getSeverity = (action) => {
      const criticalActions = [
        'ADMIN_DELETE_USER', 'ADMIN_SUSPEND_USER', 'ADMIN_TERMINATE_SESSIONS',
        'SUBSCRIPTION_CANCELLED_BY_ADMIN', 'ACCOUNT_TERMINATION_REQUEST',
        'Unauthorized Admin Access', 'Login Attempt on Suspended Account',
        'BULK_SECURITY_ACTION'
      ];
      const highActions = [
        'ADMIN_UPDATE_USER_ROLE', 'ADMIN_IMPERSONATE_USER', 'UPDATE_SYSTEM_SETTINGS',
        'ADMIN_FORCE_LOGOUT', 'IP_LIST_ADD', 'IP_LIST_UPDATE', 'IP_LIST_REMOVE',
        'PASSWORD_RESET_COMPLETED', 'ENABLE_2FA', 'DISABLE_2FA'
      ];
      const mediumActions = [
        'ADMIN_VIEW_USER_DETAILS', 'ADMIN_VIEW_USERS', 'PASSWORD_RESET_REQUEST',
        'UPDATE_PROFILE', 'PROFILE_UPDATE', 'Authentication Failed'
      ];

      if (criticalActions.includes(action)) return 'critical';
      if (highActions.includes(action)) return 'high';
      if (mediumActions.includes(action)) return 'medium';
      return 'low';
    };

    // Format response
    const formattedLogs = auditLogs.map(log => {
      const userName = log.user
        ? log.user.type === 'individual'
          ? `${log.user.firstName} ${log.user.lastName}`
          : log.user.organizationName
        : 'System';

      const userEmail = log.user?.email || 'system@dha.go.ke';

      // Determine status based on action
      let status = 'success';
      if (log.action.includes('Failed') || log.action.includes('Unauthorized')) {
        status = 'failure';
      } else if (log.action.includes('Attempt') || log.action.includes('Request')) {
        status = 'warning';
      }

      return {
        id: log._id.toString(),
        timestamp: log.createdAt,
        user: userName,
        userEmail: userEmail,
        action: log.action,
        resource: log.description || 'N/A',
        status: status,
        severity: getSeverity(log.action),
        ipAddress: log.ip || 'Unknown',
        details: log.details || {}
      };
    });

    // Filter by severity if specified (after mapping)
    let filteredLogs = formattedLogs;
    if (severity && severity !== 'all') {
      filteredLogs = formattedLogs.filter(log => log.severity === severity);
    }

    res.status(200).json({
      data: filteredLogs,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
};

// Helper functions
function getSeverity(action) {
  const criticalActions = [
    'IP Blocked',
    'Account Locked',
    'Brute Force Detected',
    'Unauthorized Access Attempt'
  ];
  const highActions = [
    'Multiple Failed Attempts',
    'Suspicious Activity Detected',
    'Session Hijack Attempt',
    'Unusual Login Pattern'
  ];
  const mediumActions = [
    'Failed Login',
    'Authentication Failed'
  ];

  if (criticalActions.some(c => action.includes(c))) return 'critical';
  if (highActions.some(h => action.includes(h))) return 'high';
  if (mediumActions.some(m => action.includes(m))) return 'medium';
  return 'low';
}

function getSeverityFromAction(action) {
  const criticalActions = [
    'ADMIN_DELETE_USER', 'ADMIN_SUSPEND_USER', 'ADMIN_TERMINATE_SESSIONS',
    'SUBSCRIPTION_CANCELLED_BY_ADMIN', 'ACCOUNT_TERMINATION_REQUEST',
    'Unauthorized Admin Access', 'Login Attempt on Suspended Account',
    'BULK_SECURITY_ACTION'
  ];
  const highActions = [
    'ADMIN_UPDATE_USER_ROLE', 'ADMIN_IMPERSONATE_USER', 'UPDATE_SYSTEM_SETTINGS',
    'ADMIN_FORCE_LOGOUT', 'IP_LIST_ADD', 'IP_LIST_UPDATE', 'IP_LIST_REMOVE',
    'PASSWORD_RESET_COMPLETED', 'ENABLE_2FA', 'DISABLE_2FA'
  ];
  const mediumActions = [
    'ADMIN_VIEW_USER_DETAILS', 'ADMIN_VIEW_USERS', 'PASSWORD_RESET_REQUEST',
    'UPDATE_PROFILE', 'PROFILE_UPDATE', 'Authentication Failed'
  ];

  if (criticalActions.includes(action)) return 'critical';
  if (highActions.includes(action)) return 'high';
  if (mediumActions.includes(action)) return 'medium';
  return 'low';
}
