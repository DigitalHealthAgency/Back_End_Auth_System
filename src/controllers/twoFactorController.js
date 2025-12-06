// src/controllers/twoFactorController.js
const speakeasy = require('speakeasy');
const bcrypt = require('bcryptjs');
const qrcode = require('qrcode');
const User = require('../models/User');
const { sendNotification } = require('../services/notificationService');
const logActivity = require('../utils/activityLogger');

exports.generate2FASecret = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Use organizationEmail if present, otherwise email
    const accountEmail = user.organizationEmail || user.email;

    const secret = speakeasy.generateSecret({
      name: `Kenya DHA (${accountEmail})`
    });

    user.twoFactorTempSecret = secret.base32;
    await user.save();

    const otpauthUrl = secret.otpauth_url;

    qrcode.toDataURL(otpauthUrl, (err, data_url) => {
      if (err) {
        return res.status(500).json({ message: 'Error generating QR code' });
      }

      res.status(200).json({
        qrCode: data_url,
        manualEntryKey: secret.base32
      });
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.verify2FACode = async (req, res) => {
  const { token } = req.body;
  const sessionData = req.session?.pending2FA;

  try {
    // For login: sessionData exists
    if (sessionData) {
      const user = await User.findById(sessionData.userId);
      if (!user || !user.twoFactorSecret) {
        return res.status(400).json({ message: '2FA not set up' });
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token
      });

      if (!verified) {
        return res.status(401).json({ message: 'Invalid 2FA code' });
      }

      // Login continues here
      const sessionId = crypto.randomUUID();
      const newSession = {
        sessionId,
        ip: sessionData.ip,
        device: sessionData.device,
        createdAt: new Date()
      };

      user.sessions.push(newSession);
      await user.save();

      const jwtToken = generateToken(user._id, true, {
        sessionId: sessionId,
        tokenVersion: user.tokenVersion || 0
      });
      res.cookie('token', jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      });

      delete req.session.pending2FA;

      res.status(200).json({ user, token: jwtToken });
    } else {
      // 2FA setup: permanent save of the secret
      const user = await User.findById(req.user._id);

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorTempSecret,
        encoding: 'base32',
        token
      });

      if (!verified) {
        return res.status(401).json({ message: 'Invalid verification code' });
      }

      user.twoFactorSecret = user.twoFactorTempSecret;
      user.twoFactorTempSecret = undefined;
      user.twoFactorEnabled = true;
      await user.save();

      //Send Notification for 2FA Enabled
      await sendNotification({
        userId: user._id,
        title: 'Two-Factor Authentication Enabled',
        body: 'You have successfully enabled 2FA on your account.',
        type: 'success'
      });

      // Log activity
      await logActivity({
        user: user._id,
        action: 'ENABLE_2FA',
        description: 'User enabled 2FA',
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Generate new token with twoFactorConfirmed flag so user can continue without re-login
      const { generateToken } = require('../utils/generateToken');
      const currentSessionId = req.user.sessionId; // Get current session ID from the existing token
      const newToken = generateToken(user._id, false, {
        sessionId: currentSessionId,
        tokenVersion: user.tokenVersion || 0,
        twoFactorConfirmed: true // Mark 2FA as confirmed
      });

      // Update the cookie with the new token
      res.cookie('token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
      });

      res.status(200).json({
        message: '2FA enabled successfully',
        token: newToken,
        user: {
          _id: user._id,
          twoFactorEnabled: true
        }
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '2FA verification failed' });
  }
};

exports.disable2FA = async (req, res) => {
  const { password, twoFactorCode } = req.body;

  try {
    const user = await User.findById(req.user._id).select('+twoFactorSecret');

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is not enabled' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // If 2FA is enabled, require and verify the code
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return res.status(401).json({ message: '2FA code required', requiresTwoFactor: true });
      }
      // Debug log for troubleshooting
      console.log('[2FA DEBUG] Disabling 2FA: secret =', user.twoFactorSecret, 'code =', twoFactorCode);
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode
      });
      if (!verified) {
        return res.status(401).json({ message: 'Invalid 2FA code' });
      }
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorTempSecret = undefined;
    await user.save();

    // Send Notification for 2FA Disabled
    await sendNotification({
      userId: user._id,
      title: 'Two-Factor Authentication Disabled',
      body: 'You have successfully disabled 2FA on your account.',
      type: 'warning'
    });

    // Log activity
    await logActivity({
      user: user._id,
      action: 'DISABLE_2FA',
      description: 'User disabled 2FA',
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({ message: '2FA has been disabled successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to disable 2FA' });
  }
};

