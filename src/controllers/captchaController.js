// src/controllers/captchaController.js
const { createCaptchaChallenge } = require('../utils/captcha');

/**
 * Generate a new CAPTCHA challenge
 * Returns the CAPTCHA text and token
 */
exports.generateCaptcha = async (req, res) => {
  try {
    const { text, token, expiresAt } = createCaptchaChallenge();

    // Return the text (to be displayed as distorted image on frontend)
    // and token (to be stored and verified later)
    res.status(200).json({
      captchaText: text,
      captchaToken: token,
      expiresAt: expiresAt
    });
  } catch (err) {
    console.error('CAPTCHA generation error:', err);
    res.status(500).json({ message: 'Failed to generate CAPTCHA' });
  }
};
