// ✅ DHA RBAC PERMISSION MATRIX
// FR-RBAC-001: Complete permission matrix for all 9 roles
// SRS Requirement: Granular CRUD permissions per role

/**
 * Permission Matrix Structure:
 * - Each role has specific resource access
 * - Resources support: create, read, update, delete, approve, reject, execute actions
 * - Nested permissions for fine-grained control
 * - Separation of duties enforced at permission level
 */

const PERMISSIONS = {
  // ============================================================================
  // ROLE 1: VENDOR_DEVELOPER
  // ============================================================================
  // Software vendors submitting certification applications
  // Can manage their own applications, documents, and team
  vendor_developer: {
    applications: {
      actions: ['create', 'read', 'update'],
      scope: 'own', // Only own organization's applications
      conditions: {
        create: { max_draft_applications: 5 },
        update: { allowed_statuses: ['draft', 'returned', 'rejected'] }
      }
    },
    documents: {
      actions: ['create', 'read', 'update', 'delete'],
      scope: 'own',
      types: ['technical', 'compliance', 'business', 'security', 'user_manual'],
      conditions: {
        delete: { not_in_review: true }
      }
    },
    team: {
      actions: ['create', 'read', 'update', 'delete'],
      scope: 'own',
      roles: ['vendor_developer', 'vendor_technical_lead', 'vendor_compliance_officer']
    },
    tests: {
      actions: ['read'],
      scope: 'own', // Only tests for own applications
      details: 'summary' // Can see test results but not detailed logs
    },
    reports: {
      actions: ['read'],
      scope: 'own',
      types: ['test_summary', 'review_summary']
    },
    registry: {
      actions: ['read'],
      scope: 'all' // Can view public registry
    },
    api_credentials: {
      actions: ['read'],
      scope: 'own'
    },
    notifications: {
      actions: ['read', 'update'],
      scope: 'own'
    }
  },

  // ============================================================================
  // ROLE 2: VENDOR_TECHNICAL_LEAD
  // ============================================================================
  // Vendor staff responsible for technical documentation and API compliance
  vendor_technical_lead: {
    applications: {
      actions: ['read', 'update'],
      scope: 'own',
      conditions: {
        update: { sections: ['technical_specs', 'api_documentation', 'architecture'] }
      }
    },
    documents: {
      technical: {
        actions: ['create', 'read', 'update', 'delete'],
        scope: 'own',
        types: ['api_docs', 'technical_specs', 'architecture', 'data_dictionary', 'integration_guide']
      },
      compliance: {
        actions: ['read'],
        scope: 'own'
      },
      business: {
        actions: ['read'],
        scope: 'own'
      }
    },
    api_docs: {
      actions: ['create', 'read', 'update', 'delete'],
      scope: 'own',
      formats: ['openapi', 'swagger', 'postman', 'fhir']
    },
    test_credentials: {
      actions: ['create', 'read', 'update', 'delete'],
      scope: 'own',
      types: ['sandbox', 'test_environment']
    },
    tests: {
      actions: ['read'],
      scope: 'own',
      details: 'detailed' // Can see detailed technical test logs
    },
    team: {
      actions: ['read'],
      scope: 'own'
    },
    reports: {
      actions: ['read'],
      scope: 'own',
      types: ['technical_assessment', 'api_compliance']
    },
    registry: {
      actions: ['read'],
      scope: 'all'
    }
  },

  // ============================================================================
  // ROLE 3: VENDOR_COMPLIANCE_OFFICER
  // ============================================================================
  // Vendor staff responsible for compliance documentation and legal requirements
  vendor_compliance_officer: {
    applications: {
      actions: ['read'],
      scope: 'own'
    },
    documents: {
      compliance: {
        actions: ['create', 'read', 'update', 'delete'],
        scope: 'own',
        types: ['dpia', 'privacy_policy', 'terms_of_service', 'consent_forms', 'data_retention_policy']
      },
      technical: {
        actions: ['read'],
        scope: 'own'
      },
      business: {
        actions: ['read'],
        scope: 'own'
      }
    },
    dpia: {
      actions: ['create', 'read', 'update'],
      scope: 'own',
      required_fields: ['data_types', 'processing_activities', 'risks', 'mitigations']
    },
    policies: {
      actions: ['create', 'read', 'update'],
      scope: 'own',
      types: ['privacy', 'security', 'data_retention', 'consent_management']
    },
    compliance_checklist: {
      actions: ['create', 'read', 'update'],
      scope: 'own',
      frameworks: ['data_protection_act', 'health_act', 'interoperability_standards']
    },
    tests: {
      actions: ['read'],
      scope: 'own',
      details: 'compliance_only' // Only compliance-related test results
    },
    team: {
      actions: ['read'],
      scope: 'own'
    },
    reports: {
      actions: ['read'],
      scope: 'own',
      types: ['compliance_assessment', 'dpia_summary']
    },
    registry: {
      actions: ['read'],
      scope: 'all'
    }
  },

  // ============================================================================
  // ROLE 4: DHA_SYSTEM_ADMINISTRATOR
  // ============================================================================
  // DHA IT staff managing the certification platform
  // Full system access for administration but cannot approve certifications
  dha_system_administrator: {
    users: {
      actions: ['create', 'read', 'update', 'delete'],
      scope: 'all',
      conditions: {
        create: { require_approval: true },
        delete: { require_confirmation: true, cannot_delete: ['own_account'] }
      }
    },
    roles: {
      actions: ['create', 'read', 'update', 'delete'],
      scope: 'all',
      restrictions: {
        cannot_modify: ['dha_system_administrator'] // Cannot modify own role
      }
    },
    permissions: {
      actions: ['create', 'read', 'update', 'delete'],
      scope: 'all'
    },
    system_settings: {
      actions: ['create', 'read', 'update', 'delete'],
      scope: 'all',
      categories: ['platform', 'email', 'notifications', 'integrations', 'security']
    },
    applications: {
      actions: ['read', 'delete'],
      scope: 'all',
      conditions: {
        delete: { allowed_statuses: ['draft', 'withdrawn'], require_confirmation: true }
      }
    },
    documents: {
      actions: ['read', 'delete'],
      scope: 'all',
      conditions: {
        delete: { require_justification: true }
      }
    },
    tests: {
      actions: ['read', 'delete'],
      scope: 'all'
    },
    audit_logs: {
      actions: ['read', 'export'],
      scope: 'all',
      retention: '7_years'
    },
    reports: {
      actions: ['read', 'export'],
      scope: 'all',
      types: ['system_usage', 'user_activity', 'application_statistics', 'security_events']
    },
    security_events: {
      actions: ['read', 'export'],
      scope: 'all'
    },
    ip_management: {
      actions: ['create', 'read', 'update', 'delete'],
      scope: 'all'
    },
    backups: {
      actions: ['create', 'read', 'restore'],
      scope: 'all'
    },
    registry: {
      actions: ['read'],
      scope: 'all'
    },
    // CANNOT: approve/reject applications, vote on certifications
    restrictions: {
      cannot_approve: true,
      cannot_vote: true,
      cannot_conduct_reviews: true
    }
  },

  // ============================================================================
  // ROLE 5: DHA_CERTIFICATION_OFFICER
  // ============================================================================
  // DHA staff reviewing and evaluating certification applications
  dha_certification_officer: {
    applications: {
      actions: ['read', 'update', 'approve', 'reject', 'return'],
      scope: 'all',
      conditions: {
        approve: { require_all_tests_passed: true, require_committee_vote: true },
        reject: { require_justification: true },
        return: { require_feedback: true },
        update: { sections: ['review_status', 'officer_notes', 'checklist'] }
      },
      workflow: {
        can_assign: true,
        can_reassign: true,
        can_escalate: true
      }
    },
    documents: {
      actions: ['read', 'review', 'comment'],
      scope: 'all',
      can_request_changes: true
    },
    reviews: {
      actions: ['create', 'read', 'update', 'submit'],
      scope: 'assigned', // Only applications assigned to them
      checklist: {
        technical_compliance: true,
        legal_compliance: true,
        security_requirements: true,
        interoperability_standards: true
      }
    },
    tests: {
      actions: ['create', 'read', 'update', 'execute', 'assign'],
      scope: 'assigned',
      can_create_test_plan: true,
      can_assign_to_lab: true
    },
    comments: {
      actions: ['create', 'read', 'update', 'delete'],
      scope: 'assigned',
      types: ['internal', 'vendor_facing']
    },
    reports: {
      actions: ['create', 'read', 'export'],
      scope: 'assigned',
      types: ['review_report', 'compliance_report', 'recommendation_report']
    },
    notifications: {
      actions: ['create', 'read'],
      scope: 'assigned',
      can_notify_vendors: true
    },
    registry: {
      actions: ['read'],
      scope: 'all'
    },
    // Can request additional information from vendors
    vendor_communication: {
      actions: ['create', 'read'],
      types: ['clarification_request', 'document_request', 'meeting_request']
    }
  },

  // ============================================================================
  // ROLE 6: TESTING_LAB_STAFF
  // ============================================================================
  // Testing lab personnel conducting technical compliance tests
  testing_lab_staff: {
    applications: {
      actions: ['read'],
      scope: 'assigned', // Only applications assigned to their lab
      access_level: 'technical_only' // No access to business/compliance docs
    },
    tests: {
      actions: ['read', 'execute', 'update'],
      scope: 'assigned',
      types: [
        'api_compliance',
        'security_testing',
        'performance_testing',
        'interoperability_testing',
        'data_validation'
      ],
      can_create_test_cases: true
    },
    test_results: {
      actions: ['create', 'read', 'update', 'submit'],
      scope: 'assigned',
      fields: {
        status: ['pass', 'fail', 'conditional_pass', 'not_applicable'],
        evidence: 'required',
        notes: 'required_for_failures'
      }
    },
    evidence: {
      actions: ['create', 'read', 'update', 'delete'],
      scope: 'assigned',
      types: ['screenshots', 'logs', 'api_responses', 'test_outputs'],
      max_file_size: '50MB'
    },
    test_environments: {
      actions: ['read', 'access'],
      scope: 'assigned'
    },
    reports: {
      actions: ['create', 'read', 'export'],
      scope: 'assigned',
      types: ['test_execution_report', 'findings_report', 'technical_summary']
    },
    vendor_communication: {
      actions: ['create', 'read'],
      types: ['technical_clarification', 'test_credentials_request'],
      must_cc_certification_officer: true
    },
    registry: {
      actions: ['read'],
      scope: 'all'
    },
    // CANNOT: approve/reject applications, access business/compliance documents
    restrictions: {
      cannot_approve: true,
      cannot_access_business_docs: true,
      cannot_access_compliance_docs: true
    }
  },

  // ============================================================================
  // ROLE 7: CERTIFICATION_COMMITTEE_MEMBER
  // ============================================================================
  // Committee members voting on final certification decisions
  certification_committee_member: {
    applications: {
      actions: ['read'],
      scope: 'under_review', // Only applications ready for committee vote
      access_level: 'summary' // High-level summary, not granular details
    },
    documents: {
      actions: ['read'],
      scope: 'under_review',
      types: ['executive_summary', 'review_summary', 'test_summary']
    },
    test_results: {
      actions: ['read'],
      scope: 'under_review',
      details: 'summary_only'
    },
    reports: {
      actions: ['read'],
      scope: 'under_review',
      types: ['certification_officer_recommendation', 'test_summary', 'compliance_summary']
    },
    votes: {
      actions: ['create', 'read', 'update'],
      scope: 'assigned',
      options: ['approve', 'reject', 'abstain', 'request_more_info'],
      require_justification: true,
      conflict_of_interest_check: true
    },
    decisions: {
      actions: ['create', 'read'],
      scope: 'assigned',
      require_majority: true,
      quorum_required: true
    },
    meetings: {
      actions: ['read', 'attend'],
      scope: 'scheduled',
      can_request_presentation: true
    },
    registry: {
      actions: ['read'],
      scope: 'all'
    },
    // Conflict of interest declarations
    conflict_of_interest: {
      actions: ['create', 'read', 'update'],
      scope: 'own',
      required_before_vote: true
    },
    // CANNOT: conduct technical reviews, execute tests, communicate with vendors directly
    restrictions: {
      cannot_conduct_reviews: true,
      cannot_execute_tests: true,
      cannot_contact_vendors: true,
      must_declare_conflicts: true
    }
  },

  // ============================================================================
  // ROLE 8: COUNTY_HEALTH_OFFICER
  // ============================================================================
  // County health officials monitoring certified systems in their jurisdiction
  county_health_officer: {
    registry: {
      actions: ['read', 'search', 'filter'],
      scope: 'all',
      can_filter_by_county: true,
      can_view_certificate_details: true
    },
    certificates: {
      actions: ['read', 'verify', 'export'],
      scope: 'all',
      can_check_validity: true,
      can_view_history: true
    },
    reports: {
      actions: ['create', 'read', 'export'],
      scope: 'county', // Only their county
      types: [
        'county_adoption_report',
        'certified_systems_list',
        'compliance_monitoring'
      ]
    },
    incidents: {
      actions: ['create', 'read'],
      scope: 'county',
      types: ['compliance_issue', 'security_incident', 'patient_complaint']
    },
    notifications: {
      actions: ['read', 'subscribe'],
      types: ['new_certifications', 'certificate_revocations', 'system_alerts']
    },
    // CANNOT: access application details, review processes, internal documents
    restrictions: {
      cannot_access_applications: true,
      cannot_access_reviews: true,
      cannot_access_vendor_docs: true,
      read_only_access: true
    }
  },

  // ============================================================================
  // ROLE 9: PUBLIC_USER
  // ============================================================================
  // General public with read-only access to certified systems registry
  public_user: {
    registry: {
      actions: ['read', 'search'],
      scope: 'certified_only', // Only approved/certified systems
      fields: ['system_name', 'vendor', 'certificate_number', 'issue_date', 'expiry_date', 'category']
    },
    certificates: {
      actions: ['read', 'verify'],
      scope: 'all',
      can_verify_certificate_number: true
    },
    // CANNOT: access anything else
    restrictions: {
      read_only: true,
      no_application_access: true,
      no_document_access: true,
      no_test_access: true
    }
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all permissions for a specific role
 */
function getRolePermissions(role) {
  return PERMISSIONS[role] || null;
}

/**
 * Check if a role has permission to perform an action on a resource
 */
function hasPermission(role, resource, action, options = {}) {
  const rolePermissions = PERMISSIONS[role];

  if (!rolePermissions) {
    return { allowed: false, reason: 'Invalid role' };
  }

  const resourcePermissions = rolePermissions[resource];

  if (!resourcePermissions) {
    return { allowed: false, reason: 'No access to resource' };
  }

  // Handle simple array of actions
  if (Array.isArray(resourcePermissions.actions)) {
    if (!resourcePermissions.actions.includes(action)) {
      return { allowed: false, reason: 'Action not permitted' };
    }
  }

  // Check scope restrictions
  if (resourcePermissions.scope && options.checkScope) {
    if (resourcePermissions.scope === 'own' && !options.isOwner) {
      return { allowed: false, reason: 'Can only access own resources' };
    }
    if (resourcePermissions.scope === 'assigned' && !options.isAssigned) {
      return { allowed: false, reason: 'Can only access assigned resources' };
    }
  }

  // Check conditions
  if (resourcePermissions.conditions && resourcePermissions.conditions[action]) {
    const conditions = resourcePermissions.conditions[action];
    if (options.checkConditions) {
      // Conditions would be checked here
    }
  }

  // Check restrictions
  if (resourcePermissions.restrictions) {
    const restrictions = resourcePermissions.restrictions;
    if (restrictions[`cannot_${action}`]) {
      return { allowed: false, reason: `Role restricted from ${action}` };
    }
  }

  return { allowed: true };
}

/**
 * Get all actions a role can perform on a resource
 */
function getResourceActions(role, resource) {
  const rolePermissions = PERMISSIONS[role];

  if (!rolePermissions || !rolePermissions[resource]) {
    return [];
  }

  if (Array.isArray(rolePermissions[resource].actions)) {
    return rolePermissions[resource].actions;
  }

  // Handle nested permissions
  const actions = [];
  const resourcePermissions = rolePermissions[resource];

  for (const key in resourcePermissions) {
    if (resourcePermissions[key].actions) {
      actions.push(...resourcePermissions[key].actions);
    }
  }

  return [...new Set(actions)]; // Remove duplicates
}

/**
 * Check if role has any vendor-related permissions (vendor staff)
 */
function isVendorRole(role) {
  return ['vendor_developer', 'vendor_technical_lead', 'vendor_compliance_officer'].includes(role);
}

/**
 * Check if role has DHA staff permissions
 */
function isDHARole(role) {
  return ['dha_system_administrator', 'dha_certification_officer'].includes(role);
}

/**
 * Check if role can approve/vote on certifications
 */
function canApproveCertifications(role) {
  return ['certification_committee_member'].includes(role);
}

/**
 * Get role hierarchy level (for separation of duties)
 */
function getRoleLevel(role) {
  const levels = {
    public_user: 0,
    county_health_officer: 1,
    vendor_developer: 2,
    vendor_technical_lead: 2,
    vendor_compliance_officer: 2,
    testing_lab_staff: 3,
    dha_certification_officer: 4,
    certification_committee_member: 5,
    dha_system_administrator: 6
  };

  return levels[role] || 0;
}

module.exports = {
  PERMISSIONS,
  getRolePermissions,
  hasPermission,
  getResourceActions,
  isVendorRole,
  isDHARole,
  canApproveCertifications,
  getRoleLevel
};
