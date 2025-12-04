const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const generateRecoveryKey = require('../utils/generateRecoveryKey');
const generateRecoveryPDF = require('../utils/generateRecoveryPDF');
const { logsecurityEvent } = require('./admin/securityController');
const { cloudinary } = require('../config/cloudinary');
const path = require('path');
const fs = require('fs');
const getDeviceDetails = require('../utils/getDeviceDetails');
const { sendNotification } = require('../services/notificationService');
const logActivity = require('../utils/activityLogger');
const securityEvent = require('../models/securityEvent');
const crypto = require('crypto');
const IPList = require('../models/IPList');
const {
  createWelcomeEmail,
  createLoginAlertEmail,
  createPasswordResetEmail
} = require('../utils/emailTemplates');
const speakeasy = require('speakeasy');
const { verifyCaptcha } = require('../utils/captcha');
const { getRolePortal, getRoleDisplayName } = require('../constants/roles');

const accountSecurityState = new Map();

const DEFAULT_LOGOS = [
  'https://res.cloudinary.com/dqmo5qzze/image/upload/v1745409948/default-logo-1_al7thz.png',
  'https://res.cloudinary.com/dqmo5qzze/image/upload/v1745409948/default-logo-2_kaywcs.png',
  'https://res.cloudinary.com/dqmo5qzze/image/upload/v1745409947/default-logo-3_mbvp1t.png',
  'https://res.cloudinary.com/dqmo5qzze/image/upload/v1745409947/default-logo-4_ug6isl.png'
];

// Enhanced helper function to extract detailed request info
function getRequestInfo(req) {
  const ip = req.clientIP || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const deviceInfo = getDeviceDetails(userAgent);
  const deviceString = `${deviceInfo.browser} on ${deviceInfo.os}`;

  return {
    ip,
    userAgent,
    deviceInfo,
    deviceString,
    riskAssessment: req.riskAssessment || null,
    fingerprint: req.fingerprint || null
  };
}

