const Joi = require('joi');

const verify2FASchema = Joi.object({
  token: Joi.string().length(6).pattern(/^\d+$/).required()
});

const disable2FASchema = Joi.object({
  password: Joi.string().min(8).max(64).required(),
  twoFactorCode: Joi.string().length(6).pattern(/^\d+$/).optional()
}).unknown(false);

module.exports = {
  verify2FASchema,
  disable2FASchema
};