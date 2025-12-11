//  CONFLICT OF INTEREST MODEL
// SRS Requirement: FR-RBAC-004 (Conflict of Interest Management)

const mongoose = require('mongoose');

const conflictOfInterestSchema = new mongoose.Schema({
  // User making the declaration
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Application this declaration relates to
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true,
    index: true
  },

  // Does user have a conflict?
  hasConflict: {
    type: Boolean,
    required: true,
    default: false
  },

  // Type of conflict (if any)
  conflictType: {
    type: String,
    enum: [
      'financial_interest',
      'employment_history',
      'family_relationship',
      'business_relationship',
      'advisory_role',
      'competitive_interest',
      'other'
    ]
  },

  // Details of the conflict
  details: {
    type: String,
    required: true
  },

  // Additional context
  organizationName: String,
  relationshipDescription: String,
  startDate: Date,
  endDate: Date,

  // Declaration status
  status: {
    type: String,
    enum: ['active', 'resolved', 'reviewed', 'expired'],
    default: 'active'
  },

  // Review by admin
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  reviewedAt: Date,

  reviewComments: String,

  // Resolution
  resolution: {
    type: String,
    enum: ['recusal_required', 'acceptable', 'needs_investigation']
  },

  // Expiration
  expiresAt: Date

}, { timestamps: true });

// Compound index for efficient lookups
conflictOfInterestSchema.index({ userId: 1, applicationId: 1, status: 1 });

// Ensure only one active declaration per user per application
conflictOfInterestSchema.index(
  { userId: 1, applicationId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' }
  }
);

module.exports = mongoose.model('ConflictOfInterest', conflictOfInterestSchema);