// Enhanced security logging function
async function logSecurityEvent(eventData) {
  try {
    await securityEvent.createEvent({
      user: eventData.user || null,
      targetEmail: eventData.targetEmail || null,
      action: eventData.action,
      severity: eventData.severity || 'medium',
      ip: eventData.ip,
      device: eventData.device,
      details: {
        ...eventData.details,
        timestamp: new Date(),
        userAgent: eventData.userAgent
      }
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

// Updated register function with subscription plan selection
exports.register = async (req, res) => {
  console.log('[REGISTER] Request received:', { type: req.body.type, email: req.body.email || req.body.organizationEmail });
  const { type, captchaAnswer, captchaToken } = req.body;
  const requestInfo = getRequestInfo(req);

  try {
    if (!type || !['individual', 'organization'].includes(type)) {
      return res.status(400).json({ message: 'Invalid registration type', code: 'INVALID_TYPE' });
    }

    // Verify CAPTCHA
    if (!captchaAnswer || !captchaToken) {
      return res.status(400).json({ message: 'CAPTCHA verification required', code: 'CAPTCHA_REQUIRED' });
    }

    if (!verifyCaptcha(captchaAnswer, captchaToken)) {
      await logSecurityEvent({
        action: 'Failed CAPTCHA Verification',
        severity: 'medium',
        ip: requestInfo.ip,
        device: requestInfo.deviceString,
        details: { attemptedRegistration: true }
      });
      return res.status(400).json({ message: 'Invalid CAPTCHA. Please try again.', code: 'CAPTCHA_INVALID' });
    }

    // Enhanced security checks (example: suspicious IP, device fingerprint, etc.)
    if (requestInfo.riskAssessment === 'high') {
      await logSecurityEvent({
        action: 'High Risk Registration Attempt',
        severity: 'high',
        ip: requestInfo.ip,
        device: requestInfo.deviceString,
        details: { riskAssessment: requestInfo.riskAssessment }
      });
      return res.status(403).json({ message: 'Registration blocked due to high risk', code: 'HIGH_RISK' });
    }

    let userData = {
      type,
      receiveSystemAlerts: !!req.body.receiveSystemAlerts,
      suspiciousActivityAlerts: true,
      accountStatus: type === 'organization' ? 'pending_registration' : 'active'
    };

    if (type === 'individual') {
      const { username, firstName, lastName, email, phone, password } = req.body;
      if (!username || !firstName || !lastName || !email || !phone || !password) {
        return res.status(400).json({ message: 'Missing required fields for individual registration', code: 'MISSING_FIELDS' });
      }
      if (await User.findOne({ $or: [{ username }, { email }] })) {
        return res.status(409).json({ message: 'Username or email already exists', code: 'USER_EXISTS' });
      }
      
      // Set role to system administrator for specific hardcoded email, otherwise public_user for individuals
      const role = email === 'ianmathew186@gmail.com' ? 'dha_system_administrator' : 'public_user';

      userData = { ...userData, username, firstName, lastName, email, phone, password: await bcrypt.hash(password, 12), role };
    } else if (type === 'organization') {
      const { organizationName, organizationType, county, subCounty, organizationEmail, organizationPhone, yearOfEstablishment, password } = req.body;
      if (!organizationName || !organizationType || !county || !subCounty || !organizationEmail || !organizationPhone || !yearOfEstablishment || !password) {
        return res.status(400).json({ message: 'Missing required fields for organization registration', code: 'MISSING_FIELDS' });
      }
      if (await User.findOne({ $or: [{ organizationName }, { organizationEmail }] })) {
        return res.status(409).json({ message: 'Organization name or email already exists', code: 'ORG_EXISTS' });
      }
      userData = {
        ...userData,
        organizationName,
        organizationType,
        county,
        subCounty,
        organizationEmail,
        organizationPhone,
        yearOfEstablishment,
        password: await bcrypt.hash(password, 12),
        role: 'vendor_developer' // Default role for new organizations - they are vendors submitting applications
      };
    }

    // Assign random logo
    userData.logo = { url: DEFAULT_LOGOS[Math.floor(Math.random() * DEFAULT_LOGOS.length)] };

    // Create user
    const user = await User.create(userData);

    // Generate recovery key and PDF
    const plainKey = generateRecoveryKey();
    user.recoveryKeyHash = await bcrypt.hash(plainKey, 12);
    user.recoveryKeyGeneratedAt = new Date();
    await user.save();

    const pdfPath = await generateRecoveryPDF({
      name: user.firstName || user.organizationName,
      email: user.email || user.organizationEmail,
      recoveryKey: plainKey
    });
    // Optionally, auto-delete PDF after 5 mins as before

    // Session logic: clean old sessions, keep max 5
    const sessionId = crypto.randomUUID();
    user.sessions = user.sessions || [];
    user.sessions.unshift({ sessionId, ip: requestInfo.ip, device: requestInfo.deviceString, createdAt: new Date() });
    if (user.sessions.length > 5) user.sessions = user.sessions.slice(0, 5);
    await user.save();

    // Log security event
    await logSecurityEvent({
      user: user._id,
      action: 'Account Registered',
      severity: 'medium',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      details: { registrationType: type }
    });

    // Generate token
    // For new registrations, twoFactorConfirmed should be true if user hasn't enabled 2FA yet
    const token = generateToken(user._id, false, {
      sessionId,
      tokenVersion: user.tokenVersion || 0,
      deviceInfo: requestInfo.deviceInfo,
      ip: requestInfo.ip,
      twoFactorConfirmed: !user.twoFactorEnabled  // true if 2FA not enabled, false if enabled
    });

    // Set secure cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',  // Allow cross-origin in dev
      path: '/'
    });

    res.status(201).json({
      user: {
        _id: user._id,
        type: user.type,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        organizationName: user.organizationName,
        organizationType: user.organizationType,
        county: user.county,
        subCounty: user.subCounty,
        organizationEmail: user.organizationEmail,
        organizationPhone: user.organizationPhone,
        yearOfEstablishment: user.yearOfEstablishment,
        role: user.role,
        logo: user.logo,
        accountStatus: user.accountStatus,
        twoFactorEnabled: user.twoFactorEnabled,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      token,
      recoveryKey: plainKey,
      recoveryPDF: `/recovery/${require('path').basename(pdfPath)}`,
      message: 'Registration successful!'
    });

    // Send welcome email
    await sendEmail({
      to: user.email || user.organizationEmail,
      subject: 'Welcome to Kenya Digital Health Agency',
      html: createWelcomeEmail({ name: user.firstName || user.organizationName || plainKey })
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Registration failed. Please try again.', code: 'REGISTRATION_ERROR' });
  }
};

// Updated login function with account-first security priority and failed attempts reset
exports.login = async (req, res) => {
  console.log('[LOGIN] Request received:', { identifier: req.body.identifier });
  const { identifier, password, twoFactorCode, captchaAnswer, captchaToken } = req.body; // Accept twoFactorCode and CAPTCHA
  const requestInfo = getRequestInfo(req);

  if (!identifier || !password) {
    console.log('[LOGIN] Missing credentials');
    return res.status(400).json({ message: 'Identifier and password are required', code: 'MISSING_CREDENTIALS' });
  }

  // Verify CAPTCHA for login
  if (!captchaAnswer || !captchaToken) {
    return res.status(400).json({ message: 'CAPTCHA verification required', code: 'CAPTCHA_REQUIRED' });
  }

  if (!verifyCaptcha(captchaAnswer, captchaToken)) {
    await logSecurityEvent({
      action: 'Failed CAPTCHA Verification',
      severity: 'medium',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      details: { attemptedLogin: true }
    });
    return res.status(400).json({ message: 'Invalid CAPTCHA. Please try again.', code: 'CAPTCHA_INVALID' });
  }

  try {
    // Find user by email, username, organizationName, or organizationEmail
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
        { organizationName: identifier },
        { organizationEmail: identifier }
      ]
    }).select('+password +twoFactorSecret +knownDevices');

    // Log failed attempt for non-existent user
    if (!user) {
      await logSecurityEvent({
        action: 'Failed Login',
        severity: 'medium',
        ip: requestInfo.ip,
        device: requestInfo.deviceString,
        targetEmail: identifier,
        details: { reason: 'User not found', riskAssessment: requestInfo.riskAssessment }
      });
      await new Promise(resolve => setTimeout(resolve, 1500)); // Delay for timing attacks
      return res.status(401).json({ message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    // Check if account is suspended before any other processing
    if (user.accountStatus === 'suspended' || user.suspended) {
      await logSecurityEvent({
        user: user._id,
        action: 'Login Attempt on Suspended Account',
        severity: 'high',
        ip: requestInfo.ip,
        device: requestInfo.deviceString,
        details: { reason: 'Account suspended', riskAssessment: requestInfo.riskAssessment }
      });
      return res.status(423).json({ message: 'Account suspended. Please contact support.', code: 'ACCOUNT_SUSPENDED' });
    }

    // Priority 1: Account-based check and potential suspension
    const accountState = await getAccountSecurityState(user.email || user.organizationEmail);
    if (accountState.failedAttempts >= THREAT_PATTERNS.RATE_LIMITS.ACCOUNT_LOCK_THRESHOLD) {
      user.accountStatus = 'suspended';
      user.suspended = true;
      user.suspendedAt = new Date();
      await user.save();
      await logSecurityEvent({
        user: user._id,
        action: 'Account Suspended Due to Failed Logins',
        severity: 'high',
        ip: requestInfo.ip,
        device: requestInfo.deviceString,
        details: { failedAttempts: accountState.failedAttempts }
      });
      return res.status(423).json({ message: 'Account suspended due to multiple failed login attempts.', code: 'ACCOUNT_SUSPENDED' });
    }

    // PRIORITY 2: IP-based checks (only if account wasn't suspended)
    const recentIPFailures = await securityEvent.countDocuments({
      ip: requestInfo.ip,
      action: 'Failed Login',
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
    });

    if (recentIPFailures >= THREAT_PATTERNS.RATE_LIMITS.IP_TEMP_BLOCK_THRESHOLD) {
      await handleIPTempBlock(requestInfo.ip, recentIPFailures, user.email || user.organizationEmail, requestInfo);

      return res.status(429).json({
        message: 'IP temporarily blocked due to multiple failed attempts.',
        code: 'IP_TEMP_BLOCKED',
        retryAfter: Math.min(recentIPFailures * 5, 60) * 60
      });
    }

    // Delay to prevent brute force
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Password check
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      await logSecurityEvent({
        user: user._id,
        action: 'Failed Login',
        severity: 'medium',
        ip: requestInfo.ip,
        device: requestInfo.deviceString,
        targetEmail: user.email || user.organizationEmail,
        details: { reason: 'Incorrect password', riskAssessment: requestInfo.riskAssessment }
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
      return res.status(401).json({ message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    // Password is correct: Reset failed attempts for this account
    await resetAccountFailedAttempts(user.email || user.organizationEmail, user._id, requestInfo);

    // 2FA checks (inline, not session-based)
    let twoFactorPassed = false;
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        await logSecurityEvent({
          user: user._id,
          action: '2FA Required',
          severity: 'low',
          ip: requestInfo.ip,
          device: requestInfo.deviceString,
          targetEmail: user.email || user.organizationEmail,
          details: {
            stage: 'password_verified',
            riskAssessment: requestInfo.riskAssessment
          }
        });
        return res.status(400).json({ 
          success: false,
          message: '2FA code required', 
          requiresTwoFactor: true,
          code: '2FA_REQUIRED' 
        });
      }
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode
      });
      if (!verified) {
        await logSecurityEvent({
          user: user._id,
          action: 'Invalid 2FA Code',
          severity: 'medium',
          ip: requestInfo.ip,
          device: requestInfo.deviceString,
          targetEmail: user.email || user.organizationEmail,
          details: {
            providedCode: twoFactorCode,
            riskAssessment: requestInfo.riskAssessment
          }
        });
        return res.status(401).json({ message: 'Invalid 2FA code', code: 'INVALID_2FA_CODE' });
      }
      twoFactorPassed = true;
    } else {
      twoFactorPassed = true; // No 2FA required, so pass
    }

    // New session logic, clean expired sessions, max 5 sessions
    const sessionId = crypto.randomUUID();
    user.sessions = user.sessions || [];
    user.sessions.unshift({ sessionId, ip: requestInfo.ip, device: requestInfo.deviceString, createdAt: new Date() });
    if (user.sessions.length > 5) user.sessions = user.sessions.slice(0, 5);

    // Check for new device/IP
    let isNewDevice = true;
    if (user.knownDevices && user.knownDevices.length > 0) {
      isNewDevice = !user.knownDevices.some(dev =>
        dev.ip === requestInfo.ip && dev.device === requestInfo.deviceString
      );
    }
    if (isNewDevice) {
      user.knownDevices = user.knownDevices || [];
      user.knownDevices.push({
        ip: requestInfo.ip,
        device: requestInfo.deviceString,
        lastUsed: new Date()
      });
      // Send login alert email
      await sendEmail({
        to: user.email || user.organizationEmail,
        subject: 'New Device Login Alert',
        html: createLoginAlertEmail(
          user,
          requestInfo.ip,
          requestInfo.deviceString
        )
      });
      await logSecurityEvent({
        user: user._id,
        action: 'New Device Login',
        severity: 'medium',
        ip: requestInfo.ip,
        device: requestInfo.deviceString,
        details: { newDevice: true }
      });
    }

    // Update last login, sessions, and devices using atomic operation to avoid version conflicts
    const updateData = {
      lastLogin: new Date(),
      sessions: user.sessions,
      knownDevices: user.knownDevices
    };

    await User.findByIdAndUpdate(user._id, updateData, { new: false });

    // Generate token
    const token = generateToken(user._id, twoFactorPassed, {
      sessionId,
      tokenVersion: user.tokenVersion || 0,
      deviceInfo: requestInfo.deviceInfo,
      ip: requestInfo.ip
    });

    // Set secure cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',  // Allow cross-origin in dev
      path: '/'
    });

    res.status(200).json({
      user: {
        _id: user._id,
        type: user.type,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        organizationName: user.organizationName,
        organizationEmail: user.organizationEmail,
        organizationType: user.organizationType,
        role: user.role,
        roleDisplayName: getRoleDisplayName(user.role),
        portal: getRolePortal(user.role),
        logo: user.logo,
        twoFactorEnabled: user.twoFactorEnabled || false,
        accountStatus: user.accountStatus
      },
      token
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed. Please try again.', code: 'LOGIN_ERROR' });
  }
};

// NEW: Helper function to reset failed login attempts for an account
async function resetAccountFailedAttempts(targetEmail, userId, requestInfo) {
  try {
    // Delete recent failed login events for this email
    await securityEvent.deleteMany({
      targetEmail: targetEmail,
      action: 'Failed Login',
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
    });

    // Clear in-memory state
    const key = `account:${targetEmail}`;
    accountSecurityState.delete(key);

    await logSecurityEvent({
      user: userId,
      action: 'Failed Attempts Reset',
      severity: 'low',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      targetEmail: targetEmail,
      details: {
        reason: 'Successful login',
        resetTimestamp: new Date(),
        riskAssessment: requestInfo.riskAssessment
      }
    });

    console.log(`Failed login attempts reset for account: ${targetEmail}`);
  } catch (error) {
    console.error('Error resetting failed attempts:', error);
  }
}

// Helper function for IP temporary blocking
async function handleIPTempBlock(clientIP, recentIPFailures, targetEmail, requestInfo) {
  try {
    const systemUserId = await getSystemUserId();

    if (systemUserId) {
      // Check if IP is already temporarily blocked
      const existingBlock = await IPList.findOne({
        ip: clientIP,
        type: 'blacklist',
        isActive: true,
        expiresAt: { $gt: new Date() }
      });

      if (!existingBlock) {
        const blockDuration = Math.min(recentIPFailures * 5, 60); // Max 1 hour

        await IPList.create({
          ip: clientIP,
          type: 'blacklist',
          reason: `Temporary block: ${recentIPFailures} failed attempts from IP${isLocalhostIP(clientIP) ? ' (localhost)' : ''}`,
          expiresAt: new Date(Date.now() + blockDuration * 60 * 1000),
          createdBy: systemUserId,
          isActive: true
        });

        await securityEvent.createEvent({
          user: null,
          targetEmail: targetEmail,
          action: 'IP Temporarily Blocked',
          severity: 'high',
          ip: clientIP,
          device: requestInfo.deviceString,
          details: {
            failedAttempts: recentIPFailures,
            blockDuration: `${blockDuration} minutes`,
            targetEmail: targetEmail,
            isLocalhost: isLocalhostIP(clientIP)
          }
        });
      }
    }
  } catch (error) {
    console.error('IP temp block error:', error);
  }
}

// Helper function to get account security state
async function getAccountSecurityState(email) {
  try {
    const failedAttempts = await securityEvent.countDocuments({
      targetEmail: email,
      action: 'Failed Login',
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) } // Last 30 minutes
    });

    return {
      failedAttempts,
      email,
      timeWindow: '30 minutes'
    };
  } catch (error) {
    console.error('Error getting account security state:', error);
    return { failedAttempts: 0, email };
  }
}

// Helper function to get system user ID (for automated actions)
async function getSystemUserId() {
  try {
    // Try to find a system user, or create one if it doesn't exist
    let systemUser = await User.findOne({ email: 'system@internal.app', role: 'dha_system_administrator' });

    if (!systemUser) {
      // Create system user if it doesn't exist
      systemUser = new User({
        type: 'individual',
        firstName: 'System',
        lastName: 'Administrator',
        email: 'system@internal.app',
        role: 'dha_system_administrator',
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
        suspended: false,
        isSystemAccount: true
      });
      await systemUser.save();
    }

    return systemUser._id;
  } catch (error) {
    console.error('Error getting system user ID:', error);
    return null;
  }
}

// Helper function to check if IP is localhost
function isLocalhostIP(ip) {
  const localhostPatterns = [
    '127.0.0.1',
    '::1',
    'localhost',
    '0.0.0.0'
  ];

  return localhostPatterns.some(pattern =>
    ip === pattern || ip.startsWith(pattern)
  );
}

// Security threat patterns constant
const THREAT_PATTERNS = {
  RATE_LIMITS: {
    ACCOUNT_LOCK_THRESHOLD: 5,        // Suspend account after 5 failed attempts
    IP_TEMP_BLOCK_THRESHOLD: 10,      // Temp block IP after 10 failed attempts in 30 min
    GLOBAL_BLOCK_THRESHOLD: 50        // Global threat detection after 50 failures in 1 hour
  }
};

exports.getProfile = async (req, res) => {
  const requestInfo = getRequestInfo(req);

  try {
    const user = await User.findById(req.user._id)
      .select('-password -recoveryKeyHash -__v');

    if (!user) {
      await logSecurityEvent({
        action: 'Profile Access Failed',
        severity: 'medium',
        ip: requestInfo.ip,
        device: requestInfo.deviceString,
        details: {
          reason: 'User not found',
          requestedUserId: req.user._id,
          riskAssessment: requestInfo.riskAssessment
        }
      });

      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const profile = {
      ...user.toObject(),
      roleDisplayName: getRoleDisplayName(user.role),
      portal: getRolePortal(user.role),
      lastUpdated: user.updatedAt,
    };

    res.status(200).json({ user: profile });
  } catch (err) {
    console.error('Get profile error:', err);

    await logSecurityEvent({
      user: req.user?._id,
      action: 'Profile Access Error',
      severity: 'medium',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      details: {
        error: err.message,
        riskAssessment: requestInfo.riskAssessment
      }
    });

    res.status(500).json({
      message: 'Failed to fetch profile',
      code: 'PROFILE_ERROR'
    });
  }
};

exports.updateProfile = async (req, res) => {
  const requestInfo = getRequestInfo(req);
  const updates = {};
  const allowedFields = [
    'firstName', 'middleName', 'surname', 'companyName', 'position',
    'phone', 'address', 'quoteTerms', 'invoiceTerms', 'receiptTerms', 'estimateTerms'
  ];

  // Validate and sanitize inputs
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      if (typeof req.body[field] === 'string') {
        updates[field] = req.body[field].trim();
      } else {
        updates[field] = req.body[field];
      }
    }
  });

  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -recoveryKeyHash');

    if (!updatedUser) {
      await logSecurityEvent({
        action: 'Profile Update Failed',
        severity: 'medium',
        ip: requestInfo.ip,
        device: requestInfo.deviceString,
        details: {
          reason: 'User not found',
          requestedUserId: req.user._id,
          attemptedUpdates: Object.keys(updates),
          riskAssessment: requestInfo.riskAssessment
        }
      });

      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    await logActivity({
      user: updatedUser._id,
      action: 'PROFILE_UPDATE',
      description: 'User updated profile successfully',
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent
    });

    await logSecurityEvent({
      user: updatedUser._id,
      action: 'Profile Updated',
      severity: 'low',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      details: {
        updatedFields: Object.keys(updates),
        riskAssessment: requestInfo.riskAssessment
      }
    });

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (err) {
    console.error('Update profile error:', err);

    await logSecurityEvent({
      user: req.user?._id,
      action: 'Profile Update Error',
      severity: 'medium',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      details: {
        error: err.message,
        attemptedUpdates: Object.keys(updates),
        riskAssessment: requestInfo.riskAssessment
      }
    });

    res.status(500).json({
      message: 'Failed to update profile',
      code: 'UPDATE_ERROR'
    });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const requestInfo = getRequestInfo(req);

  if (!currentPassword || !newPassword) {
    await logSecurityEvent({
      user: req.user?._id,
      action: 'Password Change Failed',
      severity: 'low',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      details: {
        reason: 'Missing passwords',
        providedCurrent: !!currentPassword,
        providedNew: !!newPassword,
        riskAssessment: requestInfo.riskAssessment
      }
    });

    return res.status(400).json({
      message: 'Both current and new passwords are required',
      code: 'MISSING_PASSWORDS'
    });
  }

  if (newPassword.length < 8) {
    await logSecurityEvent({
      user: req.user?._id,
      action: 'Password Change Failed',
      severity: 'low',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      details: {
        reason: 'New password too weak',
        newPasswordLength: newPassword.length,
        riskAssessment: requestInfo.riskAssessment
      }
    });

    return res.status(400).json({
      message: 'New password must be at least 8 characters long',
      code: 'WEAK_PASSWORD'
    });
  }

  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      await logSecurityEvent({
        user: user._id,
        action: 'Password Change Failed',
        severity: 'medium',
        ip: requestInfo.ip,
        device: requestInfo.deviceString,
        details: {
          reason: 'Incorrect current password',
          riskAssessment: requestInfo.riskAssessment
        }
      });

      return res.status(401).json({
        message: 'Incorrect current password',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedNewPassword;
    user.passwordChangedAt = new Date();

    // DON'T increment token version - keep user logged in
    // user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await logActivity({
      user: user._id,
      action: 'PASSWORD_CHANGE',
      description: 'User changed password successfully',
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent
    });

    // Send in-app notification
    await sendNotification({
      userId: user._id,
      title: 'Password Changed',
      body: 'You have successfully changed your account password.',
      type: 'success'
    });

    // Send email notification
    const { sendEmail } = require('../utils/sendEmail');
    const { createPasswordChangeEmail } = require('../utils/emailTemplates');
    const userEmail = user.email || user.organizationEmail;
    const userName = user.firstName || user.organizationName || 'User';

    try {
      await sendEmail({
        to: userEmail,
        subject: 'Password Changed - Kenya DHA',
        html: createPasswordChangeEmail(
          userName,
          userEmail,
          new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }),
          requestInfo.ip,
          requestInfo.deviceString
        )
      });
    } catch (emailError) {
      console.error('Failed to send password change email:', emailError);
      // Don't fail the password change if email fails
    }

    await logSecurityEvent({
      user: user._id,
      action: 'Password Changed',
      severity: 'medium',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      details: {
        tokenVersionIncremented: false,  // Keep user logged in
        riskAssessment: requestInfo.riskAssessment
      }
    });

    res.status(200).json({
      message: 'Password updated successfully. You remain logged in.',
      code: 'PASSWORD_CHANGED'
    });
  } catch (err) {
    console.error('Change password error:', err);

    await logSecurityEvent({
      user: req.user?._id,
      action: 'Password Change Error',
      severity: 'high',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      details: {
        error: err.message,
        riskAssessment: requestInfo.riskAssessment
      }
    });

    res.status(500).json({
      message: 'Failed to change password',
      code: 'PASSWORD_CHANGE_ERROR'
    });
  }
};

