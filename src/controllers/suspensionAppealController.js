// ✅ DHA SUSPENSION APPEAL CONTROLLER
// FR-USER-LIFECYCLE-002: Suspension appeal workflow
// Handles user appeals for account suspensions

const { SuspensionAppeal, APPEAL_STATUS } = require('../models/SuspensionAppeal');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailService');

/**
 * ========================================
 * SUBMIT APPEAL
 * ========================================
 */

/**
 * Submit a suspension appeal
 * POST /api/appeals/submit
 */
exports.submitAppeal = async (req, res) => {
  try {
    const userId = req.user._id;
    const { appealReason, supportingDocuments } = req.body;

    // Validate appeal reason
    if (!appealReason || appealReason.trim().length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Appeal reason must be at least 50 characters'
      });
    }

    if (appealReason.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Appeal reason cannot exceed 2000 characters'
      });
    }

    // Check if user is suspended
    const user = await User.findById(userId);

    if (user.accountStatus !== 'suspended') {
      return res.status(400).json({
        success: false,
        message: 'Only suspended accounts can submit appeals'
      });
    }

    // Check if user already has a pending appeal
    const hasPending = await SuspensionAppeal.hasPendingAppeal(userId);

    if (hasPending) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending appeal. Please wait for it to be reviewed.'
      });
    }

    // Create appeal
    const appeal = new SuspensionAppeal({
      userId,
      suspensionReason: user.suspensionReason || 'Not specified',
      suspendedAt: user.suspendedAt || new Date(),
      suspendedBy: user.suspendedBy,
      appealReason: appealReason.trim(),
      supportingDocuments: supportingDocuments || []
    });

    await appeal.save();

    // Send confirmation email to user
    await sendEmail({
      to: user.email || user.organizationEmail,
      subject: 'Suspension Appeal Received',
      template: 'appeal-received',
      data: {
        name: user.firstName || user.organizationName,
        appealId: appeal._id,
        submittedAt: appeal.createdAt
      }
    });

    // Notify admins
    const admins = await User.find({ role: 'dha_system_administrator', accountStatus: 'active' });
    for (const admin of admins) {
      await sendEmail({
        to: admin.email,
        subject: 'New Suspension Appeal Submitted',
        template: 'appeal-notification-admin',
        data: {
          appealId: appeal._id,
          userName: user.firstName || user.organizationName,
          userEmail: user.email || user.organizationEmail,
          submittedAt: appeal.createdAt
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Appeal submitted successfully',
      data: {
        appealId: appeal._id,
        status: appeal.status,
        submittedAt: appeal.createdAt
      }
    });
  } catch (error) {
    console.error('Submit appeal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit appeal',
      error: error.message
    });
  }
};

/**
 * ========================================
 * VIEW APPEALS
 * ========================================
 */

/**
 * Get user's appeals
 * GET /api/appeals/my-appeals
 */
exports.getMyAppeals = async (req, res) => {
  try {
    const userId = req.user._id;

    const appeals = await SuspensionAppeal.getUserAppeals(userId);

    res.status(200).json({
      success: true,
      data: {
        appeals,
        count: appeals.length
      }
    });
  } catch (error) {
    console.error('Get user appeals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve appeals',
      error: error.message
    });
  }
};

/**
 * Get all pending appeals (Admin only)
 * GET /api/appeals/pending
 */
exports.getPendingAppeals = async (req, res) => {
  try {
    const appeals = await SuspensionAppeal.getPendingAppeals();

    res.status(200).json({
      success: true,
      data: {
        appeals,
        count: appeals.length
      }
    });
  } catch (error) {
    console.error('Get pending appeals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending appeals',
      error: error.message
    });
  }
};

/**
 * Get appeal statistics (Admin only)
 * GET /api/appeals/statistics
 */
exports.getAppealStatistics = async (req, res) => {
  try {
    const statistics = await SuspensionAppeal.getStatistics();

    res.status(200).json({
      success: true,
      data: { statistics }
    });
  } catch (error) {
    console.error('Get appeal statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve appeal statistics',
      error: error.message
    });
  }
};

