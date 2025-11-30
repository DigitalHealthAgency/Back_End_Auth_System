// middleware/maintenanceMiddleware.js
const SystemSettings = require('../models/SystemSettings');

/**
 * Middleware to check if the system is in maintenance mode
 * Allows admin users to bypass maintenance mode
 */
const maintenanceCheck = async (req, res, next) => {
  try {
    // Skip the check for authentication routes
    const bypassPaths = ['/api/auth/login', '/api/auth/admin-bypass'];
    if (bypassPaths.includes(req.path)) {
      return next();
    }
    
    const settings = await SystemSettings.getSettings();
    
    if (settings.maintenanceMode) {
      // Check if user is admin (can bypass maintenance mode)
      if (req.user && req.user.role === 'admin') {
        // Admin users can bypass maintenance mode
        return next();
      }
      
      // Return maintenance mode response for non-admin users
      return res.status(503).json({
        status: 'maintenance',
        message: settings.maintenanceMessage || 'System is currently under maintenance',
        plannedEnd: settings.plannedMaintenanceEnd
      });
    }
    
    next();
  } catch (err) {
    console.error('Error in maintenance check middleware:', err);
    next(); // Proceed even if there's an error checking maintenance status
  }
};

module.exports = maintenanceCheck;