exports.regenerateAccessKey = async (req, res) => {
  const requestInfo = getRequestInfo(req);

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const plainKey = generateRecoveryKey();
    const hashedKey = await bcrypt.hash(plainKey, 12);

    user.recoveryKeyHash = hashedKey;
    user.recoveryKeyGeneratedAt = new Date();
    await user.save();

    await logSecurityEvent({
      user: user._id,
      action: 'Recovery Key Generated',
      severity: 'medium',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      details: {
        riskAssessment: requestInfo.riskAssessment
      }
    });

    const pdfPath = await generateRecoveryPDF({
      name: user.name,
      email: user.email,
      recoveryKey: plainKey
    });

    const filename = path.basename(pdfPath);

    // Auto delete PDF after 5 mins
    setTimeout(() => {
      fs.unlink(pdfPath, (err) => {
        if (err) console.error('Failed to delete recovery PDF:', err);
      });
    }, 5 * 60 * 1000);

    res.status(200).json({
      message: 'New recovery key generated successfully!',
      recoveryKey: plainKey,
      downloadLink: `/recovery/${filename}`
    });

  } catch (err) {
    console.error('Access key regeneration failed:', err);

    await logSecurityEvent({
      user: req.user?._id,
      action: 'Recovery Key Generation Error',
      severity: 'high',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      details: {
        error: err.message,
        riskAssessment: requestInfo.riskAssessment
      }
    });

    res.status(500).json({
      message: 'Failed to regenerate access key',
      code: 'ACCESS_KEY_REGENERATION_ERROR'
    });
  }
};

