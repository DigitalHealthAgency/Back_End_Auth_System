// ✅ DHA RBAC PERMISSION MIDDLEWARE
// FR-RBAC-002: Permission checking and enforcement
// Replaces legacy adminOnly, staffOnly, hasRole functions

const { hasPermission: checkPermission, getRolePermissions, getResourceActions } = require('../config/permissions');
const ERROR_CODES = require('../constants/errorCodes');

/**
 * Main permission checking middleware
 * Usage: hasPermission('applications', 'create', { checkScope: true })
 */
const hasPermission = (resource, action, options = {}) => {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH-001'
        });
      }

      const userRole = req.user.role;
      const userId = req.user._id;

      // Get role permissions
      const rolePermissions = getRolePermissions(userRole);

      if (!rolePermissions) {
        return res.status(403).json({
          message: 'Invalid role assigned to user',
          code: 'AUTHZ-001',
          details: { role: userRole }
        });
      }

      // Prepare permission check options
      const checkOptions = { ...options };

      // Check ownership if required
      if (options.checkOwnership && req.params.id) {
        checkOptions.isOwner = await isResourceOwner(userId, resource, req.params.id);
      }

      // Check assignment if required
      if (options.checkAssignment && req.params.id) {
        checkOptions.isAssigned = await isResourceAssigned(userId, resource, req.params.id);
      }

      // Check organization scope for vendor roles
      if (options.checkOrgScope) {
        checkOptions.organizationId = req.user.organizationId;
        checkOptions.resourceOrgId = await getResourceOrganization(resource, req.params.id);

        if (checkOptions.organizationId && checkOptions.resourceOrgId) {
          checkOptions.isOwner = checkOptions.organizationId.toString() === checkOptions.resourceOrgId.toString();
        }
      }

      // Perform permission check
      const permissionResult = checkPermission(userRole, resource, action, checkOptions);

      if (!permissionResult.allowed) {
        return res.status(403).json({
          message: 'Insufficient permissions',
          code: 'AUTHZ-001',
          details: {
            required: `${resource}:${action}`,
            reason: permissionResult.reason,
            userRole
          }
        });
      }

      // Check conditional permissions
      if (options.checkConditions && permissionResult.conditions) {
        const conditionsPass = await checkConditions(permissionResult.conditions, req);

        if (!conditionsPass.passed) {
          return res.status(403).json({
            message: 'Conditions not met for this action',
            code: 'AUTHZ-002',
            details: {
              failedConditions: conditionsPass.failed
            }
          });
        }
      }

      // Permission granted - attach permission info to request
      req.permissionGranted = {
        resource,
        action,
        role: userRole,
        scope: checkOptions.scope || 'all'
      };

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        message: 'Permission check failed',
        code: 'SYS-001',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

/**
 * Check if user can perform ANY of the specified actions
 * Usage: hasAnyPermission('applications', ['read', 'update'])
 */
const hasAnyPermission = (resource, actions, options = {}) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH-001'
      });
    }

    const userRole = req.user.role;
    const allowedActions = getResourceActions(userRole, resource);

    const hasAny = actions.some(action => allowedActions.includes(action));

    if (!hasAny) {
      return res.status(403).json({
        message: 'Insufficient permissions',
        code: 'AUTHZ-001',
        details: {
          required: `${resource}:[${actions.join(', ')}]`,
          userRole
        }
      });
    }

    next();
  };
};

/**
 * Check if user can perform ALL of the specified actions
 * Usage: hasAllPermissions('applications', ['read', 'update', 'delete'])
 */
const hasAllPermissions = (resource, actions, options = {}) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH-001'
      });
    }

    const userRole = req.user.role;
    const allowedActions = getResourceActions(userRole, resource);

    const hasAll = actions.every(action => allowedActions.includes(action));

    if (!hasAll) {
      const missing = actions.filter(action => !allowedActions.includes(action));

      return res.status(403).json({
        message: 'Insufficient permissions',
        code: 'AUTHZ-001',
        details: {
          required: `${resource}:[${actions.join(', ')}]`,
          missing: missing,
          userRole
        }
      });
    }

    next();
  };
};

/**
 * Require specific role(s)
 * Usage: requireRole('dha_system_administrator')
 * Usage: requireRole(['dha_certification_officer', 'testing_lab_staff'])
 */
const requireRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH-001'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Role not authorized for this action',
        code: 'AUTHZ-001',
        details: {
          required: allowedRoles,
          current: req.user.role
        }
      });
    }

    next();
  };
};

/**
 * Check if user is vendor staff (any vendor role)
 */
const requireVendorRole = () => {
  return requireRole(['vendor_developer', 'vendor_technical_lead', 'vendor_compliance_officer']);
};

/**
 * Check if user is DHA staff (any DHA role)
 */
const requireDHARole = () => {
  return requireRole(['dha_system_administrator', 'dha_certification_officer']);
};

/**
 * Scope filter middleware - filters results based on role scope
 * Automatically filters query results to only show resources user can access
 */
