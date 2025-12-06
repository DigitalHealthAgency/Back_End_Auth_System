// ✅ DHA SUSPENSION APPEAL MODEL
// FR-USER-LIFECYCLE-002: Suspension appeal workflow
// Manages user appeals for account suspensions

const mongoose = require('mongoose');

/**
 * ========================================
 * APPEAL STATUS
 * ========================================
 */

const APPEAL_STATUS = {
  PENDING: 'pending',           // Appeal submitted, awaiting review
  UNDER_REVIEW: 'under_review', // Being reviewed by admin
  APPROVED: 'approved',         // Appeal approved, suspension lifted
  REJECTED: 'rejected',         // Appeal rejected, suspension remains
  WITHDRAWN: 'withdrawn'        // User withdrew appeal
};

/**
 * ========================================
 * SUSPENSION APPEAL SCHEMA
 * ========================================
 */

const suspensionAppealSchema = new mongoose.Schema({
  // User who filed the appeal
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Suspension details
  suspensionReason: {
    type: String,
    required: true
  },
  suspendedAt: {
    type: Date,
    required: true
  },
  suspendedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Appeal details
  appealReason: {
    type: String,
    required: true,
    minlength: 50,
    maxlength: 2000
  },
  supportingDocuments: [{
    filename: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Appeal status
  status: {
    type: String,
    enum: Object.values(APPEAL_STATUS),
    default: APPEAL_STATUS.PENDING,
    index: true
  },

  // Review details
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  reviewNotes: {
    type: String,
    maxlength: 2000
  },
  adminDecision: {
    type: String,
    maxlength: 2000
  },

  // Resolution
  resolvedAt: {
    type: Date
  },

  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Internal notes (admin only)
  internalNotes: [{
    note: String,
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now }
  }],

  // Communication history
  communications: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: String,
    sentAt: { type: Date, default: Date.now },
    isInternal: { type: Boolean, default: false }
  }]

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * ========================================
 * INDEXES
 * ========================================
 */

// Index for finding user's appeals
suspensionAppealSchema.index({ userId: 1, status: 1 });

// Index for finding pending appeals
suspensionAppealSchema.index({ status: 1, createdAt: -1 });

/**
 * ========================================
 * VIRTUALS
 * ========================================
 */

// Check if appeal is pending
suspensionAppealSchema.virtual('isPending').get(function() {
  return this.status === APPEAL_STATUS.PENDING || this.status === APPEAL_STATUS.UNDER_REVIEW;
});

// Check if appeal is resolved
suspensionAppealSchema.virtual('isResolved').get(function() {
  return this.status === APPEAL_STATUS.APPROVED ||
         this.status === APPEAL_STATUS.REJECTED ||
         this.status === APPEAL_STATUS.WITHDRAWN;
});

// Days since appeal filed
suspensionAppealSchema.virtual('daysSinceAppeal').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

/**
 * ========================================
 * METHODS
 * ========================================
 */

/**
 * Start review process
 */
suspensionAppealSchema.methods.startReview = async function(reviewerId) {
  if (this.status !== APPEAL_STATUS.PENDING) {
    throw new Error('Only pending appeals can be reviewed');
  }

  this.status = APPEAL_STATUS.UNDER_REVIEW;
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();

  return await this.save();
};

/**
 * Approve appeal
 */
suspensionAppealSchema.methods.approve = async function(reviewerId, decision) {
  if (!this.isPending) {
    throw new Error('Cannot approve a resolved appeal');
  }

  this.status = APPEAL_STATUS.APPROVED;
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.resolvedAt = new Date();
  this.adminDecision = decision;

  return await this.save();
};

/**
 * Reject appeal
 */
suspensionAppealSchema.methods.reject = async function(reviewerId, decision) {
  if (!this.isPending) {
    throw new Error('Cannot reject a resolved appeal');
  }

  this.status = APPEAL_STATUS.REJECTED;
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.resolvedAt = new Date();
  this.adminDecision = decision;

  return await this.save();
};

/**
 * Withdraw appeal
 */
suspensionAppealSchema.methods.withdraw = async function() {
  if (!this.isPending) {
    throw new Error('Cannot withdraw a resolved appeal');
  }

  this.status = APPEAL_STATUS.WITHDRAWN;
  this.resolvedAt = new Date();

  return await this.save();
};

/**
 * Add internal note
 */
suspensionAppealSchema.methods.addInternalNote = async function(note, addedBy) {
  this.internalNotes.push({
    note,
    addedBy,
    addedAt: new Date()
  });

  return await this.save();
};

/**
 * Add communication
 */
suspensionAppealSchema.methods.addCommunication = async function(from, message, isInternal = false) {
  this.communications.push({
    from,
    message,
    sentAt: new Date(),
    isInternal
  });

  return await this.save();
};

/**
 * ========================================
 * STATIC METHODS
 * ========================================
 */

/**
 * Get pending appeals
 */
suspensionAppealSchema.statics.getPendingAppeals = function() {
  return this.find({
    status: { $in: [APPEAL_STATUS.PENDING, APPEAL_STATUS.UNDER_REVIEW] }
  })
    .populate('userId', 'firstName lastName email organizationName')
    .populate('suspendedBy', 'firstName lastName')
    .populate('reviewedBy', 'firstName lastName')
    .sort({ priority: -1, createdAt: 1 });
};

/**
 * Get user's appeals
 */
suspensionAppealSchema.statics.getUserAppeals = function(userId) {
  return this.find({ userId })
    .populate('suspendedBy', 'firstName lastName')
    .populate('reviewedBy', 'firstName lastName')
    .sort({ createdAt: -1 });
};

/**
 * Get appeal statistics
 */
suspensionAppealSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    total: 0,
    pending: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    withdrawn: 0
  };

  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });

  return result;
};

/**
 * Check if user has pending appeal
 */
suspensionAppealSchema.statics.hasPendingAppeal = async function(userId) {
  const appeal = await this.findOne({
    userId,
    status: { $in: [APPEAL_STATUS.PENDING, APPEAL_STATUS.UNDER_REVIEW] }
  });

  return !!appeal;
};

/**
 * ========================================
 * EXPORTS
 * ========================================
 */

const SuspensionAppeal = mongoose.model('SuspensionAppeal', suspensionAppealSchema);

module.exports = {
  SuspensionAppeal,
  APPEAL_STATUS
};
