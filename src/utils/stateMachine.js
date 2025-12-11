//  DHA USER STATE MACHINE
// FR-USER-LIFECYCLE-001: State transition validation
// Enforces valid state transitions and prevents invalid state changes

/**
 * ========================================
 * USER STATE DEFINITIONS
 * ========================================
 */

const USER_STATES = {
  // Initial States
  PENDING_VERIFICATION: 'pending_verification',      // Account created, awaiting email verification
  PENDING_REGISTRATION: 'pending_registration',      // Registration started but not completed
  PENDING_SETUP: 'pending_setup',                    // Account created, needs first-time password setup

  // Active States
  ACTIVE: 'active',                                   // Fully operational account
  ROLE_UPDATE_PENDING: 'role_update_pending',        // Role change in progress

  // Workflow States (Organizations)
  SUBMITTED: 'submitted',                             // Organization application submitted
  UNDER_REVIEW: 'under_review',                      // Under DHA review
  CLARIFICATION: 'clarification',                     // Needs clarification from user
  APPROVED: 'approved',                               // Application approved
  CERTIFIED: 'certified',                             // Fully certified

  // Disabled States
  INACTIVE: 'inactive',                               // Temporarily disabled (can be reactivated)
  SUSPENDED: 'suspended',                             // Temporarily suspended by admin (can appeal)
  TERMINATED: 'terminated',                           // Account ended (can be reactivated by admin)
  CANCELLED: 'cancelled',                             // User-initiated cancellation (can be reactivated)
  DEACTIVATED: 'deactivated',                        // Permanently disabled (cannot be reactivated)
  REJECTED: 'rejected'                                // Application rejected (can reapply)
};

/**
 * ========================================
 * STATE TRANSITION RULES
 * ========================================
 * Defines valid state transitions
 * Format: { fromState: [allowedToStates] }
 */

const STATE_TRANSITIONS = {
  // FROM: pending_verification
  [USER_STATES.PENDING_VERIFICATION]: [
    USER_STATES.ACTIVE,                  // Email verified → active
    USER_STATES.PENDING_SETUP,           // Needs password setup
    USER_STATES.SUSPENDED,               // Account suspended (e.g., failed login attempts)
    USER_STATES.CANCELLED,               // User cancels registration
    USER_STATES.TERMINATED               // Admin terminates unverified account
  ],

  // FROM: pending_registration
  [USER_STATES.PENDING_REGISTRATION]: [
    USER_STATES.PENDING_VERIFICATION,    // Registration completed → needs verification
    USER_STATES.SUBMITTED,               // Organization submits application
    USER_STATES.CANCELLED,               // User cancels registration
    USER_STATES.TERMINATED               // Admin terminates incomplete registration
  ],

  // FROM: pending_setup
  [USER_STATES.PENDING_SETUP]: [
    USER_STATES.ACTIVE,                  // Password setup completed
    USER_STATES.SUSPENDED,               // Account suspended (e.g., failed login attempts)
    USER_STATES.CANCELLED,               // User cancels
    USER_STATES.TERMINATED               // Admin terminates
  ],

  // FROM: active
  [USER_STATES.ACTIVE]: [
    USER_STATES.ROLE_UPDATE_PENDING,     // Role change requested
    USER_STATES.SUBMITTED,               // Organization submits certification
    USER_STATES.INACTIVE,                // User goes inactive
    USER_STATES.SUSPENDED,               // Admin suspends account
    USER_STATES.TERMINATED,              // Admin terminates
    USER_STATES.CANCELLED,               // User cancels account
    USER_STATES.DEACTIVATED             // Admin permanently deactivates
  ],

  // FROM: role_update_pending
  [USER_STATES.ROLE_UPDATE_PENDING]: [
    USER_STATES.ACTIVE,                  // Role change approved/rejected
    USER_STATES.SUSPENDED,               // Admin suspends during role change
    USER_STATES.TERMINATED               // Admin terminates
  ],

  // FROM: submitted
  [USER_STATES.SUBMITTED]: [
    USER_STATES.UNDER_REVIEW,            // DHA starts review
    USER_STATES.REJECTED,                // Application rejected without review
    USER_STATES.CANCELLED,               // User cancels application
    USER_STATES.ACTIVE                   // Rollback to active
  ],

  // FROM: under_review
  [USER_STATES.UNDER_REVIEW]: [
    USER_STATES.CLARIFICATION,           // DHA requests clarification
    USER_STATES.APPROVED,                // Application approved
    USER_STATES.REJECTED,                // Application rejected
    USER_STATES.CANCELLED,               // User cancels during review
    USER_STATES.SUBMITTED                // Rollback to submitted
  ],

  // FROM: clarification
  [USER_STATES.CLARIFICATION]: [
    USER_STATES.UNDER_REVIEW,            // User provides clarification
    USER_STATES.REJECTED,                // Rejected due to insufficient clarification
    USER_STATES.CANCELLED,               // User cancels
    USER_STATES.SUBMITTED                // Rollback to submitted
  ],

  // FROM: approved
  [USER_STATES.APPROVED]: [
    USER_STATES.CERTIFIED,               // Certification issued
    USER_STATES.ACTIVE,                  // Activated without certification
    USER_STATES.REJECTED,                // Approval reversed
    USER_STATES.SUSPENDED,               // Suspended after approval
    USER_STATES.TERMINATED               // Terminated
  ],

  // FROM: certified
  [USER_STATES.CERTIFIED]: [
    USER_STATES.ACTIVE,                  // Certification expires → active
    USER_STATES.SUSPENDED,               // Certification suspended
    USER_STATES.TERMINATED,              // Certification terminated
    USER_STATES.REJECTED                 // Certification revoked
  ],

  // FROM: inactive
  [USER_STATES.INACTIVE]: [
    USER_STATES.ACTIVE,                  // Reactivated
    USER_STATES.SUSPENDED,               // Admin suspends inactive account
    USER_STATES.TERMINATED,              // Admin terminates
    USER_STATES.DEACTIVATED             // Permanently deactivated
  ],

  // FROM: suspended
  [USER_STATES.SUSPENDED]: [
    USER_STATES.ACTIVE,                  // Suspension lifted
    USER_STATES.TERMINATED,              // Admin terminates suspended account
    USER_STATES.DEACTIVATED             // Permanently deactivated
  ],

  // FROM: terminated
  [USER_STATES.TERMINATED]: [
    USER_STATES.ACTIVE,                  // Admin reactivates
    USER_STATES.DEACTIVATED             // Permanently deactivated
  ],

  // FROM: cancelled
  [USER_STATES.CANCELLED]: [
    USER_STATES.ACTIVE,                  // User or admin reactivates
    USER_STATES.PENDING_VERIFICATION,    // Restart verification
    USER_STATES.TERMINATED,              // Admin terminates
    USER_STATES.DEACTIVATED             // Permanently deactivated
  ],

  // FROM: rejected
  [USER_STATES.REJECTED]: [
    USER_STATES.SUBMITTED,               // Resubmit application
    USER_STATES.ACTIVE,                  // Rollback to active
    USER_STATES.TERMINATED,              // Admin terminates
    USER_STATES.CANCELLED                // User cancels
  ],

  // FROM: deactivated (TERMINAL STATE - no transitions allowed)
  [USER_STATES.DEACTIVATED]: []
};

