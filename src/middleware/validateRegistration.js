const { individualSchema, organizationSchema } = require('../validators/authValidator');

/**
 * Custom validation middleware for registration that handles type-based schema selection
 * This is necessary because Joi's alternatives().try() doesn't provide specific error messages
 * when all alternatives fail
 */
module.exports = (req, res, next) => {
  try {
    const { type } = req.body;
    
    // Determine which schema to use based on type
    let schema;
    if (type === 'individual') {
      schema = individualSchema;
    } else if (type === 'organization') {
      schema = organizationSchema;
    } else {
      // Invalid or missing type
      return res.status(400).json({
        message: !type ? 'Registration type is required' : 'Invalid registration type',
        code: 'INVALID_TYPE',
        details: [{
          message: !type ? 'Registration type is required' : 'Invalid registration type. Must be "individual" or "organization"',
          path: ['type'],
          type: !type ? 'any.required' : 'any.only'
        }]
      });
    }
    
    // Validate against the selected schema
    const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    
    if (error) {
      const firstError = error.details[0];
      let errorCode = firstError.type.toUpperCase().replace(/\./g, '_');
      let errorMessage = firstError.message;
      
      // Apply custom error code mappings
      if (firstError.type === 'string.email') {
        errorCode = 'INVALID_EMAIL';
      } else if (firstError.type === 'string.min' && firstError.context?.key === 'password') {
        errorCode = 'WEAK_PASSWORD';
      } else if (firstError.type === 'string.pattern.name') {
        errorCode = 'WEAK_PASSWORD';
      } else if (firstError.type === 'string.pattern.base' &&
                 (firstError.context?.key === 'phone' || firstError.context?.key === 'organizationPhone')) {
        errorCode = 'INVALID_PHONE';
      } else if (firstError.type === 'any.required') {
        const key = firstError.context?.key;
        if (key === 'type') {
          errorCode = 'INVALID_TYPE';
          errorMessage = 'Registration type is required';
        } else {
          errorCode = 'MISSING_FIELDS';
        }
      } else if (firstError.type === 'any.only' && firstError.context?.key === 'type') {
        errorCode = 'INVALID_TYPE';
        errorMessage = 'Invalid registration type';
      }
      
      return res.status(400).json({
        message: errorMessage,
        code: errorCode,
        details: error.details.map(d => ({
          message: d.message,
          path: d.path,
          type: d.type
        }))
      });
    }
    
    next();
  } catch (validationError) {
    console.error('Registration validation error:', validationError);
    return res.status(400).json({
      message: 'Invalid request data',
      code: 'VALIDATION_ERROR',
      details: validationError.message
    });
  }
};
