//  CRITICAL SECURITY FIX: Password Expiry Checking
// SRS Requirements: FR-AUTH-003 (Password Management - 90 day expiry)

const { isPasswordExpired, getDaysUntilExpiry } = require('../utils/passwordSecurity');
const ERROR_CODES = require('../constants/errorCodes');

/**
 * Middleware to check if user's password has expired
 * Should run after authentication but before allowing access
 */
const checkPasswordExpiry = async (req, res, next) => {
  try {
    // Skip if no user (not authenticated)
    if (!req.user) {
      return next();
    }

    // Skip password expiry check for certain routes
    const skipRoutes = [
      '/api/auth/change-password',
      '/api/password/reset',
      '/api/password/verify',
      '/api/auth/logout'
    ];

    if (skipRoutes.includes(req.path)) {
      return next();
    }

    // Check if password has expired
    if (req.user.passwordExpiresAt && isPasswordExpired(req.user.passwordExpiresAt)) {
      const daysOverdue = Math.abs(getDaysUntilExpiry(req.user.passwordExpiresAt));

      return res.status(401).json({
        message: ERROR_CODES.PASSWORD_EXPIRED.message,
        code: ERROR_CODES.PASSWORD_EXPIRED.code,
        requiresPasswordChange: true,
        passwordExpired: true,
        daysOverdue,
        expiryDate: req.user.passwordExpiresAt,
        changePasswordUrl: '/api/auth/change-password'
      });
    }

    // Warn if password is expiring soon (30, 14, 7, 1 days)
    const daysRemaining = getDaysUntilExpiry(req.user.passwordExpiresAt);
    const warningThresholds = [30, 14, 7, 1];

    if (daysRemaining !== null && warningThresholds.includes(daysRemaining)) {
      // Add warning to response headers
      res.setHeader('X-Password-Expiry-Warning', 'true');
      res.setHeader('X-Password-Days-Remaining', daysRemaining.toString());
      res.setHeader('X-Password-Expiry-Date', req.user.passwordExpiresAt.toISOString());
    }

    next();
  } catch (error) {
    console.error('Password expiry check error:', error);
    // Don't block request if check fails
    next();
  }
};

/**
 * Strict password expiry check - blocks access completely if expired
 * Use for sensitive operations
 */
const strictPasswordExpiryCheck = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    if (req.user.passwordExpiresAt && isPasswordExpired(req.user.passwordExpiresAt)) {
      return res.status(401).json({
        message: 'Password has expired. You must change your password to perform this action.',
        code: ERROR_CODES.PASSWORD_EXPIRED.code,
        requiresPasswordChange: true,
        passwordExpired: true
      });
    }

    next();
  } catch (error) {
    console.error('Strict password expiry check error:', error);
    next();
  }
};

module.exports = {
  checkPasswordExpiry,
  strictPasswordExpiryCheck
};
