const express = require('express');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

// Import the global cron manager instance
let cronManager = null;

// Set the cron manager instance (called from app.js)
const setCronManager = (manager) => {
  cronManager = manager;
};

/**
 * @route GET /api/cron/status
 * @desc Get status of all cron jobs
 * @access Admin Only
 */
router.get('/status', authenticateToken, authenticateToken.hasRole(['admin']), async (req, res) => {
  try {
    if (!cronManager) {
      return res.status(503).json({
        success: false,
        message: 'Cron manager not initialized'
      });
    }

    const status = cronManager.getStatus();
    const statistics = cronManager.getStatistics();

    res.json({
      success: true,
      data: {
        status,
        statistics,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Get cron status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cron status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/cron/:jobName/trigger
 * @desc Manually trigger a cron job
 * @access Admin Only
 */
router.post('/:jobName/trigger', authenticateToken, authenticateToken.hasRole(['admin']), async (req, res) => {
  try {
    const { jobName } = req.params;

    if (!cronManager) {
      return res.status(503).json({
        success: false,
        message: 'Cron manager not initialized'
      });
    }

    const result = await cronManager.triggerJob(jobName);

    res.json({
      success: true,
      data: result,
      message: `Job '${jobName}' triggered successfully`
    });

  } catch (error) {
    console.error(`Trigger job ${req.params.jobName} error:`, error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route PATCH /api/cron/:jobName/enable
 * @desc Enable a cron job
 * @access Admin Only
 */
router.patch('/:jobName/enable', authenticateToken, authenticateToken.hasRole(['admin']), async (req, res) => {
  try {
    const { jobName } = req.params;

    if (!cronManager) {
      return res.status(503).json({
        success: false,
        message: 'Cron manager not initialized'
      });
    }

    const success = cronManager.enableJob(jobName);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: `Job '${jobName}' not found`
      });
    }

    res.json({
      success: true,
      message: `Job '${jobName}' enabled successfully`
    });

  } catch (error) {
    console.error(`Enable job ${req.params.jobName} error:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to enable job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route PATCH /api/cron/:jobName/disable
 * @desc Disable a cron job
 * @access Admin Only
 */
router.patch('/:jobName/disable', authenticateToken, authenticateToken.hasRole(['admin']), async (req, res) => {
  try {
    const { jobName } = req.params;

    if (!cronManager) {
      return res.status(503).json({
        success: false,
        message: 'Cron manager not initialized'
      });
    }

    const success = cronManager.disableJob(jobName);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: `Job '${jobName}' not found`
      });
    }

    res.json({
      success: true,
      message: `Job '${jobName}' disabled successfully`
    });

  } catch (error) {
    console.error(`Disable job ${req.params.jobName} error:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to disable job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/cron/:jobName/start
 * @desc Start a cron job
 * @access Admin Only
 */
router.post('/:jobName/start', authenticateToken, authenticateToken.hasRole(['admin']), async (req, res) => {
  try {
    const { jobName } = req.params;

    if (!cronManager) {
      return res.status(503).json({
        success: false,
        message: 'Cron manager not initialized'
      });
    }

    const success = cronManager.startJob(jobName);

    res.json({
      success,
      message: success ? `Job '${jobName}' started successfully` : `Job '${jobName}' could not be started`
    });

  } catch (error) {
    console.error(`Start job ${req.params.jobName} error:`, error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/cron/:jobName/stop
 * @desc Stop a cron job
 * @access Admin Only
 */
router.post('/:jobName/stop', authenticateToken, authenticateToken.hasRole(['admin']), async (req, res) => {
  try {
    const { jobName } = req.params;

    if (!cronManager) {
      return res.status(503).json({
        success: false,
        message: 'Cron manager not initialized'
      });
    }

    const success = cronManager.stopJob(jobName);

    res.json({
      success,
      message: success ? `Job '${jobName}' stopped successfully` : `Job '${jobName}' was not running`
    });

  } catch (error) {
    console.error(`Stop job ${req.params.jobName} error:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/cron/health
 * @desc Get cron manager health status
 * @access Admin Only
 */
router.get('/health', authenticateToken, authenticateToken.hasRole(['admin']), async (req, res) => {
  try {
    if (!cronManager) {
      return res.status(503).json({
        success: false,
        message: 'Cron manager not initialized',
        healthy: false
      });
    }

    const healthResult = await cronManager.performHealthCheck();

    res.json({
      success: true,
      data: healthResult,
      healthy: healthResult.cronManager?.status === 'healthy'
    });

  } catch (error) {
    console.error('Cron health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      healthy: false,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = {
  router,
  setCronManager
};
