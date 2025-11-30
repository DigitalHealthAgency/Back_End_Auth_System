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

module.exports = {
  forgotPasswordSchema,
  verifyCodeSchema,
  recoveryLoginSchema
};