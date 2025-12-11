//  CRITICAL SECURITY FIX: CAPTCHA Verification
// SRS Requirements: FR-SEC-001 (Failed Login Handling)
// Required after 3 failed login attempts

const axios = require('axios');

/**
 * Verify Google reCAPTCHA token
 * @param {string} token - reCAPTCHA response token from client
 * @param {string} remoteip - User's IP address (optional)
 * @returns {Promise<Object>} - { success: boolean, score: number, errors: Array }
 */
const verifyRecaptcha = async (token, remoteip = null) => {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.error(' RECAPTCHA_SECRET_KEY not configured');
    // In development, allow bypass if not configured
    if (process.env.NODE_ENV === 'development') {
      console.warn(' CAPTCHA bypassed in development mode');
      return { success: true, score: 1.0, bypassed: true };
    }
    return {
      success: false,
      errors: ['CAPTCHA not configured on server'],
      code: 'CAPTCHA_NOT_CONFIGURED'
    };
  }

  if (!token) {
    return {
      success: false,
      errors: ['CAPTCHA token is required'],
      code: 'CAPTCHA_TOKEN_MISSING'
    };
  }

  try {
    const params = new URLSearchParams({
      secret: secretKey,
      response: token
    });

    if (remoteip) {
      params.append('remoteip', remoteip);
    }

    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 5000
      }
    );

    const data = response.data;

    if (!data.success) {
      return {
        success: false,
        errors: data['error-codes'] || ['CAPTCHA verification failed'],
        code: 'CAPTCHA_INVALID'
      };
    }

    // For reCAPTCHA v3, check score (0.0 - 1.0, higher is better)
    // For reCAPTCHA v2, no score is provided
    const score = data.score || 1.0;

    // Minimum score threshold (0.5 is recommended for v3)
    const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');

    if (score < minScore) {
      return {
        success: false,
        score,
        errors: [`CAPTCHA score too low: ${score} < ${minScore}`],
        code: 'CAPTCHA_SCORE_TOO_LOW'
      };
    }

    return {
      success: true,
      score,
      hostname: data.hostname,
      challengeTimestamp: data.challenge_ts
    };

  } catch (error) {
    console.error('CAPTCHA verification error:', error.message);

    // Handle timeout errors
    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        errors: ['CAPTCHA verification timeout'],
        code: 'CAPTCHA_TIMEOUT',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }

    return {
      success: false,
      errors: ['CAPTCHA verification service unavailable'],
      code: 'CAPTCHA_SERVICE_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
};

/**
 * Check if CAPTCHA is required based on failed attempts
 * @param {number} failedAttempts - Number of failed login attempts
 * @returns {boolean} - True if CAPTCHA is required
 */
const isCaptchaRequired = (failedAttempts) => {
  const threshold = parseInt(process.env.CAPTCHA_THRESHOLD || '3', 10);
  return failedAttempts >= threshold;
};

/**
 * Middleware to verify CAPTCHA token
 * @param {boolean} required - Whether CAPTCHA is required (default: false)
 * @returns {Function} - Express middleware
 */
const verifyCaptchaMiddleware = (required = false) => {
  return async (req, res, next) => {
    const captchaToken = req.body.captchaToken || req.body.recaptchaToken;
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;

    // If CAPTCHA is required but not provided
    if (required && !captchaToken) {
      return res.status(400).json({
        message: 'CAPTCHA verification required',
        code: 'CAPTCHA_REQUIRED',
        requiresCaptcha: true
      });
    }

    // If CAPTCHA token is provided, verify it
    if (captchaToken) {
      const result = await verifyRecaptcha(captchaToken, clientIP);

      if (!result.success) {
        return res.status(400).json({
          message: 'CAPTCHA verification failed',
          code: result.code || 'CAPTCHA_INVALID',
          errors: result.errors,
          requiresCaptcha: true
        });
      }

      // Attach CAPTCHA result to request
      req.captchaVerified = true;
      req.captchaScore = result.score;
    }

    next();
  };
};

module.exports = {
  verifyRecaptcha,
  isCaptchaRequired,
  verifyCaptchaMiddleware
};
