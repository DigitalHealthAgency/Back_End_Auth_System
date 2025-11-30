const mongoose = require('mongoose');

// Client Behavior Tracking Schema
const clientBehaviorSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Quotation-related behaviors
  quotationStats: {
    totalQuotations: { type: Number, default: 0 },
    acceptedQuotations: { type: Number, default: 0 },
    rejectedQuotations: { type: Number, default: 0 },
    pendingQuotations: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 }, // in hours
    acceptanceRate: { type: Number, default: 0 }, // percentage
    averageQuotationValue: { type: Number, default: 0 },
    lastQuotationDate: Date,
    preferredCurrency: String
  },
  // Invoice-related behaviors
  invoiceStats: {
    totalInvoices: { type: Number, default: 0 },
    paidInvoices: { type: Number, default: 0 },
    overdueInvoices: { type: Number, default: 0 },
    averagePaymentTime: { type: Number, default: 0 }, // in days
    paymentReliabilityScore: { type: Number, default: 0 }, // 0-100
    totalAmountPaid: { type: Number, default: 0 },
    averageInvoiceValue: { type: Number, default: 0 },
    lastPaymentDate: Date,
    preferredPaymentMethod: String
  },
  // Email engagement
  emailStats: {
    quotationEmailsSent: { type: Number, default: 0 },
    quotationEmailsOpened: { type: Number, default: 0 },
    invoiceEmailsSent: { type: Number, default: 0 },
    invoiceEmailsOpened: { type: Number, default: 0 },
    emailOpenRate: { type: Number, default: 0 }, // percentage
    lastEmailOpened: Date
  },
  // Risk assessment
  riskProfile: {
    paymentRisk: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    riskScore: { type: Number, default: 50 }, // 0-100 (0 = lowest risk)
    riskFactors: [String],
    lastRiskAssessment: { type: Date, default: Date.now }
  },
  // Prediction data
  predictions: {
    nextPaymentLikelihood: { type: Number, default: 0 }, // 0-100%
    estimatedPaymentDate: Date,
    churnRisk: { type: Number, default: 0 }, // 0-100%
    lifetimeValue: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Analytics Dashboard Data Schema
const analyticsDashboardSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  period: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']
  },
  dateRange: {
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  },
  // Financial metrics
  financialMetrics: {
    totalRevenue: { type: Number, default: 0 },
    projectedRevenue: { type: Number, default: 0 },
    outstandingAmount: { type: Number, default: 0 },
    averageInvoiceValue: { type: Number, default: 0 },
    revenueGrowth: { type: Number, default: 0 }, // percentage
    cashFlowForecast: [{
      date: Date,
      predicted: Number,
      actual: Number
    }],
    receiptMetrics: {
      totalReceipts: { type: Number, default: 0 },
      totalReceiptAmount: { type: Number, default: 0 },
      averageReceiptValue: { type: Number, default: 0 },
      paymentMethods: {
        mpesa: { count: { type: Number, default: 0 }, amount: { type: Number, default: 0 } },
        bank: { count: { type: Number, default: 0 }, amount: { type: Number, default: 0 } },
        cash: { count: { type: Number, default: 0 }, amount: { type: Number, default: 0 } }
      },
      receiptTrends: [{
        date: Date,
        count: Number,
        amount: Number,
        paymentMethod: String
      }]
    }
  },
  // Quotation analytics
  quotationMetrics: {
    totalQuotations: { type: Number, default: 0 },
    acceptedQuotations: { type: Number, default: 0 },
    rejectedQuotations: { type: Number, default: 0 },
    pendingQuotations: { type: Number, default: 0 },
    acceptanceRate: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 }, // quotation to invoice
    topPerformingServices: [{
      serviceName: String,
      count: Number,
      revenue: Number
    }]
  },
  // Invoice analytics
  invoiceMetrics: {
    totalInvoices: { type: Number, default: 0 },
    paidInvoices: { type: Number, default: 0 },
    overdueInvoices: { type: Number, default: 0 },
    paymentRate: { type: Number, default: 0 },
    averagePaymentTime: { type: Number, default: 0 },
    dso: { type: Number, default: 0 }, // Days Sales Outstanding
    paymentTrends: [{
      date: Date,
      onTime: Number,
      late: Number,
      overdue: Number
    }]
  },
  // Email analytics
  emailMetrics: {
    totalEmailsSent: { type: Number, default: 0 },
    emailsOpened: { type: Number, default: 0 },
    openRate: { type: Number, default: 0 },
    quotationEmailStats: {
      sent: Number,
      opened: Number,
      rate: Number
    },
    invoiceEmailStats: {
      sent: Number,
      opened: Number,
      rate: Number
    }
  },
  // Client analytics
  clientMetrics: {
    totalClients: { type: Number, default: 0 },
    activeClients: { type: Number, default: 0 },
    newClients: { type: Number, default: 0 },
    churnedClients: { type: Number, default: 0 },
    clientRetentionRate: { type: Number, default: 0 },
    topClientsByRevenue: [{
      clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
      clientName: String,
      revenue: Number,
      invoiceCount: Number
    }]
  }
}, {
  timestamps: true
});

