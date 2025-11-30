// src/middleware/featureToggleMiddleware.js
const FeatureToggle = require('../models/FeatureToggle');
const logActivity = require('../utils/activityLogger');
/**
 * Middleware to check if a specific feature is enabled and accessible to the current user
 * @param {String} featureName - Name of the feature to check
 * @returns {Function} Middleware function
 */
const requireFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      // Skip for admin users if desired (optional - can be removed to enforce checks for everyone)
      //if (req.user && req.user.role === 'admin') return next();
      
      const feature = await FeatureToggle.findOne({ name: featureName });
      
      // If feature doesn't exist or is not enabled
      if (!feature || !feature.enabled) {
        return res.status(403).json({
          message: 'This feature is currently unavailable',
          feature: featureName
        });
      }
      
      // Check if user has access to this feature
      const hasAccess = feature.isAccessibleTo(req.user);
      
      if (!hasAccess) {
        return res.status(403).json({
          message: 'You do not have access to this feature',
          feature: featureName
        });
      }
      
      // Feature is enabled and user has access
      // Attach feature to request object for potential use in controller
      req.feature = feature;
      
      next();
    } catch (error) {
      console.error(`Error in feature toggle middleware for ${featureName}:`, error);
      // Default to denying access on error
      res.status(500).json({
        message: 'Error checking feature access',
        feature: featureName
      });
    }
  };
};

/**
 * Middleware to attach all available features to the request object
 * Used for routes that need to know what features are available to the user
 */
const attachUserFeatures = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const features = await FeatureToggle.getForUser(req.user);
    
    // Attach formatted feature map to request object
    req.userFeatures = features.reduce((acc, feature) => {
      acc[feature.name] = {
        id: feature._id,
        enabled: feature.enabled,
        settings: feature.settings || {}
      };
      return acc;
    }, {});
    
    next();
  } catch (error) {
    console.error('Error attaching user features:', error);
    // Continue without features on error
    req.userFeatures = {};
    next();
  }
};

/**
 * Middleware to log feature usage
 * @param {String} featureName - Name of the feature being used
 * @returns {Function} Middleware function
 */
const logFeatureUsage = (featureName) => {
  return async (req, res, next) => {
    try {
      if (req.user) {
        await logActivity({
          user: req.user._id,
          action: 'FEATURE_USAGE',
          description: `Used feature: ${featureName}`,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        });
      }
    } catch (error) {
      console.error(`Error logging feature usage for ${featureName}:`, error);
      // Continue even if logging fails
    }
    
    next();
  };
};

module.exports = {
  requireFeature,
  attachUserFeatures,
  logFeatureUsage
};