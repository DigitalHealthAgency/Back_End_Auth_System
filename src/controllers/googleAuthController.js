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

    // Generate JWT token
    const token = generateToken(user);

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
