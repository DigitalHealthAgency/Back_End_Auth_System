// src/config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

/**
 * Google OAuth 2.0 Strategy Configuration
 * Handles authentication via Google Sign-In
 */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        passReqToCallback: true
      },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Extract profile information
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        const firstName = profile.name ? profile.name.givenName : '';
        const lastName = profile.name ? profile.name.familyName : '';
        const googleId = profile.id;

        if (!email) {
          return done(new Error('No email found in Google profile'), null);
        }

        // Check if user already exists by Google ID
        let user = await User.findOne({ googleId });

        if (user) {
          // User exists, update last login
          user.lastLogin = new Date();
          await user.save();
          return done(null, user);
        }

        // Check if user exists with the same email
        user = await User.findOne({ email });

        if (user) {
          // Link Google account to existing user
          user.googleId = googleId;
          user.lastLogin = new Date();
          user.twoFactorEnabled = false; // Disable 2FA when linking Google
          user.twoFactorSetupRequired = false;
          await user.save();
          return done(null, user);
        }

        // Create new user with Google authentication
        // Generate a unique username from email
        const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        let username = baseUsername;
        let counter = 1;

        // Ensure username is unique
        while (await User.findOne({ username })) {
          username = `${baseUsername}${counter}`;
          counter++;
        }

        user = new User({
          username,
          firstName,
          lastName,
          email,
          googleId,
          type: 'individual', // Default to individual user type
          role: 'public_user', // Default role
          accountStatus: 'active', // Google users are active immediately
          isEmailVerified: true, // Google email is already verified
          receiveSystemAlerts: true,
          twoFactorEnabled: false, // Disable 2FA for Google OAuth users
          twoFactorSetupRequired: false, // Don't require 2FA setup
          password: null, // No password for Google auth users
          lastLogin: new Date()
        });

        await user.save();

        return done(null, user);
      } catch (error) {
        console.error('Google OAuth error:', error);
        return done(error, null);
      }
    }
  )
  );
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
