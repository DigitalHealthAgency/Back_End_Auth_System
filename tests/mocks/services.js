// ✅ MOCK EXTERNAL SERVICES

const jest = require('jest-mock');

/**
 * Mock email service
 */
const mockEmailService = {
  sendEmail: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-message-id'
  }),

  reset: function() {
    this.sendEmail.mockClear();
  },

  simulateFailure: function() {
    this.sendEmail.mockRejectedValueOnce(new Error('Email service unavailable'));
  }
};

/**
 * Mock SMS service
 */
const mockSMSService = {
  sendSMS: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-sms-id'
  }),

  reset: function() {
    this.sendSMS.mockClear();
  },

  simulateFailure: function() {
    this.sendSMS.mockRejectedValueOnce(new Error('SMS service unavailable'));
  }
};

/**
 * Mock Cloudinary service
 */
const mockCloudinaryService = {
  upload: jest.fn().mockResolvedValue({
    secure_url: 'https://mock.cloudinary.com/image.jpg',
    public_id: 'mock-public-id'
  }),

  delete: jest.fn().mockResolvedValue({
    result: 'ok'
  }),

  reset: function() {
    this.upload.mockClear();
    this.delete.mockClear();
  },

  simulateFailure: function() {
    this.upload.mockRejectedValueOnce(new Error('Upload failed'));
  }
};

/**
 * Mock reCAPTCHA service
 */
const mockRecaptchaService = {
  verify: jest.fn().mockResolvedValue({
    success: true,
    score: 0.9,
    challenge_ts: new Date().toISOString(),
    hostname: 'localhost'
  }),

  reset: function() {
    this.verify.mockClear();
  },

  simulateFailure: function() {
    this.verify.mockResolvedValueOnce({
      success: false,
      'error-codes': ['invalid-input-response']
    });
  },

  simulateLowScore: function(score = 0.3) {
    this.verify.mockResolvedValueOnce({
      success: true,
      score,
      challenge_ts: new Date().toISOString(),
      hostname: 'localhost'
    });
  }
};

/**
 * Mock notification service
 */
const mockNotificationService = {
  send: jest.fn().mockResolvedValue({
    success: true
  }),

  reset: function() {
    this.send.mockClear();
  }
};

/**
 * Reset all mocks
 */
function resetAllMocks() {
  mockEmailService.reset();
  mockSMSService.reset();
  mockCloudinaryService.reset();
  mockRecaptchaService.reset();
  mockNotificationService.reset();
}

module.exports = {
  mockEmailService,
  mockSMSService,
  mockCloudinaryService,
  mockRecaptchaService,
  mockNotificationService,
  resetAllMocks
};
