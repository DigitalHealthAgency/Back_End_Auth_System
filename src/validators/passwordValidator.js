const Joi = require('joi');

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required()
});

const verifyCodeSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  code: Joi.string().length(4).required() // Adjust length if your code is different
});

// Recovery key: 4 groups of 4 allowed chars separated by hyphens
const allowedChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const recoveryKeyRegex = new RegExp(
  `^[${allowedChars}]{4}-[${allowedChars}]{4}-[${allowedChars}]{4}-[${allowedChars}]{4}$`
);

const recoveryLoginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  recoveryKey: Joi.string().pattern(recoveryKeyRegex).required().messages({
    'string.pattern.base': 'Recovery key must be in format XXXX-XXXX-XXXX-XXXX using allowed characters'
  })
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&#)'
    })
});

module.exports = {
  forgotPasswordSchema,
  verifyCodeSchema,
  resetPasswordSchema,
  recoveryLoginSchema
};