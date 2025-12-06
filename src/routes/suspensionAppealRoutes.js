// ✅ DHA SUSPENSION APPEAL ROUTES
// FR-USER-LIFECYCLE-002: Suspension appeal workflow routes

const express = require('express');
const router = express.Router();
const suspensionAppealController = require('../controllers/suspensionAppealController');
const protect = require('../middleware/authMiddleware');
const { requireRole, auditLog } = require('../middleware/rbac');

/**
 * ========================================
 * APPEAL SUBMISSION ROUTES (User)
 * ========================================
 */

// Submit a suspension appeal
router.post(
  '/submit',
  protect,
  auditLog('SUBMIT_SUSPENSION_APPEAL'),
  suspensionAppealController.submitAppeal
);

// Get user's own appeals
router.get(
  '/my-appeals',
  protect,
  suspensionAppealController.getMyAppeals
);

// Withdraw appeal
router.post(
  '/:appealId/withdraw',
  protect,
  auditLog('WITHDRAW_APPEAL'),
  suspensionAppealController.withdrawAppeal
);

/**
 * ========================================
 * APPEAL VIEWING ROUTES
 * ========================================
 */

// Get appeal details (user can view own, admin can view all)
router.get(
  '/:appealId',
  protect,
  suspensionAppealController.getAppealDetails
);

// Add communication to appeal
router.post(
  '/:appealId/communicate',
  protect,
  suspensionAppealController.addCommunication
);

/**
 * ========================================
 * APPEAL MANAGEMENT ROUTES (Admin only)
 * ========================================
 */

// Get all pending appeals
router.get(
  '/pending',
  protect,
  requireRole('dha_system_administrator'),
  suspensionAppealController.getPendingAppeals
);

// Get appeal statistics
router.get(
  '/statistics',
  protect,
  requireRole('dha_system_administrator'),
  suspensionAppealController.getAppealStatistics
);

// Start reviewing an appeal
router.post(
  '/:appealId/review/start',
  protect,
  requireRole('dha_system_administrator'),
  auditLog('START_APPEAL_REVIEW'),
  suspensionAppealController.startReview
);

// Approve appeal
router.post(
  '/:appealId/approve',
  protect,
  requireRole('dha_system_administrator'),
  auditLog('APPROVE_APPEAL'),
  suspensionAppealController.approveAppeal
);

// Reject appeal
router.post(
  '/:appealId/reject',
  protect,
  requireRole('dha_system_administrator'),
  auditLog('REJECT_APPEAL'),
  suspensionAppealController.rejectAppeal
);

// Add internal note
router.post(
  '/:appealId/notes',
  protect,
  requireRole('dha_system_administrator'),
  suspensionAppealController.addInternalNote
);

module.exports = router;
