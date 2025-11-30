// src/models/PasswordReset.js
const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
  email: { type: String, required: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
// This model represents a password reset request, including the email address, the reset code, and the expiration time of the request.