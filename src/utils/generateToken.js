// src/utils/generateToken.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Generate JWT token with enhanced security features
 * @param {string} userId - User ID
 * @param {boolean} twoFactorConfirmed - Whether 2FA is confirmed
 * @param {Object} options - Additional options
 * @param {string} options.sessionId - Session ID for session tracking
 * @param {number} options.tokenVersion - Token version for invalidation
 * @param {string} options.impersonatedBy - Admin ID if impersonating
 * @param {string} options.expiresIn - Token expiration time
 * @param {Object} options.deviceInfo - Device information
 * @param {string} options.ip - Client IP address
 * @returns {string} JWT token
 */
const generateToken = (userId, twoFactorConfirmed = false, options = {}) => {
  const {
    sessionId = generateSessionId(),
    tokenVersion = 0,
    impersonatedBy = null,
    expiresIn = '7d',
    deviceInfo = {},
    ip = null,
    twoFactorConfirmed: twoFactorConfirmedOption
  } = options;

  // Allow options.twoFactorConfirmed to override parameter if explicitly set
  const finalTwoFactorConfirmed = twoFactorConfirmedOption !== undefined
    ? twoFactorConfirmedOption
    : twoFactorConfirmed;

  const payload = {
    id: userId,
    twoFactorConfirmed: finalTwoFactorConfirmed,
    sessionId,
    tokenVersion,
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomBytes(16).toString('hex') // JWT ID for token tracking
  };

  // Add impersonation info if present
  if (impersonatedBy) {
    payload.impersonatedBy = impersonatedBy;
  }

  // Add device fingerprint for additional security
  if (deviceInfo.userAgent || ip) {
    payload.deviceFingerprint = generateDeviceFingerprint({
      userAgent: deviceInfo.userAgent,
      ip: ip
    });
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn,
    issuer: 'Prezio', // Fixed: Made consistent with other functions
    audience: 'prezio-users' // Fixed: Made consistent with other functions
  });
};

/**
 * Generate a unique session ID
 * @returns {string} Session ID
 */
const generateSessionId = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate device fingerprint for additional security
 * @param {Object} deviceInfo - Device information
 * @param {string} deviceInfo.userAgent - User agent string
 * @param {string} deviceInfo.ip - IP address
 * @returns {string} Device fingerprint hash
 */
const generateDeviceFingerprint = (deviceInfo) => {
  const { userAgent = '', ip = '' } = deviceInfo;
  
  // Create a hash from device characteristics
  const fingerprintData = [
    userAgent,
    ip.split('.').slice(0, 3).join('.') // Use first 3 octets for some IP flexibility
  ].join('|');

  return crypto.createHash('sha256').update(fingerprintData).digest('hex');
};

/**
 * Generate admin impersonation token
 * @param {string} targetUserId - User being impersonated
 * @param {string} adminUserId - Admin performing impersonation
 * @param {Object} options - Additional options
 * @returns {string} Impersonation token
 */
const generateImpersonationToken = (targetUserId, adminUserId, options = {}) => {
  return generateToken(targetUserId, true, {
    ...options,
    impersonatedBy: adminUserId,
    expiresIn: options.expiresIn || '2h' // Shorter expiration for impersonation
  });
};

/**
 * Generate 2FA verification token
 * @param {string} userId - User ID
 * @param {Object} options - Additional options
 * @returns {string} 2FA token (short-lived)
 */
const generate2FAToken = (userId, options = {}) => {
  return generateToken(userId, false, {
    ...options,
    expiresIn: '10m' // Short expiration for 2FA verification
  });
};

/**
 * Generate refresh token
 * @param {string} userId - User ID
 * @param {Object} options - Additional options
 * @returns {string} Refresh token (long-lived)
 */
const generateRefreshToken = (userId, options = {}) => {
  const payload = {
    id: userId,
    type: 'refresh',
    sessionId: options.sessionId || generateSessionId(),
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomBytes(16).toString('hex')
  };

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: '30d',
    issuer: 'Prezio',
    audience: 'prezio-refresh'
  });
};

/**
 * Generate password reset token
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {string} Password reset token
 */
const generatePasswordResetToken = (userId, email) => {
  const payload = {
    id: userId,
    email,
    type: 'password_reset',
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomBytes(16).toString('hex')
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '1h',
    issuer: 'Prezio',
    audience: 'password-reset'
  });
};

/**
 * Generate email verification token
 * @param {string} userId - User ID
 * @param {string} email - Email to verify
 * @returns {string} Email verification token
 */
const generateEmailVerificationToken = (userId, email) => {
  const payload = {
    id: userId,
    email,
    type: 'email_verification',
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomBytes(16).toString('hex')
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'Prezio',
    audience: 'email-verification'
  });
};

/**
 * Verify and decode token
 * @param {string} token - JWT token
 * @param {string} type - Token type ('access', 'refresh', 'password_reset', etc.)
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token, type = 'access') => {
  try {
    const secret = type === 'refresh' 
      ? (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET)
      : process.env.JWT_SECRET;

    const audience = type === 'refresh' 
      ? 'prezio-refresh'
      : type === 'password_reset'
      ? 'password-reset'
      : type === 'email_verification'
      ? 'email-verification'
      : 'prezio-users';

    return jwt.verify(token, secret, {
      issuer: 'Prezio',
      audience: audience
    });
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

/**
 * Extract token payload without verification (for debugging/logging)
 * @param {string} token - JWT token
 * @returns {Object} Token payload
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

/**
 * Check if token is expired
 * @param {string} token - JWT token
 * @returns {boolean} Whether token is expired
 */
const isTokenExpired = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return true;
    
    return Date.now() >= decoded.exp * 1000;
  } catch (error) {
    return true;
  }
};

/**
 * Get token expiration time
 * @param {string} token - JWT token
 * @returns {Date|null} Expiration date or null if invalid
 */
const getTokenExpiration = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return null;
    
    return new Date(decoded.exp * 1000);
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  generateSessionId,
  generateDeviceFingerprint,
  generateImpersonationToken,
  generate2FAToken,
  generateRefreshToken,
  generatePasswordResetToken,
  generateEmailVerificationToken,
  verifyToken,
  decodeToken,
  isTokenExpired,
  getTokenExpiration
};