// src/routes/captchaRoutes.js
const express = require('express');
const router = express.Router();
const { generateCaptcha } = require('../controllers/captchaController');
const { captchaLimiter } = require('../middleware/rateLimiter');

// Generate new CAPTCHA
router.get('/generate', captchaLimiter, generateCaptcha);

module.exports = router;
