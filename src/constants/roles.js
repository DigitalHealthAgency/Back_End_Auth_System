// src/constants/roles.js
// 🎯 KENYA DHA CERTIFICATION SYSTEM - ROLE-BASED ACCESS CONTROL (RBAC)
// Complete implementation of 9 user roles with granular permissions

/**
 * ========================================
 * ROLE DEFINITIONS
 * ========================================
 */

const ROLES = {
  // CATEGORY 1: VENDOR/DEVELOPER (3 ROLES)
  VENDOR_DEVELOPER: 'vendor_developer',
  VENDOR_TECHNICAL_LEAD: 'vendor_technical_lead',
  VENDOR_COMPLIANCE_OFFICER: 'vendor_compliance_officer',

  // CATEGORY 2: DHA ADMINISTRATION (2 ROLES)
  DHA_SYSTEM_ADMINISTRATOR: 'dha_system_administrator',
  DHA_CERTIFICATION_OFFICER: 'dha_certification_officer',

  // CATEGORY 3: TESTING LAB (1 ROLE)
  TESTING_LAB_STAFF: 'testing_lab_staff',

  // CATEGORY 4: CERTIFICATION COMMITTEE (1 ROLE)
  CERTIFICATION_COMMITTEE_MEMBER: 'certification_committee_member',

  // CATEGORY 5: COUNTY HEALTH (1 ROLE)
  COUNTY_HEALTH_OFFICER: 'county_health_officer',

  // CATEGORY 6: PUBLIC USER (1 ROLE)
  PUBLIC_USER: 'public_user'
};

/**
 * ========================================
 * ROLE DISPLAY NAMES (User-Friendly)
 * ========================================
 */

const ROLE_DISPLAY_NAMES = {
  [ROLES.VENDOR_DEVELOPER]: 'Vendor/Developer',
  [ROLES.VENDOR_TECHNICAL_LEAD]: 'Vendor Technical Lead',
  [ROLES.VENDOR_COMPLIANCE_OFFICER]: 'Vendor Compliance Officer',
  [ROLES.DHA_SYSTEM_ADMINISTRATOR]: 'DHA System Administrator',
  [ROLES.DHA_CERTIFICATION_OFFICER]: 'DHA Certification Officer',
  [ROLES.TESTING_LAB_STAFF]: 'Testing Lab Staff',
  [ROLES.CERTIFICATION_COMMITTEE_MEMBER]: 'Certification Committee Member',
  [ROLES.COUNTY_HEALTH_OFFICER]: 'County Health Officer',
  [ROLES.PUBLIC_USER]: 'Public User'
};

/**
 * ========================================
 * ROLE-TO-PORTAL MAPPING
 * ========================================
 */

const ROLE_PORTAL_MAP = {
  // Vendor roles → Vendor Portal
  [ROLES.VENDOR_DEVELOPER]: '/vendor-portal',
  [ROLES.VENDOR_TECHNICAL_LEAD]: '/vendor-portal',
  [ROLES.VENDOR_COMPLIANCE_OFFICER]: '/vendor-portal',

  // DHA Admin → Admin Portal
  [ROLES.DHA_SYSTEM_ADMINISTRATOR]: '/admin-portal',

  // DHA Certification → Certification Portal
  [ROLES.DHA_CERTIFICATION_OFFICER]: '/certification-portal',

  // Testing Lab → Lab Portal
  [ROLES.TESTING_LAB_STAFF]: '/lab-portal',

  // Committee → Committee Portal
  [ROLES.CERTIFICATION_COMMITTEE_MEMBER]: '/committee-portal',

  // County → County Portal
  [ROLES.COUNTY_HEALTH_OFFICER]: '/county-portal',

  // Public → Public Portal (Dashboard with registry access)
  [ROLES.PUBLIC_USER]: '/dashboard'
};

/**
 * ========================================
 * PERMISSION DEFINITIONS
 * ========================================
 */

