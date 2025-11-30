// src/middleware/impersonationMiddleware.js
const jwt = require('jsonwebtoken');

/**
 * Verify a JWT token
 * @param {String} token - JWT token to verify
 * @returns {Object|null} - Decoded token or null if invalid
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    console.error('Token verification error:', err.message);
    return null;
  }
};

/**
 * Middleware to detect and handle impersonation sessions
 * Sets headers and adds metadata for tracking
 */
const handleImpersonation = async (req, res, next) => {
  if (!req.user || !req.user.impersonatedBy) {
    return next();
  }

  try {
    // Find the admin/staff user who is impersonating
    const User = require('../models/User');
    const impersonator = await User.findById(req.user.impersonatedBy).select('name email role');
    
    if (impersonator) {
      // Set headers to indicate impersonation mode
      res.set('X-Impersonation-Active', 'true');
      res.set('X-Impersonated-By', impersonator.name);
      
      // Add impersonator info to the request object for logging
      req.impersonator = {
        id: impersonator._id,
        name: impersonator.name,
        email: impersonator.email,
        role: impersonator.role
      };
    }
  } catch (err) {
    console.error('Error processing impersonation data:', err);
    // Continue processing anyway - this is non-blocking
  }

  next();
};

/**
 * Middleware to validate and process impersonation tokens
 * Used when switching from admin to impersonated user
 */
const processImpersonationToken = async (req, res, next) => {
  const token = req.body.impersonationToken || req.query.impersonationToken;
  
  if (!token) {
    return next();
  }
  
  const decoded = verifyToken(token);
  
  if (!decoded || !decoded.impersonatedBy) {
    return res.status(400).json({ message: 'Invalid impersonation token' });
  }
  
  // Create a new session cookie with the impersonation token
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 2 * 60 * 60 * 1000 // 2 hours - should match token expiry
  });
  
  next();
};

module.exports = {
  verifyToken,
  handleImpersonation,
  processImpersonationToken
};