// ✅ DHA TEAM MEMBER MODEL
// FR-TEAM-MGMT-001: Multi-user organizational management
// Manages team members within vendor organizations

const mongoose = require('mongoose');

/**
 * ========================================
 * INTERNAL ROLE DEFINITIONS
 * ========================================
 * These are roles within an organization, separate from system roles
 */

const INTERNAL_ROLES = {
  TECHNICAL_LEAD: 'technical_lead',           // Technical documentation and API lead
  COMPLIANCE_OFFICER: 'compliance_officer',   // Compliance and legal lead
  PROJECT_MANAGER: 'project_manager',         // Project management
  DEVELOPER: 'developer',                     // General developer
  TESTER: 'tester',                          // QA/Testing
  SUPPORT: 'support',                        // Support staff
  VIEWER: 'viewer'                           // Read-only access
};

/**
 * ========================================
 * TEAM HIERARCHY LEVELS
 * ========================================
 */

const HIERARCHY_LEVELS = {
  OWNER: 1,              // Organization owner (highest authority)
  ADMIN: 2,              // Team admin (can manage members)
  LEAD: 3,               // Team lead
  MEMBER: 4,             // Regular member
  VIEWER: 5              // Read-only (lowest authority)
};

/**
 * ========================================
 * TEAM MEMBER SCHEMA
 * ========================================
 */

const teamMemberSchema = new mongoose.Schema({
  // Organization reference
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Internal role within organization
  internalRole: {
    type: String,
    enum: Object.values(INTERNAL_ROLES),
    required: true,
    default: INTERNAL_ROLES.VIEWER
  },

  // Hierarchy level (for permission inheritance)
  hierarchyLevel: {
    type: Number,
    enum: Object.values(HIERARCHY_LEVELS),
    required: true,
    default: HIERARCHY_LEVELS.MEMBER
  },

  // Team member status
  status: {
    type: String,
    enum: [
      'pending',      // Invitation sent, not yet accepted
      'active',       // Active team member
      'inactive',     // Temporarily inactive
      'revoked',      // Access revoked
      'left'          // Member left voluntarily
    ],
    default: 'pending'
  },

  // Permissions within organization
  permissions: {
    // Application permissions
    canCreateApplications: { type: Boolean, default: false },
    canEditApplications: { type: Boolean, default: false },
    canSubmitApplications: { type: Boolean, default: false },
    canDeleteApplications: { type: Boolean, default: false },

    // Document permissions
    canUploadDocuments: { type: Boolean, default: true },
    canEditDocuments: { type: Boolean, default: true },
    canDeleteDocuments: { type: Boolean, default: false },

    // Team management permissions
    canInviteMembers: { type: Boolean, default: false },
    canRemoveMembers: { type: Boolean, default: false },
    canAssignRoles: { type: Boolean, default: false },

    // Financial permissions
    canViewFinancials: { type: Boolean, default: false },
    canManagePayments: { type: Boolean, default: false }
  },

  // Invitation details
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invitedAt: {
    type: Date,
    default: Date.now
  },
  invitationToken: {
    type: String
  },
  invitationExpiresAt: {
    type: Date
  },

  // Acceptance details
  acceptedAt: {
    type: Date
  },

  // Revocation details
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  revokedAt: {
    type: Date
  },
  revocationReason: {
    type: String
  },

  // Additional metadata
  department: {
    type: String
  },
  title: {
    type: String
  },
  notes: {
    type: String
  },

  // Activity tracking
  lastActivityAt: {
    type: Date
  }

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

// Unique constraint: one user can only have one active membership per organization
teamMemberSchema.index(
  { organizationId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['pending', 'active', 'inactive'] }
    }
  }
);

// Index for finding team members by organization
teamMemberSchema.index({ organizationId: 1, status: 1 });

// Index for finding invitations
teamMemberSchema.index({ invitationToken: 1 }, { sparse: true });

/**
 * ========================================
 * VIRTUALS
 * ========================================
 */

// Check if invitation is expired
teamMemberSchema.virtual('isInvitationExpired').get(function() {
  if (!this.invitationExpiresAt) return false;
  return new Date() > this.invitationExpiresAt;
});

// Check if member is active
teamMemberSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

/**
 * ========================================
 * METHODS
 * ========================================
 */

/**
 * Accept invitation
 */
teamMemberSchema.methods.acceptInvitation = async function() {
  if (this.status !== 'pending') {
    throw new Error('Only pending invitations can be accepted');
  }

  if (this.isInvitationExpired) {
    throw new Error('Invitation has expired');
  }

  this.status = 'active';
  this.acceptedAt = new Date();
  this.invitationToken = undefined;
  this.invitationExpiresAt = undefined;

  return await this.save();
};

/**
 * Revoke access
 */
teamMemberSchema.methods.revokeAccess = async function(revokedBy, reason) {
  if (this.status === 'revoked') {
    throw new Error('Access already revoked');
  }

  this.status = 'revoked';
  this.revokedBy = revokedBy;
  this.revokedAt = new Date();
  this.revocationReason = reason;

  return await this.save();
};

/**
 * Update permissions based on internal role
 */
