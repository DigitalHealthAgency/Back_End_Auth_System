// src/middleware/rbac.js
//  ROLE-BASED ACCESS CONTROL (RBAC) MIDDLEWARE
// Enforces permission-based access control for Kenya DHA Certification System

const {
  PERMISSIONS,
  hasPermission,
  isVendorRole,
  isDHARole,
  isAdminRole,
  canAccessResource
} = require('../constants/roles');

/**
 * ========================================
 * CORE RBAC MIDDLEWARE
 * ========================================
 */

/**
 * Check if user has required permission
 * @param {string|string[]} requiredPermissions - Single permission or array of permissions (OR logic)
 */
function requirePermission(requiredPermissions) {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!user.role) {
        return res.status(403).json({
          success: false,
          message: 'No role assigned to user. Please contact DHA administrator.'
        });
      }

      // Convert to array for uniform processing
      const permissions = Array.isArray(requiredPermissions)
        ? requiredPermissions
        : [requiredPermissions];

      // Check if user has ANY of the required permissions (OR logic)
      const hasAnyPermission = permissions.some(permission =>
        hasPermission(user.role, permission)
      );

      if (!hasAnyPermission) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
          required: permissions,
          userRole: user.role
        });
      }

      next();
    } catch (error) {
      console.error('RBAC Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed',
        error: error.message
      });
    }
  };
}

/**
 * Check if user has ALL required permissions (AND logic)
 * @param {string[]} requiredPermissions - Array of permissions (all required)
 */
function requireAllPermissions(requiredPermissions) {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!user.role) {
        return res.status(403).json({
          success: false,
          message: 'No role assigned to user'
        });
      }

      // Check if user has ALL required permissions
      const hasAllPermissions = requiredPermissions.every(permission =>
        hasPermission(user.role, permission)
      );

      if (!hasAllPermissions) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Missing required permissions.',
          required: requiredPermissions,
          userRole: user.role
        });
      }

      next();
    } catch (error) {
      console.error('RBAC Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed',
        error: error.message
      });
    }
  };
}

/**
 * ========================================
 * ROLE-BASED MIDDLEWARE
 * ========================================
 */

/**
 * Require user to have specific role(s)
 * @param {string|string[]} allowedRoles - Single role or array of allowed roles
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      if (!roles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient role.',
          allowed: roles,
          userRole: user.role
        });
      }

      next();
    } catch (error) {
      console.error('Role Check Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Role check failed',
        error: error.message
      });
    }
  };
}

/**
 * ========================================
 * VENDOR-SPECIFIC MIDDLEWARE
 * ========================================
 */

/**
 * Ensure user is a vendor (any vendor role)
 */
function requireVendorRole() {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!isVendorRole(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Vendor role required.',
          userRole: user.role
        });
      }

      next();
    } catch (error) {
      console.error('Vendor Role Check Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Vendor role check failed',
        error: error.message
      });
    }
  };
}

/**
 * ========================================
 * DHA-SPECIFIC MIDDLEWARE
 * ========================================
 */

/**
 * Ensure user is a DHA staff member
 */
function requireDHARole() {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!isDHARole(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. DHA staff role required.',
          userRole: user.role
        });
      }

      next();
    } catch (error) {
      console.error('DHA Role Check Error:', error);
      return res.status(500).json({
        success: false,
        message: 'DHA role check failed',
        error: error.message
      });
    }
  };
}

/**
 * Ensure user is a DHA System Administrator
 */
function requireAdminRole() {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!isAdminRole(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. System administrator role required.',
          userRole: user.role
        });
      }

      next();
    } catch (error) {
      console.error('Admin Role Check Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Admin role check failed',
        error: error.message
      });
    }
  };
}

/**
 * ========================================
 * RESOURCE OWNERSHIP MIDDLEWARE
 * ========================================
 */

/**
 * Check if user can access a specific resource
 * For vendors: Can only access their own resources
 * For DHA staff: Can access all resources
 * @param {function} getResourceOwnerId - Function to extract resource owner ID from request
 */
function requireResourceAccess(getResourceOwnerId) {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // DHA roles can access all resources
      if (isDHARole(user.role)) {
        return next();
      }

      // Get resource owner ID
      const resourceOwnerId = await getResourceOwnerId(req);

      if (!resourceOwnerId) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }

      // Check if user can access this resource
      const canAccess = canAccessResource(user.role, resourceOwnerId, user._id.toString());

      if (!canAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only access your own resources.'
        });
      }

      next();
    } catch (error) {
      console.error('Resource Access Check Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Resource access check failed',
        error: error.message
      });
    }
  };
}

/**
 * Ensure user can only access their own data
 * Compares user ID from token with user ID from request params
 */
function requireSelfOrAdmin() {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Admins can access any user data
      if (isAdminRole(user.role)) {
        return next();
      }

      // Get target user ID from request params
      const targetUserId = req.params.userId || req.params.id;

      // Check if user is accessing their own data
      if (user._id.toString() !== targetUserId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only access your own data.'
        });
      }

      next();
    } catch (error) {
      console.error('Self Access Check Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Access check failed',
        error: error.message
      });
    }
  };
}

/**
 * ========================================
 * AUDIT LOGGING MIDDLEWARE
 * ========================================
 */

/**
 * Log sensitive operations for audit trail
 * @param {string} action - Action being performed
 */
function auditLog(action) {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (user) {
        console.log(`[AUDIT] ${new Date().toISOString()} - User: ${user._id} (${user.role}) - Action: ${action} - IP: ${req.ip}`);

        // TODO: Save to audit log collection in database
        // AuditLog.create({
        //   userId: user._id,
        //   role: user.role,
        //   action,
        //   ip: req.ip,
        //   timestamp: new Date()
        // });
      }

      next();
    } catch (error) {
      console.error('Audit Log Error:', error);
      // Don't block request if audit logging fails
      next();
    }
  };
}

/**
 * ========================================
 * EXPORTS
 * ========================================
 */

module.exports = {
  // Core RBAC
  requirePermission,
  requireAllPermissions,
  requireRole,

  // Role-specific
  requireVendorRole,
  requireDHARole,
  requireAdminRole,

  // Resource ownership
  requireResourceAccess,
  requireSelfOrAdmin,

  // Audit
  auditLog,

  // Permission constants for easy import
  PERMISSIONS
};
