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
  legalTrack: {
    type: String,
    enum: ['PBO', 'CBO', 'CGRA', 'NPO', 'CSO'],
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
      return !this.firstTimeSetup;
    }, 
    select: true 
  },
  
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

  // Enhanced Role system for board members and organization roles
  role: {
    type: String,
    enum: [
      'admin', 
      'user', 
      'organization',
      'reviewer', // Required for Organization Registration service
      // Board roles
      'chairperson',
      'vice_chairperson',
      'secretary',
      'treasurer',
      'board_member',
      'patron',
      'advisor',
      // New operational roles
      'project_manager',
      'field_officer',
      'm_and_e_officer',
      'donor',
      // Department roles
      'hr',
      'finance',
      'operations',
      'marketing',
      'it',
      'legal',
      'programs',
      'communications',
      // Management roles
      'ceo',
      'director',
      'manager',
      'coordinator',
      'officer',
      'assistant'
    ],
    default: 'user'
  },

  // Two-Factor Authentication
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, select: false },
  twoFactorTempSecret: { type: String },

  tokenVersion: { type: Number, default: 0 },

  // Account Suspension
  suspended: { type: Boolean, default: false },
  suspensionReason: { type: String },
  suspendedAt: { type: Date },
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

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