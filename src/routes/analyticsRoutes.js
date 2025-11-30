const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const AnalyticsController = require('../controllers/analyticsController');
const protect = require('../middleware/authMiddleware');
//const premiumCheck = require('../middleware/premiumCheck');

// Validation middleware
const validateEventTracking = [
  body('eventType')
    .notEmpty()
    .withMessage('Event type is required')
    .isIn([
      'quotation_sent', 'quotation_viewed', 'quotation_accepted', 'quotation_rejected',
      'invoice_sent', 'invoice_viewed', 'invoice_paid', 'invoice_overdue',
      'email_opened', 'email_clicked', 'client_created', 'client_updated'
    ])
    .withMessage('Invalid event type'),
  body('entityId')
    .notEmpty()
    .withMessage('Entity ID is required')
    .isMongoId()
    .withMessage('Invalid entity ID'),
  body('entityType')
    .notEmpty()
    .withMessage('Entity type is required')
    .isIn(['quotation', 'invoice', 'client', 'email'])
    .withMessage('Invalid entity type'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

const validatePeriod = [
  query('period')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
    .withMessage('Invalid period. Must be daily, weekly, monthly, quarterly, or yearly')
];

const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

const validateClientId = [
  param('clientId')
    .notEmpty()
    .withMessage('Client ID is required')
    .isMongoId()
    .withMessage('Invalid client ID')
];

const validateInvoiceId = [
  param('invoiceId')
    .notEmpty()
    .withMessage('Invoice ID is required')
    .isMongoId()
    .withMessage('Invalid invoice ID')
];

// Apply authentication and premium check to all routes
router.use(protect);
//router.use(premiumCheck); // TODO Create a  premium check

// Dashboard routes
router.get('/dashboard',
  validatePeriod,
  validateDateRange,
  AnalyticsController.getDashboard
);

router.get('/summary',
  AnalyticsController.getQuickSummary
);

// Payment prediction routes
router.get('/predictions/payment/:invoiceId',
  validateInvoiceId,
  AnalyticsController.getPaymentPrediction
);

// Client behavior routes
router.get('/clients/:clientId/behavior',
  validateClientId,
  AnalyticsController.getClientBehavior
);

router.put('/clients/:clientId/behavior',
  validateClientId,
  [
    body('emailStats.emailOpenRate')
      .optional()
      .isNumeric()
      .withMessage('Email open rate must be a number'),
    body('emailStats.emailClickRate')
      .optional()
      .isNumeric()
      .withMessage('Email click rate must be a number'),
    body('communicationPreferences.preferredMethod')
      .optional()
      .isIn(['email', 'phone', 'whatsapp', 'sms'])
      .withMessage('Invalid communication method'),
    body('communicationPreferences.bestTimeToContact')
      .optional()
      .isString()
      .withMessage('Best time to contact must be a string')
  ],
  AnalyticsController.updateClientBehavior
);

// Event tracking routes
router.post('/events',
  validateEventTracking,
  AnalyticsController.trackEvent
);

// Analytics by category routes
router.get('/quotations',
  validatePeriod,
  AnalyticsController.getQuotationAnalytics
);

router.get('/invoices',
  validatePeriod,
  AnalyticsController.getInvoiceAnalytics
);

router.get('/emails',
  validatePeriod,
  AnalyticsController.getEmailAnalytics
);

router.get('/clients',
  validatePeriod,
  AnalyticsController.getClientAnalytics
);

router.get('/clients/creation',
  [
    validatePeriod[0],
    query('groupBy')
      .optional()
      .isIn(['day', 'week', 'month'])
      .withMessage('Invalid grouping interval')
  ],
  AnalyticsController.getClientCreationAnalytics
);

router.get('/financial',
  validatePeriod,
  AnalyticsController.getFinancialAnalytics
);

// Forecast and trends routes
router.get('/forecasts/cashflow',
  [
    query('months')
      .optional()
      .isInt({ min: 1, max: 24 })
      .withMessage('Months must be between 1 and 24')
  ],
  AnalyticsController.getCashFlowForecast
);

router.get('/trends/payments',
  validatePeriod,
  AnalyticsController.getPaymentTrends
);

// Performance routes
router.get('/services/top-performing',
  [
    validatePeriod[0],
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  AnalyticsController.getTopPerformingServices
);

// Export routes
router.get('/export',
  [
    validatePeriod[0],
    query('format')
      .optional()
      .isIn(['json', 'csv'])
      .withMessage('Format must be json or csv')
  ],
  AnalyticsController.exportAnalytics
);

// Health check route for analytics service
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Analytics service is healthy',
    timestamp: new Date(),
    user: req.user._id
  });
});

// Receipt analytics routes
router.get('/receipts',
  validatePeriod,
  AnalyticsController.getReceiptAnalytics
);

router.get('/receipts/payment-methods',
  [
    validatePeriod[0],
    query('currency')
      .optional()
      .isIn(['KSH', 'TSH', 'USH', 'USD', 'EUR'])
      .withMessage('Invalid currency')
  ],
  AnalyticsController.getPaymentMethodAnalytics
);

router.get('/receipts/trends',
  [
    validatePeriod[0],
    query('groupBy')
      .optional()
      .isIn(['day', 'week', 'month'])
      .withMessage('Invalid grouping interval')
  ],
  AnalyticsController.getReceiptTrends
);

router.get('/receipts/summary',
  AnalyticsController.getReceiptSummary
);

module.exports = router;