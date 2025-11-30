const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  to: String,
  subject: String,
  type: {
    type: String,
    enum: ['System', 'Invoice', 'Receipt', 'Quotation', 'Other'],
    default: 'Other'
  },
  status: {
    type: String,
    enum: ['sent', 'failed'],
    required: true
  },
  error: String,
  sentAt: { type: Date, default: Date.now }
});

// Add indexes for better query performance
emailLogSchema.index({ sentAt: -1 });
emailLogSchema.index({ type: 1, sentAt: -1 });
emailLogSchema.index({ status: 1, sentAt: -1 });

module.exports = mongoose.model('EmailLog', emailLogSchema);