/**
 * ========================================
 * STATE CATEGORIES
 * ========================================
 */

const STATE_CATEGORIES = {
  INITIAL: [
    USER_STATES.PENDING_VERIFICATION,
    USER_STATES.PENDING_REGISTRATION,
    USER_STATES.PENDING_SETUP
  ],
  ACTIVE: [
    USER_STATES.ACTIVE,
    USER_STATES.ROLE_UPDATE_PENDING
  ],
  WORKFLOW: [
    USER_STATES.SUBMITTED,
    USER_STATES.UNDER_REVIEW,
    USER_STATES.CLARIFICATION,
    USER_STATES.APPROVED,
    USER_STATES.CERTIFIED
  ],
  DISABLED: [
    USER_STATES.INACTIVE,
    USER_STATES.SUSPENDED,
    USER_STATES.TERMINATED,
    USER_STATES.CANCELLED,
    USER_STATES.DEACTIVATED,
    USER_STATES.REJECTED
  ],
  TERMINAL: [
    USER_STATES.DEACTIVATED  // Cannot transition from this state
  ]
};

/**
 * ========================================
 * VALIDATION FUNCTIONS
 * ========================================
 */

/**
 * Check if a state transition is valid
 * @param {string} fromState - Current state
 * @param {string} toState - Desired state
 * @returns {Object} { valid: boolean, reason: string }
 */
function isValidTransition(fromState, toState) {
  // Check if states exist
  if (!Object.values(USER_STATES).includes(fromState)) {
    return {
      valid: false,
      reason: `Invalid current state: ${fromState}`
    };
  }

  if (!Object.values(USER_STATES).includes(toState)) {
    return {
      valid: false,
      reason: `Invalid target state: ${toState}`
    };
  }

  // Check if same state (no transition needed)
  if (fromState === toState) {
    return {
      valid: true,
      reason: 'No state change required'
    };
  }

  // Check if transition is allowed
  const allowedTransitions = STATE_TRANSITIONS[fromState] || [];

  if (!allowedTransitions.includes(toState)) {
    return {
      valid: false,
      reason: `Invalid transition from '${fromState}' to '${toState}'. Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`
    };
  }

  return {
    valid: true,
    reason: 'Valid transition'
  };
}

