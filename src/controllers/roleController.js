// src/controllers/roleController.js
//  ROLE MANAGEMENT CONTROLLER
// Handles role assignment and management for DHA System Administrators

const User = require('../models/User');
const { ROLES, ROLE_DISPLAY_NAMES, getRoleDisplayName, getRolePortal, ROLE_PERMISSIONS } = require('../constants/roles');
const { logsecurityEvent } = require('./admin/securityController');

/**
 * Get all available roles
 * @route GET /api/roles
 * @access DHA System Administrator only
 */
exports.getAllRoles = async (req, res) => {
  try {
    const roles = Object.values(ROLES).map(role => ({
      code: role,
      displayName: getRoleDisplayName(role),
      portal: getRolePortal(role),
      permissions: ROLE_PERMISSIONS[role] || []
    }));

    res.status(200).json({
      success: true,
      data: roles,
      count: roles.length
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve roles',
      error: error.message
    });
  }
};

/**
 * Assign role to a user
 * @route PATCH /api/roles/assign/:userId
 * @access DHA System Administrator only
 */
exports.assignRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const adminUser = req.user;

    // Validate role
    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role',
        validRoles: Object.values(ROLES)
      });
    }

    // Find target user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Store old role for audit
    const oldRole = user.role;

    // Update role
    user.role = role;
    await user.save();

    // Log security event
    await logsecurityEvent({
      user: adminUser._id,
      action: 'Role Assignment',
      severity: 'medium',
      targetUser: user._id,
      details: {
        targetUserEmail: user.email || user.organizationEmail,
        oldRole,
        newRole: role,
        adminEmail: adminUser.email || adminUser.organizationEmail
      }
    });

    res.status(200).json({
      success: true,
      message: `Role updated successfully to ${getRoleDisplayName(role)}`,
      data: {
        userId: user._id,
        username: user.username || user.organizationName,
        oldRole,
        newRole: role,
        roleDisplayName: getRoleDisplayName(role),
        portal: getRolePortal(role)
      }
    });
  } catch (error) {
    console.error('Assign role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign role',
      error: error.message
    });
  }
};

/**
 * Get user's role information
 * @route GET /api/roles/user/:userId
 * @access DHA System Administrator or Self
 */
exports.getUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUser = req.user;

    // Allow users to view their own role, or admin to view any
    if (requestingUser._id.toString() !== userId && requestingUser.role !== ROLES.DHA_SYSTEM_ADMINISTRATOR) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const user = await User.findById(userId).select('role email username organizationName organizationEmail type');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        username: user.username || user.organizationName,
        email: user.email || user.organizationEmail,
        type: user.type,
        role: user.role,
        roleDisplayName: getRoleDisplayName(user.role),
        portal: getRolePortal(user.role),
        permissions: ROLE_PERMISSIONS[user.role] || []
      }
    });
  } catch (error) {
    console.error('Get user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user role',
      error: error.message
    });
  }
};

/**
 * Get all users by role
 * @route GET /api/roles/users/:role
 * @access DHA System Administrator only
 */
exports.getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;

    // Validate role
    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role',
        validRoles: Object.values(ROLES)
      });
    }

    const users = await User.find({ role })
      .select('username firstName lastName email organizationName organizationEmail type accountStatus createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: users,
      count: users.length,
      role: {
        code: role,
        displayName: getRoleDisplayName(role),
        portal: getRolePortal(role)
      }
    });
  } catch (error) {
    console.error('Get users by role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users by role',
      error: error.message
    });
  }
};

/**
 * Get role statistics
 * @route GET /api/roles/statistics
 * @access DHA System Administrator only
 */
exports.getRoleStatistics = async (req, res) => {
  try {
    const statistics = await Promise.all(
      Object.values(ROLES).map(async (role) => {
        const count = await User.countDocuments({ role });
        return {
          role,
          displayName: getRoleDisplayName(role),
          count
        };
      })
    );

    const totalUsers = await User.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        statistics,
        totalUsers,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Get role statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get role statistics',
      error: error.message
    });
  }
};

/**
 * Bulk assign roles
 * @route POST /api/roles/bulk-assign
 * @access DHA System Administrator only
 */
exports.bulkAssignRoles = async (req, res) => {
  try {
    const { assignments } = req.body; // Array of {userId, role}
    const adminUser = req.user;

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assignments array'
      });
    }

    const results = {
      successful: [],
      failed: []
    };

    for (const assignment of assignments) {
      try {
        const { userId, role } = assignment;

        // Validate role
        if (!Object.values(ROLES).includes(role)) {
          results.failed.push({
            userId,
            reason: 'Invalid role',
            role
          });
          continue;
        }

        // Find and update user
        const user = await User.findById(userId);

        if (!user) {
          results.failed.push({
            userId,
            reason: 'User not found'
          });
          continue;
        }

        const oldRole = user.role;
        user.role = role;
        await user.save();

        // Log security event
        await logsecurityEvent({
          user: adminUser._id,
          action: 'Bulk Role Assignment',
          severity: 'medium',
          targetUser: user._id,
          details: {
            targetUserEmail: user.email || user.organizationEmail,
            oldRole,
            newRole: role
          }
        });

        results.successful.push({
          userId: user._id,
          username: user.username || user.organizationName,
          oldRole,
          newRole: role
        });
      } catch (error) {
        results.failed.push({
          userId: assignment.userId,
          reason: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk assignment completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      data: results
    });
  } catch (error) {
    console.error('Bulk assign roles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk assign roles',
      error: error.message
    });
  }
};

module.exports = exports;
