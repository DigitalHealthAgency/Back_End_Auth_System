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
      subject: 'Prezio Password Reset Code',
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

    // OPTIONAL: Delete record after use
    await PasswordReset.deleteOne({ email });

    // Find user by either email or organizationEmail
    const user = await User.findOne({
      $or: [
        { email },
        { organizationEmail: email }
      ]
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

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
      twoFactorConfirmed: false
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
    
    res.status(200).json({ message: 'Code verified', user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Verification failed' });
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
      twoFactorConfirmed: false
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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