// src/app.js
const express = require('express');
//const cors = require('cors');
const cookieParser = require('cookie-parser');
const passport = require('./config/passport');
const authRoutes = require('./routes/authRoutes');
const passwordRoutes = require('./routes/passwordRoutes');
const captchaRoutes = require('./routes/captchaRoutes');
const googleAuthRoutes = require('./routes/googleAuthRoutes');
const userServiceRoutes = require('./routes/userServiceRoutes');
const roleRoutes = require('./routes/roleRoutes');
const teamRoutes = require('./routes/teamRoutes');
const suspensionAppealRoutes = require('./routes/suspensionAppealRoutes');
const securityAdminRoutes = require('./routes/admin/securityAdminRoutes');
const adminUsersRoutes = require('./routes/admin/adminUsersRoutes');
const adminSecurityRoutes = require('./routes/admin/adminSecurityRoutes');
const dashboardRoutes = require('./routes/admin/dashboardRoutes');
const vendorRoutes = require('./routes/vendor/vendorRoutes');
const {
  checkIPSecurity,
  detectSuspiciousActivity,
  advancedThreatDetection
  // adaptiveRateLimit - REMOVED: Rate limiting is handled by API Gateway
} = require('./middleware/ipSecurityMiddleware');
const recoveryRoutes = require('./routes/recoveryRoutes');
const twoFactorRoutes = require('./routes/twoFactorRoutes');
const { router: cronRoutes, setCronManager } = require('./routes/cronRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const testRoutes = require('./routes/testRoutes');

// Initialize cron manager
const CronManager = require('./jobs/cronManager');
const cronManager = new CronManager();

const app = express();

// CORS and basic middleware
// Enable CORS for frontend to send cookies
const cors = require('cors');
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:8000',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://192.168.1.102:8080',  // Mobile/Network access
    'http://192.168.1.102:5173',  // Frontend on network
    /^http:\/\/192\.168\.1\.\d+:\d+$/  // Allow any 192.168.1.x IP with any port
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie']
}));

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// XSS sanitization middleware
const sanitizeInput = require('./middleware/sanitize');
app.use(sanitizeInput);

// Initialize Passport
app.use(passport.initialize());

// Security middleware chain
// NOTE: Rate limiting is handled by API Gateway layer
// Only apply threat detection and IP security here
app.use(checkIPSecurity);
app.use(detectSuspiciousActivity);
app.use(advancedThreatDetection);
// REMOVED: adaptiveRateLimit - causes double rate limiting with API Gateway

// Default route
app.get('/', (req, res) => {
  res.send('Kenya Digital Health Agency Auth Service is running...');
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

// Auth routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', googleAuthRoutes);

// Password reset routes
app.use('/api/password', passwordRoutes);

// CAPTCHA routes
app.use('/api/captcha', captchaRoutes);

// User service routes (for microservice communication)
app.use('/api/users', userServiceRoutes);

// Role management routes
app.use('/api/roles', roleRoutes);

// Team management routes
app.use('/api/team', teamRoutes);

// Suspension appeal routes
app.use('/api/appeals', suspensionAppealRoutes);

// Recovery PDF route - serve the PDF from the temp folder
app.use('/recovery', recoveryRoutes);

// Two-factor authentication routes
app.use('/api/2fa', twoFactorRoutes);

// Cron job management routes
app.use('/api/cron', cronRoutes);

// Admin security routes (old)
app.use('/api/admin/security', securityAdminRoutes);

// Admin security routes (new - stats and monitoring)
app.use('/api/admin/security', adminSecurityRoutes);

// Admin users routes
app.use('/api/admin/users', adminUsersRoutes);

// Admin dashboard routes
app.use('/api/admin/dashboard', dashboardRoutes);

// Vendor routes
app.use('/api/vendor', vendorRoutes);

// Application routes (for separation of duties tests)
app.use('/api/applications', applicationRoutes);

// Test routes (for separation of duties tests)
app.use('/api/tests', testRoutes);

// Set the cron manager instance for the routes
setCronManager(cronManager);

// Start cron jobs if not in test environment
if (process.env.NODE_ENV !== 'test') {
  cronManager.startAll();
  console.log('[App] Cron manager initialized and started');
}



module.exports = app;