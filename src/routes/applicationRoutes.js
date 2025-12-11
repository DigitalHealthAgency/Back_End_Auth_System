// src/routes/applicationRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const Application = require('../models/Application');
const Review = require('../models/Review');
const ConflictOfInterest = require('../models/ConflictOfInterest');

// Separation of Duties Middleware
const checkSOD = async (req, res, next) => {
  const application = await Application.findById(req.params.id);
  if (!application) {
    return res.status(404).json({ message: 'Application not found' });
  }

  const user = req.user;
  const action = req.route.path.split('/').pop(); // approve, vote, review, etc.

  // SOD-004: Workflow Separation (check this first for more specific error)
  if (action === 'approve' && application.reviewedBy && application.reviewedBy.toString() === user._id.toString()) {
    return res.status(403).json({
      message: 'Separation of duties violation: Cannot approve after reviewing',
      code: 'SOD-004',
      details: {
        violation: 'workflow_conflict',
        previousStep: 'review',
        attemptedStep: 'approval'
      }
    });
  }

  // SOD-001: Self-Approval Prevention
  if (action === 'approve') {
    // Check if user created the application
    const createdById = application.createdBy ? application.createdBy.toString() : null;
    const userId = user._id.toString();

    if (createdById && createdById === userId) {
      return res.status(403).json({
        message: 'Separation of duties violation: Cannot approve own application',
        code: 'SOD-001',
        details: { violation: 'self_approval' }
      });
    }

    // Check organization conflict (users from same organization cannot approve)
    const appOrgId = application.organizationId ? application.organizationId.toString() : null;
    const userOrgId = user.organizationId ? user.organizationId.toString() : null;

    if (appOrgId && userOrgId && appOrgId === userOrgId) {
      return res.status(403).json({
        message: 'Separation of duties violation: Cannot approve application from same organization',
        code: 'SOD-001',
        details: { violation: 'organization_conflict' }
      });
    }
  }

  // SOD-005: Vendor Review Prevention
  if (action === 'review' && ['vendor_developer', 'vendor_technical_lead', 'vendor_compliance_officer'].includes(user.role)) {
    return res.status(403).json({
      message: 'Separation of duties violation: Vendors cannot review applications',
      code: 'SOD-005',
      details: { violation: 'vendor_review_restriction' }
    });
  }

  // SOD-006: Admin Approval Prevention
  if (action === 'approve' && user.role === 'dha_system_administrator') {
    return res.status(403).json({
      message: 'Separation of duties violation: System administrators cannot approve applications',
      code: 'SOD-006',
      details: { violation: 'admin_approval_restriction' }
    });
  }

  // SOD-007: Multiple Reviewers Requirement
  if (action === 'approve' && user.role === 'certification_committee_member') {
    const reviewCount = await Review.countDocuments({
      applicationId: application._id,
      status: 'completed'
    });

    if (reviewCount < 2) {
      return res.status(403).json({
        message: 'Separation of duties violation: Minimum 2 reviewers required',
        code: 'SOD-007',
        details: {
          current: reviewCount,
          required: 2
        }
      });
    }
  }

  req.application = application;
  next();
};

// Conflict of Interest Middleware
const checkCOI = async (req, res, next) => {
  const user = req.user;
  const applicationId = req.params.id;

  // Check if declaration exists
  const declaration = await ConflictOfInterest.findOne({
    userId: user._id,
    applicationId,
    status: 'active'
  });

  if (!declaration) {
    return res.status(403).json({
      message: 'Conflict of interest declaration required before voting',
      code: 'SOD-002',
      details: { requiresDeclaration: true }
    });
  }

  // SOD-002: Prevent voting if conflict declared
  if (declaration.hasConflict) {
    return res.status(403).json({
      message: 'Conflict of interest: Must abstain from voting',
      code: 'SOD-002',
      details: { mustAbstain: true }
    });
  }

  next();
};

// Routes
router.post('/:id/approve', protect, checkSOD, async (req, res) => {
  try {
    res.status(200).json({ message: 'Application approved' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/vote', protect, checkCOI, async (req, res) => {
  try {
    res.status(200).json({ message: 'Vote recorded' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/review', protect, checkSOD, async (req, res) => {
  try {
    res.status(200).json({ message: 'Review submitted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
