module.exports = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const firstError = error.details[0];
    return res.status(400).json({
      message: firstError.message,
      code: firstError.type.toUpperCase().replace(/\./g, '_'),
      details: error.details.map(d => ({
        message: d.message,
        path: d.path,
        type: d.type
      }))
    });
  }
  next();
};
