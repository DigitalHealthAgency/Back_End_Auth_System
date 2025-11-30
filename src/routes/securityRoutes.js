const express = require('express');
const router = express.Router();
const { getUserSecurityLogs } = require('../controllers/securityController');
const auth = require('../middleware/authMiddleware');

// Use the middleware directly on the router before defining routes
router.get('/logs', auth, getUserSecurityLogs);

module.exports = router;