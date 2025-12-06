// src/controllers/passwordController.js
const PasswordReset = require('../models/PasswordReset');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const generateCode = require('../utils/generateCode');
const logActivity = require('../utils/activityLogger');
const bcrypt = require('bcryptjs');
const { createPasswordResetEmail } = require('../utils/emailTemplates');


exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Find user by either email or organizationEmail
    const user = await User.findOne({
      $or: [
        { email },
        { organizationEmail: email }
      ]
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins from now

    await PasswordReset.findOneAndUpdate(
      { email },
      { code, expiresAt },
      { upsert: true, new: true }
    );

    await logActivity({
      user: user._id,
      action: 'PASSWORD_RESET_REQUEST',
      description: 'Password reset code generated',
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    await sendEmail({
      to: email,
      subject: 'Kenya DHA Password Reset Code',
      html: createPasswordResetEmail(email, code)
    });

    res.status(200).json({ message: 'Reset code sent to email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

exports.verifyCode = async (req, res) => {
  const { email, code } = req.body;

  try {
    // Find the password reset record for either email or organizationEmail
    const record = await PasswordReset.findOne({
      email
    });
    if (!record || record.code !== code)
      return res.status(400).json({ message: 'Invalid or expired code' });

    if (record.expiresAt < new Date())
      return res.status(400).json({ message: 'Code expired' });

    // Find user by either email or organizationEmail
    const user = await User.findOne({
      $or: [
        { email },
        { organizationEmail: email }
      ]
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Mark the code as verified
    record.verified = true;
    await record.save();

    await logActivity({
      user: user._id,
      action: 'PASSWORD_RESET_CODE_VERIFIED',
      description: `Password reset code verified for email: ${email}`,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Create session and log the user in immediately after code verification
    const sessionId = require('crypto').randomUUID();
    user.sessions = user.sessions || [];
    user.sessions.unshift({
      sessionId,
      ip: req.ip,
      device: req.headers['user-agent'] || 'Unknown',
      createdAt: new Date()
    });
    if (user.sessions.length > 5) user.sessions = user.sessions.slice(0, 5);

    // Reset failed attempts and unlock account
    user.failedAttempts = 0;
    user.lockedUntil = undefined;

    await user.save();

    // Generate token with sessionId and twoFactorConfirmed flag
    const { generateToken } = require('../utils/generateToken');
    const token = generateToken(user._id, false, {
      sessionId,
      tokenVersion: user.tokenVersion || 0,
      ip: req.ip,
      deviceInfo: req.headers['user-agent'] || 'Unknown',
      twoFactorConfirmed: true
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
    });

    // Import role utilities
    const { getRolePortal, getRoleDisplayName } = require('../constants/roles');

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
        accountStatus: user.accountStatus,
        firstTimeSetup: user.firstTimeSetup || false
      },
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Verification failed' });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    // Verify that the code was verified (and not expired)
    const record = await PasswordReset.findOne({
      email,
      verified: true
    });

    if (!record)
      return res.status(400).json({ message: 'Please verify your reset code first' });

    if (record.expiresAt < new Date()) {
      await PasswordReset.deleteOne({ email });
      return res.status(400).json({ message: 'Reset code expired. Please request a new one.' });
    }

    // Find user by either email or organizationEmail
    const user = await User.findOne({
      $or: [
        { email },
        { organizationEmail: email }
      ]
    }).select('+password +passwordHistory');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check if new password matches any of the last 5 passwords
    const passwordHistory = user.passwordHistory || [];
    for (const oldPassword of passwordHistory) {
      const isOldPassword = await bcrypt.compare(newPassword, oldPassword.hash);
      if (isOldPassword) {
        return res.status(400).json({
          message: 'New password cannot be the same as any of your last 5 passwords'
        });
      }
    }

    // Check current password too
    if (user.password) {
      const isSameAsCurrent = await bcrypt.compare(newPassword, user.password);
      if (isSameAsCurrent) {
        return res.status(400).json({
          message: 'New password cannot be the same as your current password'
        });
      }
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password history
    if (user.password) {
      passwordHistory.unshift({
        hash: user.password,
        changedAt: new Date()
      });

      // Keep only last 5 passwords
      if (passwordHistory.length > 5) {
        passwordHistory.splice(5);
      }
    }

    // Update user password and related fields
    user.password = hashedPassword;
    user.passwordHistory = passwordHistory;
    user.passwordLastChanged = new Date();
    user.passwordExpiresAt = new Date(Date.now() + (user.passwordExpiryDays || 90) * 24 * 60 * 60 * 1000);
    user.failedAttempts = 0; // Reset failed attempts
    user.lockedUntil = undefined; // Unlock account if locked

    await user.save();

    // Delete the password reset record
    await PasswordReset.deleteOne({ email });

    // Log the activity
    await logActivity({
      user: user._id,
      action: 'PASSWORD_RESET_COMPLETED',
      description: 'User successfully reset their password',
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Create session and log the user in
    const sessionId = require('crypto').randomUUID();
    user.sessions = user.sessions || [];
    user.sessions.unshift({
      sessionId,
      ip: req.ip,
      device: req.headers['user-agent'] || 'Unknown',
      createdAt: new Date()
    });
    if (user.sessions.length > 5) user.sessions = user.sessions.slice(0, 5);
    await user.save();

    // Generate token with sessionId
    const { generateToken } = require('../utils/generateToken');
    const token = generateToken(user._id, false, {
      sessionId,
      tokenVersion: user.tokenVersion || 0,
      ip: req.ip,
      deviceInfo: req.headers['user-agent'] || 'Unknown',
      twoFactorConfirmed: true
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',  // Allow cross-origin
      path: '/'
    });

    res.status(200).json({
      message: 'Password reset successfully. You are now logged in.',
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
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Password reset failed' });
  }
};

exports.recoveryLogin = async (req, res) => {
  const { email, recoveryKey } = req.body;
  try {
    // Find user by either email or organizationEmail
    const user = await User.findOne({
      $or: [
        { email },
        { organizationEmail: email }
      ]
    }).select('+recoveryKeyHash');

    if (!user || !user.recoveryKeyHash)
      return res.status(404).json({ message: 'User or recovery key not found' });

    const match = await bcrypt.compare(recoveryKey, user.recoveryKeyHash);
    if (!match)
      return res.status(401).json({ message: 'Invalid recovery key' });

    const sessionId = require('crypto').randomUUID();
    user.sessions = user.sessions || [];
    user.sessions.unshift({
      sessionId,
      ip: req.ip,
      device: req.headers['user-agent'] || 'Unknown',
      createdAt: new Date()
    });
    if (user.sessions.length > 5) user.sessions = user.sessions.slice(0, 5);
    await user.save();

    // Generate token with sessionId
    const { generateToken } = require('../utils/generateToken');
    const token = generateToken(user._id, false, {
      sessionId,
      tokenVersion: user.tokenVersion || 0,
      ip: req.ip,
      deviceInfo: req.headers['user-agent'] || 'Unknown',
      twoFactorConfirmed: true
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',  // Allow cross-origin
      path: '/'
    });

    await logActivity({
      user: user._id,
      action: 'RECOVERY_LOGIN',
      description: 'User logged in with recovery key',
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({ message: 'Logged in with recovery key', user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Recovery login failed' });
  }
};

// this function handles the password reset process. It first checks if the user exists, generates a code, and sends it to the user's email. It also handles the verification of the code and generates a token for the user if the code is valid.
// The code uses the PasswordReset model to store the reset code and expiration time, and the User model to find the user. It also uses a utility function to send emails and another utility function to generate tokens.