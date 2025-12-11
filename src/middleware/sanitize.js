/**
 * XSS Sanitization Middleware
 * Sanitizes user input to prevent XSS attacks
 */

const validator = require('validator');

/**
 * Check if a value contains null bytes or other dangerous characters
 * @param {string} value - The value to check
 * @returns {boolean} - True if dangerous characters found
 */
function containsDangerousCharacters(value) {
  if (typeof value !== 'string') return false;

  // Check for null bytes
  if (value.includes('\x00')) return true;

  return false;
}

/**
 * Sanitize a string value by removing HTML tags and escaping remaining HTML
 * @param {string} value - The value to sanitize
 * @returns {string|Error} - Sanitized value or Error if dangerous characters found
 */
function sanitizeString(value) {
  if (typeof value !== 'string') return value;

  // Check for dangerous characters first - reject before sanitizing
  if (containsDangerousCharacters(value)) {
    throw new Error('DANGEROUS_INPUT');
  }

  // Strip all HTML tags first
  let sanitized = value.replace(/<[^>]*>/g, '');

  // Then escape any remaining HTML entities
  sanitized = validator.escape(sanitized);

  // Strip low ASCII characters
  sanitized = validator.stripLow(sanitized);

  return sanitized;
}

/**
 * Recursively sanitize an object
 * @param {any} obj - The object to sanitize
 * @returns {any} - Sanitized object
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  // Handle strings
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  // Return other types as-is
  return obj;
}

/**
 * Express middleware to sanitize request body, query, and params
 */
function sanitizeInput(req, res, next) {
  try {
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    if (error.message === 'DANGEROUS_INPUT') {
      return res.status(400).json({
        message: 'Invalid characters detected in input',
        code: 'INVALID_INPUT'
      });
    }
    next(error);
  }
}

module.exports = sanitizeInput;
