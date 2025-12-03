// src/utils/captcha.js
const crypto = require('crypto');

/**
 * Generates a random CAPTCHA text (6 alphanumeric characters)
 * Excludes confusing characters: 0, O, 1, I, l
 */
function generateCaptchaText(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

/**
 * Generates CAPTCHA token (hashed version to store in session/db)
 */
function generateCaptchaToken(text) {
  const hash = crypto.createHash('sha256');
  hash.update(text.toUpperCase());
  return hash.digest('hex');
}

/**
 * Verifies if the provided answer matches the CAPTCHA token
 */
function verifyCaptcha(userInput, captchaToken) {
  if (!userInput || !captchaToken) return false;

  const inputHash = generateCaptchaToken(userInput);
  return inputHash === captchaToken;
}

/**
 * Creates a CAPTCHA challenge
 * Returns: { text: 'ABC123', token: 'hashed_value', expiresAt: Date }
 */
function createCaptchaChallenge() {
  const text = generateCaptchaText();
  const token = generateCaptchaToken(text);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  return {
    text,
    token,
    expiresAt
  };
}

module.exports = {
  generateCaptchaText,
  generateCaptchaToken,
  verifyCaptcha,
  createCaptchaChallenge
};
