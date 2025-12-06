// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');
const securityEvent = require('../models/securityEvent');
const { logsecurityEvent } = require('../controllers/admin/securityController');

/**
 * Authentication middleware to protect routes
 * Verifies the JWT token from cookies and attaches user to request object
 * Handles user impersonation by admin users and session validation
 */
const protect = async (req, res, next) => {
  const token = req.cookies.token;
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  try {
    // Get system settings first
    const settings = await SystemSettings.getSettings();
    
    // Check maintenance mode first
    if (settings.maintenanceMode) {
      const bypassPaths = ['/api/auth/login', '/api/auth/admin-bypass'];
      
      // Try to decode token early for maintenance bypass check
      let decodedForMaintenance;
      try {
        decodedForMaintenance = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decodedForMaintenance.id).select('role');
        // Allow only admin to bypass maintenance mode
        if (user && user.role === 'admin') {
          // Skip maintenance mode check for admin
        } else if (!bypassPaths.includes(req.path)) {
          return res.status(503).json({
            status: 'maintenance',
            message: settings.maintenanceMessage || 'System is currently under maintenance',
            plannedEnd: settings.plannedMaintenanceEnd
          });
        }
      } catch (err) {
        // If token verification fails, apply maintenance mode restriction
        if (!bypassPaths.includes(req.path)) {
          return res.status(503).json({
            status: 'maintenance',
            message: settings.maintenanceMessage || 'System is currently under maintenance',
            plannedEnd: settings.plannedMaintenanceEnd
          });
        }
      }
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user and exclude sensitive fields
    req.user = await User.findById(decoded.id).select('-password -recoveryKeyHash');
    
    if (!req.user) {
      // Log failed authentication attempt
      await logsecurityEvent({
        userId: decoded.id || null,
        action: 'Authentication Failed',
        ip: clientIP,
        device: req.headers['user-agent'] || 'Unknown',
        details: { reason: 'User not found', tokenId: decoded.id }
      });
      
      return res.status(401).json({ message: 'User not found' });
    }

    // Check token version for session invalidation
    if (decoded.tokenVersion !== undefined && req.user.tokenVersion !== decoded.tokenVersion) {
      await logsecurityEvent({
        userId: req.user._id,
        action: 'Token Version Mismatch',
        ip: clientIP,
        device: req.headers['user-agent'] || 'Unknown',
        details: { 
          tokenVersion: decoded.tokenVersion, 
          currentVersion: req.user.tokenVersion 
        }
      });

      return res.status(401).json({ 
        message: 'Session invalidated. Please login again.',
        code: 'SESSION_INVALIDATED'
      });
    }

    // Validate session exists in user's sessions array
    if (decoded.sessionId) {
      const sessionExists = req.user.sessions.some(session => 
        session.sessionId === decoded.sessionId
      );

      if (!sessionExists) {
        await logsecurityEvent({
          userId: req.user._id,
          action: 'Invalid Session',
          ip: clientIP,
          device: req.headers['user-agent'] || 'Unknown',
          details: { sessionId: decoded.sessionId }
        });

        return res.status(401).json({ 
          message: 'Session not found. Please login again.',
          code: 'SESSION_NOT_FOUND'
        });
      }

      // Update session last activity
      const session = req.user.sessions.find(s => s.sessionId === decoded.sessionId);
      if (session) {
        session.lastActivity = new Date();
        session.ip = clientIP; // Update IP in case it changed
        
        // Check for suspicious IP change
        if (session.ip !== clientIP && !req.user.impersonatedBy) {
          await logsecurityEvent({
            userId: req.user._id,
            action: 'IP Address Changed',
            ip: clientIP,
            device: req.headers['user-agent'] || 'Unknown',
            details: { 
              previousIP: session.ip,
              newIP: clientIP,
              sessionId: decoded.sessionId
            }
          });
        }

        await req.user.save();
      }
    }

    // Check if global 2FA is required or user has enabled 2FA
    // Skip 2FA for Google OAuth users (they have googleId)
    const isGoogleUser = req.user.googleId && req.user.googleId.length > 0;
    const requires2FA = !isGoogleUser && (settings.require2FA || req.user.twoFactorEnabled);

    if (requires2FA && !decoded.twoFactorConfirmed) {
      return res.status(403).json({
        message: '2FA verification required',
        requiresTwoFactor: true,
        code: '2FA_REQUIRED'
      });
    }

    // Handle impersonation if present in token
    if (decoded.impersonatedBy) {
      const adminUser = await User.findById(decoded.impersonatedBy).select('name email role');
      if (!adminUser || adminUser.role !== 'admin') {
        await logsecurityEvent({
          userId: req.user._id,
          action: 'Invalid Impersonation',
          ip: clientIP,
          device: req.headers['user-agent'] || 'Unknown',
          details: { impersonatedBy: decoded.impersonatedBy }
        });

        return res.status(403).json({ message: 'Invalid impersonation token' });
      }

      req.user.impersonatedBy = decoded.impersonatedBy;
      req.user.impersonatedByUser = adminUser;
      res.set('X-Impersonation-Active', 'true');
      res.set('X-Impersonated-By', adminUser.email);
    }
    
    // Check if user is suspended
    if (req.user.suspended && !req.user.impersonatedBy) {
      await logsecurityEvent({
        userId: req.user._id,
        action: 'Suspended User Access Attempt',
        ip: clientIP,
        device: req.headers['user-agent'] || 'Unknown',
        details: { reason: req.user.suspensionReason }
      });

      return res.status(403).json({ 
        message: 'Your account has been suspended', 
        reason: req.user.suspensionReason || 'Contact administrator for details'
      });
    }

    // Check for account lockout due to failed attempts
    if (req.user.accountLockout && req.user.accountLockout.isLocked) {
      const now = new Date();
      if (req.user.accountLockout.lockUntil && req.user.accountLockout.lockUntil > now) {
        await logsecurityEvent({
          userId: req.user._id,
          action: 'Locked Account Access Attempt',
          ip: clientIP,
          device: req.headers['user-agent'] || 'Unknown',
          details: { 
            lockReason: req.user.accountLockout.reason,
            lockUntil: req.user.accountLockout.lockUntil
          }
        });

        return res.status(423).json({
          message: 'Account is temporarily locked',
          lockUntil: req.user.accountLockout.lockUntil,
          reason: req.user.accountLockout.reason
        });
      } else {
        // Lock has expired, clear it
        req.user.accountLockout.isLocked = false;
        req.user.accountLockout.lockUntil = null;
        req.user.accountLockout.failedAttempts = 0;
        await req.user.save();
      }
    }

    // Log successful authentication for audit (only for sensitive routes)
    const sensitiveRoutes = ['/api/admin', '/api/user/delete', '/api/settings'];
    if (sensitiveRoutes.some(route => req.path.startsWith(route))) {
      await logsecurityEvent({
        userId: req.user._id,
        action: 'Sensitive Route Access',
        ip: clientIP,
        device: req.headers['user-agent'] || 'Unknown',
        details: { 
          route: req.path,
          method: req.method,
          impersonation: !!req.user.impersonatedBy
        }
      });
    }
    
    // Attach settings to request for use in routes
    req.systemSettings = settings;
    req.clientIP = clientIP;
    
    next();
  } catch (err) {
    // Log token verification failure
    await logsecurityEvent({
      userId: null,
      action: 'Token Verification Failed',
      ip: clientIP,
      device: req.headers['user-agent'] || 'Unknown',
      details: { error: err.message, tokenPresent: !!token }
    });

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid token format.',
        code: 'INVALID_TOKEN'
      });
    }
    
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

