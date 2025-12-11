// Mock for captchaVerifier - preserves isCaptchaRequired, mocks verifyRecaptcha

// Import the real isCaptchaRequired function
const actualModule = jest.requireActual('../captchaVerifier');

// Mock verifyRecaptcha
const verifyRecaptcha = jest.fn().mockResolvedValue({
  success: true,
  score: 0.9
});

// Use the real isCaptchaRequired
const isCaptchaRequired = actualModule.isCaptchaRequired;

// Mock verifyCaptchaMiddleware
const verifyCaptchaMiddleware = jest.fn(() => (req, res, next) => next());

module.exports = {
  verifyRecaptcha,
  isCaptchaRequired,
  verifyCaptchaMiddleware
};