/**
 * Get appeal details
 * GET /api/appeals/:appealId
 */
exports.getAppealDetails = async (req, res) => {
  try {
    const { appealId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const appeal = await SuspensionAppeal.findById(appealId)
      .populate('userId', 'firstName lastName email organizationName')
      .populate('suspendedBy', 'firstName lastName')
      .populate('reviewedBy', 'firstName lastName');

    if (!appeal) {
      return res.status(404).json({
        success: false,
        message: 'Appeal not found'
      });
    }

    // Check permissions: user can only view their own appeals, admins can view all
    if (userRole !== 'dha_system_administrator' && appeal.userId._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Hide internal notes from non-admin users
    let appealData = appeal.toObject();
    if (userRole !== 'dha_system_administrator') {
      delete appealData.internalNotes;
      appealData.communications = appealData.communications.filter(c => !c.isInternal);
    }

    res.status(200).json({
      success: true,
      data: { appeal: appealData }
    });
  } catch (error) {
    console.error('Get appeal details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve appeal details',
      error: error.message
    });
  }
};

/**
 * ========================================
 * REVIEW APPEALS (Admin only)
 * ========================================
 */

/**
 * Start reviewing an appeal
 * POST /api/appeals/:appealId/review/start
 */
exports.startReview = async (req, res) => {
  try {
    const { appealId } = req.params;
    const reviewerId = req.user._id;

    const appeal = await SuspensionAppeal.findById(appealId);

    if (!appeal) {
      return res.status(404).json({
        success: false,
        message: 'Appeal not found'
      });
    }

    await appeal.startReview(reviewerId);

    res.status(200).json({
      success: true,
      message: 'Appeal review started',
      data: {
        appealId: appeal._id,
        status: appeal.status,
        reviewedBy: reviewerId,
        reviewedAt: appeal.reviewedAt
      }
    });
  } catch (error) {
    console.error('Start review error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start review',
      error: error.message
    });
  }
};

/**
 * Approve appeal
 * POST /api/appeals/:appealId/approve
 */
exports.approveAppeal = async (req, res) => {
  try {
    const { appealId } = req.params;
    const { decision } = req.body;
    const reviewerId = req.user._id;

    if (!decision || decision.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Decision explanation is required (minimum 20 characters)'
      });
    }

    const appeal = await SuspensionAppeal.findById(appealId)
      .populate('userId', 'firstName lastName email organizationName accountStatus');

    if (!appeal) {
      return res.status(404).json({
        success: false,
        message: 'Appeal not found'
      });
    }

    // Approve appeal
    await appeal.approve(reviewerId, decision);

    // Lift suspension from user account
    const user = await User.findById(appeal.userId._id);
    user.accountStatus = 'active';
    user.suspended = false;
    user.suspensionReason = null;
    user.suspendedAt = null;
    user.suspendedBy = null;

    await user.save();

    // Send notification to user
    await sendEmail({
      to: user.email || user.organizationEmail,
      subject: 'Suspension Appeal Approved',
      template: 'appeal-approved',
      data: {
        name: user.firstName || user.organizationName,
        decision,
        approvedAt: appeal.resolvedAt
      }
    });

    res.status(200).json({
      success: true,
      message: 'Appeal approved and suspension lifted',
      data: {
        appealId: appeal._id,
        status: appeal.status,
        resolvedAt: appeal.resolvedAt
      }
    });
  } catch (error) {
    console.error('Approve appeal error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve appeal',
      error: error.message
    });
  }
};

/**
 * Reject appeal
 * POST /api/appeals/:appealId/reject
 */
