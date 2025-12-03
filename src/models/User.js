const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Account type: 'individual' or 'organization'
  type: {
    type: String,
    enum: ['individual', 'organization'],
    required: true
  },

  // Individual fields
  username: {
    type: String,
    unique: true,
    sparse: true // allow null for orgs
  },
  firstName: { type: String },
  lastName: { type: String },
  email: {
    type: String,
    sparse: true // allow null for orgs
  },
  phone: { type: String },

  // Additional individual fields for board members
  idNumber: {
    type: String,
    sparse: true,
    trim: true,
    maxlength: 20
  },
  
  address: {
    physical: String,
    postal: String,
    city: String,
    county: String
  },

  // Board member specific fields
  boardMemberDetails: {
    boardRole: {
      type: String,
      enum: [
        'Chairperson',
        'Vice_Chairperson', 
        'Secretary',
        'Treasurer',
        'Member',
        'Patron',
        'Advisor',
        // New operational roles
        'project_manager',
        'Project_Manager',
        'field_officer',
        'Field_Officer',
        'm_and_e_officer',
        'M_and_E_Officer',
        'finance',
        'Finance',
        'donor',
        'Donor'
      ]
    },
    startDate: Date,
    endDate: Date,
    termLength: {
      type: Number,
      min: 1,
      max: 10
    },
    expertise: [{
      type: String,
      enum: [
        'Finance',
        'Legal',
        'Management',
        'Marketing',
        'IT',
        'Healthcare',
        'Education',
        'Agriculture',
        'Environment',
        'Social Work',
        'Other'
      ]
    }],
    qualifications: [{
      degree: String,
      institution: String,
      year: Number,
      field: String
    }],
    experience: [{
      organization: String,
      position: String,
      startDate: Date,
      endDate: Date,
      description: String,
      current: {
        type: Boolean,
        default: false
      }
    }]
  },

  // Organization reference for individuals
  organizationRegistrationNumber: {
    type: String,
    sparse: true,
    index: true // For filtering users by organization
  },

  // Organization fields
  organizationName: {
    type: String,
    unique: true,
    sparse: true // allow null for individuals
  },
  organizationType: {
    type: String,
    enum: [
      'HOSPITAL', 'CLINIC', 'HEALTH_CENTER', 'DISPENSARY', 'LABORATORY', 'PHARMACY',
      'DENTAL', 'IMAGING', 'SPECIALIST', 'REHAB', 'EMR', 'EHR', 'LIS', 'PIS', 'RIS',
      'HMIS', 'TELEMED', 'HEALTH_APP', 'HIE', 'INSURANCE', 'PUBLIC_HEALTH'
    ],
    sparse: true
  },
  subCounty: { type: String },
  organizationEmail: {
    type: String,
    unique: true,
    sparse: true
  },
  organizationPhone: { type: String },
  yearOfEstablishment: { type: Number },

  // Registration tracking
  registrationNumber: {
    type: String,
    unique: true,
    sparse: true // allow null for users without registrations
  },
  organizationStatus: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'clarification', 'approved', 'rejected', 'cancelled', 'certified'],
    sparse: true
  },

  // Common fields
  password: {
    type: String,
    required: function() {
      return !this.firstTimeSetup && !this.googleId;
    },
    select: true
  },

  // Google OAuth ID
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },

  // ✅ FIXED: Password History (SRS Requirement - Last 5 passwords)
  passwordHistory: [{
    hash: { type: String, required: true },
    changedAt: { type: Date, default: Date.now }
  }],
  maxPasswordHistory: { type: Number, default: 5 },

  // ✅ FIXED: Password Expiry (SRS Requirement - 90 days)
  passwordExpiresAt: { type: Date },
  passwordLastChanged: { type: Date, default: Date.now },
  passwordExpiryDays: { type: Number, default: 90 },
  
  // First time password setup
  firstTimeSetup: {
    type: Boolean,
    default: false
  },
  
  setupToken: {
    type: String,
    sparse: true,
    select: false
  },
  
  setupTokenExpires: {
    type: Date,
    sparse: true
  },

  receiveSystemAlerts: {
    type: Boolean,
    default: true
  },

  // Suspicious Activity Alerts
  suspiciousActivityAlerts: { type: Boolean, default: true },

  // Account Status
  accountStatus: {
    type: String,
    enum: ['active', 'inactive', 'terminated', 'cancelled', 'suspended', 'pending_registration', 'submitted', 'under_review', 'clarification', 'approved', 'rejected', 'certified', 'pending_setup'],
    default: 'active'
  },

  // Recovery Key
  recoveryKeyHash: { type: String, default: null, select: false },
  recoveryKeyGeneratedAt: { type: Date },

  // Sessions
  sessions: [{
    sessionId: { type: String, required: true },
    ip: String,
    device: String,
    createdAt: { type: Date, default: Date.now }
  }],

  // Known Devices
  knownDevices: [{
    ip: String,
    device: String,
    lastUsed: Date
  }],

  // Logo
  logo: {
    url: String,
    public_id: String
  },

  // ✅ DHA-SPECIFIC RBAC: 9 Roles with Granular Permissions (SRS Requirement)
  // FR-RBAC-001: Role-Based Access Control for Digital Health Certification
  role: {
    type: String,
    enum: [
      'vendor_developer',                 // Software vendors submitting applications
      'vendor_technical_lead',            // Vendor technical documentation lead
      'vendor_compliance_officer',        // Vendor compliance and legal lead
      'dha_system_administrator',         // DHA IT staff managing platform
      'dha_certification_officer',        // DHA staff reviewing applications
      'testing_lab_staff',                // Testing lab personnel
      'certification_committee_member',   // Committee members voting on certifications
      'county_health_officer',            // County health officials
      'public_user'                       // General public (read-only registry access)
    ],
    default: 'public_user'  // Default role for new registrations
  },

  // Two-Factor Authentication (User must set up after registration)
  twoFactorEnabled: { type: Boolean, default: false },  // Disabled by default, enabled after setup
  twoFactorSecret: { type: String, select: false },
  twoFactorTempSecret: { type: String },
  twoFactorSetupRequired: { type: Boolean, default: true }, // Prompt user to set up 2FA

  tokenVersion: { type: Number, default: 0 },

  // Account Suspension
  suspended: { type: Boolean, default: false },
  suspensionReason: { type: String },
  suspendedAt: { type: Date },
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ✅ FIXED: Account Lockout (SRS Requirement - 30-minute temporary)
  lockedUntil: { type: Date },
  failedAttempts: { type: Number, default: 0 },

  // Account Termination
  terminationRequested: { type: Boolean, default: false },
  terminationDate: { type: Date, default: null },

  // Last Login
  lastLogin: { type: Date },

  // Board Member reference (if this user is created from board member)
  boardMemberId: {
    type: mongoose.Schema.Types.ObjectId,
    sparse: true
  }

}, { timestamps: true });

// Conditional unique indexes for email based on organization membership
// Users belonging to organizations: email unique within organization
userSchema.index({ organizationRegistrationNumber: 1, email: 1 }, { 
  unique: true, 
  sparse: true,
  partialFilterExpression: { organizationRegistrationNumber: { $exists: true, $ne: null } }
});

// Independent users (no organization): email globally unique
userSchema.index({ email: 1 }, { 
  unique: true, 
  sparse: true,
  partialFilterExpression: { 
    organizationRegistrationNumber: { $exists: false },
    email: { $exists: true, $ne: null }
  }
});

// Phone number uniqueness within organization (for board members)
userSchema.index({ organizationRegistrationNumber: 1, phone: 1 }, { 
  unique: true, 
  sparse: true,
  partialFilterExpression: { 
    organizationRegistrationNumber: { $exists: true, $ne: null },
    phone: { $exists: true, $ne: null }
  }
});

module.exports = mongoose.model('User', userSchema);