const PERMISSIONS = {
  // Application/Attestation Management
  CREATE_APPLICATION: 'create_application',
  READ_OWN_APPLICATION: 'read_own_application',
  READ_ALL_APPLICATIONS: 'read_all_applications',
  UPDATE_OWN_APPLICATION: 'update_own_application',
  UPDATE_ANY_APPLICATION: 'update_any_application',
  DELETE_OWN_APPLICATION: 'delete_own_application',
  DELETE_ANY_APPLICATION: 'delete_any_application',
  SUBMIT_APPLICATION: 'submit_application',

  // Document Management
  UPLOAD_TECHNICAL_DOCS: 'upload_technical_docs',
  UPLOAD_COMPLIANCE_DOCS: 'upload_compliance_docs',
  UPLOAD_DPIA: 'upload_dpia',
  UPLOAD_POLICIES: 'upload_policies',
  VIEW_OWN_DOCUMENTS: 'view_own_documents',
  VIEW_ALL_DOCUMENTS: 'view_all_documents',
  APPROVE_DOCUMENTS: 'approve_documents',
  REJECT_DOCUMENTS: 'reject_documents',

  // Testing Management
  SCHEDULE_TESTING: 'schedule_testing',
  EXECUTE_TESTS: 'execute_tests',
  VIEW_ASSIGNED_TESTS: 'view_assigned_tests',
  VIEW_ALL_TESTS: 'view_all_tests',
  SUBMIT_TEST_RESULTS: 'submit_test_results',
  MODIFY_TEST_RESULTS: 'modify_test_results',

  // Evaluation & Review
  REVIEW_APPLICATIONS: 'review_applications',
  REQUEST_CLARIFICATIONS: 'request_clarifications',
  DOCUMENT_FINDINGS: 'document_findings',
  PREPARE_EVALUATION_REPORTS: 'prepare_evaluation_reports',

  // Certification Decisions
  VOTE_ON_CERTIFICATION: 'vote_on_certification',
  VIEW_EVALUATION_SUMMARIES: 'view_evaluation_summaries',
  MAKE_FINAL_DECISION: 'make_final_decision',
  REVOKE_CERTIFICATION: 'revoke_certification',

  // User Management
  MANAGE_ALL_USERS: 'manage_all_users',
  MANAGE_TEAM_MEMBERS: 'manage_team_members',
  VIEW_ALL_USERS: 'view_all_users',
  ASSIGN_ROLES: 'assign_roles',

  // System Administration
  CONFIGURE_SYSTEM: 'configure_system',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  MANAGE_INTEGRATIONS: 'manage_integrations',
  SYSTEM_BACKUPS: 'system_backups',

  // Registry Access
  VIEW_PUBLIC_REGISTRY: 'view_public_registry',
  VERIFY_CERTIFICATION: 'verify_certification',
  SEARCH_CERTIFIED_SYSTEMS: 'search_certified_systems',

  // Incident Reporting
  REPORT_INCIDENTS: 'report_incidents',
  MONITOR_COMPLIANCE: 'monitor_compliance',
  SUBMIT_INCIDENT_REPORTS: 'submit_incident_reports',

  // Non-Conformance Management
  ADDRESS_NON_CONFORMANCES: 'address_non_conformances',
  TRACK_NON_CONFORMANCES: 'track_non_conformances',

  // Vendor-Specific
  PROVIDE_SANDBOX_ACCESS: 'provide_sandbox_access',
  MANAGE_API_DOCUMENTATION: 'manage_api_documentation',
  COORDINATE_TECHNICAL_TESTING: 'coordinate_technical_testing'
};

/**
 * ========================================
 * ROLE PERMISSIONS MAPPING
 * ========================================
 */