teamMemberSchema.methods.updatePermissionsFromRole = function() {
  // Default all permissions to false
  const defaultPermissions = {
    canCreateApplications: false,
    canEditApplications: false,
    canSubmitApplications: false,
    canDeleteApplications: false,
    canUploadDocuments: false,
    canEditDocuments: false,
    canDeleteDocuments: false,
    canInviteMembers: false,
    canRemoveMembers: false,
    canAssignRoles: false,
    canViewFinancials: false,
    canManagePayments: false
  };

  // Set permissions based on internal role
  switch (this.internalRole) {
    case INTERNAL_ROLES.TECHNICAL_LEAD:
      this.permissions = {
        ...defaultPermissions,
        canCreateApplications: false,
        canEditApplications: true,
        canSubmitApplications: false,
        canDeleteApplications: false,
        canUploadDocuments: true,
        canEditDocuments: true,
        canDeleteDocuments: true,
        canInviteMembers: false,
        canRemoveMembers: false,
        canAssignRoles: false,
        canViewFinancials: false,
        canManagePayments: false
      };
      this.hierarchyLevel = HIERARCHY_LEVELS.LEAD;
      break;

    case INTERNAL_ROLES.COMPLIANCE_OFFICER:
      this.permissions = {
        ...defaultPermissions,
        canCreateApplications: false,
        canEditApplications: true,
        canSubmitApplications: false,
        canDeleteApplications: false,
        canUploadDocuments: true,
        canEditDocuments: true,
        canDeleteDocuments: true,
        canInviteMembers: false,
        canRemoveMembers: false,
        canAssignRoles: false,
        canViewFinancials: false,
        canManagePayments: false
      };
      this.hierarchyLevel = HIERARCHY_LEVELS.LEAD;
      break;

    case INTERNAL_ROLES.PROJECT_MANAGER:
      this.permissions = {
        ...defaultPermissions,
        canCreateApplications: true,
        canEditApplications: true,
        canSubmitApplications: true,
        canDeleteApplications: false,
        canUploadDocuments: true,
        canEditDocuments: true,
        canDeleteDocuments: false,
        canInviteMembers: true,
        canRemoveMembers: false,
        canAssignRoles: false,
        canViewFinancials: true,
        canManagePayments: false
      };
      this.hierarchyLevel = HIERARCHY_LEVELS.LEAD;
      break;

    case INTERNAL_ROLES.DEVELOPER:
      this.permissions = {
        ...defaultPermissions,
        canCreateApplications: false,
        canEditApplications: true,
        canSubmitApplications: false,
        canDeleteApplications: false,
        canUploadDocuments: true,
        canEditDocuments: true,
        canDeleteDocuments: false,
        canInviteMembers: false,
        canRemoveMembers: false,
        canAssignRoles: false,
        canViewFinancials: false,
        canManagePayments: false
      };
      this.hierarchyLevel = HIERARCHY_LEVELS.MEMBER;
      break;

    case INTERNAL_ROLES.TESTER:
      this.permissions = {
        ...defaultPermissions,
        canCreateApplications: false,
        canEditApplications: false,
        canSubmitApplications: false,
        canDeleteApplications: false,
        canUploadDocuments: true,
        canEditDocuments: false,
        canDeleteDocuments: false,
        canInviteMembers: false,
        canRemoveMembers: false,
        canAssignRoles: false,
        canViewFinancials: false,
        canManagePayments: false
      };
      this.hierarchyLevel = HIERARCHY_LEVELS.MEMBER;
      break;

    case INTERNAL_ROLES.SUPPORT:
      this.permissions = {
        ...defaultPermissions,
        canCreateApplications: false,
        canEditApplications: false,
        canSubmitApplications: false,
        canDeleteApplications: false,
        canUploadDocuments: false,
        canEditDocuments: false,
        canDeleteDocuments: false,
        canInviteMembers: false,
        canRemoveMembers: false,
        canAssignRoles: false,
        canViewFinancials: false,
        canManagePayments: false
      };
      this.hierarchyLevel = HIERARCHY_LEVELS.MEMBER;
      break;

    case INTERNAL_ROLES.VIEWER:
      this.permissions = defaultPermissions;
      this.hierarchyLevel = HIERARCHY_LEVELS.VIEWER;
      break;

    default:
      this.permissions = defaultPermissions;
      this.hierarchyLevel = HIERARCHY_LEVELS.MEMBER;
  }
};

/**
 * ========================================
 * STATIC METHODS
 * ========================================
 */

/**
 * Get active team members for an organization
 */
teamMemberSchema.statics.getActiveMembers = function(organizationId) {
  return this.find({
    organizationId,
    status: 'active'
  })
    .populate('userId', 'firstName lastName email role')
    .sort({ hierarchyLevel: 1, createdAt: 1 });
};

/**
 * Get pending invitations for an organization
 */
teamMemberSchema.statics.getPendingInvitations = function(organizationId) {
  return this.find({
    organizationId,
    status: 'pending',
    invitationExpiresAt: { $gt: new Date() }
  })
    .populate('userId', 'firstName lastName email')
    .populate('invitedBy', 'firstName lastName')
    .sort({ invitedAt: -1 });
};

/**
 * Check if user is member of organization
 */
teamMemberSchema.statics.isMember = async function(organizationId, userId) {
  const member = await this.findOne({
    organizationId,
    userId,
    status: 'active'
  });

  return !!member;
};

/**
 * Get user's role in organization
 */
teamMemberSchema.statics.getUserRole = async function(organizationId, userId) {
  const member = await this.findOne({
    organizationId,
    userId,
    status: 'active'
  });

  return member ? member.internalRole : null;
};

/**
 * ========================================
 * MIDDLEWARE
 * ========================================
 */

// Pre-save: Update permissions when internal role changes
teamMemberSchema.pre('save', function(next) {
  if (this.isModified('internalRole')) {
    this.updatePermissionsFromRole();
  }
  next();
});

/**
 * ========================================
 * EXPORTS
 * ========================================
 */

const TeamMember = mongoose.model('TeamMember', teamMemberSchema);

module.exports = {
  TeamMember,
  INTERNAL_ROLES,
  HIERARCHY_LEVELS
};
