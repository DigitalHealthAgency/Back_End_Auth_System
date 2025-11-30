const Joi = require('joi');

const clientValidationSchema = Joi.object({
  clientName: Joi.string().min(2).max(100).required(),
  clientAddress: Joi.string().min(5).max(200).required(),
  contactPersonName: Joi.string().min(2).max(100).required(),
  contactPersonPhone: Joi.string().pattern(/^[0-9+\-()\s]*$/).required(),
  contactPersonEmail: Joi.string().email().required()
});

module.exports = { clientValidationSchema };
