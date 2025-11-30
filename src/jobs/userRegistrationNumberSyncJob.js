const User = require('../models/User');
const axios = require('axios');
const logActivity = require('../utils/activityLogger');

class UserRegistrationNumberSyncJob {
  constructor() {
    this.name = 'UserRegistrationNumberSync';
    this.orgServiceUrl = process.env.ORGANIZATION_SERVICE_URL || 'http://localhost:5003';
    this.batchSize = 30; // Reduced batch size to avoid overwhelming
    this.maxRetries = 2; // Reduced from 4 to avoid rate limits
    this.retryDelay = 30000; // 30 seconds - increased to avoid rate limits
  }

  /**
   * Main job execution
   */
  async execute() {
    const startTime = Date.now();
    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    try {
      console.log(`[${this.name}] Starting registration number sync job...`);

      // Get organization users without registration numbers
      const usersToSync = await this.getUsersNeedingRegistrationNumbers();
      console.log(`[${this.name}] Found ${usersToSync.length} organization users without registration numbers`);

      if (usersToSync.length === 0) {
        console.log(`[${this.name}] No users need registration number sync`);
        return { success: true, processed: 0, updated: 0, errors: 0 };
      }

      // Process users in batches
      for (let i = 0; i < usersToSync.length; i += this.batchSize) {
        const batch = usersToSync.slice(i, i + this.batchSize);
        
        try {
          const batchResult = await this.processBatch(batch);
          processedCount += batchResult.processed;
          updatedCount += batchResult.updated;
          errorCount += batchResult.errors;

          // Small delay between batches
          if (i + this.batchSize < usersToSync.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (batchError) {
          console.error(`[${this.name}] Error processing batch ${Math.floor(i / this.batchSize) + 1}:`, batchError.message);
          errorCount += batch.length;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[${this.name}] Job completed in ${duration}ms - Processed: ${processedCount}, Updated: ${updatedCount}, Errors: ${errorCount}`);

      // Log job completion
      await this.logJobExecution({
        processed: processedCount,
        updated: updatedCount,
        errors: errorCount,
        duration
      });

      return {
        success: true,
        processed: processedCount,
        updated: updatedCount,
        errors: errorCount,
        duration
      };

    } catch (error) {
      console.error(`[${this.name}] Job failed:`, error);
      
      await this.logJobExecution({
        processed: processedCount,
        updated: updatedCount,
        errors: errorCount + 1,
        duration: Date.now() - startTime,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        processed: processedCount,
        updated: updatedCount,
        errors: errorCount + 1
      };
    }
  }

  /**
   * Get organization users that don't have registration numbers
   */
  async getUsersNeedingRegistrationNumbers() {
    try {
      const users = await User.find({
        type: 'organization',
        $or: [
          { registrationNumber: { $exists: false } },
          { registrationNumber: null },
          { registrationNumber: '' }
        ]
      }).select('_id email organizationEmail organizationName accountStatus organizationStatus createdAt').lean();

      return users;
    } catch (error) {
      console.error(`[${this.name}] Error getting users for registration number sync:`, error);
      throw error;
    }
  }

  /**
   * Process a batch of users
   */
  async processBatch(users) {
    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const result = await this.syncUserRegistrationNumber(user);
        processed++;
        if (result.updated) {
          updated++;
        }
      } catch (error) {
        console.error(`[${this.name}] Error syncing registration number for user ${user._id}:`, error.message);
        errors++;
      }
    }

    return { processed, updated, errors };
  }

  /**
   * Sync individual user registration number
   */
  async syncUserRegistrationNumber(user) {
    try {
      // Try to find registration by user ID
      const registration = await this.findRegistrationByUser(user);
      
      if (!registration || !registration.registrationNumber) {
        return { 
          updated: false, 
          reason: registration ? 'No registration number in registration' : 'No registration found' 
        };
      }

      // Update user with registration number and organization status
      const updateData = {
        registrationNumber: registration.registrationNumber,
        lastUpdated: new Date(),
        lastSyncAt: new Date()
      };

      // Also sync organization status if available
      if (registration.status) {
        updateData.organizationStatus = registration.status;
        
        // Update account status based on registration status
        const expectedAccountStatus = this.mapRegistrationToAccountStatus(registration.status);
        if (expectedAccountStatus !== user.accountStatus) {
          updateData.accountStatus = expectedAccountStatus;
        }
      }

      await User.findByIdAndUpdate(user._id, updateData);

      console.log(`[${this.name}] Updated user ${user._id} with registration number: ${registration.registrationNumber} (status: ${registration.status})`);

      // Log the sync action
      try {
        await logActivity({
          user: user._id,
          action: 'USER_STATUS_SYNC',
          description: `Registration number added: ${registration.registrationNumber}`,
          details: {
            registrationNumber: registration.registrationNumber,
            organizationStatus: registration.status,
            previousAccountStatus: user.accountStatus,
            newAccountStatus: updateData.accountStatus || user.accountStatus,
            syncType: 'registration_number_sync',
            organizationName: registration.organizationName
          },
          ip: 'localhost',
          userAgent: 'UserRegistrationNumberSyncJob'
        });
      } catch (auditError) {
        console.warn(`[${this.name}] Failed to log sync action for user ${user._id}:`, auditError.message);
      }

      return {
        updated: true,
        registrationNumber: registration.registrationNumber,
        organizationStatus: registration.status,
        accountStatusUpdated: !!updateData.accountStatus
      };

    } catch (error) {
      console.error(`[${this.name}] Error syncing registration number for user ${user._id}:`, error);
      throw error;
    }
  }

  /**
   * Find registration by user ID
   */
  async findRegistrationByUser(user) {
    let retryCount = 0;
    
    while (retryCount < this.maxRetries) {
      try {
        // Add cache busting parameter
        const cacheBuster = Date.now();
        const response = await axios.get(
          `${this.orgServiceUrl}/api/registrations/user/${user._id}?_cb=${cacheBuster}`,
          {
            timeout: 10000,
            headers: {
              'X-Service-Request': 'auth-system-sync',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          }
        );

        if (response.data.success && response.data.data) {
          const registration = response.data.data;
          console.log(`[${this.name}] Found registration for user ${user._id}:`, {
            registrationNumber: registration.registrationNumber,
            status: registration.status,
            organizationName: registration.organizationName
          });
          
          // Validate that we have required data
          if (!registration.registrationNumber) {
            console.warn(`[${this.name}] Registration found but no registrationNumber for user ${user._id}`);
            return null;
          }
          
          return registration;
        }

        return null;
      } catch (error) {
        retryCount++;
        
        // Log specific error details
        if (error.response?.status === 404) {
          // User has no registration - this is normal for some users
          console.log(`[${this.name}] No registration found for user ${user._id} (404)`);
          return null;
        }
        
        console.warn(`[${this.name}] Attempt ${retryCount} failed for user ${user._id}:`, error.message);
        
        if (retryCount < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        } else {
          // Don't throw error for individual users - just log and continue
          console.error(`[${this.name}] Failed to find registration for user ${user._id} after ${this.maxRetries} attempts: ${error.message}`);
          return null;
        }
      }
    }
  }

  /**
   * Map registration status to account status
   */
  mapRegistrationToAccountStatus(registrationStatus) {
    const statusMap = {
      'draft': 'pending_registration',
      'submitted': 'pending_registration',
      'under_review': 'pending_registration',
      'clarification': 'pending_registration',
      'approved': 'active',
      'rejected': 'suspended',
      'certified': 'active'
    };

    return statusMap[registrationStatus] || 'pending_registration';
  }

  /**
   * Log job execution for monitoring
   */
  async logJobExecution(result) {
    try {
      await logActivity({
        user: null, // System action
        action: 'CRON_JOB_EXECUTED',
        description: `Registration number sync job completed: ${result.processed} processed, ${result.updated} updated, ${result.errors} errors`,
        details: {
          jobName: this.name,
          ...result,
          executedAt: new Date()
        },
        ip: 'localhost',
        userAgent: 'CronManager'
      });
    } catch (error) {
      console.error(`[${this.name}] Failed to log job execution:`, error.message);
    }
  }

  /**
   * Health check method
   */
  async healthCheck() {
    try {
      // Check if Organization Service is accessible
      const response = await axios.get(`${this.orgServiceUrl}/health`, {
        timeout: 5000
      });
      
      return {
        healthy: response.status === 200,
        organizationService: 'available',
        database: 'connected'
      };
    } catch (error) {
      return {
        healthy: false,
        organizationService: 'unavailable',
        database: 'unknown',
        error: error.message
      };
    }
  }
}

module.exports = UserRegistrationNumberSyncJob;
