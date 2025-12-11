//  TEST MODEL - For Application Testing and Validation
// SRS Requirement: FR-TEST-001 (Testing and Validation)

const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  // Application being tested
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true,
    index: true
  },

  // Test type
  testType: {
    type: String,
    enum: [
      'api_compliance',
      'security_assessment',
      'interoperability',
      'data_quality',
      'performance',
      'usability',
      'fhir_compliance',
      'hl7_compliance',
      'other'
    ],
    required: true
  },

  // Test status
  status: {
    type: String,
    enum: [
      'pending',
      'assigned',
      'in_progress',
      'completed',
      'failed',
      'cancelled'
    ],
    default: 'pending'
  },

  // Assignment - Individual user
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  // Assignment - Lab
  assignedLab: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Lab organization
  },

  // Assignment - Team
  assignedTeam: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Test execution
  executedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  executedAt: Date,

  // Test results
  result: {
    type: String,
    enum: ['pass', 'fail', 'conditional_pass', 'pending']
  },

  score: {
    type: Number,
    min: 0,
    max: 100
  },

  // Test details
  testPlan: {
    description: String,
    criteria: [String],
    methodology: String
  },

  findings: [{
    category: String,
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'info']
    },
    description: String,
    recommendation: String,
    status: {
      type: String,
      enum: ['open', 'resolved', 'acknowledged']
    }
  }],

  // Test documentation
  testReports: [{
    name: String,
    type: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Timeline
  scheduledStartDate: Date,
  scheduledEndDate: Date,
  actualStartDate: Date,
  actualEndDate: Date,

  // Approval
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  approvedAt: Date,

  // Comments
  comments: String,
  internalNotes: String

}, { timestamps: true });

// Indexes
testSchema.index({ applicationId: 1, status: 1 });
testSchema.index({ assignedTo: 1, status: 1 });
testSchema.index({ assignedLab: 1, status: 1 });
testSchema.index({ testType: 1, status: 1 });

module.exports = mongoose.model('Test', testSchema);
