module.exports = (schema) => (req, res, next) => {
  try {
    const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
    // For alternatives schemas (like registration), intelligently pick the relevant error
    let relevantError = error.details[0];

    // If this is an alternatives error, find the most specific error for the provided type
    if (relevantError.type === 'alternatives.match' || relevantError.type === 'alternatives.types' ||
        relevantError.type === 'alternatives.any') {
      const specificErrors = error.details.filter(d =>
        d.type !== 'alternatives.match' &&
        d.type !== 'alternatives.types' &&
        d.type !== 'alternatives.any'
      );

      if (specificErrors.length > 0) {
        // If type is provided, filter errors relevant to that type's schema
        if (req.body.type) {
          // For individual type, look for errors related to individual fields
          // For organization type, look for errors related to organization fields
          const typeSpecificErrors = specificErrors.filter(err => {
            const key = err.context?.key;
            if (req.body.type === 'individual') {
              // Individual-specific fields
              return ['username', 'firstName', 'lastName', 'email', 'phone', 'password', 'type'].includes(key);
            } else if (req.body.type === 'organization') {
              // Organization-specific fields
              return ['organizationName', 'organizationType', 'county', 'subCounty',
                      'organizationEmail', 'organizationPhone', 'yearOfEstablishment', 'password', 'type'].includes(key);
            }
            return true;
          });

          relevantError = typeSpecificErrors.length > 0 ? typeSpecificErrors[0] : specificErrors[0];
        } else {
          // No type provided, use first specific error or check for type-related error
          const typeError = specificErrors.find(err => err.context?.key === 'type');
          relevantError = typeError || specificErrors[0];
        }
      } else {
        // No specific errors found - this means missing type or invalid type
        if (!req.body.type) {
          relevantError = {
            type: 'any.required',
            message: 'Registration type is required',
            context: { key: 'type' }
          };
        } else if (req.body.type && !['individual', 'organization'].includes(req.body.type)) {
          relevantError = {
            type: 'any.only',
            message: 'Invalid registration type',
            context: { key: 'type' }
          };
        }
      }
    }

    // Map Joi error types to custom error codes
    let errorCode = relevantError.type.toUpperCase().replace(/\./g, '_');
    let errorMessage = relevantError.message;

    // Apply custom error code mappings
    if (relevantError.type === 'any.only' && relevantError.context?.key === 'type') {
      errorCode = 'INVALID_TYPE';
      errorMessage = 'Invalid registration type';
    } else if (relevantError.type === 'string.email') {
      errorCode = 'INVALID_EMAIL';
    } else if (relevantError.type === 'string.min' && relevantError.context?.key === 'password') {
      errorCode = 'WEAK_PASSWORD';
    } else if (relevantError.type === 'string.pattern.name') {
      errorCode = 'WEAK_PASSWORD';
    } else if (relevantError.type === 'string.pattern.base' &&
               (relevantError.context?.key === 'phone' || relevantError.context?.key === 'organizationPhone')) {
      errorCode = 'INVALID_PHONE';
    } else if (relevantError.type === 'any.required') {
      const key = relevantError.context?.key;
      if (key === 'type') {
        errorCode = 'INVALID_TYPE';
        errorMessage = 'Registration type is required';
      } else if (key === 'identifier' || key === 'password' || key === 'login') {
        errorCode = 'MISSING_CREDENTIALS';
        errorMessage = 'Identifier and password are required';
      } else if (key === 'currentPassword' || key === 'newPassword') {
        errorCode = 'MISSING_PASSWORDS';
        errorMessage = 'Current password and new password are required';
      } else {
        errorCode = 'MISSING_FIELDS';
      }
    } else if (relevantError.type === 'object.missing') {
      // Handle case when neither login nor identifier is provided
      errorCode = 'MISSING_CREDENTIALS';
      errorMessage = 'Identifier and password are required';
    } else if (relevantError.type === 'string.min' && relevantError.context?.key === 'newPassword') {
      errorCode = 'WEAK_PASSWORD';
    } else if (relevantError.type === 'string.pattern.base' && relevantError.context?.key === 'code') {
      errorCode = 'INVALID_CODE';
    } else if (relevantError.context?.key === 'captchaToken' || relevantError.context?.key === 'recaptchaToken') {
      if (relevantError.type === 'string.empty') {
        errorCode = 'CAPTCHA_TOKEN_MISSING';
        errorMessage = 'CAPTCHA token is required';
      } else if (relevantError.type === 'string.base') {
        errorCode = 'CAPTCHA_REQUIRED';
        errorMessage = 'CAPTCHA verification required';
      } else if (relevantError.type === 'any.required') {
        errorCode = 'CAPTCHA_TOKEN_MISSING';
        errorMessage = 'CAPTCHA token is required';
      }
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
    // Catch any unexpected validation errors
    console.error('Validation middleware error:', validationError);
    return res.status(400).json({
      message: 'Invalid request data',
      code: 'VALIDATION_ERROR',
      details: validationError.message
    });
  }
};