// Payment Prediction Schema
const paymentPredictionSchema = new mongoose.Schema({
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Prediction inputs
  features: {
    invoiceAmount: Number,
    daysUntilDue: Number,
    clientPaymentHistory: {
      averagePaymentDays: Number,
      paymentReliabilityScore: Number,
      overdueRate: Number
    },
    seasonality: {
      month: Number,
      quarter: Number,
      isHoliday: Boolean
    },
    businessFactors: {
      industryType: String,
      clientSize: String,
      relationshipLength: Number // in months
    }
  },
  // Prediction outputs
  predictions: {
    paymentProbability: { type: Number, required: true }, // 0-100%
    estimatedPaymentDate: Date,
    riskLevel: { type: String, enum: ['low', 'medium', 'high'] },
    confidenceScore: { type: Number, default: 0 }, // 0-100%
    factors: [{
      factor: String,
      impact: Number, // -100 to +100
      description: String
    }]
  },
  // Model information
  modelInfo: {
    version: { type: String, default: '1.0' },
    algorithm: { type: String, default: 'weighted_scoring' },
    trainingDate: { type: Date, default: Date.now },
    accuracy: Number
  },
  // Actual outcome (for model improvement)
  actual: {
    wasPaidOnTime: Boolean,
    actualPaymentDate: Date,
    predictionAccuracy: Number
  }
}, {
  timestamps: true
});

// Analytics Event Tracking Schema
const analyticsEventSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      'quotation_sent',
      'quotation_viewed',
      'quotation_accepted',
      'quotation_rejected',
      'invoice_sent',
      'invoice_viewed',
      'invoice_created',
      'invoice_payment_received',
      'invoice_overdue',
      'invoice_deleted',
      'invoice_paid',
      'email_opened',
      'email_clicked',
      'client_created',
      'payment_received'
    ]
  },
  entityId: { type: mongoose.Schema.Types.ObjectId }, // quotation, invoice, or client ID
  entityType: { type: String, enum: ['quotation', 'invoice', 'client', 'payment'] },
  metadata: {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    amount: Number,
    currency: String,
    paymentMethod: String,
    emailType: String,
    userAgent: String,
    ipAddress: String
  },
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes for performance
clientBehaviorSchema.index({ client: 1, user: 1 }, { unique: true });
clientBehaviorSchema.index({ user: 1 });
clientBehaviorSchema.index({ 'riskProfile.riskScore': 1 });

analyticsDashboardSchema.index({ user: 1, period: 1, 'dateRange.start': 1 });
analyticsDashboardSchema.index({ user: 1, createdAt: -1 });

paymentPredictionSchema.index({ invoice: 1 }, { unique: true });
paymentPredictionSchema.index({ client: 1, user: 1 });
paymentPredictionSchema.index({ 'predictions.paymentProbability': 1 });

analyticsEventSchema.index({ user: 1, eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ entityId: 1, entityType: 1 });
analyticsEventSchema.index({ timestamp: -1 });

const ClientBehavior = mongoose.model('ClientBehavior', clientBehaviorSchema);
const AnalyticsDashboard = mongoose.model('AnalyticsDashboard', analyticsDashboardSchema);
const PaymentPrediction = mongoose.model('PaymentPrediction', paymentPredictionSchema);
const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);

module.exports = {
  ClientBehavior,
  AnalyticsDashboard,
  PaymentPrediction,
  AnalyticsEvent
};