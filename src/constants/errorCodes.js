// ✅ CRITICAL SECURITY FIX: Standardized Error Codes
// SRS Requirements: Error Handling Section

module.exports = {
  // ===== AUTHENTICATION ERRORS =====
  AUTH_001: {
    code: 'AUTH-001',
    message: 'Access Denied',
    httpStatus: 403
  },
  AUTH_002: {
    code: 'AUTH-002',
    message: 'Account Suspended',
    httpStatus: 423
  },
  AUTH_003: {
    code: 'AUTH-003',
    message: 'Invalid Credentials',
    httpStatus: 401
  },
  AUTH_004: {
    code: 'AUTH-004',
    message: '2FA Failure',
    httpStatus: 401
  },
  AUTH_005: {
    code: 'AUTH-005',
    message: 'Session Expired',
    httpStatus: 401
  },
  AUTH_006: {
    code: 'AUTH-006',
    message: 'Account Locked',
    httpStatus: 423
  },
  AUTH_007: {
    code: 'AUTH-007',
    message: 'Password Expired',
    httpStatus: 401
  },

  // ===== PASSWORD ERRORS (NEW) =====
  PASSWORD_TOO_SHORT: {
    code: 'PASSWORD-001',
    message: 'Password must be at least 12 characters long (SRS requirement)',
    httpStatus: 400
  },
  PASSWORD_IN_HISTORY: {
    code: 'PASSWORD-002',
    message: 'Password has been used recently. Please choose a different password.',
    httpStatus: 400
  },
  PASSWORD_EXPIRED: {
    code: 'PASSWORD-003',
    message: 'Your password has expired. Please change your password to continue.',
    httpStatus: 401
  },
  PASSWORD_EXPIRING_SOON: {
    code: 'PASSWORD-004',
    message: 'Your password will expire soon. Please change it.',
    httpStatus: 200
  },

  // ===== CAPTCHA ERRORS (NEW) =====
  CAPTCHA_REQUIRED: {
    code: 'CAPTCHA-001',
    message: 'CAPTCHA verification required after multiple failed attempts',
    httpStatus: 400
  },
  CAPTCHA_INVALID: {
    code: 'CAPTCHA-002',
    message: 'Invalid CAPTCHA response. Please try again.',
    httpStatus: 400
  },
  CAPTCHA_VERIFICATION_FAILED: {
    code: 'CAPTCHA-003',
    message: 'CAPTCHA verification failed',
    httpStatus: 400
  },

  // ===== ACCOUNT LOCKOUT ERRORS (NEW) =====
  ACCOUNT_LOCKED: {
    code: 'LOCKOUT-001',
    message: 'Account temporarily locked due to multiple failed login attempts',
    httpStatus: 423
  },
  ACCOUNT_LOCKED_PERMANENT: {
    code: 'LOCKOUT-002',
    message: 'Account permanently locked. Contact administrator.',
    httpStatus: 423
  },

  // ===== AUTHORIZATION ERRORS =====
  AUTHZ_001: {
    code: 'AUTHZ-001',
    message: 'Insufficient Permissions',
    httpStatus: 403
  },
  AUTHZ_002: {
    code: 'AUTHZ-002',
    message: 'Role Conflict',
    httpStatus: 403
  },
  AUTHZ_003: {
    code: 'AUTHZ-003',
    message: 'State Violation',
    httpStatus: 403
  },

  // ===== SYSTEM ERRORS =====
  SYS_001: {
    code: 'SYS-001',
    message: 'Database Connection Failure',
    httpStatus: 503
  },
  SYS_002: {
    code: 'SYS-002',
    message: 'External Service Unavailable',
    httpStatus: 503
  },
  SYS_003: {
    code: 'SYS-003',
    message: 'Invalid Session State',
    httpStatus: 401
  },

  // ===== VALIDATION ERRORS =====
  VAL_001: {
    code: 'VAL-001',
    message: 'Invalid Input',
    httpStatus: 400
  },
  VAL_002: {
    code: 'VAL-002',
    message: 'Missing Required Field',
    httpStatus: 400
  },

  // ===== INTEGRATION ERRORS =====
  INT_001: {
    code: 'INT-001',
    message: 'eCitizen Integration Failure',
    httpStatus: 503
  },
  INT_002: {
    code: 'INT-002',
    message: 'Email Delivery Failure',
    httpStatus: 503
  },
  INT_003: {
    code: 'INT-003',
    message: 'SMS Delivery Failure',
    httpStatus: 503
  }
};
