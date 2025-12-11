//  DHA STATE TRANSITION MIDDLEWARE
// FR-USER-LIFECYCLE-001: Enforce state transition validation in API routes
// Validates state changes before they are applied

const {
  isValidTransition,
  validateTransitionWithRole,
  canLogin,
  isTerminalState,
  getValidNextStates
} = require('../utils/stateMachine');

/**
 * ========================================
 * STATE TRANSITION VALIDATION MIDDLEWARE
 * ========================================
 */

/**
 * Validate state transition in request body
 * Use this middleware on routes that update accountStatus
 */
const validateStateChange = async (req, res, next) => {
  try {
    const { accountStatus: newStatus } = req.body;

    // If accountStatus is not being changed, skip validation
    if (!newStatus) {
      return next();
    }

    // Get target user
    const userId = req.params.userId || req.params.id || req.user._id;
    const User = require('../models/User');
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currentStatus = user.accountStatus;

    // Validate transition
    const validation = validateTransitionWithRole(
      currentStatus,
      newStatus,
      req.user.role
    );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid state transition',
        details: {
          currentState: currentStatus,
          attemptedState: newStatus,
          reason: validation.reason,
          allowedStates: getValidNextStates(currentStatus)
        }
      });
    }

    // Attach validation result to request for audit logging
    req.stateTransition = {
      from: currentStatus,
      to: newStatus,
      valid: true
    };

    next();
  } catch (error) {
    console.error('State validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'State validation failed',
      error: error.message
    });
  }
};

/**
 * Check if user's account status allows login
 * Use this in authentication middleware
 */
const enforceLoginStatus = (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user's state allows login
    if (!canLogin(user.accountStatus)) {
      return res.status(403).json({
        success: false,
        message: `Account cannot login in current state: ${user.accountStatus}`,
        accountStatus: user.accountStatus,
        details: {
          suspended: user.accountStatus === 'suspended',
          terminated: user.accountStatus === 'terminated',
          deactivated: user.accountStatus === 'deactivated',
          needsVerification: user.accountStatus === 'pending_verification',
          needsSetup: user.accountStatus === 'pending_setup'
        }
      });
    }

    next();
  } catch (error) {
    console.error('Login status check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login status check failed',
      error: error.message
    });
  }
};

/**
 * Prevent operations on terminal states
 * Use this to prevent modifications to permanently deactivated accounts
 */
const preventTerminalStateModification = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.params.id || req.body.userId;

    if (!userId) {
      return next();
    }

    const User = require('../models/User');
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (isTerminalState(user.accountStatus)) {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify account in terminal state',
        accountStatus: user.accountStatus,
        details: {
          reason: 'Account is permanently deactivated and cannot be modified'
        }
      });
    }

    next();
  } catch (error) {
    console.error('Terminal state check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terminal state check failed',
      error: error.message
    });
  }
};

/**
 * Get available state transitions for current user
 * Useful for showing available actions in UI
 */
const getAvailableTransitions = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    const User = require('../models/User');
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const validStates = getValidNextStates(user.accountStatus);

    // Filter by role permissions
    const allowedStates = validStates.filter(state => {
      const validation = validateTransitionWithRole(
        user.accountStatus,
        state,
        req.user.role
      );
      return validation.valid;
    });

    res.status(200).json({
      success: true,
      data: {
        currentState: user.accountStatus,
        availableTransitions: allowedStates,
        isTerminal: isTerminalState(user.accountStatus),
        canLogin: canLogin(user.accountStatus)
      }
    });
  } catch (error) {
    console.error('Get available transitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available transitions',
      error: error.message
    });
  }
};

/**
 * ========================================
 * ROLE-BASED STATE TRANSITION CHECKS
 * ========================================
 */

/**
 * Check if user has permission to change state
 */
const canChangeState = (fromState, toState, userRole) => {
  const validation = validateTransitionWithRole(fromState, toState, userRole);
  return validation.valid;
};

/**
 * Middleware to check if user can suspend accounts
 */
const canSuspendAccounts = (req, res, next) => {
  if (req.user.role !== 'dha_system_administrator') {
    return res.status(403).json({
      success: false,
      message: 'Only system administrators can suspend accounts'
    });
  }
  next();
};

/**
 * Middleware to check if user can deactivate accounts
 */
const canDeactivateAccounts = (req, res, next) => {
  if (req.user.role !== 'dha_system_administrator') {
    return res.status(403).json({
      success: false,
      message: 'Only system administrators can permanently deactivate accounts'
    });
  }
  next();
};

/**
 * ========================================
 * EXPORTS
 * ========================================
 */

module.exports = {
  validateStateChange,
  enforceLoginStatus,
  preventTerminalStateModification,
  getAvailableTransitions,
  canChangeState,
  canSuspendAccounts,
  canDeactivateAccounts
};
