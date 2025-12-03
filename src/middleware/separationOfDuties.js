// ✅ DHA SEPARATION OF DUTIES MIDDLEWARE
// FR-RBAC-003: Enforce separation of duties rules
// Prevents conflicts of interest and ensures no single user can complete entire workflow

const { isVendorRole, isDHARole } = require('../config/permissions');

/**
 * Prevent vendors from approving their own applications
 * Used on application approval endpoints
 */
const preventSelfApproval = () => {
  return async (req, res, next) => {
    try {
      const userId = req.user._id;
      const applicationId = req.params.id || req.body.applicationId;

      if (!applicationId) {
        return res.status(400).json({
          message: 'Application ID required',
          code: 'VAL-001'
        });
      }

      // Get application details
      const Application = require('../models/Application');
      const application = await Application.findById(applicationId)
        .select('createdBy organizationId submittedBy teamMembers');

      if (!application) {
        return res.status(404).json({
          message: 'Application not found',
          code: 'NOT_FOUND'
        });
      }

      // Check if user created the application
      if (application.createdBy && application.createdBy.toString() === userId.toString()) {
        return res.status(403).json({
          message: 'Cannot approve own application - Separation of duties violation',
          code: 'SOD-001',
          details: {
            violation: 'self_approval',
            applicationId
          }
        });
      }

      // Check if user is part of the vendor organization
      if (req.user.organizationId && application.organizationId) {
        if (req.user.organizationId.toString() === application.organizationId.toString()) {
          return res.status(403).json({
            message: 'Cannot approve application from own organization - Separation of duties violation',
            code: 'SOD-001',
            details: {
              violation: 'organization_conflict',
              applicationId
            }
          });
        }
      }

      // Check if user was involved in submission
      if (application.teamMembers && application.teamMembers.length > 0) {
        const isTeamMember = application.teamMembers.some(
          member => member.userId && member.userId.toString() === userId.toString()
        );

        if (isTeamMember) {
          return res.status(403).json({
            message: 'Cannot approve application you contributed to - Separation of duties violation',
            code: 'SOD-001',
            details: {
              violation: 'contributor_approval',
              applicationId
            }
          });
        }
      }

      next();
    } catch (error) {
      console.error('Self-approval check error:', error);
      return res.status(500).json({
        message: 'Separation of duties check failed',
        code: 'SYS-001'
      });
    }
  };
};

/**
 * Check for conflict of interest in committee voting
 * Committee members must declare conflicts before voting
 */
const checkConflictOfInterest = () => {
  return async (req, res, next) => {
    try {
      const userId = req.user._id;
      const applicationId = req.params.id || req.body.applicationId;

      if (!applicationId) {
        return res.status(400).json({
          message: 'Application ID required',
          code: 'VAL-001'
        });
      }

      // Get application details
      const Application = require('../models/Application');
      const application = await Application.findById(applicationId)
        .populate('organizationId', 'name');

      if (!application) {
        return res.status(404).json({
          message: 'Application not found',
          code: 'NOT_FOUND'
        });
      }

      // Check if user has declared conflict of interest
      const ConflictOfInterest = require('../models/ConflictOfInterest');
      const conflictDeclaration = await ConflictOfInterest.findOne({
        userId,
        applicationId,
        status: 'active'
      });

      if (!conflictDeclaration) {
        return res.status(403).json({
          message: 'Conflict of interest declaration required before voting',
          code: 'SOD-002',
          details: {
            applicationId,
            requiresDeclaration: true
          }
        });
      }

      // If user declared a conflict, prevent voting
      if (conflictDeclaration.hasConflict) {
        return res.status(403).json({
          message: 'Cannot vote due to declared conflict of interest',
          code: 'SOD-002',
          details: {
            conflictType: conflictDeclaration.conflictType,
            conflictDetails: conflictDeclaration.details,
            mustAbstain: true
          }
        });
      }

      // Check employment/financial relationships
      const hasFinancialInterest = await checkFinancialRelationship(userId, application.organizationId);
      if (hasFinancialInterest) {
        return res.status(403).json({
          message: 'Potential financial conflict of interest detected',
          code: 'SOD-002',
          details: {
            violation: 'financial_interest',
            organizationId: application.organizationId,
            requiresReview: true
          }
        });
      }

      // Attach conflict declaration to request for audit trail
      req.conflictDeclaration = conflictDeclaration;

      next();
    } catch (error) {
      console.error('Conflict of interest check error:', error);
      return res.status(500).json({
        message: 'Conflict check failed',
        code: 'SYS-001'
      });
    }
  };
};

