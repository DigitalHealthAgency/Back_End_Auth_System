const {
  ClientBehavior,
  AnalyticsDashboard,
  PaymentPrediction,
  AnalyticsEvent
} = require('../models/Analytics');
const Quotation = require('../models/Quotation');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const User = require('../models/User');
const Receipt = require('../models/Receipt');

class AnalyticsService {
  /**
   * Track analytics event
   */
  static async trackEvent(eventData) {
    try {
      return await AnalyticsEvent.create(eventData);
    } catch (error) {
      console.error('Error tracking analytics event:', error);
      // Don't throw error to avoid breaking main functionality
    }
  }

  /**
 * Track client creation analytics
 */
  static async trackClientCreation(clientId, userId) {
    try {
      const client = await Client.findById(clientId);
      if (!client) return;

      // Track the client creation event
      await this.trackEvent({
        user: userId,
        eventType: 'client_created',
        entityId: clientId,
        entityType: 'client',
        metadata: {
          clientId: clientId,
          industry: client.industry,
          size: client.size,
          location: client.location,
          contactMethod: client.preferredContactMethod
        }
      });

      // Initialize client behavior tracking
      await ClientBehavior.create({
        client: clientId,
        user: userId,
        quotationStats: {
          totalQuotations: 0,
          acceptedQuotations: 0,
          rejectedQuotations: 0,
          pendingQuotations: 0,
          lastQuotationDate: null
        },
        invoiceStats: {
          totalInvoices: 0,
          paidInvoices: 0,
          overdueInvoices: 0,
          lastPaymentDate: null
        },
        emailStats: {
          quotationEmailsSent: 0,
          quotationEmailsOpened: 0,
          invoiceEmailsSent: 0,
          invoiceEmailsOpened: 0,
          emailOpenRate: 0
        },
        riskProfile: {
          paymentRisk: 'medium',
          riskScore: 50,
          riskFactors: ['New client'],
          lastRiskAssessment: new Date()
        }
      });

    } catch (error) {
      console.error('Error tracking client creation:', error);
      throw error;
    }
  }

  /**
   * Update client behavior based on new data
   */
  static async updateClientBehavior(clientId, userId, updateData) {
    try {
      const behavior = await ClientBehavior.findOneAndUpdate(
        { client: clientId, user: userId },
        { $set: updateData },
        { upsert: true, new: true }
      );

      // Calculate derived metrics
      await this.calculateClientMetrics(behavior);

      return behavior;
    } catch (error) {
      console.error('Error updating client behavior:', error);
      throw error;
    }
  }

