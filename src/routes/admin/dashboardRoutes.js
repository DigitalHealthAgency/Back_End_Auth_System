// src/routes/admin/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const {
  getDashboardMetrics,
  getFailedLoginDetails,
  getSessionDetails,
  getBlockedIPDetails,
  getUserActivity,
  getPermissionMatrix,
  getRoleDetails,
  assignRoleWithConfirmation
} = require('../../controllers/admin/dashboardController');
const auth = require('../../middleware/authMiddleware');
const { requireAdminRole } = require('../../middleware/rbac');

// All routes require authentication and admin role
router.use(auth);
router.use(requireAdminRole());

// Dashboard metrics
router.get('/metrics', getDashboardMetrics);

// Detailed views
router.get('/failed-logins/:id', getFailedLoginDetails);
router.get('/sessions/:sessionId', getSessionDetails);
router.get('/blocked-ips/:id', getBlockedIPDetails);

// User activity
router.get('/users/:userId/activity', getUserActivity);

// Permission matrix
router.get('/permissions/matrix', getPermissionMatrix);
router.get('/permissions/roles/:role', getRoleDetails);

// Role assignment with confirmation
router.post('/users/:userId/assign-role', assignRoleWithConfirmation);

module.exports = router;
