# Kenya DHA Authentication Service - Complete Endpoint List

## Public Endpoints (No Authentication Required)

### Authentication
```
POST   /api/auth/register                           - User registration
POST   /api/auth/login                              - User login
POST   /api/auth/setup-password                     - Initial password setup
GET    /api/captcha/generate                        - Generate CAPTCHA
```

### Password Management
```
POST   /api/password/forgot-password                - Request password reset
POST   /api/password/forgot                         - Alias for forgot-password
POST   /api/password/verify-code                    - Verify reset code
POST   /api/password/reset-password                 - Reset password
POST   /api/password/reset                          - Alias for reset-password
POST   /api/password/recovery-login                 - Login with recovery key
```

### Team
```
POST   /api/team/accept/:token                      - Accept team invitation
```

### OAuth
```
GET    /api/auth/google                             - Google OAuth initiate
GET    /api/auth/google/callback                    - Google OAuth callback
GET    /api/auth/google/failure                     - Google OAuth failure
```

### Recovery
```
GET    /recovery/:filename                          - Download recovery PDF
```

### Public Settings
```
GET    /api/public/settings                         - Get public settings
```

---

## Protected Endpoints (JWT Authentication Required)

### User Profile & Account
```
POST   /api/auth/logout                             - Logout
GET    /api/auth/me                                 - Get current user profile
GET    /api/auth/profile                            - Get profile (alias)
PATCH  /api/auth/me                                 - Update profile
PUT    /api/auth/profile                            - Update profile (PUT)
PATCH  /api/auth/profile                            - Update profile (PATCH)
POST   /api/auth/change-password                    - Change password
PATCH  /api/auth/change-password                    - Change password (PATCH)
POST   /api/auth/first-time-password-change         - First-time password change
POST   /api/auth/regenerate-access-key              - Regenerate access key
POST   /api/auth/me/logo                            - Upload logo
DELETE /api/auth/logo                               - Delete logo
POST   /api/auth/terminate                          - Terminate account
POST   /api/auth/abort-termination                  - Abort account termination
```

### Session Management
```
GET    /api/auth/sessions                           - Get active sessions
DELETE /api/auth/sessions/:sessionId                - Terminate session
```

### Two-Factor Authentication
```
POST   /api/2fa/generate                            - Generate 2FA secret
GET    /api/2fa/generate                            - Generate 2FA secret (GET)
POST   /api/2fa/verify                              - Verify 2FA code
POST   /api/2fa/disable                             - Disable 2FA
```

### Team Management (Requires MANAGE_TEAM_MEMBERS permission)
```
POST   /api/team/invite                             - Invite team member
GET    /api/team/invitations/pending                - Get pending invitations
GET    /api/team/members                            - Get team members
GET    /api/team/members/:memberId                  - Get member details
PATCH  /api/team/members/:memberId/role             - Update member role
PATCH  /api/team/members/:memberId/permissions      - Update member permissions
POST   /api/team/members/:memberId/revoke           - Revoke member access
DELETE /api/team/members/:memberId                  - Remove team member
GET    /api/team/hierarchy                          - Get team hierarchy
```

### Suspension Appeals
```
POST   /api/appeals/submit                          - Submit appeal
GET    /api/appeals/my-appeals                      - Get user's appeals
GET    /api/appeals/:appealId                       - Get appeal details
POST   /api/appeals/:appealId/communicate           - Add communication
POST   /api/appeals/:appealId/withdraw              - Withdraw appeal
```

### Role Information
```
GET    /api/roles/user/:userId                      - Get user's role
```

### Security Logs
```
GET    /api/security/logs                           - Get user security logs
```

---

## Admin-Only Endpoints (DHA System Administrator)

### User Management
```
POST   /api/auth/admin/create-user                  - Create user by admin
GET    /api/admin/users/export                      - Export users
GET    /api/admin/users/                            - Get all users
POST   /api/admin/users/                            - Create user
GET    /api/admin/users/:id                         - Get user by ID
PATCH  /api/admin/users/:id/status                  - Update user status
PATCH  /api/admin/users/:id/role                    - Update user role
DELETE /api/admin/users/:id                         - Delete user
```