exports.uploadLogo = async (req, res) => {
  try {
    console.log('Upload request received');
    console.log('req.file:', req.file);
    console.log('req.body:', req.body);
    
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ message: 'No logo file uploaded' });
    }

    // With multer-storage-cloudinary, the file structure is different
    if (!req.file.path) {
      console.log('No file path in request.file');
      return res.status(400).json({ message: 'Upload failed - no file URL received' });
    }

    console.log('File uploaded successfully to:', req.file.path);

    // Optional: delete previous logo
    if (user.logo?.public_id) {
      try {
        await cloudinary.uploader.destroy(user.logo.public_id);
        console.log('Previous logo deleted');
      } catch (deleteError) {
        console.warn('Failed to delete old logo:', deleteError);
      }
    }

    user.logo = {
      url: req.file.path, // Cloudinary secure URL
      public_id: req.file.filename, // public_id from multer-storage-cloudinary
    };
    await user.save();
    console.log('User logo updated in database');

    res.status(200).json({
      message: 'Logo uploaded successfully',
      logo: user.logo,
    });
  } catch (err) {
    console.error('Upload logo failed:', err);
    res.status(500).json({ message: 'Failed to upload logo', error: err.message });
  }
};

exports.deleteLogo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.logo?.public_id) {
      return res.status(404).json({ message: 'No logo to Remove' });
    }

    await cloudinary.uploader.destroy(user.logo.public_id);

    user.logo = undefined;
    await user.save();

    res.status(200).json({ message: 'Logo Removed successfully' });
  } catch (err) {
    console.error('Failed to Remove logo:', err);
    res.status(500).json({ message: 'Could not delete logo' });
  }
};

