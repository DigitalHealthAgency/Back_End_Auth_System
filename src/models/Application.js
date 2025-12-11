//  APPLICATION MODEL - For DHA Certification Applications
// SRS Requirement: FR-APP-001 (Application Management)

const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  // Organization submitting the application
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // User who created/submitted the application
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Application details
  title: {
    type: String,
    required: true
  },

  description: {
    type: String
  },

  // Application status
  status: {
    type: String,
    enum: [
      'draft',
      'submitted',
      'under_review',
      'testing',
      'committee_review',
      'approved',
      'rejected',
      'withdrawn'
    ],
    default: 'draft'
  },

  // Team members involved in the application
  teamMembers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['developer', 'technical_lead', 'compliance_officer', 'other']
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Workflow tracking for SOD
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  testedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Workflow history for audit trail
  workflowHistory: [{
    step: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    action: String,
    notes: String
  }],

  // Documents attached
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Review count
  reviewCount: {
    type: Number,
    default: 0
  },

  // Final decision
  decision: {
    outcome: {
      type: String,
      enum: ['approved', 'rejected', 'pending']
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    decidedAt: Date,
    comments: String
  }

}, { timestamps: true });

// Indexes for efficient querying
applicationSchema.index({ organizationId: 1, status: 1 });
applicationSchema.index({ createdBy: 1 });
applicationSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Application', applicationSchema);
