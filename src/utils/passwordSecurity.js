// ✅ CRITICAL SECURITY FIX: Password History & Expiry Utilities
// SRS Requirements: FR-AUTH-003 (Password Management)

const bcrypt = require('bcryptjs');

/**
 * Check if new password is in password history (last 5 passwords)
 * @param {string} newPassword - Plain text password to check
 * @param {Array} passwordHistory - Array of password hashes
 * @returns {Promise<boolean>} - True if password is in history
 */
const isPasswordInHistory = async (newPassword, passwordHistory = []) => {
  if (!passwordHistory || passwordHistory.length === 0) {
    return false;
  }

  // Check against each historical password
  for (const historyEntry of passwordHistory) {
    const match = await bcrypt.compare(newPassword, historyEntry.hash);
    if (match) {
      return true;
    }
  }

  return false;
};

/**
 * Add current password to history
 * @param {Object} user - User document
 * @param {string} currentPasswordHash - Current password hash
 * @returns {Array} - Updated password history
 */
const addPasswordToHistory = (user, currentPasswordHash) => {
  const history = user.passwordHistory || [];

  // Add current password to history
  history.unshift({
    hash: currentPasswordHash,
    changedAt: new Date()
  });

  // Keep only last 5 passwords (or maxPasswordHistory)
  const maxHistory = user.maxPasswordHistory || 5;
  if (history.length > maxHistory) {
    history.splice(maxHistory);
  }

  return history;
};

/**
 * Calculate password expiry date
 * @param {number} expiryDays - Number of days until expiry (default 90)
 * @returns {Date} - Expiry date
 */
const calculatePasswordExpiry = (expiryDays = 90) => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiryDays);
  return expiryDate;
};

/**
 * Check if password has expired
 * @param {Date} passwordExpiresAt - Password expiry date
 * @returns {boolean} - True if password has expired
 */
const isPasswordExpired = (passwordExpiresAt) => {
  if (!passwordExpiresAt) {
    return false;
  }
  return new Date() > passwordExpiresAt;
};

/**
 * Get days until password expires
 * @param {Date} passwordExpiresAt - Password expiry date
 * @returns {number} - Days until expiry (negative if expired)
 */
const getDaysUntilExpiry = (passwordExpiresAt) => {
  if (!passwordExpiresAt) {
    return null;
  }

  const now = new Date();
  const expiryDate = new Date(passwordExpiresAt);
  const diffTime = expiryDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

/**
 * Check if password expiry warning should be sent
 * @param {Date} passwordExpiresAt - Password expiry date
 * @returns {Object} - { shouldWarn: boolean, daysRemaining: number }
 */
const shouldSendExpiryWarning = (passwordExpiresAt) => {
  const daysRemaining = getDaysUntilExpiry(passwordExpiresAt);

  if (daysRemaining === null) {
    return { shouldWarn: false, daysRemaining: null };
  }

  // Send warning at 30, 14, 7, and 1 days before expiry
  const warningThresholds = [30, 14, 7, 1];
  const shouldWarn = warningThresholds.includes(daysRemaining);

  return { shouldWarn, daysRemaining };
};

/**
 * Validate password complexity requirements
 * @param {string} password - Plain text password
 * @returns {Object} - { valid: boolean, errors: Array }
 */
const validatePasswordComplexity = (password) => {
  const errors = [];

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long (SRS requirement)');
  }

  if (password.length > 64) {
    errors.push('Password must be at most 64 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must include at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must include at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must include at least one number');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must include at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Set password expiry date on user
 * @param {Object} user - User document
 * @returns {Date} - Password expiry date
 */
const setPasswordExpiry = (user) => {
  const expiryDays = user.passwordExpiryDays || 90;
  user.passwordExpiresAt = calculatePasswordExpiry(expiryDays);
  user.passwordLastChanged = new Date();
  return user.passwordExpiresAt;
};

module.exports = {
  isPasswordInHistory,
  addPasswordToHistory,
  calculatePasswordExpiry,
  isPasswordExpired,
  getDaysUntilExpiry,
  shouldSendExpiryWarning,
  validatePasswordComplexity,
  setPasswordExpiry
};
