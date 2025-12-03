// src/routes/googleAuthRoutes.js
const express = require('express');
const passport = require('passport');
const router = express.Router();
const { googleAuthSuccess, googleAuthFailure } = require('../controllers/googleAuthController');

/**
 * @route GET /api/auth/google
 * @desc Initiate Google OAuth flow
 * @access Public
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

/**
 * @route GET /api/auth/google/callback
 * @desc Google OAuth callback URL
 * @access Public
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/api/auth/google/failure',
    session: false
  }),
  googleAuthSuccess
);

/**
 * @route GET /api/auth/google/failure
 * @desc Google OAuth failure redirect
 * @access Public
 */
router.get('/google/failure', googleAuthFailure);

module.exports = router;
