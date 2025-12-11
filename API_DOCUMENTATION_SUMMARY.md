# Kenya DHA Authentication Service API - Quick Reference

## Document Overview

**Full Documentation:** See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete details (4,493 lines)

## Quick Stats

- **Total Endpoints:** 100+
- **Public Endpoints:** 12
- **Protected Endpoints:** 65+
- **Admin-Only Endpoints:** 30+
- **Internal Service Endpoints:** 12
- **Roles:** 9
- **Permissions:** 30+

---

## Base URLs

- **Production:** `https://api.dha.go.ke`
- **Staging:** `https://staging-api.dha.go.ke`
- **Development:** `http://localhost:5000`

---

## Quick Start

### 1. Register
```bash
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123!@#",
  "firstName": "John",
  "lastName": "Doe",
  ...
}
```

### 2. Login
```bash
POST /api/auth/login
{
  "identifier": "user@example.com",
  "password": "SecurePass123!@#"
}
# Returns: { "token": "...", "user": {...} }
```

### 3. Use Token
```bash
GET /api/auth/me
Authorization: Bearer <your-token>
```

---

## Endpoint Categories

### 1. Authentication (16 endpoints)
- Register, Login, Logout
- Profile management
- Password change
- Session management
- Account termination

### 2. Password Management (4 endpoints)
- Forgot password
- Verify reset code
- Reset password
- Recovery login

### 3. Two-Factor Authentication (3 endpoints)
- Generate 2FA secret
- Verify 2FA code
- Disable 2FA

### 4. Role Management (6 endpoints)
- Get roles
- Assign roles
- Role statistics
- Bulk operations

### 5. Admin User Management (7 endpoints)
- User CRUD operations
- Status management
- User export

### 6. Security Admin (12 endpoints)
- Security statistics
- Failed logins
- Session management
- IP blocking
- Audit logs

### 7. Admin Dashboard (4 endpoints)
- Dashboard metrics
- Permission matrix
- User activity

### 8. Team Management (10 endpoints)
- Team invitations
- Member management
- Role assignment
- Access revocation

### 9. Suspension Appeals (11 endpoints)
- Submit appeals
- Review process
- Admin decisions

### 10. Internal Services (11 endpoints)
- Service-to-service communication
- User lookups
- Status updates

---

## 9 System Roles

1. **vendor_developer** → `/vendor-portal`
2. **vendor_technical_lead** → `/vendor-portal`
3. **vendor_compliance_officer** → `/vendor-portal`
4. **dha_system_administrator** → `/admin-portal`
5. **dha_certification_officer** → `/certification-portal`
6. **testing_lab_staff** → `/lab-portal`
7. **certification_committee_member** → `/committee-portal`
8. **county_health_officer** → `/county-portal`
9. **public_user** → `/dashboard`

---

## Security Features

### Password Requirements
- Minimum 12 characters
- Uppercase + lowercase + number + special character
- 90-day expiry
- Cannot reuse last 5 passwords

### Account Lockout
- 5 failed attempts → 30-minute lockout
- Progressive delays on attempts
- Auto-unlock after 30 minutes

### Two-Factor Authentication
- TOTP-based (30-second window)
- QR code + manual entry
- Backup codes provided

### IP Security
- VPN/Proxy detection
- Automatic IP blocking
- Whitelist support
- Suspicious activity monitoring

### Rate Limiting
| Endpoint | Limit | Window |
|----------|-------|--------|
| Password Reset | 5 | 1 hour |
| CAPTCHA | 20 | 15 min |
| Sensitive Ops | 50 | 1 hour |
| General API | 1000 | 15 min |

---

## Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized / Invalid Token |
| 403 | Forbidden / Insufficient Permissions |
| 404 | Not Found |
| 409 | Conflict (e.g., email exists) |
| 423 | Locked (account locked/suspended) |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |
| 503 | Maintenance Mode |

---

## Key Error Codes

| Code | Description |
|------|-------------|
| `AUTH-001` | Access Denied |
| `AUTH-002` | Account Suspended |
| `AUTH-003` | Invalid Credentials |
| `AUTH-004` | 2FA Failed |
| `AUTH-005` | Session Expired |
| `AUTH-006` | Account Locked |
| `AUTH-007` | Password Expired |
| `PASSWORD_IN_HISTORY` | Password reused |
| `CAPTCHA_INVALID` | Invalid CAPTCHA |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `2FA_REQUIRED` | 2FA verification needed |
| `IP_BLOCKED` | IP address blocked |
| `VPN_DETECTED` | VPN/Proxy detected |

---

## Authentication Header Formats

### JWT Token (Main Method)
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Service-to-Service
```
x-service-request: true
```

### Admin Impersonation
```
Authorization: Bearer <admin-token>
x-impersonate-user: <user-id>
```

---

## Example Request/Response

### Request
```http
POST /api/auth/login HTTP/1.1
Host: api.dha.go.ke
Content-Type: application/json

{
  "identifier": "developer@healthtech.co.ke",
  "password": "SecurePass123!@#"
}
```

### Response
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "developer@healthtech.co.ke",
      "role": "vendor_developer",
      "accountStatus": "active",
      "twoFactorEnabled": false
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h",
    "portalRedirect": "/vendor-portal"
  }
}
```

---

## Need Help?

- **Full Documentation:** [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Email Support:** api-support@dha.go.ke
- **Developer Portal:** https://developer.dha.go.ke

---

**Last Updated:** December 11, 2025