const ROLE_PERMISSIONS = {
  // ==========================================
  // VENDOR DEVELOPER
  // ==========================================
  [ROLES.VENDOR_DEVELOPER]: [
    // Application Management
    PERMISSIONS.CREATE_APPLICATION,
    PERMISSIONS.READ_OWN_APPLICATION,
    PERMISSIONS.UPDATE_OWN_APPLICATION,
    PERMISSIONS.DELETE_OWN_APPLICATION,
    PERMISSIONS.SUBMIT_APPLICATION,

    // Document Management (General)
    PERMISSIONS.VIEW_OWN_DOCUMENTS,

    // Team Management
    PERMISSIONS.MANAGE_TEAM_MEMBERS,

    // Non-Conformance
    PERMISSIONS.ADDRESS_NON_CONFORMANCES,

    // Vendor-Specific
    PERMISSIONS.PROVIDE_SANDBOX_ACCESS
  ],

  // ==========================================
  // VENDOR TECHNICAL LEAD
  // ==========================================
  [ROLES.VENDOR_TECHNICAL_LEAD]: [
    // Application Management (Read/Update only)
    PERMISSIONS.READ_OWN_APPLICATION,
    PERMISSIONS.UPDATE_OWN_APPLICATION,

    // Technical Documentation
    PERMISSIONS.UPLOAD_TECHNICAL_DOCS,
    PERMISSIONS.VIEW_OWN_DOCUMENTS,

    // Vendor-Specific
    PERMISSIONS.MANAGE_API_DOCUMENTATION,
    PERMISSIONS.COORDINATE_TECHNICAL_TESTING,
    PERMISSIONS.PROVIDE_SANDBOX_ACCESS,

    // Non-Conformance (Technical)
    PERMISSIONS.ADDRESS_NON_CONFORMANCES
  ],

  // ==========================================
  // VENDOR COMPLIANCE OFFICER
  // ==========================================
  [ROLES.VENDOR_COMPLIANCE_OFFICER]: [
    // Application Management (Read/Update only)
    PERMISSIONS.READ_OWN_APPLICATION,
    PERMISSIONS.UPDATE_OWN_APPLICATION,

    // Compliance Documentation
    PERMISSIONS.UPLOAD_COMPLIANCE_DOCS,
    PERMISSIONS.UPLOAD_DPIA,
    PERMISSIONS.UPLOAD_POLICIES,
    PERMISSIONS.VIEW_OWN_DOCUMENTS,

    // Non-Conformance (Compliance)
    PERMISSIONS.ADDRESS_NON_CONFORMANCES
  ],

  // ==========================================
  // DHA SYSTEM ADMINISTRATOR
  // ==========================================
  [ROLES.DHA_SYSTEM_ADMINISTRATOR]: [
    // User Management (Full)
    PERMISSIONS.MANAGE_ALL_USERS,
    PERMISSIONS.VIEW_ALL_USERS,
    PERMISSIONS.ASSIGN_ROLES,

    // System Administration (Full)
    PERMISSIONS.CONFIGURE_SYSTEM,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.MANAGE_INTEGRATIONS,
    PERMISSIONS.SYSTEM_BACKUPS,

    // Registry Access
    PERMISSIONS.VIEW_PUBLIC_REGISTRY,
    PERMISSIONS.VERIFY_CERTIFICATION,
    PERMISSIONS.SEARCH_CERTIFIED_SYSTEMS,

    // NOTE: CANNOT influence certification decisions or alter test results
  ],

  // ==========================================
  // DHA CERTIFICATION OFFICER
  // ==========================================
  [ROLES.DHA_CERTIFICATION_OFFICER]: [
    // Application Review (Full)
    PERMISSIONS.READ_ALL_APPLICATIONS,
    PERMISSIONS.REVIEW_APPLICATIONS,
    PERMISSIONS.REQUEST_CLARIFICATIONS,
    PERMISSIONS.DOCUMENT_FINDINGS,
    PERMISSIONS.PREPARE_EVALUATION_REPORTS,

    // Document Management (Full)
    PERMISSIONS.VIEW_ALL_DOCUMENTS,
    PERMISSIONS.APPROVE_DOCUMENTS,
    PERMISSIONS.REJECT_DOCUMENTS,

    // Testing Management
    PERMISSIONS.SCHEDULE_TESTING,
    PERMISSIONS.VIEW_ALL_TESTS,

    // Non-Conformance Tracking
    PERMISSIONS.TRACK_NON_CONFORMANCES,

    // Registry Access
    PERMISSIONS.VIEW_PUBLIC_REGISTRY,
    PERMISSIONS.VERIFY_CERTIFICATION,
    PERMISSIONS.SEARCH_CERTIFIED_SYSTEMS,

    // NOTE: CANNOT make final certification decisions (Committee only)
    // NOTE: CANNOT modify test results from labs
  ],

  // ==========================================
  // TESTING LAB STAFF
  // ==========================================
  [ROLES.TESTING_LAB_STAFF]: [
    // Testing (Assigned only)
    PERMISSIONS.VIEW_ASSIGNED_TESTS,
    PERMISSIONS.EXECUTE_TESTS,
    PERMISSIONS.SUBMIT_TEST_RESULTS,

    // Vendor Access (for testing)
    PERMISSIONS.READ_OWN_APPLICATION, // Access to assigned vendor systems

    // NOTE: CANNOT view other labs' results
    // NOTE: CANNOT modify submitted results
    // NOTE: CANNOT access internal DHA notes
  ],

  // ==========================================
  // CERTIFICATION COMMITTEE MEMBER
  // ==========================================
  [ROLES.CERTIFICATION_COMMITTEE_MEMBER]: [
    // Decision Making
    PERMISSIONS.VOTE_ON_CERTIFICATION,
    PERMISSIONS.MAKE_FINAL_DECISION,
    PERMISSIONS.REVOKE_CERTIFICATION,

    // Review Access (Read-Only)
    PERMISSIONS.VIEW_EVALUATION_SUMMARIES,
    PERMISSIONS.VIEW_ALL_DOCUMENTS,
    PERMISSIONS.VIEW_ALL_TESTS,

    // Registry Access
    PERMISSIONS.VIEW_PUBLIC_REGISTRY,
    PERMISSIONS.VERIFY_CERTIFICATION,
    PERMISSIONS.SEARCH_CERTIFIED_SYSTEMS,

    // NOTE: CANNOT alter test data or evaluation materials
    // NOTE: Conflict-of-interest rules apply
  ],

  // ==========================================
  // COUNTY HEALTH OFFICER
  // ==========================================
  [ROLES.COUNTY_HEALTH_OFFICER]: [
    // Registry Access (Read-Only)
    PERMISSIONS.VIEW_PUBLIC_REGISTRY,
    PERMISSIONS.VERIFY_CERTIFICATION,
    PERMISSIONS.SEARCH_CERTIFIED_SYSTEMS,

    // Incident Reporting
    PERMISSIONS.REPORT_INCIDENTS,
    PERMISSIONS.SUBMIT_INCIDENT_REPORTS,
    PERMISSIONS.MONITOR_COMPLIANCE,

    // NOTE: CANNOT initiate certification
    // NOTE: CANNOT view confidential vendor data
  ],

  // ==========================================
  // PUBLIC USER
  // ==========================================
  [ROLES.PUBLIC_USER]: [
    // Registry Access (Read-Only)
    PERMISSIONS.VIEW_PUBLIC_REGISTRY,
    PERMISSIONS.VERIFY_CERTIFICATION,
    PERMISSIONS.SEARCH_CERTIFIED_SYSTEMS,

    // NOTE: No access to internal documents, test results, or vendor data
  ]
};