exports.terminateAccount = async (req, res) => {
  const requestInfo = getRequestInfo(req); // <-- Move this outside try
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

    user.terminationRequested = true;
    user.terminationDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    await user.save();

    await logActivity({
      user: user._id,
      action: 'ACCOUNT_TERMINATION_REQUEST',
      description: 'User requested account termination',
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    await logSecurityEvent({
      user: req.user?._id,
      action: 'Account Termination Requested',
      severity: 'high',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      details: {
        riskAssessment: requestInfo.riskAssessment
      }
    });

    res.status(200).json({
      message: 'Account termination scheduled. Your account will be deleted in 7 days.',
      terminationDate: user.terminationDate
    });
  } catch (err) {
    console.error('Account termination error:', err);
    await logSecurityEvent({
      user: req.user?._id,
      action: 'Account Termination Error',
      severity: 'high',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      details: {
        error: err.message,
        riskAssessment: requestInfo.riskAssessment
      }
    });
    res.status(500).json({ message: 'Server error during termination' });
  }
};

exports.abortTermination = async (req, res) => {
  const requestInfo = getRequestInfo(req); // <-- Add this for consistency
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.terminationRequested || !user.terminationDate) {
      return res.status(400).json({ message: 'No termination was scheduled for this account' });
    }

    user.terminationRequested = false;
    user.terminationDate = undefined;
    await user.save();

    await logActivity({
      user: user._id,
      action: 'ACCOUNT_TERMINATION_ABORTED',
      description: 'User aborted account termination',
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    await logSecurityEvent({
      user: user._id,
      action: 'Account Termination Aborted',
      severity: 'low',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      details: {
        riskAssessment: requestInfo.riskAssessment
      }
    });

    res.status(200).json({ message: 'Account termination cancelled successfully' });
  } catch (err) {
    console.error('Abort termination error:', err);
    await logSecurityEvent({
      user: req.user?._id,
      action: 'Account Termination Abort Error',
      severity: 'medium',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      details: {
        error: err.message,
        riskAssessment: requestInfo.riskAssessment
      }
    });
    res.status(500).json({ message: 'Server error while aborting termination' });
  }
};

exports.logout = async (req, res) => {
  try {
    // If we have user info, log the logout activity
    if (req.user) {
      await logActivity({
        user: req.user._id,
        action: 'LOGOUT',
        description: 'User logged out successfully',
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
    }

    res.clearCookie('token');
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    // Still clear the cookie even if logging fails
    res.clearCookie('token');
    res.status(200).json({ message: 'Logged out successfully' });
  }
};

// Board Member User Creation (Internal API)
exports.createBoardMemberUser = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      idNumber,
      address,
      boardRole,
      startDate,
      endDate,
      termLength,
      expertise,
      qualifications,
      experience,
      organizationRegistrationNumber,
      boardMemberId
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User with this email already exists' 
      });
    }

    // Generate setup token and recovery key
    const setupToken = crypto.randomBytes(32).toString('hex');
    const setupTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const plainRecoveryKey = generateRecoveryKey();
    const recoveryKeyHash = await bcrypt.hash(plainRecoveryKey, 12);

    // Parse name into firstName and lastName
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Map board role to system role
    const roleMapping = {
      'Chairperson': 'chairperson',
      'chairperson': 'chairperson',
      'Vice_Chairperson': 'vice_chairperson',
      'vice_chairperson': 'vice_chairperson',
      'Secretary': 'secretary',
      'secretary': 'secretary',
      'Treasurer': 'treasurer',
      'treasurer': 'treasurer',
      'Member': 'board_member',
      'member': 'board_member',
      'Patron': 'patron',
      'patron': 'patron',
      'Advisor': 'advisor',
      'advisor': 'advisor',
      // New operational roles
      'project_manager': 'project_manager',
      'Project_Manager': 'project_manager',
      'field_officer': 'field_officer',
      'Field_Officer': 'field_officer',
      'm_and_e_officer': 'm_and_e_officer',
      'M_and_E_Officer': 'm_and_e_officer',
      'finance': 'finance',
      'Finance': 'finance',
      'donor': 'donor',
      'Donor': 'donor'
    };

    // Create user data
    const userData = {
      type: 'individual',
      firstName,
      lastName,
      email,
      phone,
      idNumber,
      address,
      organizationRegistrationNumber,
      boardMemberId,
      role: roleMapping[boardRole] || 'board_member',
      firstTimeSetup: true,
      setupToken,
      setupTokenExpires,
      accountStatus: 'pending_setup',
      recoveryKeyHash,
      recoveryKeyGeneratedAt: new Date(),
      boardMemberDetails: {
        boardRole,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        termLength,
        expertise: expertise || [],
        qualifications: qualifications || [],
        experience: experience || []
      },
      logo: { url: DEFAULT_LOGOS[Math.floor(Math.random() * DEFAULT_LOGOS.length)] }
    };

    const user = await User.create(userData);

    // Generate recovery PDF
    const pdfPath = await generateRecoveryPDF({
      name: firstName,
      email,
      recoveryKey: plainRecoveryKey
    });

    // Send setup email
    await sendEmail({
      to: email,
      subject: 'Welcome to the Board - Complete Your Account Setup',
      html: createBoardMemberSetupEmail({
        name: firstName,
        boardRole,
        setupToken,
        recoveryKey: plainRecoveryKey,
        setupUrl: `${process.env.FRONTEND_URL}/auth/setup-password?token=${setupToken}`
      })
    });

    res.status(201).json({
      success: true,
      message: 'Board member user created successfully',
      data: {
        userId: user._id,
        email: user.email,
        setupToken, // Include for immediate use if needed
        recoveryKey: plainRecoveryKey,
        recoveryPDF: `/recovery/${require('path').basename(pdfPath)}`
      }
    });

  } catch (error) {
    console.error('Error creating board member user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create board member user',
      error: error.message
    });
  }
};

