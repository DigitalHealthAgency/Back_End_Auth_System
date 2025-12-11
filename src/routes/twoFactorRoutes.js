// src/routes/twoFactorRoutes.js
const express = require('express');
const router = express.Router();
const { generate2FASecret, verify2FACode, disable2FA } = require('../controllers/twoFactorController');
const protect = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { verify2FASchema, disable2FASchema } = require('../validators/twoFactorValidator');

// Setup flow
router.post('/generate', protect, generate2FASecret);
router.get('/generate', protect, generate2FASecret); // Support both GET and POST
router.post('/verify', protect, validate(verify2FASchema), verify2FACode);

// Disable 2FA
router.post('/disable', protect, validate(disable2FASchema), disable2FA);

module.exports = router;
