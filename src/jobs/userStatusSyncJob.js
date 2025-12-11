const User = require('../models/User');
const axios = require('axios');
const logActivity = require('../utils/activityLogger');

class UserStatusSyncJob {
  constructor() {
    this.name = 'UserStatusSync';
    this.orgServiceUrl = process.env.ORGANIZATION_SERVICE_URL || 'http://localhost:5003';
    this.batchSize = 50; // Process users in batches
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
      console.log(`[${this.name}] Starting user status synchronization job...`);

      // Get all users that might need status updates
      const usersToSync = await this.getUsersNeedingSync();
      console.log(`[${this.name}] Found ${usersToSync.length} users to check for status sync`);

      if (usersToSync.length === 0) {
        console.log(`[${this.name}] No users need status synchronization`);
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

          // Small delay between batches to avoid overwhelming the system
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
   * Get users that might need status synchronization
   */
  async getUsersNeedingSync() {
    try {
      // Get users that either:
      // 1. Have registration numbers (direct link)
      // 2. Are organizations with status that could benefit from sync
      const users = await User.find({
        $or: [
          // Users with registration numbers
          { 
            registrationNumber: { $exists: true, $ne: null }
          },
          // Organization users who might have registrations but no registration number field yet
          {
            type: 'organization',
            $or: [
              { accountStatus: 'pending_registration' },
              { accountStatus: 'submitted' },
              { accountStatus: 'under_review' },
              { accountStatus: 'clarification' },
              // Users updated more than 1 hour ago (to catch missed updates)
              { 
                lastUpdated: { 
                  $lt: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
                },
                accountStatus: { $in: ['pending_registration', 'submitted', 'under_review'] }
              }
            ]
          }
        ]
      }).select('_id email organizationEmail organizationName accountStatus organizationStatus registrationNumber lastUpdated type').lean();

      return users;
    } catch (error) {
      console.error(`[${this.name}] Error getting users for sync:`, error);
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
        const result = await this.syncUserStatus(user);
        processed++;
        if (result.updated) {
          updated++;
        }
      } catch (error) {
        console.error(`[${this.name}] Error syncing user ${user._id}:`, error.message);
        errors++;
      }
    }

    return { processed, updated, errors };
  }

  /**
   * Sync individual user status
   */
  async syncUserStatus(user) {
    try {
      let registrationStatus = null;
      let registrationNumber = user.registrationNumber;

      // Try to get registration status - first by registration number, then by user lookup
      if (registrationNumber) {
        registrationStatus = await this.getRegistrationStatus(registrationNumber);
      } else if (user.type === 'organization') {
        // Try to find registration by user ID or email
        const foundRegistration = await this.findRegistrationByUser(user);
        if (foundRegistration) {
          registrationStatus = foundRegistration;
          registrationNumber = foundRegistration.registrationNumber;
        }
      }
      
      if (!registrationStatus) {
        // No registration found or service unavailable
        return { updated: false, reason: 'No registration found' };
      }

      // Determine what the account status should be
      const expectedAccountStatus = this.mapRegistrationToAccountStatus(registrationStatus.status);
      const expectedOrgStatus = registrationStatus.status;

      // Check if update is needed
      const needsUpdate = user.accountStatus !== expectedAccountStatus || 
                         user.organizationStatus !== expectedOrgStatus ||
                         (registrationNumber && user.registrationNumber !== registrationNumber);

      if (!needsUpdate) {
        console.log(`[${this.name}] User ${user._id} already in sync: accountStatus=${user.accountStatus}, registrationStatus=${registrationStatus.status}`);
        return { updated: false, reason: 'Already in sync' };
      }

      // Update user status
      const updateData = {
        accountStatus: expectedAccountStatus,
        organizationStatus: expectedOrgStatus,
        lastUpdated: new Date(),
        lastSyncAt: new Date()
      };

      // Add registration number if we found it and user doesn't have it
      if (registrationNumber && !user.registrationNumber) {
        updateData.registrationNumber = registrationNumber;
      }

      await User.findByIdAndUpdate(user._id, updateData);

      console.log(`[${this.name}]  UPDATED user ${user._id}: ${user.accountStatus} -> ${expectedAccountStatus}` + 
                  (registrationNumber && !user.registrationNumber ? ` (added registration number: ${registrationNumber})` : ''));

      // Log the sync action
      try {
        await logActivity({
          user: user._id,
          action: 'USER_STATUS_SYNC',
          description: `User status synced from ${user.accountStatus} to ${expectedAccountStatus}`,
          details: {
            previousAccountStatus: user.accountStatus,
            newAccountStatus: expectedAccountStatus,
            previousOrgStatus: user.organizationStatus,
            newOrgStatus: expectedOrgStatus,
            registrationNumber: registrationNumber,
            registrationStatus: registrationStatus.status,
            syncType: 'automated',
            registrationNumberAdded: registrationNumber && !user.registrationNumber
          },
          ip: 'localhost',
          userAgent: 'UserStatusSyncJob'
        });
      } catch (auditError) {
        console.warn(`[${this.name}] Failed to log sync action for user ${user._id}:`, auditError.message);
      }

      return {
        updated: true,
        previousStatus: user.accountStatus,
        newStatus: expectedAccountStatus,
        registrationStatus: registrationStatus.status,
        registrationNumberAdded: registrationNumber && !user.registrationNumber
      };

    } catch (error) {
      console.error(`[${this.name}] Error syncing user ${user._id}:`, error);
      throw error;
    }
  }

  /**
   * Get registration status from Organization Service
   */
  async getRegistrationStatus(registrationNumber) {
    let retryCount = 0;
    
    while (retryCount < this.maxRetries) {
      try {
        // Add cache busting parameter
        const cacheBuster = Date.now();
        const response = await axios.get(
          `${this.orgServiceUrl}/api/registrations/number/${registrationNumber}/status?_cb=${cacheBuster}`,
          {
            timeout: 10000, // 10 second timeout
            headers: {
              'X-Service-Request': 'auth-system-sync',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          }
        );

        if (response.data.success && response.data.data) {
          console.log(`[${this.name}] Got registration status for ${registrationNumber}: ${response.data.data.status}`);
          return response.data.data;
        }

        return null;
      } catch (error) {
        retryCount++;
        console.warn(`[${this.name}] Attempt ${retryCount} failed for registration ${registrationNumber}:`, error.message);
        
        if (retryCount < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        } else {
          throw new Error(`Failed to get registration status after ${this.maxRetries} attempts: ${error.message}`);
        }
      }
    }
  }

  /**
   * Find registration by user details when registration number is not available
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
            timeout: 10000, // 10 second timeout
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
        console.warn(`[${this.name}] Attempt ${retryCount} failed for user registration lookup ${user._id}:`, error.message);
        
        if (retryCount < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        } else {
          // Don't throw error here - just return null as this is a fallback method
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
        description: `User status sync job completed: ${result.processed} processed, ${result.updated} updated, ${result.errors} errors`,
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

module.exports = UserStatusSyncJob;
