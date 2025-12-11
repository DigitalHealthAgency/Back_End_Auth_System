# Production-Ready Cron Manager for User Status Synchronization

## Overview

This implementation provides a robust, production-ready cron management system that automatically synchronizes user account statuses based on their organization registration statuses. It ensures that user accounts are properly updated even if real-time updates fail.

## Architecture

### Components

1. **UserRegistrationNumberSyncJob** (`Auth_System/src/jobs/userRegistrationNumberSyncJob.js`)
   - Initial migration and registration number population
   - Finds organization users without registration numbers
   - Links users to their registrations via user ID lookup
   - Processes in smaller batches for precision

2. **UserStatusSyncJob** (`Auth_System/src/jobs/userStatusSyncJob.js`)
   - Main synchronization job
   - Processes users in batches
   - Handles retries and error recovery
   - Comprehensive audit logging

3. **CronManager** (`Auth_System/src/jobs/cronManager.js`)
   - Production-ready job scheduler
   - Graceful shutdown handling
   - Job monitoring and statistics
   - Health checks and error recovery

4. **SyncRoutes** (`Organization_Registration/src/routes/syncRoutes.js`)
   - Microservice endpoints for status queries
   - Service-to-service authentication
   - Batch processing support
   - User ID to registration lookup

5. **Management API** (`Auth_System/src/routes/cronRoutes.js`)
   - Admin interface for job management
   - Manual job triggering
   - Status monitoring
   - Enable/disable functionality

## Features

### Automated Synchronization
- **Registration Number Sync**: Runs every 6 hours to populate missing registration numbers
- **Status Sync**: Runs every 2 hours to keep statuses synchronized
- **Batch Processing**: Uses appropriate batch sizes for each job type
- **Status Mapping**:
  - `approved` → `active`
  - `rejected` → `suspended`
  - `certified` → `active`
  - `draft/submitted/under_review/clarification` → `pending_registration`

### Production Features
- **Graceful Shutdown**: Properly handles SIGTERM/SIGINT signals
- **Error Recovery**: Automatic retries with exponential backoff
- **Health Monitoring**: Built-in health checks for dependencies
- **Audit Logging**: Comprehensive logging of all sync operations
- **Memory Management**: Processes in batches to prevent memory issues
- **Service Discovery**: Automatic detection of organization service

### Monitoring & Management
- **Real-time Status**: View job status, run counts, success rates
- **Manual Triggers**: Admins can manually trigger synchronization
- **Job Control**: Enable/disable jobs without restarting service
- **Statistics**: Detailed performance metrics and success rates
- **Error Tracking**: Track and monitor failed synchronizations

## Configuration

### Environment Variables
```bash
# Organization Service URL
ORGANIZATION_SERVICE_URL=http://localhost:5003

# Cron Job Settings (optional)
CRON_USER_SYNC_ENABLED=true
CRON_USER_SYNC_SCHEDULE="0 */2 * * *"  # Every 2 hours
CRON_BATCH_SIZE=50
CRON_MAX_RETRIES=3
```

### Job Schedules
- **User Status Sync**: `0 */2 * * *` (Every 2 hours)
- **Health Check**: `*/30 * * * *` (Every 30 minutes)
- **Account Cleanup**: `0 2 * * *` (Daily at 2 AM UTC) - Disabled by default

## API Endpoints

### Admin Management (Auth System)
```
GET    /api/cron/status           - Get all jobs status
POST   /api/cron/:job/trigger     - Manually trigger a job
PATCH  /api/cron/:job/enable      - Enable a job
PATCH  /api/cron/:job/disable     - Disable a job
POST   /api/cron/:job/start       - Start a job
POST   /api/cron/:job/stop        - Stop a job
GET    /api/cron/health           - Health check
```

### Sync Endpoints (Organization Registration)
```
GET    /api/registrations/number/:regNumber/status  - Get registration status
GET    /api/registrations/user/:userId              - Get registration by user ID
POST   /api/registrations/batch/status              - Get multiple statuses
```

## Usage Examples

### Check Job Status
```bash
curl -H "Authorization: Bearer <admin-token>" \
     http://localhost:5000/api/cron/status
```

### Manually Trigger Registration Number Sync
```bash
curl -X POST \
     -H "Authorization: Bearer <admin-token>" \
     http://localhost:5000/api/cron/userRegistrationNumberSync/trigger
```

### Manually Trigger Status Sync
```bash
curl -X POST \
     -H "Authorization: Bearer <admin-token>" \
     http://localhost:5000/api/cron/userStatusSync/trigger
```

### Disable a Job
```bash
curl -X PATCH \
     -H "Authorization: Bearer <admin-token>" \
     http://localhost:5000/api/cron/userStatusSync/disable
```

### Test Registration Number Sync (Development)
```bash
cd Auth_System
node test-registration-sync.js
```

## Benefits

### Reliability
- **Fault Tolerance**: Continues operation even if individual syncs fail
- **Data Consistency**: Ensures user statuses eventually match registration statuses
- **Automatic Recovery**: Retries failed operations with intelligent backoff

### Performance
- **Batch Processing**: Efficient handling of large user bases
- **Resource Management**: Prevents memory leaks and database overload
- **Optimized Queries**: Uses database indexes and efficient query patterns

### Monitoring
- **Comprehensive Logging**: All operations logged to audit trail
- **Performance Metrics**: Track sync times, success rates, error patterns
- **Health Monitoring**: Automatic detection of service issues

### Operational
- **Zero Downtime**: Can be managed without service restarts
- **Admin Control**: Full administrative control over job execution
- **Production Ready**: Built for 24/7 production environments

## Security

- **Service Authentication**: All microservice calls require proper headers
- **Admin Only**: Management endpoints restricted to admin users
- **Audit Logging**: All administrative actions logged
- **Error Sanitization**: Sensitive information not exposed in logs

## Monitoring & Alerting

### Key Metrics to Monitor
- Job success rates
- Sync operation duration
- Error frequency
- Queue processing time
- Service health status

### Recommended Alerts
- Job failure rate > 10%
- Sync duration > 5 minutes
- Service health check failures
- Queue backlog > 1000 users

## Installation

1. **Dependencies are already installed** in the Auth System
2. **Routes are automatically registered** when the service starts
3. **Jobs start automatically** in production mode
4. **No additional configuration required** for basic operation

## Implementation Status

 **Complete and Ready for Production**
- User Status Sync Job implemented
- Cron Manager with full production features
- Admin management API
- Microservice sync endpoints
- Comprehensive error handling
- Audit logging integration
- Health monitoring
- Graceful shutdown handling

The system is now ready to automatically maintain user account status consistency across the microservice architecture.
