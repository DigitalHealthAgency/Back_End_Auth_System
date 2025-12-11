//  REVIEW MODEL - For Application Reviews
// SRS Requirement: FR-REVIEW-001 (Application Review Process)

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  // Application being reviewed
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },

  // Reviewer
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Review type
  reviewType: {
    type: String,
    enum: [
      'technical',
      'compliance',
      'security',
      'administrative',
      'final'
    ],
    default: 'technical'
  },

  // Review status
  status: {
    type: String,
    enum: [
      'pending',
      'in_progress',
      'completed',
      'cancelled'
    ],
    default: 'pending'
  },

  // Review outcome
  recommendation: {
    type: String,
    enum: [
      'approve',
      'reject',
      'request_changes',
      'needs_more_info'
    ]
  },

  // Review details
  comments: {
    type: String,
    required: true
  },

  findings: [{
    category: {
      type: String,
      enum: [
        'documentation',
        'technical_compliance',
        'security',
        'data_standards',
        'interoperability',
        'licensing',
        'other'
      ]
    },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'info']
    },
    description: String,
    recommendation: String,
    status: {
      type: String,
      enum: ['open', 'addressed', 'accepted']
    }
  }],

  // Checklist items
  checklist: [{
    item: String,
    checked: Boolean,
    notes: String
  }],

  // Timeline
  assignedAt: {
    type: Date,
    default: Date.now
  },

  startedAt: Date,

  completedAt: Date,

  dueDate: Date,

  // Rating/scoring
  overallScore: {
    type: Number,
    min: 0,
    max: 100
  },

  criteriaScores: [{
    criterion: String,
    score: Number,
    weight: Number,
    comments: String
  }],

  // Documents reviewed
  documentsReviewed: [{
    documentId: String,
    documentName: String,
    reviewedAt: Date,
    notes: String
  }],

  // Follow-up
  requiresFollowUp: {
    type: Boolean,
    default: false
  },

  followUpNotes: String,

  followUpBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Internal notes
  internalNotes: String,

  // Approval chain (if review needs approval)
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  approvedAt: Date

}, { timestamps: true });

// Indexes
reviewSchema.index({ applicationId: 1, status: 1 });
reviewSchema.index({ reviewerId: 1, status: 1 });
reviewSchema.index({ status: 1, dueDate: 1 });

// Ensure one review per reviewer per application (can be overridden for multiple review rounds)
reviewSchema.index(
  { applicationId: 1, reviewerId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'in_progress'] } }
  }
);

module.exports = mongoose.model('Review', reviewSchema);
