const mockEmailService = {
  sendEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true)
};

const mockRecaptchaService = {
  verify: jest.fn().mockResolvedValue(true)
};

const resetAllMocks = () => {
  mockEmailService.sendEmail.mockClear();
  mockEmailService.sendVerificationEmail.mockClear();
  mockEmailService.sendPasswordResetEmail.mockClear();
  mockRecaptchaService.verify.mockClear();
};

module.exports = {
  mockEmailService,
  mockRecaptchaService,
  resetAllMocks
};