// First Time Password Setup
exports.setupPassword = async (req, res) => {
  const requestInfo = getRequestInfo(req);

  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token, password, and confirm password are required'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Find user by setup token
    const user = await User.findOne({
      setupToken: token,
      setupTokenExpires: { $gt: new Date() },
      firstTimeSetup: true
    }).select('+setupToken');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired setup token'
      });
    }

    // Hash password and update user
    const hashedPassword = await bcrypt.hash(password, 12);
    
    user.password = hashedPassword;
    user.firstTimeSetup = false;
    user.setupToken = undefined;
    user.setupTokenExpires = undefined;
    user.accountStatus = 'active';
    user.lastLogin = new Date();

    // Create session
    const sessionId = crypto.randomUUID();
    user.sessions = user.sessions || [];
    user.sessions.unshift({
      sessionId,
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      createdAt: new Date()
    });

    // Keep only last 5 sessions
    if (user.sessions.length > 5) {
      user.sessions = user.sessions.slice(0, 5);
    }

    await user.save();

    // Log security event
    await logSecurityEvent({
      user: user._id,
      action: 'First Time Password Setup',
      severity: 'medium',
      ip: requestInfo.ip,
      device: requestInfo.deviceString,
      details: { setupCompleted: true }
    });

    // Generate token
    // For password setup, twoFactorConfirmed should be true if user hasn't enabled 2FA yet
    const authToken = generateToken(user._id, false, {
      sessionId,
      tokenVersion: user.tokenVersion || 0,
      deviceInfo: requestInfo.deviceInfo,
      ip: requestInfo.ip,
      twoFactorConfirmed: !user.twoFactorEnabled  // true if 2FA not enabled, false if enabled
    });

    // Set secure cookie
    res.cookie('token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'strict'
    });

    res.json({
      success: true,
      message: 'Password setup completed successfully',
      data: {
        user: {
          _id: user._id,
          type: user.type,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          boardMemberDetails: user.boardMemberDetails,
          accountStatus: user.accountStatus
        },
        token: authToken
      }
    });

  } catch (error) {
    console.error('Error setting up password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup password',
      error: error.message
    });
  }
};

