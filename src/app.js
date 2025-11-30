// src/app.js
const express = require('express');
//const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const passwordRoutes = require('./routes/passwordRoutes');
const userServiceRoutes = require('./routes/userServiceRoutes');
const { 
  checkIPSecurity, 
  detectSuspiciousActivity,
  advancedThreatDetection 
  // adaptiveRateLimit - REMOVED: Rate limiting is handled by API Gateway
} = require('./middleware/ipSecurityMiddleware');
const recoveryRoutes = require('./routes/recoveryRoutes');
const twoFactorRoutes = require('./routes/twoFactorRoutes');
const { router: cronRoutes, setCronManager } = require('./routes/cronRoutes');

// Initialize cron manager
const CronManager = require('./jobs/cronManager');
const cronManager = new CronManager();

const app = express();

// CORS and basic middleware
//app.use(cors({
  //origin: '*',
  //credentials: true
//}));

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Security middleware chain
// NOTE: Rate limiting is handled by API Gateway layer
// Only apply threat detection and IP security here
app.use(checkIPSecurity);
app.use(detectSuspiciousActivity);
app.use(advancedThreatDetection);
// REMOVED: adaptiveRateLimit - causes double rate limiting with API Gateway

// Default route
app.get('/', (req, res) => {
  res.send('Huduma Hub is running...');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Auth System is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Auth route
app.use('/api/auth', authRoutes);

// Password reset routes
app.use('/api/password', passwordRoutes);

// User service routes (for microservice communication)
app.use('/api/users', userServiceRoutes);

// Recovery PDF route - serve the PDF from the temp folder
app.use('/recovery', recoveryRoutes);

// Two-factor authentication routes
app.use('/api/two-factor', twoFactorRoutes);

// Cron job management routes
app.use('/api/cron', cronRoutes);

// Set the cron manager instance for the routes
setCronManager(cronManager);

// Start cron jobs if not in test environment
if (process.env.NODE_ENV !== 'test') {
  cronManager.startAll();
  console.log('[App] Cron manager initialized and started');
}



module.exports = app;