  /**
 * Update invoice analytics
 */
  static async updateInvoiceBehavior(invoiceId, eventType) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) return;

      // Track different invoice events based on type
      switch (eventType) {
        case 'invoice_created':
          await this.trackEvent({
            user: invoice.creator,
            eventType: 'invoice_created',
            entityId: invoiceId,
            entityType: 'invoice',
            metadata: {
              clientId: invoice.client,
              amount: invoice.total,
              currency: invoice.currency,
              dueDate: invoice.dueDate
            }
          });
          break;

        case 'invoice_payment_received':
          await this.trackEvent({
            user: invoice.creator,
            eventType: 'invoice_payment_received',
            entityId: invoiceId,
            entityType: 'invoice',
            metadata: {
              clientId: invoice.client,
              amount: invoice.amountPaid,
              totalAmount: invoice.total,
              currency: invoice.currency,
              paymentMethod: invoice.payment?.method
            }
          });

          // Update client behavior for payment received
          await this.updateClientBehavior(invoice.client, invoice.creator, {
            'invoiceStats.lastPaymentDate': new Date(),
            'invoiceStats.paidInvoices': invoice.status === 'paid' ? 1 : 0
          });
          break;

        case 'invoice_overdue':
          await this.trackEvent({
            user: invoice.creator,
            eventType: 'invoice_overdue',
            entityId: invoiceId,
            entityType: 'invoice',
            metadata: {
              clientId: invoice.client,
              amount: invoice.total,
              currency: invoice.currency,
              daysOverdue: Math.ceil((new Date() - invoice.dueDate) / (1000 * 60 * 60 * 24))
            }
          });

          // Update client behavior for overdue invoice
          await this.updateClientBehavior(invoice.client, invoice.creator, {
            'invoiceStats.overdueInvoices': 1
          });
          break;

        case 'invoice_deleted':
          await this.trackEvent({
            user: invoice.creator,
            eventType: 'invoice_deleted',
            entityId: invoiceId,
            entityType: 'invoice',
            metadata: {
              clientId: invoice.client,
              amount: invoice.total,
              currency: invoice.currency,
              status: invoice.status
            }
          });
          break;

        case 'invoice_paid':
          await this.trackEvent({
            user: invoice.creator,
            eventType: 'invoice_paid',
            entityId: invoiceId,
            entityType: 'invoice',
            metadata: {
              clientId: invoice.client,
              amount: invoice.total,
              currency: invoice.currency,
              paymentMethod: invoice.payment?.method,
              daysToPayment: Math.ceil((invoice.paidDate - invoice.createdAt) / (1000 * 60 * 60 * 24))
            }
          });

          // Update client behavior for paid invoice
          await this.updateClientBehavior(invoice.client, invoice.creator, {
            'invoiceStats.lastPaymentDate': invoice.paidDate,
            'invoiceStats.paidInvoices': 1,
            'invoiceStats.totalAmountPaid': invoice.total
          });

          // Update payment prediction accuracy if exists
          await this.updatePaymentPredictionAccuracy(invoiceId);
          break;
      }

    } catch (error) {
      console.error('Error updating invoice behavior:', error);
      // Don't throw to avoid breaking main functionality
    }
  }

  /**
   * Update payment prediction accuracy
   */
  static async updatePaymentPredictionAccuracy(invoiceId) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      const prediction = await PaymentPrediction.findOne({ invoice: invoiceId });

      if (prediction && invoice.paidDate) {
        const actualPaymentDate = invoice.paidDate;
        const predictedDate = prediction.predictions.estimatedPaymentDate;
        const daysDifference = Math.abs((actualPaymentDate - predictedDate) / (1000 * 60 * 60 * 24));
        const accuracy = Math.max(0, 100 - (daysDifference * 2)); // 2% penalty per day difference

        await PaymentPrediction.findByIdAndUpdate(prediction._id, {
          $set: {
            'actual.wasPaidOnTime': actualPaymentDate <= invoice.dueDate,
            'actual.actualPaymentDate': actualPaymentDate,
            'actual.predictionAccuracy': accuracy
          }
        });
      }
    } catch (error) {
      console.error('Error updating payment prediction accuracy:', error);
    }
  }

  /**
   * Calculate client-specific metrics
   */
  static async calculateClientMetrics(behavior) {
    try {
      const clientId = behavior.client;
      const userId = behavior.user;

      // Get quotation stats
      const quotationStats = await Quotation.aggregate([
        { $match: { client: clientId, creator: userId, isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $in: ['$status', ['sent', 'viewed', 'draft']] }, 1, 0] } },
            avgValue: { $avg: '$total' },
            lastDate: { $max: '$createdAt' }
          }
        }
      ]);

      // Get invoice stats
      const invoiceStats = await Invoice.aggregate([
        { $match: { client: clientId, creator: userId, isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
            overdue: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } },
            avgValue: { $avg: '$total' },
            totalPaid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$total', 0] } },
            lastPayment: { $max: { $cond: [{ $eq: ['$status', 'paid'] }, '$paidDate', null] } },
            avgPaymentTime: { $avg: { $cond: [{ $ne: ['$paidDate', null] }, { $divide: [{ $subtract: ['$paidDate', '$createdAt'] }, 86400000] }, 0] } }
          }
        }
      ]);

      const quotationData = quotationStats[0] || {};
      const invoiceData = invoiceStats[0] || {};

      // Calculate acceptance rate
      const acceptanceRate = quotationData.total > 0 ?
        (quotationData.accepted / quotationData.total) * 100 : 0;

      // Calculate payment reliability score
      const paymentReliabilityScore = invoiceData.total > 0 ?
        (invoiceData.paid / invoiceData.total) * 100 : 0;

      // Update behavior with calculated metrics
      await ClientBehavior.findByIdAndUpdate(behavior._id, {
        $set: {
          'quotationStats.totalQuotations': quotationData.total || 0,
          'quotationStats.acceptedQuotations': quotationData.accepted || 0,
          'quotationStats.rejectedQuotations': quotationData.rejected || 0,
          'quotationStats.pendingQuotations': quotationData.pending || 0,
          'quotationStats.acceptanceRate': acceptanceRate,
          'quotationStats.averageQuotationValue': quotationData.avgValue || 0,
          'quotationStats.lastQuotationDate': quotationData.lastDate,

          'invoiceStats.totalInvoices': invoiceData.total || 0,
          'invoiceStats.paidInvoices': invoiceData.paid || 0,
          'invoiceStats.overdueInvoices': invoiceData.overdue || 0,
          'invoiceStats.paymentReliabilityScore': paymentReliabilityScore,
          'invoiceStats.totalAmountPaid': invoiceData.totalPaid || 0,
          'invoiceStats.averageInvoiceValue': invoiceData.avgValue || 0,
          'invoiceStats.averagePaymentTime': invoiceData.avgPaymentTime || 0,
          'invoiceStats.lastPaymentDate': invoiceData.lastPayment
        }
      });

      // Calculate risk profile
      await this.calculateRiskProfile(behavior._id);

    } catch (error) {
      console.error('Error calculating client metrics:', error);
    }
  }

  /**
   * Calculate client risk profile
   */
  static async calculateRiskProfile(behaviorId) {
    try {
      const behavior = await ClientBehavior.findById(behaviorId);
      if (!behavior) return;

      let riskScore = 50; // Start with medium risk
      const riskFactors = [];

      // Payment reliability factor (40% weight)
      const paymentReliability = behavior.invoiceStats.paymentReliabilityScore;
      if (paymentReliability >= 90) {
        riskScore -= 20;
      } else if (paymentReliability >= 70) {
        riskScore -= 10;
      } else if (paymentReliability < 50) {
        riskScore += 20;
        riskFactors.push('Poor payment history');
      }

      // Average payment time factor (20% weight)
      const avgPaymentTime = behavior.invoiceStats.averagePaymentTime;
      if (avgPaymentTime <= 7) {
        riskScore -= 10;
      } else if (avgPaymentTime > 30) {
        riskScore += 15;
        riskFactors.push('Slow payment pattern');
      }

      // Overdue invoices factor (20% weight)
      const overdueRate = behavior.invoiceStats.totalInvoices > 0 ?
        (behavior.invoiceStats.overdueInvoices / behavior.invoiceStats.totalInvoices) * 100 : 0;
      if (overdueRate > 30) {
        riskScore += 15;
        riskFactors.push('High overdue rate');
      } else if (overdueRate === 0) {
        riskScore -= 5;
      }

      // Quotation acceptance factor (10% weight)
      const acceptanceRate = behavior.quotationStats.acceptanceRate;
      if (acceptanceRate < 30) {
        riskScore += 10;
        riskFactors.push('Low quotation acceptance');
      } else if (acceptanceRate > 70) {
        riskScore -= 5;
      }

      // Email engagement factor (10% weight)
      const emailOpenRate = behavior.emailStats.emailOpenRate;
      if (emailOpenRate < 20) {
        riskScore += 5;
        riskFactors.push('Poor email engagement');
      }

      // Ensure score is within bounds
      riskScore = Math.max(0, Math.min(100, riskScore));

      // Determine risk level
      let riskLevel = 'medium';
      if (riskScore <= 30) riskLevel = 'low';
      else if (riskScore >= 70) riskLevel = 'high';

      await ClientBehavior.findByIdAndUpdate(behaviorId, {
        $set: {
          'riskProfile.riskScore': riskScore,
          'riskProfile.paymentRisk': riskLevel,
          'riskProfile.riskFactors': riskFactors,
          'riskProfile.lastRiskAssessment': new Date()
        }
      });

    } catch (error) {
      console.error('Error calculating risk profile:', error);
    }
  }

  /**
   * Predict invoice payment
   */
  static async predictPayment(invoiceId) {
    try {
      const invoice = await Invoice.findById(invoiceId)
        .populate('client')
        .populate('creator');

      if (!invoice) throw new Error('Invoice not found');

      // Get client behavior data
      const clientBehavior = await ClientBehavior.findOne({
        client: invoice.client._id,
        user: invoice.creator._id
      });

      // Calculate prediction features
      const features = await this.calculatePredictionFeatures(invoice, clientBehavior);

      // Make prediction using weighted scoring algorithm
      const prediction = await this.calculatePaymentPrediction(features);

      // Save prediction
      const paymentPrediction = await PaymentPrediction.findOneAndUpdate(
        { invoice: invoiceId },
        {
          client: invoice.client._id,
          user: invoice.creator._id,
          features,
          predictions: prediction,
          modelInfo: {
            version: '1.0',
            algorithm: 'weighted_scoring',
            trainingDate: new Date()
          }
        },
        { upsert: true, new: true }
      );

      return paymentPrediction;

    } catch (error) {
      console.error('Error predicting payment:', error);
      throw error;
    }
  }

  /**
   * Calculate prediction features from invoice and client data
   */
  static async calculatePredictionFeatures(invoice, clientBehavior) {
    const now = new Date();
    const dueDate = new Date(invoice.dueDate);
    const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

    // Client relationship length
    const firstInvoice = await Invoice.findOne({
      client: invoice.client._id,
      creator: invoice.creator._id
    }).sort({ createdAt: 1 });

    const relationshipLength = firstInvoice ?
      Math.ceil((now - firstInvoice.createdAt) / (1000 * 60 * 60 * 24 * 30)) : 0;

    return {
      invoiceAmount: invoice.total,
      daysUntilDue,
      clientPaymentHistory: {
        averagePaymentDays: clientBehavior?.invoiceStats.averagePaymentTime || 30,
        paymentReliabilityScore: clientBehavior?.invoiceStats.paymentReliabilityScore || 50,
        overdueRate: clientBehavior?.invoiceStats.totalInvoices > 0 ?
          (clientBehavior.invoiceStats.overdueInvoices / clientBehavior.invoiceStats.totalInvoices) * 100 : 50
      },
      seasonality: {
        month: now.getMonth() + 1,
        quarter: Math.ceil((now.getMonth() + 1) / 3),
        isHoliday: this.isHolidayPeriod(now)
      },
      businessFactors: {
        industryType: invoice.client.industry || 'general',
        clientSize: this.determineClientSize(clientBehavior),
        relationshipLength
      }
    };
  }

  /**
   * Calculate payment prediction using weighted scoring
   */
  static async calculatePaymentPrediction(features) {
    let paymentProbability = 50; // Base probability
    const factors = [];

    // Payment history factor (40% weight)
    const reliabilityScore = features.clientPaymentHistory.paymentReliabilityScore;
    if (reliabilityScore >= 90) {
      paymentProbability += 30;
      factors.push({ factor: 'Excellent payment history', impact: 30, description: 'Client has >90% payment reliability' });
    } else if (reliabilityScore >= 70) {
      paymentProbability += 15;
      factors.push({ factor: 'Good payment history', impact: 15, description: 'Client has >70% payment reliability' });
    } else if (reliabilityScore < 50) {
      paymentProbability -= 25;
      factors.push({ factor: 'Poor payment history', impact: -25, description: 'Client has <50% payment reliability' });
    }

    // Days until due factor (25% weight)
    const daysUntilDue = features.daysUntilDue;
    if (daysUntilDue > 30) {
      paymentProbability += 15;
      factors.push({ factor: 'Long payment term', impact: 15, description: 'More than 30 days until due' });
    } else if (daysUntilDue < 7) {
      paymentProbability -= 10;
      factors.push({ factor: 'Short payment term', impact: -10, description: 'Less than 7 days until due' });
    }

    // Invoice amount factor (15% weight)
    const avgPaymentTime = features.clientPaymentHistory.averagePaymentDays;
    if (avgPaymentTime <= 15) {
      paymentProbability += 10;
      factors.push({ factor: 'Fast payer', impact: 10, description: 'Average payment time ≤15 days' });
    } else if (avgPaymentTime > 45) {
      paymentProbability -= 15;
      factors.push({ factor: 'Slow payer', impact: -15, description: 'Average payment time >45 days' });
    }

    // Relationship length factor (10% weight)
    const relationshipLength = features.businessFactors.relationshipLength;
    if (relationshipLength > 12) {
      paymentProbability += 5;
      factors.push({ factor: 'Long-term relationship', impact: 5, description: 'Client relationship >1 year' });
    } else if (relationshipLength < 3) {
      paymentProbability -= 5;
      factors.push({ factor: 'New client', impact: -5, description: 'Client relationship <3 months' });
    }

    // Seasonality factor (5% weight)
    if (features.seasonality.isHoliday) {
      paymentProbability -= 5;
      factors.push({ factor: 'Holiday period', impact: -5, description: 'Invoice due during holiday season' });
    }

    // Overdue rate factor (5% weight)
    const overdueRate = features.clientPaymentHistory.overdueRate;
    if (overdueRate > 50) {
      paymentProbability -= 10;
      factors.push({ factor: 'High overdue rate', impact: -10, description: 'Client has >50% overdue rate' });
    }

    // Ensure probability is within bounds
    paymentProbability = Math.max(5, Math.min(95, paymentProbability));

    // Determine risk level
    let riskLevel = 'medium';
    if (paymentProbability >= 75) riskLevel = 'low';
    else if (paymentProbability <= 40) riskLevel = 'high';

    // Calculate estimated payment date
    const estimatedPaymentDate = new Date();
    estimatedPaymentDate.setDate(estimatedPaymentDate.getDate() + avgPaymentTime);

    // Calculate confidence score based on available data
    const confidenceScore = this.calculateConfidenceScore(features);

    return {
      paymentProbability,
      estimatedPaymentDate,
      riskLevel,
      confidenceScore,
      factors
    };
  }

  /**
   * Generate analytics dashboard data
   */
  static async generateDashboardData(userId, period = 'monthly', customRange = null) {
    try {
      const dateRange = customRange || this.getDateRange(period);

      // Check if data already exists for this period
      const existingData = await AnalyticsDashboard.findOne({
        user: userId,
        period,
        'dateRange.start': dateRange.start,
        'dateRange.end': dateRange.end
      });

      if (existingData && this.isDataFresh(existingData.updatedAt)) {
        return existingData;
      }

      // Generate fresh data
      const dashboardData = {
        user: userId,
        period,
        dateRange,
        financialMetrics: {
          ...(await this.calculateFinancialMetrics(userId, dateRange)),
          receiptMetrics: await this.calculateReceiptMetrics(userId, dateRange)
        },
        quotationMetrics: await this.calculateQuotationMetrics(userId, dateRange),
        invoiceMetrics: await this.calculateInvoiceMetrics(userId, dateRange),
        emailMetrics: await this.calculateEmailMetrics(userId, dateRange),
        clientMetrics: await this.calculateClientMetrics(userId, dateRange)
      };

      // Save or update dashboard data
      const result = await AnalyticsDashboard.findOneAndUpdate(
        {
          user: userId,
          period,
          'dateRange.start': dateRange.start,
          'dateRange.end': dateRange.end
        },
        dashboardData,
        { upsert: true, new: true }
      );

      return result;

    } catch (error) {
      console.error('Error generating dashboard data:', error);
      throw error;
    }
  }

  /**
   * Calculate financial metrics
   */
  static async calculateFinancialMetrics(userId, dateRange) {
    const invoices = await Invoice.aggregate([
      {
        $match: {
          creator: userId,
          createdAt: { $gte: dateRange.start, $lte: dateRange.end },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$total', 0] } },
          projectedRevenue: { $sum: '$total' },
          outstandingAmount: { $sum: { $cond: [{ $ne: ['$status', 'paid'] }, '$total', 0] } },
          averageInvoiceValue: { $avg: '$total' },
          totalInvoices: { $sum: 1 },
          paidInvoices: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } }
        }
      }
    ]);

    const metrics = invoices[0] || {};

    // Calculate revenue growth (compare with previous period)
    const previousPeriod = this.getPreviousPeriod(dateRange);
    const previousRevenue = await Invoice.aggregate([
      {
        $match: {
          creator: userId,
          createdAt: { $gte: previousPeriod.start, $lte: previousPeriod.end },
          status: 'paid',
          isDeleted: { $ne: true }
        }
      },
      { $group: { _id: null, revenue: { $sum: '$total' } } }
    ]);

    const prevRevenue = previousRevenue[0]?.revenue || 0;
    const revenueGrowth = prevRevenue > 0 ?
      ((metrics.totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    // Generate cash flow forecast
    const cashFlowForecast = await this.generateCashFlowForecast(userId, dateRange);

    return {
      totalRevenue: metrics.totalRevenue || 0,
      projectedRevenue: metrics.projectedRevenue || 0,
      outstandingAmount: metrics.outstandingAmount || 0,
      averageInvoiceValue: metrics.averageInvoiceValue || 0,
      revenueGrowth,
      cashFlowForecast
    };
  }

  /**
   * Calculate quotation metrics
   */
  static async calculateQuotationMetrics(userId, dateRange) {
    const quotations = await Quotation.aggregate([
      {
        $match: {
          creator: userId,
          createdAt: { $gte: dateRange.start, $lte: dateRange.end },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $in: ['$status', ['sent', 'viewed', 'draft']] }, 1, 0] } },
          avgResponseTime: {
            $avg: {
              $cond: [
                { $ne: ['$respondedAt', null] },
                { $divide: [{ $subtract: ['$respondedAt', '$sentAt'] }, 3600000] },
                null
              ]
            }
          }
        }
      }
    ]);

    const metrics = quotations[0] || {};
    const acceptanceRate = metrics.total > 0 ? (metrics.accepted / metrics.total) * 100 : 0;

    // Calculate conversion rate (quotations that became invoices)
    const conversions = await Invoice.countDocuments({
      creator: userId,
      quotation: { $exists: true },
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
      isDeleted: { $ne: true }
    });

    const conversionRate = metrics.total > 0 ? (conversions / metrics.total) * 100 : 0;

    // Get top performing services
    const topPerformingServices = await Quotation.aggregate([
      {
        $match: {
          creator: userId,
          createdAt: { $gte: dateRange.start, $lte: dateRange.end },
          status: 'accepted',
          isDeleted: { $ne: true }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.description',
          count: { $sum: 1 },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      {
        $project: {
          serviceName: '$_id',
          count: 1,
          revenue: 1,
          _id: 0
        }
      }
    ]);

    return {
      totalQuotations: metrics.total || 0,
      acceptedQuotations: metrics.accepted || 0,
      rejectedQuotations: metrics.rejected || 0,
      pendingQuotations: metrics.pending || 0,
      acceptanceRate,
      averageResponseTime: metrics.avgResponseTime || 0,
      conversionRate,
      topPerformingServices
    };
  }

  /**
   * Calculate invoice metrics
   */
  static async calculateInvoiceMetrics(userId, dateRange) {
    const invoices = await Invoice.aggregate([
      {
        $match: {
          creator: userId,
          createdAt: { $gte: dateRange.start, $lte: dateRange.end },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } },
          avgPaymentTime: {
            $avg: {
              $cond: [
                { $ne: ['$paidDate', null] },
                { $divide: [{ $subtract: ['$paidDate', '$createdAt'] }, 86400000] },
                null
              ]
            }
          }
        }
      }
    ]);

    const metrics = invoices[0] || {};
    const paymentRate = metrics.total > 0 ? (metrics.paid / metrics.total) * 100 : 0;

    // Calculate DSO (Days Sales Outstanding)
    const dso = await this.calculateDSO(userId, dateRange);

    // Generate payment trends
    const paymentTrends = await this.generatePaymentTrends(userId, dateRange);

    return {
      totalInvoices: metrics.total || 0,
      paidInvoices: metrics.paid || 0,
      overdueInvoices: metrics.overdue || 0,
      paymentRate,
      averagePaymentTime: metrics.avgPaymentTime || 0,
      dso,
      paymentTrends
    };
  }

  /**
 * Calculate receipt metrics
 */
  static async calculateReceiptMetrics(userId, dateRange) {
    try {
      // Get basic receipt stats
      const receiptStats = await Receipt.aggregate([
        {
          $match: {
            creator: userId,
            dateIssued: { $gte: dateRange.start, $lte: dateRange.end },
            isDeleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: null,
            totalReceipts: { $sum: 1 },
            totalAmount: { $sum: '$total' },
            averageValue: { $avg: '$total' }
          }
        }
      ]);

      // Get payment method breakdown
      const paymentMethodStats = await Receipt.aggregate([
        {
          $match: {
            creator: userId,
            dateIssued: { $gte: dateRange.start, $lte: dateRange.end },
            isDeleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: '$payment.method',
            count: { $sum: 1 },
            amount: { $sum: '$total' }
          }
        }
      ]);

      // Generate receipt trends (daily breakdown)
      const receiptTrends = await Receipt.aggregate([
        {
          $match: {
            creator: userId,
            dateIssued: { $gte: dateRange.start, $lte: dateRange.end },
            isDeleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$dateIssued' } },
              paymentMethod: '$payment.method'
            },
            count: { $sum: 1 },
            amount: { $sum: '$total' }
          }
        },
        {
          $project: {
            _id: 0,
            date: { $dateFromString: { dateString: '$_id.date' } },
            paymentMethod: '$_id.paymentMethod',
            count: 1,
            amount: 1
          }
        },
        { $sort: { date: 1 } }
      ]);

      const stats = receiptStats[0] || {};
      const paymentMethods = {};

      // Initialize payment method stats
      ['mpesa', 'bank', 'cash'].forEach(method => {
        paymentMethods[method] = {
          count: 0,
          amount: 0
        };
      });

      // Populate payment method stats
      paymentMethodStats.forEach(stat => {
        if (paymentMethods[stat._id]) {
          paymentMethods[stat._id] = {
            count: stat.count,
            amount: stat.amount
          };
        }
      });

      return {
        totalReceipts: stats.totalReceipts || 0,
        totalReceiptAmount: stats.totalAmount || 0,
        averageReceiptValue: stats.averageValue || 0,
        paymentMethods,
        receiptTrends
      };
    } catch (error) {
      console.error('Error calculating receipt metrics:', error);
      throw error;
    }
  }

  /**
   * Update receipt analytics when receipt is created
   */
  static async updateReceiptAnalytics(receiptId) {
    try {
      const receipt = await Receipt.findById(receiptId);
      if (!receipt) return;

      await this.trackEvent({
        user: receipt.creator,
        eventType: 'payment_received',
        entityId: receiptId,
        entityType: 'receipt',
        metadata: {
          clientId: receipt.client,
          amount: receipt.total,
          currency: receipt.currency,
          paymentMethod: receipt.payment.method
        }
      });

      // Update client behavior
      await this.updateClientBehavior(receipt.client, receipt.creator, {
        'invoiceStats.lastPaymentDate': receipt.dateIssued,
        'invoiceStats.totalAmountPaid': receipt.total
      });

    } catch (error) {
      console.error('Error updating receipt analytics:', error);
    }
  }

  /**
   * Calculate email metrics
   */
  static async calculateEmailMetrics(userId, dateRange) {
    const emailEvents = await AnalyticsEvent.aggregate([
      {
        $match: {
          user: userId,
          timestamp: { $gte: dateRange.start, $lte: dateRange.end },
          eventType: { $in: ['quotation_sent', 'quotation_viewed', 'invoice_sent', 'invoice_viewed', 'email_opened'] }
        }
      },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      }
    ]);

    const eventCounts = {};
    emailEvents.forEach(event => {
      eventCounts[event._id] = event.count;
    });

    const totalSent = (eventCounts.quotation_sent || 0) + (eventCounts.invoice_sent || 0);
    const totalOpened = (eventCounts.quotation_viewed || 0) + (eventCounts.invoice_viewed || 0) + (eventCounts.email_opened || 0);
    const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;

    return {
      totalEmailsSent: totalSent,
      emailsOpened: totalOpened,
      openRate,
      quotationEmailStats: {
        sent: eventCounts.quotation_sent || 0,
        opened: eventCounts.quotation_viewed || 0,
        rate: eventCounts.quotation_sent > 0 ? ((eventCounts.quotation_viewed || 0) / eventCounts.quotation_sent) * 100 : 0
      },
      invoiceEmailStats: {
        sent: eventCounts.invoice_sent || 0,
        opened: eventCounts.invoice_viewed || 0,
        rate: eventCounts.invoice_sent > 0 ? ((eventCounts.invoice_viewed || 0) / eventCounts.invoice_sent) * 100 : 0
      }
    };
  }

  /**
   * Calculate client metrics
   */
  static async calculateClientMetrics(userId, dateRange) {
    // Total and active clients
    const totalClients = await Client.countDocuments({ creator: userId, isDeleted: { $ne: true } });

    // New clients in period
    const newClients = await Client.countDocuments({
      creator: userId,
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
      isDeleted: { $ne: true }
    });

    // Active clients (had activity in period)
    const activeClients = await Invoice.distinct('client', {
      creator: userId,
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
      isDeleted: { $ne: true }
    });

    // Calculate churn rate
    const previousPeriod = this.getPreviousPeriod(dateRange);
    const previousActiveClients = await Invoice.distinct('client', {
      creator: userId,
      createdAt: { $gte: previousPeriod.start, $lte: previousPeriod.end },
      isDeleted: { $ne: true }
    });

    const churnedClients = previousActiveClients.filter(client =>
      !activeClients.includes(client)
    ).length;

    const clientRetentionRate = previousActiveClients.length > 0 ?
      ((previousActiveClients.length - churnedClients) / previousActiveClients.length) * 100 : 0;

    // Top clients by revenue
    const topClientsByRevenue = await Invoice.aggregate([
      {
        $match: {
          creator: userId,
          createdAt: { $gte: dateRange.start, $lte: dateRange.end },
          status: 'paid',
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$client',
          revenue: { $sum: '$total' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'clients',
          localField: '_id',
          foreignField: '_id',
          as: 'clientInfo'
        }
      },
      {
        $project: {
          clientId: '$_id',
          clientName: { $arrayElemAt: ['$clientInfo.name', 0] },
          revenue: 1,
          invoiceCount: 1
        }
      }
    ]);

    return {
      totalClients,
      activeClients: activeClients.length,
      newClients,
      churnedClients,
      clientRetentionRate,
      topClientsByRevenue
    };
  }

  /**
   * Generate cash flow forecast
   */
  static async generateCashFlowForecast(userId, dateRange) {
    const invoices = await Invoice.find({
      creator: userId,
      status: { $in: ['sent', 'viewed', 'overdue'] },
      isDeleted: { $ne: true }
    }).populate('client');

    const forecast = [];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
      const forecastDate = new Date(now);
      forecastDate.setMonth(now.getMonth() + i);

      let predicted = 0;

      // Calculate predicted payments for this month
      for (const invoice of invoices) {
        const prediction = await PaymentPrediction.findOne({ invoice: invoice._id });
        if (prediction && prediction.predictions.estimatedPaymentDate) {
          const paymentDate = new Date(prediction.predictions.estimatedPaymentDate);
          if (paymentDate.getMonth() === forecastDate.getMonth() &&
            paymentDate.getFullYear() === forecastDate.getFullYear()) {
            predicted += invoice.total * (prediction.predictions.paymentProbability / 100);
          }
        }
      }

      // Get actual payments for past months
      let actual = 0;
      if (forecastDate <= now) {
        const monthStart = new Date(forecastDate.getFullYear(), forecastDate.getMonth(), 1);
        const monthEnd = new Date(forecastDate.getFullYear(), forecastDate.getMonth() + 1, 0);

        const actualPayments = await Invoice.aggregate([
          {
            $match: {
              creator: userId,
              status: 'paid',
              paidDate: { $gte: monthStart, $lte: monthEnd },
              isDeleted: { $ne: true }
            }
          },
          { $group: { _id: null, total: { $sum: '$total' } } }
        ]);

        actual = actualPayments[0]?.total || 0;
      }

      forecast.push({
        date: forecastDate,
        predicted,
        actual: forecastDate <= now ? actual : null
      });
    }

    return forecast;
  }

  /**
   * Calculate DSO (Days Sales Outstanding)
   */
  static async calculateDSO(userId, dateRange) {
    const invoices = await Invoice.aggregate([
      {
        $match: {
          creator: userId,
          createdAt: { $gte: dateRange.start, $lte: dateRange.end },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: null,
          totalReceivables: { $sum: { $cond: [{ $ne: ['$status', 'paid'] }, '$total', 0] } },
          totalSales: { $sum: '$total' }
        }
      }
    ]);

    const data = invoices[0];
    if (!data || data.totalSales === 0) return 0;

    const daysInPeriod = Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24));
    return (data.totalReceivables / data.totalSales) * daysInPeriod;
  }

  /**
   * Generate payment trends
   */
  static async generatePaymentTrends(userId, dateRange) {
    const trends = [];
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    // Generate weekly trends
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    for (let date = new Date(start); date <= end; date.setTime(date.getTime() + weekMs)) {
      const weekEnd = new Date(Math.min(date.getTime() + weekMs, end.getTime()));

      const weeklyData = await Invoice.aggregate([
        {
          $match: {
            creator: userId,
            dueDate: { $gte: date, $lte: weekEnd },
            isDeleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: null,
            onTime: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'paid'] }, { $lte: ['$paidDate', '$dueDate'] }] }, 1, 0] } },
            late: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'paid'] }, { $gt: ['$paidDate', '$dueDate'] }] }, 1, 0] } },
            overdue: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } }
          }
        }
      ]);

      const data = weeklyData[0] || { onTime: 0, late: 0, overdue: 0 };
      trends.push({
        date: new Date(date),
        onTime: data.onTime,
        late: data.late,
        overdue: data.overdue
      });
    }

    return trends;
  }

  /**
   * Helper methods
   */
  static getDateRange(period) {
    const now = new Date();
    const start = new Date();

    switch (period) {
      case 'daily':
        start.setHours(0, 0, 0, 0);
        return { start, end: new Date() };
      case 'weekly':
        start.setDate(now.getDate() - 7);
        return { start, end: now };
      case 'monthly':
        start.setMonth(now.getMonth() - 1);
        return { start, end: now };
      case 'quarterly':
        start.setMonth(now.getMonth() - 3);
        return { start, end: now };
      case 'yearly':
        start.setFullYear(now.getFullYear() - 1);
        return { start, end: now };
      default:
        start.setMonth(now.getMonth() - 1);
        return { start, end: now };
    }
  }

  static getPreviousPeriod(dateRange) {
    const duration = dateRange.end - dateRange.start;
    return {
      start: new Date(dateRange.start.getTime() - duration),
      end: new Date(dateRange.start)
    };
  }

  static isDataFresh(lastUpdate, maxAge = 3600000) { // 1 hour default
    return (new Date() - lastUpdate) < maxAge;
  }

  static isHolidayPeriod(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Check for common holiday periods (customize based on region)
    return (
      (month === 12 && day >= 20) || // Christmas period
      (month === 1 && day <= 5) ||   // New Year period
      (month === 7 && day >= 1 && day <= 15) || // Summer holidays
      (month === 8 && day >= 15) // Late summer holidays
    );
  }

  static determineClientSize(clientBehavior) {
    if (!clientBehavior) return 'unknown';

    const avgInvoiceValue = clientBehavior.invoiceStats.averageInvoiceValue;

    if (avgInvoiceValue > 10000) return 'large';
    if (avgInvoiceValue > 2000) return 'medium';
    return 'small';
  }

  static calculateConfidenceScore(features) {
    let score = 0;

    // More historical data = higher confidence
    if (features.clientPaymentHistory.paymentReliabilityScore !== 50) score += 25;
    if (features.clientPaymentHistory.averagePaymentDays !== 30) score += 25;
    if (features.businessFactors.relationshipLength > 0) score += 20;
    if (features.clientPaymentHistory.overdueRate !== 50) score += 15;
    if (features.businessFactors.industryType !== 'general') score += 15;

    return Math.min(100, score);
  }

  /**
   * Update client behavior when quotation is sent/responded
   */
  static async updateQuotationBehavior(quotationId, eventType) {
    try {
      const quotation = await Quotation.findById(quotationId);
      if (!quotation) return;

      await this.trackEvent({
        user: quotation.creator,
        eventType,
        entityId: quotationId,
        entityType: 'quotation',
        metadata: {
          clientId: quotation.client,
          amount: quotation.total,
          currency: quotation.currency
        }
      });

      // Update client behavior
      if (eventType === 'quotation_accepted' || eventType === 'quotation_rejected') {
        await this.updateClientBehavior(quotation.client, quotation.creator, {
          'quotationStats.lastQuotationDate': new Date()
        });
      }

    } catch (error) {
      console.error('Error updating quotation behavior:', error);
    }
  }

  /**
   * Update client behavior when invoice is paid
   */
  static async updateInvoiceBehavior(invoiceId, eventType) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) return;

      await this.trackEvent({
        user: invoice.creator,
        eventType,
        entityId: invoiceId,
        entityType: 'invoice',
        metadata: {
          clientId: invoice.client,
          amount: invoice.total,
          currency: invoice.currency,
          paymentMethod: invoice.paymentMethod
        }
      });

      // Update client behavior
      if (eventType === 'invoice_paid') {
        await this.updateClientBehavior(invoice.client, invoice.creator, {
          'invoiceStats.lastPaymentDate': new Date()
        });

        // Update prediction accuracy if exists
        const prediction = await PaymentPrediction.findOne({ invoice: invoiceId });
        if (prediction) {
          const actualPaymentDate = invoice.paidDate;
          const predictedDate = prediction.predictions.estimatedPaymentDate;
          const daysDifference = Math.abs((actualPaymentDate - predictedDate) / (1000 * 60 * 60 * 24));
          const accuracy = Math.max(0, 100 - (daysDifference * 2)); // 2% penalty per day difference

          await PaymentPrediction.findByIdAndUpdate(prediction._id, {
            $set: {
              'actual.wasPaidOnTime': actualPaymentDate <= invoice.dueDate,
              'actual.actualPaymentDate': actualPaymentDate,
              'actual.predictionAccuracy': accuracy
            }
          });
        }
      }

    } catch (error) {
      console.error('Error updating invoice behavior:', error);
    }
  }

  /**
   * Get client risk analysis
   */
  static async getClientRiskAnalysis(clientId, userId) {
    try {
      const behavior = await ClientBehavior.findOne({ client: clientId, user: userId });
      if (!behavior) {
        return {
          riskLevel: 'unknown',
          riskScore: 50,
          riskFactors: ['Insufficient data'],
          recommendations: ['Establish payment history with this client']
        };
      }

      const recommendations = [];

      if (behavior.riskProfile.riskScore > 70) {
        recommendations.push('Consider requesting payment upfront or partial advance');
        recommendations.push('Set shorter payment terms');
        recommendations.push('Monitor payment closely');
      } else if (behavior.riskProfile.riskScore < 30) {
        recommendations.push('Consider offering extended payment terms');
        recommendations.push('This client is reliable for larger projects');
      }

      if (behavior.invoiceStats.averagePaymentTime > 30) {
        recommendations.push('Follow up on invoices more frequently');
      }

      if (behavior.quotationStats.acceptanceRate < 30) {
        recommendations.push('Review quotation pricing strategy');
        recommendations.push('Consider improving quotation presentation');
      }

      return {
        riskLevel: behavior.riskProfile.paymentRisk,
        riskScore: behavior.riskProfile.riskScore,
        riskFactors: behavior.riskProfile.riskFactors,
        recommendations,
        paymentReliability: behavior.invoiceStats.paymentReliabilityScore,
        averagePaymentTime: behavior.invoiceStats.averagePaymentTime,
        quotationAcceptanceRate: behavior.quotationStats.acceptanceRate
      };

    } catch (error) {
      console.error('Error getting client risk analysis:', error);
      throw error;
    }
  }
}

module.exports = AnalyticsService;