// src/routes/passwordRoutes.js
const express = require('express');
const router = express.Router();
const { forgotPassword, verifyCode, recoveryLogin } = require('../controllers/passwordController');
const validate = require('../middleware/validate');
const { forgotPasswordSchema, verifyCodeSchema, recoveryLoginSchema } = require('../validators/passwordValidator');
const { forgotPasswordLimiter } = require('../middleware/rateLimiter');

router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/verify-code', validate(verifyCodeSchema), verifyCode);
router.post('/recovery-login', validate(recoveryLoginSchema), recoveryLogin);

module.exports = router;
// This code defines the routes for password reset functionality in an Express application. It imports the necessary modules, sets up the router, and defines three POST routes: one for requesting a password reset code, another for verifying that code, and a third for logging in with recovery credentials. The routes are then exported for use in the main application file.
// The forgotPassword route handles the request to send a password reset code to the user's email, the verifyCode route checks if the provided code is valid and not expired, and the recoveryLogin route allows the user to log in using recovery credentials. The routes are linked to their respective controller functions for handling the logic.
// Additionally, this code includes validation middleware for all three routes, ensuring that the data sent to the server complies with the defined schemas (forgotPasswordSchema, verifyCodeSchema, and recoveryLoginSchema) before reaching the controller functions.
// The forgotPassword route is also protected by a rate limiter middleware (forgotPasswordLimiter) to prevent abuse by limiting the number of requests that can be made to this route in a given time period.