/**
 * Middleware to check if user requires password change on first login
 * Must be used after the protect middleware
 * Allows access to password change endpoint and logout
 */
const checkFirstTimeSetup = async (req, res, next) => {
  try {
    // Skip check for specific routes that should always be accessible
    const allowedRoutes = [
      '/api/auth/first-time-password-change',
      '/api/auth/logout',
      '/api/auth/profile' // Allow profile read for displaying user info
    ];

    // If the current route is in the allowed list, proceed
    if (allowedRoutes.some(route => req.path === route || req.path.startsWith(route))) {
      return next();
    }

    // Check if user has firstTimeSetup flag
    if (req.user && req.user.firstTimeSetup === true) {
      return res.status(403).json({
        success: false,
        message: 'You must change your temporary password before accessing the system.',
        code: 'FIRST_TIME_SETUP_REQUIRED',
        requirePasswordChange: true
      });
    }

    // User doesn't need to change password, proceed
    next();
  } catch (error) {
    console.error('First-time setup check error:', error);
    next(); // Don't block on errors, just proceed
  }
};

/**
 * Admin-only middleware
 * Checks if the authenticated user has admin role
 * Must be used after the protect middleware
 * @deprecated Use RBAC middleware from rbac.js instead
 */
const adminOnly = async (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    // Log unauthorized admin access attempt
    if (req.user) {
      await logsecurityEvent({
        userId: req.user._id,
        action: 'Unauthorized Admin Access',
        ip: req.clientIP || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip,
        device: req.headers['user-agent'] || 'Unknown',
        details: { 
          attemptedRoute: req.path,
          userRole: req.user.role
        }
      });
    }
    
    return res.status(403).json({ message: 'Access denied. Admins only.' });
  }
  next();
};

