// models/securityEvent.js
const mongoose = require('mongoose');

const securityEventSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Made optional for cases where user can't be identified
  },
  // New field to track the target email for failed attempts
  targetEmail: {
    type: String,
    required: false,
    lowercase: true,
    trim: true,
    index: true // Add index for efficient querying
  },
  action: {
    type: String,
    required: true,
    enum: [
      'Login Attempt',
      'Registration Successful',
      'Account Registered',
      'Registration Failed',
      'Registration Error',
      'High Risk Registration Blocked',
      'High Risk Request Blocked',
      'Suspicious Activity Detected',
      'Failed Login',
      'Authentication Failed',
      'Login Successful',
      'Suspended Account Login Attempt',
      'New Device Login',
      'Password Changed',
      'Password Change Failed',
      'Password Change Error',
      'Password Expired Login Attempt',
      '2FA Required',
      'Recovery Key Generated',
      'Recovery Key Generation Error',
      'Account Termination Requested',
      'Force Logout by Admin',
      'Suspicious Activity Detected',
      'Global Threat Detected',
      'Rate Limit Violation',
      'IP Blocked',
      'IP Temporarily Blocked',
      'Token Verification Failed',
      'Token Version Mismatch',
      'IP_LIST_UPDATED',
      'IP_LIST_REMOVED',
      'Multiple Failed Attempts',
      'Failed Attempts Reset',
      'Account Locked',
      'Account Suspended',
      'Account Unlocked',
      'Admin Access',
      'Permission Escalation',
      'Data Export',
      'Profile Updated',
      'Profile Update Error',
      'Profile Access Failed',
      'Profile Access Error',
      'Profile Update Failed',
      'Suspended User Access Attempt',
      'Login Attempt on Suspended Account',
      'Security Settings Changed'
    ]
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  ip: {
    type: String,
    required: true
  },
  device: {
    type: String,
    required: true
  },
  location: {
    country: String,
    region: String,
    city: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  details: {
    type: mongoose.Schema.Types.Mixed, // Flexible object for additional details
    default: {}
  },
  isResolved: {
    type: Boolean,
    default: false
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: {
    type: Date
  },
  resolution: {
    type: String,
    maxlength: 1000
  },
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reason: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Indexes for performance
securityEventSchema.index({ user: 1, createdAt: -1 });
securityEventSchema.index({ severity: 1, createdAt: -1 });
securityEventSchema.index({ action: 1, createdAt: -1 });
securityEventSchema.index({ ip: 1, createdAt: -1 });
securityEventSchema.index({ isResolved: 1, createdAt: -1 });
securityEventSchema.index({ riskScore: -1, createdAt: -1 });
// New indexes for email tracking
securityEventSchema.index({ targetEmail: 1, createdAt: -1 });
securityEventSchema.index({ targetEmail: 1, action: 1, createdAt: -1 });
securityEventSchema.index({ ip: 1, action: 1, createdAt: -1 });

// Virtual for event age
securityEventSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Method to resolve security event
securityEventSchema.methods.resolve = function(resolvedBy, resolution) {
  this.isResolved = true;
  this.resolvedBy = resolvedBy;
  this.resolvedAt = new Date();
  this.resolution = resolution;
  return this.save();
};

// Static method to create security event with auto risk scoring
securityEventSchema.statics.createEvent = async function(eventData) {
  const riskScore = this.calculateRiskScore(eventData);
  return this.create({
    ...eventData,
    riskScore
  });
};

// Static method to calculate risk score
securityEventSchema.statics.calculateRiskScore = function(eventData) {
  let score = 0;
  
  // Base scores by action type
  const actionScores = {
    'Failed Login': 20,
    'Multiple Failed Attempts': 40,
    'Account Locked': 60,
    'New Device Login': 30,
    'Suspicious Activity Detected': 70,
    'IP Blocked': 50,
    'Permission Escalation': 80,
    'Data Export': 40,
    'Admin Access': 35
  };
  
  score += actionScores[eventData.action] || 10;
  
  // Increase score for repeated events from same IP
  if (eventData.details?.repeatCount > 1) {
    score += Math.min(eventData.details.repeatCount * 10, 30);
  }
  
  // Increase score for targeting specific email accounts
  if (eventData.targetEmail && eventData.details?.failedAttempts > 3) {
    score += 15;
  }
  
  // Increase score for unusual hours (outside 6 AM - 10 PM)
  const hour = new Date().getHours();
  if (hour < 6 || hour > 22) {
    score += 15;
  }
  
  // Cap the score at 100
  return Math.min(score, 100);
};

// Static method to get failed login attempts by email
securityEventSchema.statics.getFailedAttemptsByEmail = async function(email, timeRange = 24) {
  const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
  
  return this.find({
    targetEmail: email,
    action: { $in: ['Failed Login',
      'Authentication Failed', 'Multiple Failed Attempts'] },
    createdAt: { $gte: startDate }
  }).sort({ createdAt: -1 });
};

// Static method to get most targeted emails
securityEventSchema.statics.getMostTargetedEmails = async function(timeRange = 24, limit = 10) {
  const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        targetEmail: { $exists: true, $ne: null },
        action: { $in: ['Failed Login',
      'Authentication Failed', 'Multiple Failed Attempts'] },
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$targetEmail',
        attemptCount: { $sum: 1 },
        uniqueIPs: { $addToSet: '$ip' },
        latestAttempt: { $max: '$createdAt' },
        highestRiskScore: { $max: '$riskScore' }
      }
    },
    {
      $project: {
        email: '$_id',
        attemptCount: 1,
        uniqueIPCount: { $size: '$uniqueIPs' },
        uniqueIPs: 1,
        latestAttempt: 1,
        highestRiskScore: 1
      }
    },
    { $sort: { attemptCount: -1 } },
    { $limit: limit }
  ]);
};

