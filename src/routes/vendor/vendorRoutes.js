// src/routes/vendor/vendorRoutes.js
const express = require('express');
const router = express.Router();
const {
  getVendorStats,
  getVendorApplications,
  getVendorTeam,
  getVendorDocuments,
  getTestStatus,
  getVendorCertificates,
  createApplication,
  getPaymentHistory,
  getVendorNotifications
} = require('../../controllers/vendor/vendorController');
const auth = require('../../middleware/authMiddleware');

// All routes require authentication
router.use(auth);

// Vendor dashboard statistics
router.get('/stats', getVendorStats);

// Applications management
router.get('/applications', getVendorApplications);
router.post('/application', createApplication);

// Team management (organization only)
router.get('/team', getVendorTeam);

// Documents
router.get('/documents', getVendorDocuments);

// Testing
router.get('/test-status/:applicationId', getTestStatus);

// Certificates
router.get('/certificates', getVendorCertificates);

// Payments
router.get('/payments', getPaymentHistory);

// Notifications
router.get('/notifications', getVendorNotifications);

module.exports = router;