exports.rejectAppeal = async (req, res) => {
  try {
    const { appealId } = req.params;
    const { decision } = req.body;
    const reviewerId = req.user._id;

    if (!decision || decision.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Decision explanation is required (minimum 20 characters)'
      });
    }

    const appeal = await SuspensionAppeal.findById(appealId)
      .populate('userId', 'firstName lastName email organizationName');

    if (!appeal) {
      return res.status(404).json({
        success: false,
        message: 'Appeal not found'
      });
    }

    // Reject appeal
    await appeal.reject(reviewerId, decision);

    // Send notification to user
    const user = appeal.userId;
    await sendEmail({
      to: user.email || user.organizationEmail,
      subject: 'Suspension Appeal Decision',
      template: 'appeal-rejected',
      data: {
        name: user.firstName || user.organizationName,
        decision,
        rejectedAt: appeal.resolvedAt
      }
    });

    res.status(200).json({
      success: true,
      message: 'Appeal rejected',
      data: {
        appealId: appeal._id,
        status: appeal.status,
        resolvedAt: appeal.resolvedAt
      }
    });
  } catch (error) {
    console.error('Reject appeal error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reject appeal',
      error: error.message
    });
  }
};

/**
 * ========================================
 * APPEAL MANAGEMENT
 * ========================================
 */

/**
 * Withdraw appeal
 * POST /api/appeals/:appealId/withdraw
 */
exports.withdrawAppeal = async (req, res) => {
  try {
    const { appealId } = req.params;
    const userId = req.user._id;

    const appeal = await SuspensionAppeal.findById(appealId);

    if (!appeal) {
      return res.status(404).json({
        success: false,
        message: 'Appeal not found'
      });
    }

    // Check if user owns the appeal
    if (appeal.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only withdraw your own appeals'
      });
    }

    await appeal.withdraw();

    res.status(200).json({
      success: true,
      message: 'Appeal withdrawn successfully',
      data: {
        appealId: appeal._id,
        status: appeal.status
      }
    });
  } catch (error) {
    console.error('Withdraw appeal error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to withdraw appeal',
      error: error.message
    });
  }
};

/**
 * Add internal note (Admin only)
 * POST /api/appeals/:appealId/notes
 */
exports.addInternalNote = async (req, res) => {
  try {
    const { appealId } = req.params;
    const { note } = req.body;
    const addedBy = req.user._id;

    if (!note || note.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Note must be at least 10 characters'
      });
    }

    const appeal = await SuspensionAppeal.findById(appealId);

    if (!appeal) {
      return res.status(404).json({
        success: false,
        message: 'Appeal not found'
      });
    }

    await appeal.addInternalNote(note, addedBy);

    res.status(200).json({
      success: true,
      message: 'Internal note added successfully'
    });
  } catch (error) {
    console.error('Add internal note error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add internal note',
      error: error.message
    });
  }
};

/**
 * Add communication
 * POST /api/appeals/:appealId/communicate
 */
exports.addCommunication = async (req, res) => {
  try {
    const { appealId } = req.params;
    const { message, isInternal } = req.body;
    const from = req.user._id;
    const userRole = req.user.role;

    if (!message || message.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Message must be at least 10 characters'
      });
    }

    // Only admins can send internal communications
    const internal = userRole === 'dha_system_administrator' ? (isInternal || false) : false;

    const appeal = await SuspensionAppeal.findById(appealId)
      .populate('userId', 'email organizationEmail firstName organizationName');

    if (!appeal) {
      return res.status(404).json({
        success: false,
        message: 'Appeal not found'
      });
    }

    // Check permissions
    if (userRole !== 'dha_system_administrator' && appeal.userId._id.toString() !== from.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await appeal.addCommunication(from, message, internal);

    // Send email notification if not internal
    if (!internal) {
      const recipient = userRole === 'dha_system_administrator' ? appeal.userId : null;
      if (recipient) {
        await sendEmail({
          to: recipient.email || recipient.organizationEmail,
          subject: 'New Message on Your Suspension Appeal',
          template: 'appeal-communication',
          data: {
            name: recipient.firstName || recipient.organizationName,
            message,
            appealId: appeal._id
          }
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Communication added successfully'
    });
  } catch (error) {
    console.error('Add communication error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add communication',
      error: error.message
    });
  }
};
