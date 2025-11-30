const cron = require('node-cron');
const UserStatusSyncJob = require('./userStatusSyncJob');
const UserRegistrationNumberSyncJob = require('./userRegistrationNumberSyncJob');

class CronManager {
  constructor() {
    this.jobs = new Map();
    this.isShuttingDown = false;
    this.runningJobs = new Set();
    
    // Initialize jobs
    this.initializeJobs();
    
    // Handle graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Initialize all cron jobs
   */
  initializeJobs() {
    // User Registration Number Sync Job - runs daily at 3 AM (production schedule)
    this.registerJob('userRegistrationNumberSync', {
      schedule: '0 3 * * *', // Daily at 3 AM UTC
      job: new UserRegistrationNumberSyncJob(),
      description: 'Add registration numbers to organization users who don\'t have them',
      enabled: process.env.NODE_ENV !== 'test', // Disable in test environment
      timezone: 'UTC'
    });

    // User Status Sync Job - runs every 6 hours (production schedule)
    this.registerJob('userStatusSync', {
      schedule: '0 */6 * * *', // Every 6 hours
      job: new UserStatusSyncJob(),
      description: 'Synchronize user account statuses with registration statuses',
      enabled: process.env.NODE_ENV !== 'test', // Disable in test environment
      timezone: 'UTC'
    });

    // Account Cleanup Job - runs daily at 2 AM
    this.registerJob('accountCleanup', {
      schedule: '0 2 * * *', // Daily at 2 AM UTC
      job: null, // Will be implemented later if needed
      description: 'Clean up old audit logs and temporary data',
      enabled: false, // Disabled for now
      timezone: 'UTC'
    });

    // Health Check Job - runs every 30 minutes
    this.registerJob('healthCheck', {
      schedule: '*/30 * * * *', // Every 30 minutes
      job: {
        execute: async () => {
          return await this.performHealthCheck();
        }
      },
      description: 'Perform system health checks',
      enabled: process.env.NODE_ENV === 'production',
      timezone: 'UTC'
    });
  }

  /**
   * Register a new cron job
   */
  registerJob(name, config) {
    if (this.jobs.has(name)) {
      console.warn(`[CronManager] Job '${name}' already exists. Skipping registration.`);
      return false;
    }

    if (!config.schedule || !config.job) {
      console.error(`[CronManager] Invalid job configuration for '${name}'`);
      return false;
    }

    const jobConfig = {
      name,
      schedule: config.schedule,
      job: config.job,
      description: config.description || '',
      enabled: config.enabled !== false,
      timezone: config.timezone || 'UTC',
      task: null,
      lastRun: null,
      lastResult: null,
      runCount: 0,
      errorCount: 0
    };

    this.jobs.set(name, jobConfig);
    console.log(`[CronManager] Registered job '${name}': ${config.description}`);
    
    return true;
  }

  /**
   * Start all enabled cron jobs
   */
  startAll() {
    console.log('[CronManager] Starting cron manager...');
    
    let startedCount = 0;
    let skippedCount = 0;

    for (const [name, config] of this.jobs) {
      if (config.enabled && config.job) {
        try {
          this.startJob(name);
          startedCount++;
        } catch (error) {
          console.error(`[CronManager] Failed to start job '${name}':`, error.message);
          config.errorCount++;
        }
      } else {
        console.log(`[CronManager] Skipping disabled job '${name}'`);
        skippedCount++;
      }
    }

    console.log(`[CronManager] Started ${startedCount} jobs, skipped ${skippedCount} jobs`);
    
    // Log startup summary
    this.logManagerStatus('started');
  }

  /**
   * Start a specific job
   */
  startJob(name) {
    const config = this.jobs.get(name);
    if (!config) {
      throw new Error(`Job '${name}' not found`);
    }

    if (config.task) {
      console.warn(`[CronManager] Job '${name}' is already running`);
      return false;
    }

    if (!config.enabled) {
      throw new Error(`Job '${name}' is disabled`);
    }

    // Validate cron schedule
    if (!cron.validate(config.schedule)) {
      throw new Error(`Invalid cron schedule for job '${name}': ${config.schedule}`);
    }

    // Create the cron task
    config.task = cron.schedule(config.schedule, async () => {
      await this.executeJob(name);
    }, {
      scheduled: false, // Don't start immediately
      timezone: config.timezone
    });

    // Start the task
    config.task.start();
    
    console.log(`[CronManager] Started job '${name}' with schedule '${config.schedule}'`);
    return true;
  }

  /**
   * Stop a specific job
   */
  stopJob(name) {
    const config = this.jobs.get(name);
    if (!config || !config.task) {
      console.warn(`[CronManager] Job '${name}' is not running`);
      return false;
    }

    config.task.stop();
    config.task = null;
    
    console.log(`[CronManager] Stopped job '${name}'`);
    return true;
  }

  /**
   * Stop all jobs
   */
  stopAll() {
    console.log('[CronManager] Stopping all cron jobs...');
    
    let stoppedCount = 0;
    for (const [name] of this.jobs) {
      if (this.stopJob(name)) {
        stoppedCount++;
      }
    }

    console.log(`[CronManager] Stopped ${stoppedCount} jobs`);
    this.logManagerStatus('stopped');
  }

  /**
   * Execute a job with error handling and logging
   */
  async executeJob(name) {
    if (this.isShuttingDown) {
      console.log(`[CronManager] Skipping job '${name}' - system is shutting down`);
      return;
    }

    const config = this.jobs.get(name);
    if (!config) {
      console.error(`[CronManager] Job '${name}' not found during execution`);
      return;
    }

    // Check if job is already running
    if (this.runningJobs.has(name)) {
      console.warn(`[CronManager] Job '${name}' is already running, skipping this execution`);
      return;
    }

    this.runningJobs.add(name);
    const startTime = Date.now();

    try {
      console.log(`[CronManager] Executing job '${name}'...`);
      
      // Execute the job
      const result = await config.job.execute();
      
      const duration = Date.now() - startTime;
      config.lastRun = new Date();
      config.lastResult = { success: true, ...result, duration };
      config.runCount++;

      console.log(`[CronManager] Job '${name}' completed successfully in ${duration}ms`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      config.lastRun = new Date();
      config.lastResult = { 
        success: false, 
        error: error.message, 
        duration 
      };
      config.errorCount++;

      console.error(`[CronManager] Job '${name}' failed after ${duration}ms:`, error.message);
      
      // Don't stop the job on error - let it retry on next schedule
    } finally {
      this.runningJobs.delete(name);
    }
  }

  /**
   * Get status of all jobs
   */
  getStatus() {
    const status = {
      managerStatus: this.isShuttingDown ? 'shutting_down' : 'running',
      totalJobs: this.jobs.size,
      runningJobs: this.runningJobs.size,
      jobs: []
    };

    for (const [name, config] of this.jobs) {
      status.jobs.push({
        name,
        description: config.description,
        schedule: config.schedule,
        enabled: config.enabled,
        isRunning: config.task ? config.task.running : false,
        isCurrentlyExecuting: this.runningJobs.has(name),
        lastRun: config.lastRun,
        lastResult: config.lastResult,
        runCount: config.runCount,
        errorCount: config.errorCount,
        successRate: config.runCount > 0 ? 
          ((config.runCount - config.errorCount) / config.runCount * 100).toFixed(2) + '%' : 
          'N/A'
      });
    }

    return status;
  }

  /**
   * Enable a job
   */
  enableJob(name) {
    const config = this.jobs.get(name);
    if (!config) {
      return false;
    }

    config.enabled = true;
    console.log(`[CronManager] Enabled job '${name}'`);
    return true;
  }

  /**
   * Disable a job
   */
  disableJob(name) {
    const config = this.jobs.get(name);
    if (!config) {
      return false;
    }

    // Stop the job if it's running
    this.stopJob(name);
    config.enabled = false;
    console.log(`[CronManager] Disabled job '${name}'`);
    return true;
  }

  /**
   * Manually trigger a job
   */
  async triggerJob(name) {
    const config = this.jobs.get(name);
    if (!config) {
      throw new Error(`Job '${name}' not found`);
    }

    if (!config.job) {
      throw new Error(`Job '${name}' has no executable`);
    }

    console.log(`[CronManager] Manually triggering job '${name}'`);
    await this.executeJob(name);
    
    return config.lastResult;
  }

  /**
   * Perform system health check
   */
  async performHealthCheck() {
    try {
      const userStatusJob = new UserStatusSyncJob();
      const healthResult = await userStatusJob.healthCheck();
      
      return {
        timestamp: new Date(),
        cronManager: {
          totalJobs: this.jobs.size,
          runningJobs: this.runningJobs.size,
          status: 'healthy'
        },
        services: healthResult
      };
    } catch (error) {
      return {
        timestamp: new Date(),
        cronManager: {
          totalJobs: this.jobs.size,
          runningJobs: this.runningJobs.size,
          status: 'unhealthy',
          error: error.message
        }
      };
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`[CronManager] Received ${signal}, starting graceful shutdown...`);
      this.isShuttingDown = true;

      // Stop all jobs
      this.stopAll();

      // Wait for running jobs to complete (max 30 seconds)
      const maxWaitTime = 30000;
      const startTime = Date.now();
      
      while (this.runningJobs.size > 0 && (Date.now() - startTime) < maxWaitTime) {
        console.log(`[CronManager] Waiting for ${this.runningJobs.size} jobs to complete...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (this.runningJobs.size > 0) {
        console.warn(`[CronManager] ${this.runningJobs.size} jobs did not complete within timeout`);
      } else {
        console.log('[CronManager] All jobs completed successfully');
      }

      console.log('[CronManager] Graceful shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Log manager status changes
   */
  logManagerStatus(action) {
    const status = this.getStatus();
    console.log(`[CronManager] Manager ${action}:`, {
      totalJobs: status.totalJobs,
      runningJobs: status.runningJobs,
      timestamp: new Date()
    });
  }

  /**
   * Get job statistics
   */
  getStatistics() {
    const stats = {
      totalJobs: this.jobs.size,
      enabledJobs: 0,
      runningJobs: this.runningJobs.size,
      totalRuns: 0,
      totalErrors: 0,
      averageSuccessRate: 0
    };

    let totalSuccessRate = 0;
    let jobsWithRuns = 0;

    for (const [, config] of this.jobs) {
      if (config.enabled) stats.enabledJobs++;
      stats.totalRuns += config.runCount;
      stats.totalErrors += config.errorCount;
      
      if (config.runCount > 0) {
        const successRate = (config.runCount - config.errorCount) / config.runCount;
        totalSuccessRate += successRate;
        jobsWithRuns++;
      }
    }

    if (jobsWithRuns > 0) {
      stats.averageSuccessRate = (totalSuccessRate / jobsWithRuns * 100).toFixed(2) + '%';
    } else {
      stats.averageSuccessRate = 'N/A';
    }

    return stats;
  }
}

module.exports = CronManager;
