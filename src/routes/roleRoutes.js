// src/routes/roleRoutes.js
// 🔧 ROLE MANAGEMENT ROUTES
// Routes for managing user roles - Admin only

const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const auth = require('../middleware/authMiddleware');
const { requireAdminRole, requireRole, auditLog } = require('../middleware/rbac');
const { ROLES } = require('../constants/roles');

// All role management routes require authentication
router.use(auth);

/**
 * @route   GET /api/roles
 * @desc    Get all available roles
 * @access  DHA System Administrator
 */
router.get(
  '/',
  requireAdminRole(),
  auditLog('View All Roles'),
  roleController.getAllRoles
);

/**
 * @route   GET /api/roles/statistics
 * @desc    Get role statistics (counts per role)
 * @access  DHA System Administrator
 */
router.get(
  '/statistics',
  requireAdminRole(),
  auditLog('View Role Statistics'),
  roleController.getRoleStatistics
);

/**
 * @route   GET /api/roles/user/:userId
 * @desc    Get a specific user's role information
 * @access  DHA System Administrator or Self
 */
router.get(
  '/user/:userId',
  auditLog('View User Role'),
  roleController.getUserRole
);

/**
 * @route   GET /api/roles/users/:role
 * @desc    Get all users with a specific role
 * @access  DHA System Administrator
 */
router.get(
  '/users/:role',
  requireAdminRole(),
  auditLog('View Users By Role'),
  roleController.getUsersByRole
);

/**
 * @route   PATCH /api/roles/assign/:userId
 * @desc    Assign a role to a user
 * @access  DHA System Administrator
 */
router.patch(
  '/assign/:userId',
  requireAdminRole(),
  auditLog('Assign User Role'),
  roleController.assignRole
);

/**
 * @route   POST /api/roles/bulk-assign
 * @desc    Bulk assign roles to multiple users
 * @access  DHA System Administrator
 */
router.post(
  '/bulk-assign',
  requireAdminRole(),
  auditLog('Bulk Assign Roles'),
  roleController.bulkAssignRoles
);

module.exports = router;
