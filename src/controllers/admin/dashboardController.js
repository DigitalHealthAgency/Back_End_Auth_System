// src/controllers/admin/dashboardController.js
const User = require('../../models/User');
const SecurityEvent = require('../../models/securityEvent');
const ActivityLog = require('../../models/ActivityLog');
const { ROLES, ROLE_DISPLAY_NAMES, PERMISSIONS, ROLE_PERMISSIONS } = require('../../constants/roles');

/**
 * Get comprehensive dashboard metrics
 * Main dashboard view for System Administrator
 */
exports.getDashboardMetrics = async (req, res) => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

    // Total number of users (ALL users in system)
    const totalUsers = await User.countDocuments();

    // Active sessions - users with active sessions
    const activeSessions = await User.countDocuments({
      'sessions.0': { $exists: true }
    });

    // Count all sessions across all users
    const usersWithSessions = await User.find({
      sessions: { $exists: true, $ne: [] }
    }).select('sessions');

    const totalActiveSessions = usersWithSessions.reduce((count, user) => {
      return count + (user.sessions ? user.sessions.length : 0);
    }, 0);

    // Security alerts in last 24 hours
    const securityAlerts = await SecurityEvent.countDocuments({
      action: {
        $in: [
          'Suspicious Activity Detected',
          'Multiple Failed Attempts',
          'Account Locked',
          'IP Blocked',
          'Unauthorized Access Attempt'
        ]
      },
      createdAt: { $gte: twentyFourHoursAgo }
    });

    // Failed logins in last 24 hours
    const failedLogins = await SecurityEvent.countDocuments({
      action: { $regex: /Failed Login|Authentication Failed/i },
      createdAt: { $gte: twentyFourHoursAgo }
    });

    // Blocked IPs count
    const blockedIPsList = await SecurityEvent.distinct('ip', {
      action: { $in: ['IP Blocked', 'IP Temporarily Blocked'] }
    });
    const blockedIPs = blockedIPsList.length;

    // 2FA compliance
    const usersWithTwoFactor = await User.countDocuments({
      twoFactorEnabled: true
    });
    const twoFactorCompliance = totalUsers > 0
      ? Math.round((usersWithTwoFactor / totalUsers) * 100)
      : 0;

    // Account lockouts - currently locked accounts
    const accountLockouts = await User.countDocuments({
      lockedUntil: { $exists: true, $ne: null, $gt: now }
    });

    // User status breakdown
    const activeUsers = await User.countDocuments({
      accountStatus: 'active',
      suspended: false
    });
    const suspendedUsers = await User.countDocuments({ suspended: true });
    const pendingUsers = await User.countDocuments({ accountStatus: 'pending' });
    const inactiveUsers = totalUsers - activeUsers - suspendedUsers - pendingUsers;

    // Role distribution
    const roleDistribution = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    const roleStats = roleDistribution.map(item => ({
      role: item._id || 'unassigned',
      displayName: ROLE_DISPLAY_NAMES[item._id] || item._id || 'Unassigned',
      count: item.count
    }));

    // Recent security events (last 10)
    const recentSecurityEvents = await SecurityEvent.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'email firstName lastName organizationName type')
      .lean();

    const formattedEvents = recentSecurityEvents.map(event => ({
      id: event._id.toString(),
      action: event.action,
      user: event.user
        ? (event.user.type === 'individual'
            ? `${event.user.firstName} ${event.user.lastName}`
            : event.user.organizationName)
        : event.targetEmail || 'Unknown',
      email: event.user?.email || event.targetEmail || 'Unknown',
      ip: event.ip || 'Unknown',
      timestamp: event.createdAt,
      severity: getSeverityLevel(event.action)
    }));

    res.status(200).json({
      success: true,
      data: {
        // Main metrics
        totalUsers,
        activeSessions: totalActiveSessions,
        securityAlerts,

        // Detailed metrics
        failedLogins24h: failedLogins,
        blockedIPsCount: blockedIPs,
        twoFactorCompliance,
        usersWithTwoFactor,
        accountLockouts,

        // User breakdown
        userStats: {
          total: totalUsers,
          active: activeUsers,
          suspended: suspendedUsers,
          pending: pendingUsers,
          inactive: inactiveUsers
        },

        // Role distribution
        roleDistribution: roleStats,

        // Recent activity
        recentSecurityEvents: formattedEvents,

        timestamp: now
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get detailed failed login information
 */
exports.getFailedLoginDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const failedLogin = await SecurityEvent.findById(id)
      .populate('user', 'email firstName lastName organizationName type role accountStatus')
      .lean();

    if (!failedLogin) {
      return res.status(404).json({
        success: false,
        message: 'Failed login record not found'
      });
    }

    const formattedData = {
      id: failedLogin._id.toString(),
      timestamp: failedLogin.createdAt,
      action: failedLogin.action,
      user: failedLogin.user
        ? {
            id: failedLogin.user._id,
            name: failedLogin.user.type === 'individual'
              ? `${failedLogin.user.firstName} ${failedLogin.user.lastName}`
              : failedLogin.user.organizationName,
            email: failedLogin.user.email,
            role: failedLogin.user.role,
            status: failedLogin.user.accountStatus
          }
        : null,
      targetEmail: failedLogin.targetEmail,
      ipAddress: failedLogin.ip || 'Unknown',
      device: failedLogin.device || 'Unknown',
      userAgent: failedLogin.userAgent,
      location: failedLogin.location,
      reason: failedLogin.reason,
      details: failedLogin.details || {},
      metadata: failedLogin.metadata || {}
    };

    res.status(200).json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error('Error fetching failed login details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch failed login details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get detailed session information
 */
exports.getSessionDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Find user with this session
    const user = await User.findOne({
      'sessions.sessionId': sessionId
    })
      .select('firstName lastName email organizationName type role sessions')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Find the specific session
    const session = user.sessions.find(s => s.sessionId === sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const userName = user.type === 'individual'
      ? `${user.firstName} ${user.lastName}`
      : user.organizationName;

    const formattedData = {
      id: session.sessionId,
      user: {
        id: user._id,
        name: userName,
        email: user.email,
        role: user.role
      },
      ipAddress: session.ip || 'Unknown',
      device: session.device || 'Unknown',
      location: session.location || 'Unknown',
      userAgent: session.userAgent,
      loginTime: session.createdAt,
      lastActivity: session.lastActivity || session.createdAt,
      status: getSessionStatus(session)
    };

    res.status(200).json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error('Error fetching session details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get detailed blocked IP information
 */
exports.getBlockedIPDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const blockedEvent = await SecurityEvent.findById(id)
      .populate('user', 'email firstName lastName organizationName type')
      .populate('adminId', 'email firstName lastName')
      .lean();

    if (!blockedEvent) {
      return res.status(404).json({
        success: false,
        message: 'Blocked IP record not found'
      });
    }

    // Get all events from this IP
    const relatedEvents = await SecurityEvent.find({
      ip: blockedEvent.metadata?.ipAddress || blockedEvent.ip
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('user', 'email firstName lastName organizationName type')
      .lean();

    const formattedData = {
      id: blockedEvent._id.toString(),
      ipAddress: blockedEvent.metadata?.ipAddress || blockedEvent.ip,
      reason: blockedEvent.metadata?.reason || blockedEvent.reason || 'Security violation',
      blockedAt: blockedEvent.timestamp || blockedEvent.createdAt,
      blockedBy: blockedEvent.metadata?.blockedBy || 'System Auto-Block',
      expiresAt: blockedEvent.metadata?.expiresAt,
      permanent: !blockedEvent.metadata?.expiresAt,
      isActive: blockedEvent.metadata?.blocked !== false,
      relatedEvents: relatedEvents.map(event => ({
        id: event._id.toString(),
        action: event.action,
        timestamp: event.createdAt,
        user: event.user
          ? (event.user.type === 'individual'
              ? `${event.user.firstName} ${event.user.lastName}`
              : event.user.organizationName)
          : event.targetEmail || 'Unknown'
      }))
    };

    res.status(200).json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error('Error fetching blocked IP details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blocked IP details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user activity history
 */
exports.getUserActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const activities = await ActivityLog.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ActivityLog.countDocuments({ user: userId });

    const formattedActivities = activities.map(activity => ({
      id: activity._id.toString(),
      action: activity.action,
      description: activity.description,
      timestamp: activity.createdAt,
      ipAddress: activity.ip || 'Unknown',
      userAgent: activity.userAgent,
      details: activity.details || {}
    }));

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.type === 'individual'
            ? `${user.firstName} ${user.lastName}`
            : user.organizationName,
          email: user.email,
          role: user.role
        },
        activities: formattedActivities,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user activity',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get permission matrix
 * Shows all roles and their permissions
 */
exports.getPermissionMatrix = async (req, res) => {
  try {
    // Get all unique permissions
    const allPermissions = Object.values(PERMISSIONS);

    // Build matrix
    const matrix = Object.keys(ROLES).map(roleKey => {
      const role = ROLES[roleKey];
      const permissions = ROLE_PERMISSIONS[role] || [];

      // Create permission map
      const permissionMap = {};
      allPermissions.forEach(perm => {
        permissionMap[perm] = permissions.includes(perm);
      });

      return {
        role: role,
        displayName: ROLE_DISPLAY_NAMES[role],
        permissions: permissionMap,
        permissionCount: permissions.length
      };
    });

    res.status(200).json({
      success: true,
      data: {
        roles: matrix,
        allPermissions: allPermissions,
        permissionCategories: getPermissionCategories()
      }
    });
  } catch (error) {
    console.error('Error fetching permission matrix:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch permission matrix',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get role details with permissions
 */
exports.getRoleDetails = async (req, res) => {
  try {
    const { role } = req.params;

    if (!ROLES[role.toUpperCase().replace(/-/g, '_')]) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    const roleValue = role;
    const permissions = ROLE_PERMISSIONS[roleValue] || [];
    const userCount = await User.countDocuments({ role: roleValue });

    res.status(200).json({
      success: true,
      data: {
        role: roleValue,
        displayName: ROLE_DISPLAY_NAMES[roleValue],
        permissions: permissions,
        permissionCount: permissions.length,
        userCount: userCount,
        description: getRoleDescription(roleValue)
      }
    });
  } catch (error) {
    console.error('Error fetching role details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch role details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Assign role with confirmation and reason
 */
exports.assignRoleWithConfirmation = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, reason } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role is required'
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Reason for role change is required'
      });
    }

    // Validate role exists
    const roleExists = Object.values(ROLES).includes(role);
    if (!roleExists) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const previousRole = user.role;

    // Update role
    user.role = role;
    user.lastUpdated = new Date();
    await user.save();

    // Log role assignment with reason
    await ActivityLog.create({
      user: req.user?._id,
      action: 'ADMIN_UPDATE_USER_ROLE',
      description: `Updated user role from ${previousRole || 'none'} to ${role}: ${user.email}. Reason: ${reason}`,
      details: {
        targetUserId: userId,
        targetUserEmail: user.email,
        previousRole: previousRole || 'none',
        newRole: role,
        reason: reason,
        adminEmail: req.user?.email
      },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    console.log(`[ROLE ASSIGNMENT] Admin ${req.user?.email} changed ${user.email} role from ${previousRole} to ${role}. Reason: ${reason}`);

    res.status(200).json({
      success: true,
      message: 'Role assigned successfully',
      data: {
        userId: user._id,
        email: user.email,
        previousRole: previousRole || 'none',
        newRole: role,
        reason: reason,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign role',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper functions

function getSeverityLevel(action) {
  const critical = [
    'IP Blocked',
    'Account Locked',
    'Unauthorized Access Attempt',
    'Brute Force Detected'
  ];
  const high = [
    'Multiple Failed Attempts',
    'Suspicious Activity Detected',
    'Session Hijack Attempt'
  ];
  const medium = [
    'Failed Login',
    'Authentication Failed',
    'Password Reset Request'
  ];

  if (critical.some(c => action.includes(c))) return 'critical';
  if (high.some(h => action.includes(h))) return 'high';
  if (medium.some(m => action.includes(m))) return 'medium';
  return 'low';
}

function getSessionStatus(session) {
  const now = new Date();
  const sessionAge = (now - new Date(session.createdAt)) / (1000 * 60);

  if (sessionAge > 120) return 'expired';
  if (sessionAge > 30) return 'idle';
  return 'active';
}

function getPermissionCategories() {
  return {
    'Application Management': [
      'create_application',
      'read_own_application',
      'read_all_applications',
      'update_own_application',
      'update_any_application',
      'delete_own_application',
      'delete_any_application',
      'submit_application'
    ],
    'Document Management': [
      'upload_technical_docs',
      'upload_compliance_docs',
      'upload_dpia',
      'upload_policies',
      'view_own_documents',
      'view_all_documents',
      'approve_documents',
      'reject_documents'
    ],
    'User Management': [
      'manage_all_users',
      'manage_team_members',
      'view_all_users',
      'assign_roles'
    ],
    'System Administration': [
      'configure_system',
      'view_audit_logs',
      'manage_integrations',
      'system_backups'
    ],
    'Testing Management': [
      'schedule_testing',
      'execute_tests',
      'view_assigned_tests',
      'view_all_tests',
      'submit_test_results',
      'modify_test_results'
    ],
    'Certification': [
      'review_applications',
      'vote_on_certification',
      'make_final_decision',
      'revoke_certification'
    ]
  };
}

function getRoleDescription(role) {
  const descriptions = {
    [ROLES.DHA_SYSTEM_ADMINISTRATOR]: 'Full system access including user management, system configuration, and audit logs. Cannot influence certification decisions.',
    [ROLES.DHA_CERTIFICATION_OFFICER]: 'Reviews applications, manages documents, schedules testing. Cannot make final certification decisions.',
    [ROLES.VENDOR_DEVELOPER]: 'Can create and manage applications, upload documents, and manage team members.',
    [ROLES.VENDOR_TECHNICAL_LEAD]: 'Responsible for technical documentation and testing coordination.',
    [ROLES.VENDOR_COMPLIANCE_OFFICER]: 'Manages compliance documentation and addresses non-conformances.',
    [ROLES.TESTING_LAB_STAFF]: 'Executes tests and submits test results for assigned applications.',
    [ROLES.CERTIFICATION_COMMITTEE_MEMBER]: 'Reviews evaluation summaries and makes final certification decisions.',
    [ROLES.COUNTY_HEALTH_OFFICER]: 'Can view public registry, verify certifications, and report incidents.',
    [ROLES.PUBLIC_USER]: 'Read-only access to public certification registry.'
  };

  return descriptions[role] || 'No description available';
}

module.exports = exports;