/**
 * Staff access middleware (admin, support, and reviewer roles)
 * Checks if the authenticated user has admin, support, or reviewer role
 * Must be used after the protect middleware
 */
const staffOnly = async (req, res, next) => {
  if (!req.user || !['admin', 'support', 'reviewer'].includes(req.user.role)) {
    // Log unauthorized staff access attempt
    if (req.user) {
      await logsecurityEvent({
        userId: req.user._id,
        action: 'Unauthorized Staff Access',
        ip: req.clientIP || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip,
        device: req.headers['user-agent'] || 'Unknown',
        details: { 
          attemptedRoute: req.path,
          userRole: req.user.role
        }
      });
    }
    
    return res.status(403).json({ message: 'Access denied. Staff only.' });
  }
  next();
};

/**
 * Reviewer access middleware (admin and reviewer roles)
 * Checks if the authenticated user has admin or reviewer role
 * Must be used after the protect middleware
 */
const reviewerOnly = async (req, res, next) => {
  if (!req.user || !['admin', 'reviewer'].includes(req.user.role)) {
    // Log unauthorized reviewer access attempt
    if (req.user) {
      await logsecurityEvent({
        userId: req.user._id,
        action: 'Unauthorized Reviewer Access',
        ip: req.clientIP || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip,
        device: req.headers['user-agent'] || 'Unknown',
        details: { 
          attemptedRoute: req.path,
          userRole: req.user.role
        }
      });
    }
    
    return res.status(403).json({ message: 'Access denied. Reviewer access required.' });
  }
  next();
};

/**
 * Role-based access middleware
 * Checks if user has one of the allowed roles
 * @param {Array} roles - Array of allowed roles
 * @returns {Function} Middleware function
 */
const hasRole = (roles) => {
  return async (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      // Log unauthorized role access attempt
      if (req.user) {
        await logsecurityEvent({
          userId: req.user._id,
          action: 'Unauthorized Role Access',
          ip: req.clientIP || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip,
          device: req.headers['user-agent'] || 'Unknown',
          details: { 
            attemptedRoute: req.path,
            userRole: req.user.role,
            requiredRoles: roles
          }
        });
      }
      
      return res.status(403).json({ 
        message: `Access denied. Required role: ${roles.join(' or ')}.` 
      });
    }
    next();
  };
};

