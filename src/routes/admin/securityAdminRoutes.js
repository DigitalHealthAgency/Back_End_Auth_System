// src/routes/admin/securityAdminRoutes.js
const express = require('express');
const router = express.Router();
const {
  getSecurityStats,
  getFailedLogins,
  getAllActiveSessions,
  terminateSession,
  getBlockedIPs,
  unblockIP,
  getWhitelistedIPs,
  addWhitelistedIP,
  removeWhitelistedIP,
  exportSecurityLogs
} = require('../../controllers/admin/securityAdminController');
const auth = require('../../middleware/authMiddleware');
const { requireAdminRole } = require('../../middleware/rbac');

// All routes require authentication and admin role
router.use(auth);
router.use(requireAdminRole());

// Security statistics
router.get('/stats', getSecurityStats);

// Failed logins
router.get('/failed-logins', getFailedLogins);

// Active sessions
router.get('/sessions', getAllActiveSessions);
router.delete('/sessions/:sessionId', terminateSession);

// Blocked IPs
router.get('/blocked-ips', getBlockedIPs);
router.delete('/blocked-ips/:ipAddress', unblockIP);

// Whitelisted IPs
router.get('/whitelisted-ips', getWhitelistedIPs);
router.post('/whitelisted-ips', addWhitelistedIP);
router.delete('/whitelisted-ips/:id', removeWhitelistedIP);

// Export logs
router.get('/export', exportSecurityLogs);

module.exports = router;
