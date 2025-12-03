// models/SystemSettings.js
const mongoose = require('mongoose');

const SystemSettingsSchema = new mongoose.Schema({
  // Application Settings
  platformName: {
    type: String,
    default: 'Prezio'
  },
  supportEmail: {
    type: String,
    default: 'support@prezio.com'
  },
  supportPhone: {
    type: String,
    default: ''
  },
  logoUrl: {
    type: String,
    default: 'https://res.cloudinary.com/dqmo5qzze/image/upload/v1745409948/default-logo-1_al7thz.png'
  },
  favicon: {
    type: String,
    default: ''
  },
  
  // Finance Settings
  defaultCurrency: {
    type: String,
    enum: ['USD', 'EUR', 'GBP', 'KES', 'NGN', 'ZAR', 'CAD', 'AUD', 'INR'],
    default: 'KES'
  },
  defaultTaxRate: {
    type: Number,
    default: 16 // 16% as default
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  
  // Terms & Conditions
  globalInvoiceTerms: {
    type: String,
    default: 'Payment is due within 30 days of invoice date.'
  },
  globalQuoteTerms: {
    type: String,
    default: 'Quote valid for 30 days from issue date.'
  },
  globalReceiptTerms: {
    type: String,
    default: 'Thank you for your business.'
  },
  globalEstimateTerms: {
    type: String,
    default: 'Estimate valid for 15 days from issue date.'
  },
  
  // Feature Flags
  enableSignup: {
    type: Boolean,
    default: true
  },
  require2FA: {
    type: Boolean,
    default: true  // ✅ FIXED: Mandatory 2FA globally
  },
  enableNotifications: {
    type: Boolean,
    default: true
  },
  
  // Appearance & Theme
  primaryColor: {
    type: String,
    default: '#2563eb' // Default blue color
  },
  secondaryColor: {
    type: String,
    default: '#4f46e5'
  },
  accentColor: {
    type: String,
    default: '#10b981'
  },
  fontFamily: {
    type: String,
    default: 'Roboto, sans-serif'
  },
  
  // Announcements
  announcementEnabled: {
    type: Boolean,
    default: false
  },
  announcementText: {
    type: String,
    default: ''
  },
  announcementType: {
    type: String,
    enum: ['info', 'warning', 'success', 'error'],
    default: 'info'
  },
  announcementStartDate: {
    type: Date,
    default: null
  },
  announcementEndDate: {
    type: Date,
    default: null
  },
  
  // Maintenance Mode
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  maintenanceMessage: {
    type: String,
    default: 'The system is currently under maintenance. Please check back later.'
  },
  plannedMaintenanceStart: {
    type: Date,
    default: null
  },
  plannedMaintenanceEnd: {
    type: Date,
    default: null
  },
  
  // Social Links
  socialLinks: {
    twitter: {
      type: String,
      default: ''
    },
    facebook: {
      type: String,
      default: ''
    },
    linkedin: {
      type: String,
      default: ''
    },
    instagram: {
      type: String,
      default: ''
    }
  },
  
  // API Keys Configuration
  apiKeysEnabled: {
    type: Boolean,
    default: false
  },
  
  // Custom Footer
  customFooterText: {
    type: String,
    default: '© Prezio. All rights reserved.'
  },
  
  // Last Updated Metadata
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Ensure there's only one document in the collection
SystemSettingsSchema.statics.getSettings = async function() {
  const settings = await this.findOne();
  if (settings) {
    return settings;
  }
  
  // Create default settings if none exist
  return await this.create({});
};

const SystemSettings = mongoose.model('SystemSettings', SystemSettingsSchema);
module.exports = SystemSettings;