/**
 * Get all valid next states for a given state
 * @param {string} currentState - Current state
 * @returns {string[]} Array of valid next states
 */
function getValidNextStates(currentState) {
  return STATE_TRANSITIONS[currentState] || [];
}

/**
 * Check if a state is terminal (cannot transition from)
 * @param {string} state - State to check
 * @returns {boolean} True if terminal state
 */
function isTerminalState(state) {
  return STATE_CATEGORIES.TERMINAL.includes(state);
}

/**
 * Check if a state allows login
 * @param {string} state - State to check
 * @returns {boolean} True if user can login
 */
function canLogin(state) {
  const loginAllowedStates = [
    USER_STATES.ACTIVE,
    USER_STATES.ROLE_UPDATE_PENDING,
    USER_STATES.SUBMITTED,
    USER_STATES.UNDER_REVIEW,
    USER_STATES.CLARIFICATION,
    USER_STATES.APPROVED,
    USER_STATES.CERTIFIED
  ];

  return loginAllowedStates.includes(state);
}

/**
 * Check if a state is disabled
 * @param {string} state - State to check
 * @returns {boolean} True if account is disabled
 */
function isDisabledState(state) {
  return STATE_CATEGORIES.DISABLED.includes(state);
}

/**
 * Get state category
 * @param {string} state - State to check
 * @returns {string} Category name
 */
function getStateCategory(state) {
  for (const [category, states] of Object.entries(STATE_CATEGORIES)) {
    if (states.includes(state)) {
      return category.toLowerCase();
    }
  }
  return 'unknown';
}

/**
 * Validate state transition with role requirements
 * @param {string} fromState - Current state
 * @param {string} toState - Target state
 * @param {string} userRole - Role of user making the change
 * @returns {Object} { valid: boolean, reason: string }
 */
function validateTransitionWithRole(fromState, toState, userRole) {
  // First check basic transition validity
  const transitionCheck = isValidTransition(fromState, toState);
  if (!transitionCheck.valid) {
    return transitionCheck;
  }

  // Define role requirements for specific transitions
  const roleRequirements = {
    // Only admins can deactivate
    [USER_STATES.DEACTIVATED]: ['dha_system_administrator'],

    // Only admins can suspend
    [USER_STATES.SUSPENDED]: ['dha_system_administrator'],

    // Only admins can terminate
    [USER_STATES.TERMINATED]: ['dha_system_administrator'],

    // Only DHA staff can review
    [USER_STATES.UNDER_REVIEW]: ['dha_certification_officer', 'dha_system_administrator'],

    // Only DHA staff can approve
    [USER_STATES.APPROVED]: ['dha_certification_officer', 'certification_committee_member'],

    // Only DHA staff can certify
    [USER_STATES.CERTIFIED]: ['certification_committee_member', 'dha_certification_officer'],

    // Only DHA staff can reject
    [USER_STATES.REJECTED]: ['dha_certification_officer', 'dha_system_administrator']
  };

  const requiredRoles = roleRequirements[toState];

  if (requiredRoles && !requiredRoles.includes(userRole)) {
    return {
      valid: false,
      reason: `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`
    };
  }

  return {
    valid: true,
    reason: 'Valid transition with appropriate role'
  };
}

/**
 * ========================================
 * STATE TRANSITION MIDDLEWARE
 * ========================================
 */

/**
 * Mongoose pre-save middleware to validate state transitions
 * Add this to User model: userSchema.pre('save', validateStateTransition);
 */
async function validateStateTransition(next) {
  // Only validate if accountStatus is being modified
  if (!this.isModified('accountStatus')) {
    return next();
  }

  // Get original state
  const originalState = this._original?.accountStatus;
  const newState = this.accountStatus;

  // Skip validation for new documents
  if (!originalState) {
    return next();
  }

  // Validate transition
  const validation = isValidTransition(originalState, newState);

  if (!validation.valid) {
    const error = new Error(validation.reason);
    error.name = 'StateTransitionError';
    error.statusCode = 400;
    return next(error);
  }

  next();
}

/**
 * ========================================
 * EXPORTS
 * ========================================
 */

module.exports = {
  USER_STATES,
  STATE_TRANSITIONS,
  STATE_CATEGORIES,
  isValidTransition,
  getValidNextStates,
  isTerminalState,
  canLogin,
  isDisabledState,
  getStateCategory,
  validateTransitionWithRole,
  validateStateTransition
};
