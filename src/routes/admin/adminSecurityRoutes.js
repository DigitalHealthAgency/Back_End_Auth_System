// src/routes/admin/adminSecurityRoutes.js
const express = require('express');
const router = express.Router();
const {
  getSecurityStats,
  getAuditLogs,
  getFailedLogins
} = require('../../controllers/admin/adminSecurityController');
const auth = require('../../middleware/authMiddleware');
const { requireAdminRole } = require('../../middleware/rbac');

// All routes require authentication and admin role
router.use(auth);
router.use(requireAdminRole());

// Security monitoring routes
router.get('/stats', getSecurityStats);
router.get('/audit-logs', getAuditLogs);
router.get('/failed-logins', getFailedLogins);

module.exports = router;