/**
 * ========================================
 * ROLE HIERARCHY (For permission inheritance)
 * ========================================
 */

const ROLE_HIERARCHY = {
  [ROLES.DHA_SYSTEM_ADMINISTRATOR]: 100, // Highest system access
  [ROLES.CERTIFICATION_COMMITTEE_MEMBER]: 90, // Decision authority
  [ROLES.DHA_CERTIFICATION_OFFICER]: 80, // Evaluation authority
  [ROLES.TESTING_LAB_STAFF]: 60,
  [ROLES.VENDOR_DEVELOPER]: 50,
  [ROLES.VENDOR_TECHNICAL_LEAD]: 40,
  [ROLES.VENDOR_COMPLIANCE_OFFICER]: 40,
  [ROLES.COUNTY_HEALTH_OFFICER]: 30,
  [ROLES.PUBLIC_USER]: 10 // Lowest access
};

/**
 * ========================================
 * VENDOR ROLE GROUPS
 * ========================================
 */

const VENDOR_ROLES = [
  ROLES.VENDOR_DEVELOPER,
  ROLES.VENDOR_TECHNICAL_LEAD,
  ROLES.VENDOR_COMPLIANCE_OFFICER
];

const DHA_ROLES = [
  ROLES.DHA_SYSTEM_ADMINISTRATOR,
  ROLES.DHA_CERTIFICATION_OFFICER
];

const ADMIN_ROLES = [
  ROLES.DHA_SYSTEM_ADMINISTRATOR
];

/**
 * ========================================
 * HELPER FUNCTIONS
 * ========================================
 */

/**
 * Check if a role has a specific permission
 */
function hasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(permission) : false;
}

/**
 * Check if a role is a vendor role
 */
function isVendorRole(role) {
  return VENDOR_ROLES.includes(role);
}

/**
 * Check if a role is a DHA role
 */
function isDHARole(role) {
  return DHA_ROLES.includes(role);
}

/**
 * Check if a role is an admin role
 */
function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

/**
 * Get all permissions for a role
 */
function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Get portal URL for a role
 */
function getRolePortal(role) {
  return ROLE_PORTAL_MAP[role] || '/dashboard';
}

/**
 * Get display name for a role
 */
function getRoleDisplayName(role) {
  return ROLE_DISPLAY_NAMES[role] || role;
}

/**
 * Check if user can access a resource based on ownership
 * @param {string} userRole - User's role
 * @param {string} resourceOwnerId - Resource owner's ID
 * @param {string} userId - Current user's ID
 */
function canAccessResource(userRole, resourceOwnerId, userId) {
  // Admins and certification officers can access all resources
  if (isDHARole(userRole)) {
    return true;
  }

  // Committee members can read all resources
  if (userRole === ROLES.CERTIFICATION_COMMITTEE_MEMBER) {
    return true;
  }

  // Vendors can only access their own resources
  if (isVendorRole(userRole)) {
    return resourceOwnerId === userId;
  }

  // Testing lab staff can access assigned resources
  if (userRole === ROLES.TESTING_LAB_STAFF) {
    // This should check assignment - simplified for now
    return false; // Implement assignment check
  }

  // County health officers and public users cannot access private resources
  return false;
}

/**
 * ========================================
 * EXPORTS
 * ========================================
 */

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_DISPLAY_NAMES,
  ROLE_PORTAL_MAP,
  ROLE_HIERARCHY,
  VENDOR_ROLES,
  DHA_ROLES,
  ADMIN_ROLES,

  // Helper functions
  hasPermission,
  isVendorRole,
  isDHARole,
  isAdminRole,
  getRolePermissions,
  getRolePortal,
  getRoleDisplayName,
  canAccessResource
};