const applyScopeFilter = (resource) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH-001'
      });
    }

    const userRole = req.user.role;
    const rolePermissions = getRolePermissions(userRole);

    if (!rolePermissions || !rolePermissions[resource]) {
      return res.status(403).json({
        message: 'No access to this resource',
        code: 'AUTHZ-001'
      });
    }

    const resourcePermissions = rolePermissions[resource];
    const scope = resourcePermissions.scope;

    // Build scope filter for database query
    req.scopeFilter = {};

    switch (scope) {
      case 'own':
        // Vendor roles - filter by organization
        if (req.user.organizationId) {
          req.scopeFilter.organizationId = req.user.organizationId;
        } else {
          req.scopeFilter.createdBy = req.user._id;
        }
        break;

      case 'assigned':
        // Testing lab / Certification officer - filter by assignments
        req.scopeFilter.$or = [
          { assignedTo: req.user._id },
          { assignedTeam: { $in: req.user.teams || [] } }
        ];
        break;

      case 'county':
        // County health officer - filter by county
        if (req.user.county) {
          req.scopeFilter.county = req.user.county;
        }
        break;

      case 'certified_only':
        // Public users - only certified/approved items
        req.scopeFilter.status = { $in: ['approved', 'certified'] };
        break;

      case 'all':
        // No filter - can see everything
        break;

      default:
        // Unknown scope - deny access
        return res.status(403).json({
          message: 'Invalid scope configuration',
          code: 'AUTHZ-003'
        });
    }

    next();
  };
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if user owns a resource
 */
async function isResourceOwner(userId, resource, resourceId) {
  try {
    const Model = getModelForResource(resource);
    if (!Model) return false;

    const doc = await Model.findById(resourceId);
    if (!doc) return false;

    // Check direct ownership
    if (doc.createdBy && doc.createdBy.toString() === userId.toString()) {
      return true;
    }

    // Check organization ownership
    if (doc.organizationId && req.user.organizationId) {
      return doc.organizationId.toString() === req.user.organizationId.toString();
    }

    return false;
  } catch (error) {
    console.error('Ownership check error:', error);
    return false;
  }
}

/**
 * Check if resource is assigned to user
 */
async function isResourceAssigned(userId, resource, resourceId) {
  try {
    const Model = getModelForResource(resource);
    if (!Model) return false;

    const doc = await Model.findById(resourceId);
    if (!doc) return false;

    // Check if assigned to user
    if (doc.assignedTo && doc.assignedTo.toString() === userId.toString()) {
      return true;
    }

    // Check if assigned to user's team
    if (doc.assignedTeam && req.user.teams) {
      return req.user.teams.includes(doc.assignedTeam.toString());
    }

    return false;
  } catch (error) {
    console.error('Assignment check error:', error);
    return false;
  }
}

/**
 * Get organization ID for a resource
 */
async function getResourceOrganization(resource, resourceId) {
  try {
    const Model = getModelForResource(resource);
    if (!Model) return null;

    const doc = await Model.findById(resourceId).select('organizationId');
    return doc ? doc.organizationId : null;
  } catch (error) {
    console.error('Organization fetch error:', error);
    return null;
  }
}

/**
 * Get Mongoose model for resource type
 */
function getModelForResource(resource) {
  const modelMap = {
    applications: require('../models/Application'),
    documents: require('../models/Document'),
    tests: require('../models/Test'),
    users: require('../models/User'),
    // Add other models as needed
  };

  return modelMap[resource] || null;
}

/**
 * Check conditional permissions
 */
async function checkConditions(conditions, req) {
  const failed = [];

  for (const [condition, value] of Object.entries(conditions)) {
    switch (condition) {
      case 'max_draft_applications':
        // Check if user has too many draft applications
        const draftCount = await countUserDrafts(req.user._id);
        if (draftCount >= value) {
          failed.push({ condition, current: draftCount, max: value });
        }
        break;

      case 'allowed_statuses':
        // Check if resource is in allowed status
        if (req.params.id) {
          const resourceStatus = await getResourceStatus(req.params.id);
          if (!value.includes(resourceStatus)) {
            failed.push({ condition, current: resourceStatus, allowed: value });
          }
        }
        break;

      case 'require_all_tests_passed':
        // Check if all tests have passed
        if (req.params.id) {
          const allTestsPassed = await checkAllTestsPassed(req.params.id);
          if (!allTestsPassed) {
            failed.push({ condition, value });
          }
        }
        break;

      // Add more condition checks as needed
    }
  }

  return {
    passed: failed.length === 0,
    failed
  };
}

/**
 * Count user's draft applications
 */
async function countUserDrafts(userId) {
  const Application = require('../models/Application');
  return await Application.countDocuments({
    createdBy: userId,
    status: 'draft'
  });
}

/**
 * Get resource status
 */
async function getResourceStatus(resourceId) {
  const Application = require('../models/Application');
  const doc = await Application.findById(resourceId).select('status');
  return doc ? doc.status : null;
}

/**
 * Check if all tests passed for an application
 */
async function checkAllTestsPassed(applicationId) {
  const Test = require('../models/Test');
  const failedTests = await Test.countDocuments({
    applicationId,
    status: { $in: ['failed', 'pending'] }
  });
  return failedTests === 0;
}

module.exports = {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  requireRole,
  requireVendorRole,
  requireDHARole,
  applyScopeFilter
};