/**
 * Board member access middleware
 * Checks if user has board member roles (chairperson, secretary, treasurer, etc.)
 */
const boardMemberOnly = async (req, res, next) => {
  const boardRoles = [
    'chairperson',
    'vice_chairperson', 
    'secretary',
    'treasurer',
    'board_member',
    'patron',
    'advisor'
  ];

  if (!req.user || (!boardRoles.includes(req.user.role) && req.user.role !== 'admin')) {
    // Log unauthorized board access attempt
    if (req.user) {
      await logsecurityEvent({
        userId: req.user._id,
        action: 'Unauthorized Board Access',
        ip: req.clientIP || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip,
        device: req.headers['user-agent'] || 'Unknown',
        details: { 
          attemptedRoute: req.path,
          userRole: req.user.role,
          requiredRoles: boardRoles
        }
      });
    }
    
    return res.status(403).json({ 
      message: 'Access denied. Board member access required.' 
    });
  }
  next();
};

/**
 * Management access middleware
 * Checks if user has management roles (ceo, director, manager, etc.)
 */
const managementOnly = async (req, res, next) => {
  const managementRoles = [
    'ceo',
    'director', 
    'manager',
    'coordinator',
    'chairperson' // Board chairperson also has management access
  ];

  if (!req.user || (!managementRoles.includes(req.user.role) && req.user.role !== 'admin')) {
    // Log unauthorized management access attempt
    if (req.user) {
      await logsecurityEvent({
        userId: req.user._id,
        action: 'Unauthorized Management Access',
        ip: req.clientIP || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip,
        device: req.headers['user-agent'] || 'Unknown',
        details: { 
          attemptedRoute: req.path,
          userRole: req.user.role,
          requiredRoles: managementRoles
        }
      });
    }
    
    return res.status(403).json({ 
      message: 'Access denied. Management access required.' 
    });
  }
  next();
};

/**
 * Department-specific access middleware
 * Checks if user has department-specific roles
 */
const departmentOnly = (departments) => {
  return async (req, res, next) => {
    const departmentRoles = {
      hr: ['hr', 'manager', 'director', 'ceo'],
      finance: ['finance', 'treasurer', 'manager', 'director', 'ceo'],
      operations: ['operations', 'manager', 'director', 'ceo'],
      marketing: ['marketing', 'manager', 'director', 'ceo'],
      it: ['it', 'manager', 'director', 'ceo'],
      legal: ['legal', 'secretary', 'manager', 'director', 'ceo'],
      programs: ['programs', 'coordinator', 'manager', 'director', 'ceo'],
      communications: ['communications', 'secretary', 'manager', 'director', 'ceo']
    };

    const allowedRoles = departments.flatMap(dept => departmentRoles[dept] || []);
    allowedRoles.push('admin'); // Admin always has access

    if (!req.user || !allowedRoles.includes(req.user.role)) {
      // Log unauthorized department access attempt
      if (req.user) {
        await logsecurityEvent({
          userId: req.user._id,
          action: 'Unauthorized Department Access',
          ip: req.clientIP || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip,
          device: req.headers['user-agent'] || 'Unknown',
          details: { 
            attemptedRoute: req.path,
            userRole: req.user.role,
            requiredDepartments: departments,
            allowedRoles
          }
        });
      }
      
      return res.status(403).json({ 
        message: `Access denied. Required department access: ${departments.join(' or ')}.` 
      });
    }
    next();
  };
};

/**
 * Organization account access middleware
 * Checks if user account type is organization
 */
