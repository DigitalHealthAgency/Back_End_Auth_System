// src/controllers/googleAuthController.js
const { generateToken } = require('../utils/generateToken');

/**
 * Google OAuth Success Handler
 * Called after successful Google authentication
 */
exports.googleAuthSuccess = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: 'Authentication failed',
        code: 'AUTH_FAILED'
      });
    }

    // Generate JWT token with twoFactorConfirmed (Google OAuth users skip 2FA)
    const crypto = require('crypto');
    const sessionId = crypto.randomUUID();
    const token = generateToken(user._id, true, {
      sessionId,
      tokenVersion: user.tokenVersion || 0,
      twoFactorConfirmed: true
    });

    // Add session to user
    user.sessions = user.sessions || [];
    user.sessions.unshift({
      sessionId,
      ip: req.ip || 'unknown',
      device: req.headers['user-agent'] || 'Google OAuth',
      createdAt: new Date()
    });
    if (user.sessions.length > 5) user.sessions = user.sessions.slice(0, 5);
    await user.save();

    console.log(`Google OAuth success: ${user.email} (${user.username})`);

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/dashboard?oauth=success&token=${token}`;

    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Google auth success handler error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/login?error=auth_failed`);
  }
};

/**
 * Google OAuth Failure Handler
 * Called when Google authentication fails
 */
exports.googleAuthFailure = async (req, res) => {
  console.log('Google OAuth failed or cancelled');

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/login?error=oauth_failed`);
};