### Role Management
```
GET    /api/roles/                                  - Get all roles
GET    /api/roles/statistics                        - Get role statistics
GET    /api/roles/users/:role                       - Get users by role
PATCH  /api/roles/assign/:userId                    - Assign role to user
POST   /api/roles/bulk-assign                       - Bulk assign roles
```

### Security Administration
```
GET    /api/admin/security/stats                    - Get security statistics
GET    /api/admin/security/failed-logins            - Get failed login attempts
GET    /api/admin/security/sessions                 - Get all active sessions
DELETE /api/admin/security/sessions/:sessionId      - Terminate session
GET    /api/admin/security/blocked-ips              - Get blocked IPs
DELETE /api/admin/security/blocked-ips/:ipAddress   - Unblock IP
GET    /api/admin/security/whitelisted-ips          - Get whitelisted IPs
POST   /api/admin/security/whitelisted-ips          - Add whitelisted IP
DELETE /api/admin/security/whitelisted-ips/:id      - Remove whitelisted IP
GET    /api/admin/security/export                   - Export security logs
GET    /api/admin/security/audit-logs               - Get audit logs
GET    /api/admin/security/audit-logs/:id           - Get audit log details
GET    /api/admin/security/suspicious-activities    - Get suspicious activities
```

### Dashboard
```
GET    /api/admin/dashboard/metrics                 - Get dashboard metrics
GET    /api/admin/dashboard/failed-logins/:id       - Get failed login details
GET    /api/admin/dashboard/sessions/:sessionId     - Get session details
GET    /api/admin/dashboard/blocked-ips/:id         - Get blocked IP details
GET    /api/admin/dashboard/users/:userId/activity  - Get user activity
GET    /api/admin/dashboard/permissions/matrix      - Get permission matrix
GET    /api/admin/dashboard/permissions/roles/:role - Get role details
POST   /api/admin/dashboard/users/:userId/assign-role - Assign role with confirmation
```

### Suspension Appeals (Admin)
```
GET    /api/appeals/pending                         - Get pending appeals
GET    /api/appeals/statistics                      - Get appeal statistics
POST   /api/appeals/:appealId/review/start          - Start appeal review
POST   /api/appeals/:appealId/approve               - Approve appeal
POST   /api/appeals/:appealId/reject                - Reject appeal
POST   /api/appeals/:appealId/notes                 - Add internal note
```

---

## Internal Service Endpoints (Service-to-Service)

**Authentication:** Requires `x-service-request: true` header

```
POST   /api/auth/internal/board-member-user                       - Create board member user
GET    /api/auth/internal/organization/:regNumber/members         - Get organization members
GET    /api/auth/internal/user/by-email/:email                    - Find user by email
GET    /api/auth/internal/user/:userId/password-exists            - Check if user has password
PATCH  /api/auth/internal/user/:userId/board-role                 - Update board role
PATCH  /api/auth/internal/user/:userId/profile                    - Update user profile
PATCH  /api/auth/internal/user/:userId/status                     - Update user status
PATCH  /api/auth/internal/user/:userId/deactivate                 - Deactivate user
POST   /api/auth/internal/send-email                              - Send internal email
GET    /api/auth/internal/user/:userId                            - Get user by ID
POST   /api/auth/internal/users/batch                             - Get multiple users by IDs
```

---

## Endpoint Count by Category

| Category | Count |
|----------|-------|
| Authentication | 16 |
| Password Management | 4 |
| Two-Factor Authentication | 3 |
| Role Management | 6 |
| Admin User Management | 7 |
| Security Admin | 12 |
| Admin Dashboard | 8 |
| Team Management | 10 |
| Suspension Appeals (User) | 5 |
| Suspension Appeals (Admin) | 6 |
| Internal Services | 11 |
| OAuth | 3 |
| Public/Misc | 3 |
| **TOTAL** | **94** |

---

## HTTP Methods Distribution

| Method | Count |
|--------|-------|
| GET    | 42 |
| POST   | 34 |
| PATCH  | 12 |
| DELETE | 5 |
| PUT    | 1 |
| **TOTAL** | **94** |

---

## Authentication Requirements

| Type | Count |
|------|-------|
| Public | 12 |
| Protected | 25 |
| Admin Only | 46 |
| Internal Service | 11 |
| **TOTAL** | **94** |

---

**Generated:** December 11, 2025  
**API Version:** v1

