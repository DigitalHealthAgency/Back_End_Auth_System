// src/controllers/admin/securityAdminController.js
const User = require('../../models/User');
const SecurityEvent = require('../../models/securityEvent');
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
      action: 'login_failed',
      timestamp: { $gte: twentyFourHoursAgo }
    });

    // Active sessions count - aggregate from User.sessions arrays
    const usersWithSessions = await User.aggregate([
      { $unwind: '$sessions' },
      { $count: 'total' }
    ]);
    const activeSessions = usersWithSessions.length > 0 ? usersWithSessions[0].total : 0;

    // Blocked IPs count (from SecurityEvent with action: 'ip_blocked')
    const blockedIPs = await SecurityEvent.distinct('metadata.ipAddress', {
      action: 'ip_blocked',
      'metadata.blocked': true
    }).then(ips => ips.length);

    // 2FA compliance
    const totalUsers = await User.countDocuments({ accountStatus: 'active' });
    const usersWithTwoFactor = await User.countDocuments({
      accountStatus: 'active',
      twoFactorEnabled: true
    });
    const twoFactorCompliance = totalUsers > 0
      ? ((usersWithTwoFactor / totalUsers) * 100).toFixed(1)
      : 0;

    // Account lockouts
    const accountLockouts = await User.countDocuments({
      accountStatus: 'suspended',
      'metadata.reason': 'security_lockout'
    });

    // Suspicious activities
    const suspiciousActivities = await SecurityEvent.countDocuments({
      action: { $in: ['suspicious_activity', 'brute_force_detected', 'multiple_failed_attempts'] },
      timestamp: { $gte: twentyFourHoursAgo }
    });

    res.status(200).json({
      failedLogins24h: failedLogins,
      activeSessions,
      blockedIPs,
      twoFactorCompliance: parseFloat(twoFactorCompliance),
      accountLockouts,
      suspiciousActivities
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

    const query = { action: 'login_failed' };

    if (search) {
      query.$or = [
        { 'metadata.email': { $regex: search, $options: 'i' } },
        { ip: { $regex: search, $options: 'i' } }
      ];
    }

    const failedLogins = await SecurityEvent.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .select('timestamp ip device metadata.email metadata.reason metadata.location')
      .lean();

    const total = await SecurityEvent.countDocuments(query);

    const formattedData = failedLogins.map(log => ({
      id: log._id.toString(),
      email: log.metadata?.email || 'Unknown',
      ipAddress: log.ip || 'Unknown',
      timestamp: log.timestamp,
      reason: log.metadata?.reason || 'Unknown',
      location: log.metadata?.location
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
      .sort({ timestamp: -1 })
      .lean();

    const formattedData = blockedEvents.map(event => ({
      id: event._id.toString(),
      ipAddress: event.metadata.ipAddress || event.ip,
      reason: event.metadata.reason || event.reason || 'Security violation',
      blockedAt: event.timestamp,
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
      .sort({ timestamp: -1 })
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
        addedAt: event.timestamp,
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
        addedAt: whitelistEvent.timestamp,
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
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    if (type) {
      const typeMap = {
        'failed_logins': 'login_failed',
        'sessions': 'session_created',
        'blocked_ips': 'ip_blocked'
      };
      query.action = typeMap[type] || type;
    }

    const logs = await SecurityEvent.find(query)
      .sort({ timestamp: -1 })
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
        log.timestamp.toISOString(),
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