// Static method to get attack patterns by IP and email
securityEventSchema.statics.getAttackPatterns = async function(timeRange = 24) {
  const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        action: { $in: ['Failed Login',
      'Authentication Failed', 'Multiple Failed Attempts'] },
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          ip: '$ip',
          targetEmail: '$targetEmail'
        },
        attemptCount: { $sum: 1 },
        firstAttempt: { $min: '$createdAt' },
        lastAttempt: { $max: '$createdAt' },
        avgRiskScore: { $avg: '$riskScore' }
      }
    },
    {
      $project: {
        ip: '$_id.ip',
        targetEmail: '$_id.targetEmail',
        attemptCount: 1,
        firstAttempt: 1,
        lastAttempt: 1,
        avgRiskScore: { $round: ['$avgRiskScore', 2] },
        timeSpan: {
          $divide: [
            { $subtract: ['$lastAttempt', '$firstAttempt'] },
            1000 * 60 // Convert to minutes
          ]
        }
      }
    },
    { $sort: { attemptCount: -1 } }
  ]);
};

// Static method to get security insights (enhanced with email tracking)
securityEventSchema.statics.getSecurityInsights = async function(timeRange = 24) {
  const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
  
  const insights = await this.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        highRiskEvents: {
          $sum: { $cond: [{ $gte: ['$riskScore', 70] }, 1, 0] }
        },
        unresolvedEvents: {
          $sum: { $cond: [{ $eq: ['$isResolved', false] }, 1, 0] }
        },
        failedLoginAttempts: {
          $sum: { $cond: [{ $eq: ['$action', 'Failed Login'] }, 1, 0] }
        },
        uniqueTargetedEmails: {
          $addToSet: { $cond: [{ $ne: ['$targetEmail', null] }, '$targetEmail', '$$REMOVE'] }
        },
        avgRiskScore: { $avg: '$riskScore' },
        topActions: { $push: '$action' },
        topIPs: { $push: '$ip' }
      }
    },
    {
      $project: {
        totalEvents: 1,
        highRiskEvents: 1,
        unresolvedEvents: 1,
        failedLoginAttempts: 1,
        uniqueTargetedEmailsCount: { $size: '$uniqueTargetedEmails' },
        avgRiskScore: { $round: ['$avgRiskScore', 2] }
      }
    }
  ]);
  
  return insights[0] || {
    totalEvents: 0,
    highRiskEvents: 0,
    unresolvedEvents: 0,
    failedLoginAttempts: 0,
    uniqueTargetedEmailsCount: 0,
    avgRiskScore: 0
  };
};

module.exports = mongoose.model('securityEvent', securityEventSchema);