// Get Organization Members (Internal API)
exports.getOrganizationMembers = async (req, res) => {
  try {
    const { registrationNumber } = req.params;
    const { role, status, page = 1, limit = 10 } = req.query;

    const filter = {
      organizationRegistrationNumber: registrationNumber,
      type: 'individual'
    };

    if (role) filter.role = role;
    if (status) filter.accountStatus = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const members = await User.find(filter)
      .select('-password -setupToken -recoveryKeyHash -twoFactorSecret')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: members,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalDocs: total,
        hasNext: skip + parseInt(limit) < total,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Error fetching organization members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organization members',
      error: error.message
    });
  }
};

// Update User Role (Internal API)
exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        userId: user._id,
        newRole: user.role
      }
    });

  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: error.message
    });
  }
};

// Update User Board Role (Internal API) - Updates both role and boardRole
exports.updateUserBoardRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, boardRole } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update both role fields
    user.role = role;
    if (user.boardMemberDetails) {
      user.boardMemberDetails.boardRole = boardRole;
    } else {
      user.boardMemberDetails = { boardRole };
    }
    
    await user.save();

    res.json({
      success: true,
      message: 'User board role updated successfully',
      data: {
        userId: user._id,
        newRole: user.role,
        newBoardRole: user.boardMemberDetails?.boardRole
      }
    });

  } catch (error) {
    console.error('Error updating user board role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user board role',
      error: error.message
    });
  }
};

// Deactivate User (Internal API)
exports.deactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.accountStatus = 'suspended';
    user.suspended = true;
    user.suspensionReason = reason;
    user.suspendedAt = new Date();
    user.tokenVersion += 1; // Invalidate all existing tokens

    await user.save();

    res.json({
      success: true,
      message: 'User account deactivated successfully',
      data: {
        userId: user._id,
        status: user.accountStatus,
        suspendedAt: user.suspendedAt
      }
    });

  } catch (error) {
    console.error('Error deactivating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate user',
      error: error.message
    });
  }
};

// Update User Profile (Internal API)
exports.updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update allowed fields
    const allowedFields = [
      'firstName', 'lastName', 'middleName', 'surname', 
      'email', 'phone', 'idNumber', 'address',
      'boardMemberDetails'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        user[field] = updateData[field];
      }
    });

    await user.save();

    res.json({
      success: true,
      message: 'User profile updated successfully',
      data: {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        boardMemberDetails: user.boardMemberDetails
      }
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user profile',
      error: error.message
    });
  }
};

// Update User Account Status (Internal API)
exports.updateUserAccountStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    // Validate status - use all statuses from User model enum
    const validStatuses = [
      'active', 'inactive', 'terminated', 'cancelled', 'suspended', 
      'pending_registration', 'submitted', 'under_review', 'clarification', 
      'approved', 'rejected', 'certified', 'pending_setup'
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const oldStatus = user.accountStatus;
    user.accountStatus = status;

    // Handle specific status changes
    if (status === 'suspended') {
      user.suspended = true;
      user.suspensionReason = reason;
      user.suspendedAt = new Date();
      user.tokenVersion += 1; // Invalidate all existing tokens
    } else if (status === 'active') {
      user.suspended = false;
      user.suspensionReason = null;
      user.suspendedAt = null;
    } else if (status === 'terminated') {
      user.terminationRequested = true;
      user.terminationDate = new Date();
      user.tokenVersion += 1; // Invalidate all existing tokens
    }

    await user.save();

    res.json({
      success: true,
      message: 'User account status updated successfully',
      data: {
        userId: user._id,
        oldStatus,
        newStatus: status,
        updatedAt: new Date(),
        reason
      }
    });

  } catch (error) {
    console.error('Error updating user account status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user account status',
      error: error.message
    });
  }
};

