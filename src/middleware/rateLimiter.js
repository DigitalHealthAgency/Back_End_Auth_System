const rateLimit = require('express-rate-limit');

const invoiceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: ' Too many requests from this IP, please try again after 15 minutes',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Store to track request counts by IP
  store: new rateLimit.MemoryStore(),
  // Skip rate limiting for trusted IPs (optional)
  skip: (req) => {
    const trustedIPs = process.env.TRUSTED_IPS ? process.env.TRUSTED_IPS.split(',') : [];
    return trustedIPs.includes(req.ip);
  }
});

// Stricter limiter for sensitive operations
const sensitiveOpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 requests per hour
  message: {
    error: ' Too many sensitive operations from this IP, please try again after an hour',
    retryAfter: '60 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new rateLimit.MemoryStore()
});

// Industry-level: 5 requests per hour per IP for forgot password
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: process.env.NODE_ENV === 'test' ? 1000 : 5, // Higher limit in test mode
  message: {
    message: 'Too many password reset requests from this IP, please try again after an hour.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Return rate limit info in the RateLimit-* headers
  legacyHeaders: false, // Disable the X-RateLimit-* headers
  handler: (req, res, next, options) => {
    // Optional: log the event for monitoring
    console.warn(`Rate limit exceeded for IP: ${req.ip} on forgot-password`);
    res.status(options.statusCode).json(options.message);
  }
});

// CAPTCHA generation limiter - 20 requests per 15 minutes
const captchaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 CAPTCHA requests per 15 minutes
  message: {
    message: 'Too many CAPTCHA requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  invoiceLimiter,
  sensitiveOpLimiter,
  forgotPasswordLimiter,
  captchaLimiter
};