const organizationOnly = async (req, res, next) => {
  if (!req.user || (req.user.type !== 'organization' && req.user.role !== 'admin')) {
    // Log unauthorized organization access attempt
    if (req.user) {
      await logsecurityEvent({
        userId: req.user._id,
        action: 'Unauthorized Organization Access',
        ip: req.clientIP || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip,
        device: req.headers['user-agent'] || 'Unknown',
        details: { 
          attemptedRoute: req.path,
          userType: req.user.type,
          userRole: req.user.role
        }
      });
    }
    
    return res.status(403).json({ 
      message: 'Access denied. Organization account required.' 
    });
  }
  next();
};

/**
 * Individual account access middleware
 * Checks if user account type is individual
 */
const individualOnly = async (req, res, next) => {
  if (!req.user || (req.user.type !== 'individual' && req.user.role !== 'admin')) {
    // Log unauthorized individual access attempt
    if (req.user) {
      await logsecurityEvent({
        userId: req.user._id,
        action: 'Unauthorized Individual Access',
        ip: req.clientIP || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip,
        device: req.headers['user-agent'] || 'Unknown',
        details: { 
          attemptedRoute: req.path,
          userType: req.user.type,
          userRole: req.user.role
        }
      });
    }
    
    return res.status(403).json({ 
      message: 'Access denied. Individual account required.' 
    });
  }
  next();
};

/**
 * Internal service access middleware
 * Validates requests from internal services
 */
const internalServiceOnly = async (req, res, next) => {
  const serviceHeader = req.headers['x-service'];
  const allowedServices = ['governance-leadership', 'finance-management', 'project-management'];

  if (!serviceHeader || !allowedServices.includes(serviceHeader)) {
    await logsecurityEvent({
      userId: null,
      action: 'Unauthorized Internal Service Access',
      ip: req.clientIP || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip,
      device: req.headers['user-agent'] || 'Unknown',
      details: { 
        attemptedRoute: req.path,
        serviceHeader,
        allowedServices
      }
    });

    return res.status(403).json({ 
      message: 'Access denied. Internal service access required.',
      code: 'INTERNAL_SERVICE_REQUIRED'
    });
  }
  
  req.callingService = serviceHeader;
  next();
};

/**
 * Session validation middleware
 * Validates that the session is still active and hasn't expired
 */
const validateSession = async (req, res, next) => {
  if (!req.user) {
    return next();
  }

  try {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.sessionId) {
      const session = req.user.sessions.find(s => s.sessionId === decoded.sessionId);
      
      if (session) {
        // Check session timeout (default 30 minutes of inactivity)
        const sessionTimeout = req.systemSettings?.sessionTimeout || 30 * 60 * 1000;
        const timeSinceLastActivity = Date.now() - session.lastActivity.getTime();
        
        if (timeSinceLastActivity > sessionTimeout) {
          // Remove expired session
          req.user.sessions = req.user.sessions.filter(s => s.sessionId !== decoded.sessionId);
          await req.user.save();

          await logsecurityEvent({
            userId: req.user._id,
            action: 'Session Expired',
            ip: req.clientIP,
            device: req.headers['user-agent'] || 'Unknown',
            details: { 
              sessionId: decoded.sessionId,
              inactiveTime: timeSinceLastActivity
            }
          });

          return res.status(401).json({ 
            message: 'Session expired due to inactivity. Please login again.',
            code: 'SESSION_EXPIRED'
          });
        }
      }
    }

    next();
  } catch (error) {
    console.error('Session validation error:', error);
    next();
  }
};

// Add all middleware functions to the protect object for export
protect.checkFirstTimeSetup = checkFirstTimeSetup;
protect.adminOnly = adminOnly;
protect.staffOnly = staffOnly;
protect.reviewerOnly = reviewerOnly;
protect.hasRole = hasRole;
protect.validateSession = validateSession;
protect.boardMemberOnly = boardMemberOnly;
protect.managementOnly = managementOnly;
protect.departmentOnly = departmentOnly;
protect.organizationOnly = organizationOnly;
protect.individualOnly = individualOnly;
protect.internalServiceOnly = internalServiceOnly;

module.exports = protect;