// Find User by Email (Internal API)
exports.findUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.findOne({ 
      $or: [
        { email: email },
        { organizationEmail: email }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User found successfully',
      data: {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        organizationEmail: user.organizationEmail,
        phone: user.phone,
        boardMemberDetails: user.boardMemberDetails,
        organizationRegistrationNumber: user.organizationRegistrationNumber
      }
    });

  } catch (error) {
    console.error('Error finding user by email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find user by email',
      error: error.message
    });
  }
};

// Check if User has Password Set (Internal API)
exports.checkUserPasswordExists = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if password field exists and is not null/empty
    const hasPassword = !!(user.password && user.password.trim() !== '');

    res.json({
      success: true,
      message: 'Password check completed',
      data: {
        userId: user._id,
        hasPassword: hasPassword,
        accountStatus: user.accountStatus,
        email: user.email || user.organizationEmail
      }
    });

  } catch (error) {
    console.error('Error checking user password exists:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check user password',
      error: error.message
    });
  }
};

// Send Email (Internal API)
exports.sendInternalEmail = async (req, res) => {
  try {
    const { to, subject, html, text } = req.body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required email parameters'
      });
    }

    await sendEmail({
      to,
      subject,
      html: html || text,
      text
    });

    res.json({
      success: true,
      message: 'Email sent successfully'
    });

  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    });
  }
};

// Get User by ID (Internal API)
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const user = await User.findById(userId).select('-password -recoveryKeyHash -__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Build user data object safely
    const userData = {
      _id: user._id,
      type: user.type,
      role: user.role,
      accountStatus: user.accountStatus,
      logo: user.logo
    };

    // Add name based on user type
    if (user.type === 'individual') {
      userData.name = user.firstName && user.lastName ? 
        `${user.firstName} ${user.lastName}`.trim() : 
        user.username || user.email || 'Unknown User';
      userData.firstName = user.firstName;
      userData.lastName = user.lastName;
      userData.email = user.email;
      userData.organizationName = user.organizationName;
    } else if (user.type === 'organization') {
      userData.name = user.organizationName || user.username || 'Unknown Organization';
      userData.organizationName = user.organizationName;
      userData.organizationEmail = user.organizationEmail;
      userData.email = user.organizationEmail || user.email;
      userData.registrationNumber = user.registrationNumber;
      userData.organizationStatus = user.organizationStatus;
    }

    res.status(200).json({
      success: true,
      data: userData,
      message: 'User retrieved successfully'
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user',
      error: error.message
    });
  }
};

// Get Multiple Users by IDs (Internal API)
exports.getUsersByIds = async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array is required'
      });
    }

    // Limit batch size to prevent abuse
    if (userIds.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 50 users can be requested at once'
      });
    }

    const users = await User.find({
      _id: { $in: userIds }
    }).select('-password -recoveryKeyHash -__v');

    // Create a map of userId to user data
    const userMap = {};
    users.forEach(user => {
      const userData = {
        _id: user._id,
        type: user.type,
        role: user.role,
        accountStatus: user.accountStatus,
        logo: user.logo
      };

      // Add name based on user type
      if (user.type === 'individual') {
        userData.name = user.firstName && user.lastName ? 
          `${user.firstName} ${user.lastName}`.trim() : 
          user.username || user.email || 'Unknown User';
        userData.firstName = user.firstName;
        userData.lastName = user.lastName;
        userData.email = user.email;
        userData.organizationName = user.organizationName;
      } else if (user.type === 'organization') {
        userData.name = user.organizationName || user.username || 'Unknown Organization';
        userData.organizationName = user.organizationName;
        userData.organizationEmail = user.organizationEmail;
        userData.email = user.organizationEmail || user.email;
        userData.registrationNumber = user.registrationNumber;
        userData.organizationStatus = user.organizationStatus;
      }

      userMap[user._id.toString()] = userData;
    });

    res.status(200).json({
      success: true,
      data: userMap,
      message: `${users.length} users retrieved successfully`
    });
  } catch (error) {
    console.error('Get users by IDs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
      error: error.message
    });
  }
};

// Helper function to create board member setup email template
function createBoardMemberSetupEmail({ name, boardRole, setupToken, recoveryKey, setupUrl }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Welcome to the Board - Account Setup</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .button { background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
            .recovery-key { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .important { color: #e74c3c; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to the Board!</h1>
            </div>
            <div class="content">
                <h2>Hello ${name},</h2>
                <p>Congratulations! You have been added as a <strong>${boardRole}</strong> to the organization's board. To complete your account setup, please follow these steps:</p>
                
                <h3>Step 1: Set Your Password</h3>
                <p>Click the button below to set your account password:</p>
                <a href="${setupUrl}" class="button">Set Password</a>
                
                <h3>Step 2: Save Your Recovery Key</h3>
                <div class="recovery-key">
                    <h4>🔑 Your Recovery Key</h4>
                    <p><strong>${recoveryKey}</strong></p>
                    <p class="important">IMPORTANT: Save this recovery key in a secure location. You'll need it to recover your account if you forget your password.</p>
                </div>
                
                <h3>Important Information:</h3>
                <ul>
                    <li>Your setup link will expire in 24 hours</li>
                    <li>Your recovery key is unique and cannot be regenerated</li>
                    <li>Keep your recovery key confidential and secure</li>
                    <li>You can download a PDF copy of your recovery key from your account</li>
                </ul>
                
                <p>If you have any questions or need assistance, please contact the system administrator.</p>
                
                <p>Welcome aboard!<br>
                <strong>Kenya Digital Health Agency Team</strong></p>
            </div>
        </div>
    </body>
    </html>
  `;
}

module.exports.helpers = {
  getAccountSecurityState,
  getSystemUserId,
  isLocalhostIP,
  THREAT_PATTERNS
};