/**
 * Ensure testing labs only access assigned applications
 * Prevents testing lab from accessing applications not assigned to them
 */
const enforceTestingLabAssignment = () => {
  return async (req, res, next) => {
    try {
      // Only applies to testing lab staff
      if (req.user.role !== 'testing_lab_staff') {
        return next();
      }

      const userId = req.user._id;
      const applicationId = req.params.id || req.body.applicationId;
      const testId = req.params.testId || req.body.testId;

      // Check if test is assigned to this user/lab
      const Test = require('../models/Test');
      let query = {};

      if (testId) {
        query._id = testId;
      } else if (applicationId) {
        query.applicationId = applicationId;
      } else {
        return next(); // No specific resource, will be filtered by scope
      }

      query.$or = [
        { assignedTo: userId },
        { assignedLab: req.user.labId },
        { assignedTeam: { $in: req.user.teams || [] } }
      ];

      const assignedTest = await Test.findOne(query);

      if (!assignedTest) {
        return res.status(403).json({
          message: 'Access denied - Test not assigned to you',
          code: 'SOD-003',
          details: {
            violation: 'unassigned_access',
            testId,
            applicationId
          }
        });
      }

      // Attach test assignment info for further processing
      req.testAssignment = assignedTest;

      next();
    } catch (error) {
      console.error('Testing lab assignment check error:', error);
      return res.status(500).json({
        message: 'Assignment check failed',
        code: 'SYS-001'
      });
    }
  };
};

/**
 * Prevent single user from completing entire certification workflow
 * Tracks who performed each step and prevents same user doing multiple critical steps
 */
const enforceWorkflowSeparation = () => {
  return async (req, res, next) => {
    try {
      const userId = req.user._id;
      const applicationId = req.params.id || req.body.applicationId;

      if (!applicationId) {
        return res.status(400).json({
          message: 'Application ID required',
          code: 'VAL-001'
        });
      }

      // Get application workflow history
      const Application = require('../models/Application');
      const application = await Application.findById(applicationId)
        .select('workflowHistory createdBy reviewedBy testedBy approvedBy');

      if (!application) {
        return res.status(404).json({
          message: 'Application not found',
          code: 'NOT_FOUND'
        });
      }

      // Define critical workflow steps that cannot be performed by same user
      const criticalSteps = {
        submission: application.createdBy,
        review: application.reviewedBy,
        testing: application.testedBy,
        approval: application.approvedBy
      };

      // Get current action from request
      const currentAction = getCurrentWorkflowAction(req);

      // Check if user already performed a critical step
      const userPreviousSteps = [];
      for (const [step, performedBy] of Object.entries(criticalSteps)) {
        if (performedBy && performedBy.toString() === userId.toString()) {
          userPreviousSteps.push(step);
        }
      }

      // Define forbidden combinations
      const forbiddenCombinations = [
        { previous: 'submission', current: 'approval' },
        { previous: 'submission', current: 'review' },
        { previous: 'review', current: 'approval' },
        { previous: 'testing', current: 'approval' },
        { previous: 'submission', current: 'testing' }
      ];

      // Check if current action violates separation of duties
      for (const combination of forbiddenCombinations) {
        if (userPreviousSteps.includes(combination.previous) && currentAction === combination.current) {
          return res.status(403).json({
            message: 'Workflow separation of duties violation',
            code: 'SOD-004',
            details: {
              violation: 'workflow_conflict',
              previousStep: combination.previous,
              attemptedStep: combination.current,
              applicationId
            }
          });
        }
      }

      next();
    } catch (error) {
      console.error('Workflow separation check error:', error);
      return res.status(500).json({
        message: 'Workflow check failed',
        code: 'SYS-001'
      });
    }
  };
};

/**
 * Prevent vendors from reviewing or testing their own applications
 * Vendors can only submit, not evaluate
 */
const preventVendorReview = () => {
  return async (req, res, next) => {
    try {
      const userRole = req.user.role;

      // Check if user has vendor role
      if (!isVendorRole(userRole)) {
        return next(); // Not a vendor, allow access
      }

      // Vendors should not be able to access review/testing functions
      return res.status(403).json({
        message: 'Vendors cannot perform review or testing activities',
        code: 'SOD-005',
        details: {
          violation: 'vendor_review_restriction',
          userRole
        }
      });
    } catch (error) {
      console.error('Vendor review prevention error:', error);
      return res.status(500).json({
        message: 'Access check failed',
        code: 'SYS-001'
      });
    }
  };
};

/**
 * Prevent DHA admin from approving certifications
 * Admins manage system, but cannot approve applications
 */
const preventAdminApproval = () => {
  return async (req, res, next) => {
    try {
      if (req.user.role === 'dha_system_administrator') {
        return res.status(403).json({
          message: 'System administrators cannot approve certifications',
          code: 'SOD-006',
          details: {
            violation: 'admin_approval_restriction',
            note: 'Only certification officers and committee members can approve'
          }
        });
      }

      next();
    } catch (error) {
      console.error('Admin approval prevention error:', error);
      return res.status(500).json({
        message: 'Access check failed',
        code: 'SYS-001'
      });
    }
  };
};

/**
 * Require minimum number of reviewers before approval
 * Ensures multiple people review before final approval
 */
const requireMultipleReviewers = (minimumReviewers = 2) => {
  return async (req, res, next) => {
    try {
      const applicationId = req.params.id || req.body.applicationId;

      if (!applicationId) {
        return res.status(400).json({
          message: 'Application ID required',
          code: 'VAL-001'
        });
      }

      // Count unique reviewers
      const Review = require('../models/Review');
      const uniqueReviewers = await Review.distinct('reviewerId', {
        applicationId,
        status: 'completed'
      });

      if (uniqueReviewers.length < minimumReviewers) {
        return res.status(403).json({
          message: `Minimum ${minimumReviewers} reviewers required before approval`,
          code: 'SOD-007',
          details: {
            current: uniqueReviewers.length,
            required: minimumReviewers,
            applicationId
          }
        });
      }

      next();
    } catch (error) {
      console.error('Multiple reviewers check error:', error);
      return res.status(500).json({
        message: 'Reviewer check failed',
        code: 'SYS-001'
      });
    }
  };
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if user has financial relationship with organization
 */
async function checkFinancialRelationship(userId, organizationId) {
  try {
    // Check employment history
    const User = require('../models/User');
    const user = await User.findById(userId).select('employmentHistory financialInterests');

    if (!user) return false;

    // Check if user worked for this organization
    if (user.employmentHistory) {
      const workedForOrg = user.employmentHistory.some(
        employment => employment.organizationId && employment.organizationId.toString() === organizationId.toString()
      );

      if (workedForOrg) return true;
    }

    // Check declared financial interests
    if (user.financialInterests) {
      const hasFinancialInterest = user.financialInterests.some(
        interest => interest.organizationId && interest.organizationId.toString() === organizationId.toString()
      );

      if (hasFinancialInterest) return true;
    }

    return false;
  } catch (error) {
    console.error('Financial relationship check error:', error);
    return false;
  }
}

/**
 * Determine current workflow action from request
 */
function getCurrentWorkflowAction(req) {
  const path = req.path;
  const method = req.method;

  // Map routes to workflow actions
  if (path.includes('/submit')) return 'submission';
  if (path.includes('/review')) return 'review';
  if (path.includes('/test')) return 'testing';
  if (path.includes('/approve')) return 'approval';
  if (path.includes('/vote')) return 'approval';
  if (path.includes('/certify')) return 'approval';

  return 'unknown';
}

module.exports = {
  preventSelfApproval,
  checkConflictOfInterest,
  enforceTestingLabAssignment,
  enforceWorkflowSeparation,
  preventVendorReview,
  preventAdminApproval,
  requireMultipleReviewers
};
