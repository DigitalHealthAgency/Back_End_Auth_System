# Kenya DHA Authentication Service - Complete API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Base URL & Environments](#base-url--environments)
4. [Common Response Formats](#common-response-formats)
5. [Error Codes](#error-codes)
6. [Rate Limiting](#rate-limiting)
7. [API Endpoints](#api-endpoints)
   - [Authentication Endpoints](#1-authentication-endpoints)
   - [Password Management Endpoints](#2-password-management-endpoints)
   - [Two-Factor Authentication Endpoints](#3-two-factor-authentication-endpoints)
   - [Role Management Endpoints](#4-role-management-endpoints)
   - [Admin User Management Endpoints](#5-admin-user-management-endpoints)
   - [Security Admin Endpoints](#6-security-admin-endpoints)
   - [Admin Dashboard Endpoints](#7-admin-dashboard-endpoints)
   - [Team Management Endpoints](#8-team-management-endpoints)
   - [Suspension Appeal Endpoints](#9-suspension-appeal-endpoints)
   - [Internal Service Endpoints](#10-internal-service-endpoints)
8. [Security Features](#security-features)
9. [Roles & Permissions](#roles--permissions)
10. [Middleware & Validation](#middleware--validation)

---

## Overview

The Kenya Digital Health Authority (DHA) Authentication Service is a comprehensive, enterprise-grade authentication and authorization system built for secure user management, role-based access control, and compliance with healthcare data security standards.

### Key Features

- **JWT-based Authentication** with token versioning
- **Role-Based Access Control (RBAC)** with 9 distinct roles
- **Two-Factor Authentication (2FA)** using TOTP
- **Advanced Security Features**: IP blocking, VPN detection, account lockout
- **Password Security**: 90-day expiry, history tracking, complexity requirements
- **Session Management**: Multi-device support, remote termination
- **Audit Logging**: Comprehensive activity tracking
- **Rate Limiting**: Protection against brute force attacks
- **Microservice Communication**: Internal service-to-service APIs

### Technology Stack

- Node.js/Express
- MongoDB with Mongoose
- JWT for authentication
- bcrypt for password hashing
- speakeasy for 2FA
- Helmet for security headers
- Express-rate-limit for rate limiting

---

## Authentication & Authorization

### Authentication Methods

1. **JWT Tokens** (Primary)
   - Tokens can be sent via:
     - Cookie: `token` (HttpOnly, Secure)
     - Header: `Authorization: Bearer <token>`
   - Token lifetime: Configurable (default: 24 hours)
   - Token versioning for session invalidation

2. **Service-to-Service Authentication**
   - Header: `x-service-request: true`
   - Used for internal microservice communication

3. **Admin Impersonation**
   - Header: `x-impersonate-user: <userId>`
   - Only available to DHA System Administrators

### Authorization Levels

- **Public**: No authentication required
- **Protected**: Valid JWT token required
- **Role-Based**: Specific role(s) required
- **Permission-Based**: Specific permission(s) required
- **Admin-Only**: DHA System Administrator role required
- **Internal**: Service-to-service authentication required

---

## Base URL & Environments

### Production
```
https://api.dha.go.ke
```

### Staging
```
https://staging-api.dha.go.ke
```

### Development
```
http://localhost:5000
```

---

## Common Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "ERROR_CODE",
  "details": {
    // Additional error details
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH-001` | 403 | Access Denied - Insufficient permissions |
| `AUTH-002` | 423 | Account Suspended |
| `AUTH-003` | 401 | Invalid Credentials |
| `AUTH-004` | 401 | Two-Factor Authentication Failed |
| `AUTH-005` | 401 | Session Expired |
| `AUTH-006` | 423 | Account Locked (too many failed attempts) |
| `AUTH-007` | 401 | Password Expired |
| `PASSWORD_EXPIRED` | 401 | Password has expired (90-day policy) |
| `PASSWORD_TOO_SHORT` | 400 | Password must be at least 12 characters |
| `PASSWORD_IN_HISTORY` | 400 | Password was recently used |
| `PASSWORD_COMPLEXITY` | 400 | Password doesn't meet complexity requirements |
| `CAPTCHA_REQUIRED` | 400 | CAPTCHA verification required |
| `CAPTCHA_INVALID` | 400 | Invalid CAPTCHA code |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `EMAIL_EXISTS` | 409 | Email already registered |
| `INVALID_TOKEN` | 401 | Invalid or expired token |
| `2FA_REQUIRED` | 403 | Two-factor authentication required |
| `2FA_ENABLED` | 409 | 2FA already enabled |
| `2FA_NOT_ENABLED` | 400 | 2FA not enabled for this account |
| `IP_BLOCKED` | 403 | IP address blocked due to suspicious activity |
| `VPN_DETECTED` | 403 | VPN/Proxy detected (blocked) |
| `MAINTENANCE_MODE` | 503 | System under maintenance |
| `SOD_VIOLATION` | 403 | Separation of Duties violation |
| `INVALID_ROLE` | 400 | Invalid role specified |
| `USER_NOT_FOUND` | 404 | User not found |
| `SESSION_NOT_FOUND` | 404 | Session not found |
| `APPEAL_NOT_FOUND` | 404 | Appeal not found |

---

## Rate Limiting

### Rate Limit Tiers

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| **Forgot Password** | 5 requests | 1 hour |
| **CAPTCHA Generation** | 20 requests | 15 minutes |
| **Sensitive Operations** | 50 requests | 1 hour |
| **Invoice Operations** | 100 requests | 15 minutes |
| **General API** | 1000 requests | 15 minutes |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
Retry-After: 900
```

---

# API Endpoints

## 1. Authentication Endpoints

### 1.1 User Registration

**Endpoint:** `POST /api/auth/register`

**Authorization:** Public

**Description:** Register a new user (individual or organization) in the system.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body (Individual):**
```json
{
  "accountType": "individual",
  "email": "user@example.com",
  "password": "SecurePass123!@#",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+254712345678",
  "idNumber": "12345678",
  "county": "Nairobi",
  "captchaText": "ABCD123",
  "captchaId": "captcha-uuid-here"
}
```

**Request Body (Organization):**
```json
{
  "accountType": "organization",
  "email": "org@example.com",
  "password": "SecurePass123!@#",
  "organizationName": "Health Corp Ltd",
  "organizationType": "private_hospital",
  "registrationNumber": "REG123456",
  "phoneNumber": "+254712345678",
  "county": "Nairobi",
  "physicalAddress": "123 Main Street",
  "postalAddress": "P.O. Box 12345",
  "authorizedPersonName": "Jane Doe",
  "authorizedPersonTitle": "CEO",
  "authorizedPersonEmail": "jane@example.com",
  "authorizedPersonPhone": "+254798765432",
  "captchaText": "ABCD123",
  "captchaId": "captcha-uuid-here"
}
```

**Validation Rules:**
- Password: Minimum 12 characters, must contain uppercase, lowercase, number, and special character
- Email: Valid email format
- Phone: Kenyan format (+254...)
- CAPTCHA: Required and must be valid
- ID Number: Required for individuals
- Registration Number: Required for organizations

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to set up your password.",
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "accountType": "individual",
      "firstName": "John",
      "lastName": "Doe",
      "role": "public_user",
      "accountStatus": "pending_verification",
      "createdAt": "2025-12-11T10:00:00.000Z"
    },
    "accessKey": "AK-XXXX-XXXX-XXXX-XXXX",
    "recoveryPdfUrl": "/recovery/recovery_1234567890.pdf"
  }
}
```

**Error Responses:**
```json
{
  "success": false,
  "message": "Email already exists",
  "error": "EMAIL_EXISTS"
}
```

```json
{
  "success": false,
  "message": "Invalid CAPTCHA code",
  "error": "CAPTCHA_INVALID"
}
```

---

### 1.2 User Login

**Endpoint:** `POST /api/auth/login`

**Authorization:** Public

**Description:** Authenticate user and receive JWT token.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "identifier": "user@example.com",
  "password": "SecurePass123!@#"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "vendor_developer",
      "accountStatus": "active",
      "twoFactorEnabled": false,
      "passwordExpiresAt": "2026-03-11T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h",
    "portalRedirect": "/vendor-portal"
  }
}
```

**Success Response with 2FA Required (200 OK):**
```json
{
  "success": true,
  "message": "2FA verification required",
  "data": {
    "require2FA": true,
    "tempToken": "temp-token-for-2fa-verification",
    "userId": "user-uuid"
  }
}
```

**Error Responses:**
```json
{
  "success": false,
  "message": "Invalid credentials",
  "error": "AUTH-003"
}
```

```json
{
  "success": false,
  "message": "Account locked due to multiple failed login attempts. Try again in 30 minutes.",
  "error": "AUTH-006",
  "lockedUntil": "2025-12-11T11:30:00.000Z"
}
```

```json
{
  "success": false,
  "message": "Account is suspended",
  "error": "AUTH-002"
}
```

**Security Features:**
- Progressive delays on failed attempts
- Account lockout after 5 failed attempts (30-minute lockout)
- IP tracking and blocking for suspicious activity
- VPN/Proxy detection
- Auto-unlock after 30 minutes

---

### 1.3 User Logout

**Endpoint:** `POST /api/auth/logout`

**Authorization:** Protected (JWT Required)

**Description:** Logout user and invalidate current session token.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 1.4 Get Current User Profile

**Endpoint:** `GET /api/auth/me`

**Aliases:** `GET /api/auth/profile`

**Authorization:** Protected (JWT Required)

**Description:** Retrieve authenticated user's profile information.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "accountType": "individual",
      "firstName": "John",
      "lastName": "Doe",
      "phoneNumber": "+254712345678",
      "role": "vendor_developer",
      "permissions": [
        "submit_application",
        "view_own_applications",
        "manage_team_members"
      ],
      "accountStatus": "active",
      "twoFactorEnabled": true,
      "county": "Nairobi",
      "createdAt": "2025-01-01T10:00:00.000Z",
      "lastLogin": "2025-12-11T09:30:00.000Z",
      "passwordExpiresAt": "2026-03-11T10:00:00.000Z",
      "passwordChangedAt": "2025-12-11T10:00:00.000Z",
      "accessKey": "AK-XXXX-XXXX-XXXX-XXXX",
      "logo": "/uploads/logos/user-uuid.png"
    }
  }
}
```

**Response Headers (Password Expiry Warning):**
```
X-Password-Expiry-Warning: true
X-Password-Days-Remaining: 7
```

---

### 1.5 Update User Profile

**Endpoint:** `PATCH /api/auth/me`

**Aliases:** `PUT /api/auth/profile`, `PATCH /api/auth/profile`

**Authorization:** Protected (JWT Required)

**Description:** Update authenticated user's profile information.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+254712345678",
  "county": "Mombasa",
  "physicalAddress": "123 New Street"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phoneNumber": "+254712345678",
      "county": "Mombasa",
      "physicalAddress": "123 New Street",
      "updatedAt": "2025-12-11T10:00:00.000Z"
    }
  }
}
```

---

### 1.6 Change Password

**Endpoint:** `POST /api/auth/change-password`

**Aliases:** `PATCH /api/auth/change-password`

**Authorization:** Protected (JWT Required)

**Description:** Change user's password (requires current password).

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "currentPassword": "OldSecurePass123!@#",
  "newPassword": "NewSecurePass456!@#",
  "confirmPassword": "NewSecurePass456!@#"
}
```

**Validation Rules:**
- New password: Minimum 12 characters, must contain uppercase, lowercase, number, and special character
- New password must be different from current password
- New password cannot be in password history (last 5 passwords)
- Passwords must match

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully",
  "data": {
    "passwordChangedAt": "2025-12-11T10:00:00.000Z",
    "passwordExpiresAt": "2026-03-11T10:00:00.000Z"
  }
}
```

**Error Responses:**
```json
{
  "success": false,
  "message": "Current password is incorrect",
  "error": "INVALID_PASSWORD"
}
```

```json
{
  "success": false,
  "message": "Password was recently used. Please choose a different password.",
  "error": "PASSWORD_IN_HISTORY"
}
```

---

### 1.7 First-Time Password Change

**Endpoint:** `POST /api/auth/first-time-password-change`

**Authorization:** Protected (JWT Required)

**Description:** Change password for first-time users (no current password required).

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "newPassword": "NewSecurePass456!@#",
  "confirmPassword": "NewSecurePass456!@#"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Password set successfully",
  "data": {
    "passwordChangedAt": "2025-12-11T10:00:00.000Z",
    "passwordExpiresAt": "2026-03-11T10:00:00.000Z"
  }
}
```

---

### 1.8 Setup Password (Initial)

**Endpoint:** `POST /api/auth/setup-password`

**Authorization:** Public (Requires setup token)

**Description:** Set initial password using setup token from registration email.

**Request Body:**
```json
{
  "token": "setup-token-from-email",
  "password": "SecurePass123!@#",
  "confirmPassword": "SecurePass123!@#"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Password set successfully. You can now login.",
  "data": {
    "userId": "user-uuid",
    "email": "user@example.com"
  }
}
```

---

### 1.9 Regenerate Access Key

**Endpoint:** `POST /api/auth/regenerate-access-key`

**Authorization:** Protected (JWT Required)

**Description:** Generate a new access key for the user (invalidates old key).

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Access key regenerated successfully",
  "data": {
    "accessKey": "AK-YYYY-YYYY-YYYY-YYYY",
    "recoveryPdfUrl": "/recovery/recovery_9876543210.pdf",
    "generatedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 1.10 Upload User Logo

**Endpoint:** `POST /api/auth/me/logo`

**Authorization:** Protected (JWT Required)

**Description:** Upload or update user/organization logo.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data
```

**Request Body:**
```
FormData:
  logo: [File] (image file)
```

**File Requirements:**
- Accepted formats: JPG, JPEG, PNG, GIF
- Maximum size: 5MB
- Recommended dimensions: 200x200px to 500x500px

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Logo uploaded successfully",
  "data": {
    "logoUrl": "/uploads/logos/user-uuid.png",
    "uploadedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 1.11 Delete User Logo

**Endpoint:** `DELETE /api/auth/logo`

**Authorization:** Protected (JWT Required)

**Description:** Delete user/organization logo.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Logo deleted successfully"
}
```

---

### 1.12 Get Active Sessions

**Endpoint:** `GET /api/auth/sessions`

**Authorization:** Protected (JWT Required)

**Description:** Retrieve all active sessions for the authenticated user.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session-uuid-1",
        "device": "Chrome on Windows 10",
        "browser": "Chrome 120.0",
        "os": "Windows 10",
        "ipAddress": "192.168.1.1",
        "location": "Nairobi, Kenya",
        "lastActivity": "2025-12-11T10:00:00.000Z",
        "createdAt": "2025-12-11T09:00:00.000Z",
        "isCurrent": true
      },
      {
        "id": "session-uuid-2",
        "device": "Safari on iPhone",
        "browser": "Safari 17.0",
        "os": "iOS 17",
        "ipAddress": "192.168.1.2",
        "location": "Mombasa, Kenya",
        "lastActivity": "2025-12-10T15:30:00.000Z",
        "createdAt": "2025-12-10T14:00:00.000Z",
        "isCurrent": false
      }
    ],
    "total": 2
  }
}
```

---

### 1.13 Terminate Session

**Endpoint:** `DELETE /api/auth/sessions/:sessionId`

**Authorization:** Protected (JWT Required)

**Description:** Terminate a specific active session.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `sessionId` (string, required): The ID of the session to terminate

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Session terminated successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Session not found",
  "error": "SESSION_NOT_FOUND"
}
```

---

### 1.14 Terminate Account

**Endpoint:** `POST /api/auth/terminate`

**Authorization:** Protected (JWT Required)

**Description:** Request account termination (soft delete with grace period).

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "No longer need the service",
  "password": "CurrentPassword123!@#"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Account termination initiated. Your account will be permanently deleted in 30 days.",
  "data": {
    "terminationDate": "2026-01-10T10:00:00.000Z",
    "gracePeriodEnds": "2026-01-10T10:00:00.000Z"
  }
}
```

---

### 1.15 Abort Account Termination

**Endpoint:** `POST /api/auth/abort-termination`

**Authorization:** Protected (JWT Required)

**Description:** Cancel pending account termination request.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Account termination cancelled successfully",
  "data": {
    "accountStatus": "active",
    "terminationAbortedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 1.16 Create User (Admin Only)

**Endpoint:** `POST /api/auth/admin/create-user`

**Authorization:** Admin Only (dha_system_administrator)

**Description:** Create a new user account by administrator.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "dha_certification_officer",
  "phoneNumber": "+254712345678",
  "accountType": "individual"
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "User created successfully. Setup email sent.",
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "newuser@example.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "role": "dha_certification_officer",
      "accountStatus": "pending_setup",
      "createdAt": "2025-12-11T10:00:00.000Z"
    },
    "setupToken": "setup-token-here"
  }
}
```

---

## 2. Password Management Endpoints

### 2.1 Forgot Password

**Endpoint:** `POST /api/password/forgot-password`

**Aliases:** `POST /api/password/forgot`

**Authorization:** Public

**Rate Limit:** 5 requests per hour

**Description:** Request a password reset code via email.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset code sent to your email",
  "data": {
    "email": "user@example.com",
    "codeSentAt": "2025-12-11T10:00:00.000Z",
    "expiresIn": "15 minutes"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Too many requests. Please try again later.",
  "error": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 3600
}
```

**Notes:**
- Reset code is valid for 15 minutes
- Code is 6 digits
- Email is sent even if account doesn't exist (security best practice)
- Rate limited to prevent abuse

---

### 2.2 Verify Reset Code

**Endpoint:** `POST /api/password/verify-code`

**Authorization:** Public

**Description:** Verify the password reset code before allowing password reset.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Code verified successfully",
  "data": {
    "verified": true,
    "resetToken": "temporary-reset-token",
    "expiresAt": "2025-12-11T10:15:00.000Z"
  }
}
```

**Error Responses:**
```json
{
  "success": false,
  "message": "Invalid or expired code",
  "error": "INVALID_RESET_CODE"
}
```

```json
{
  "success": false,
  "message": "Too many verification attempts",
  "error": "TOO_MANY_ATTEMPTS"
}
```

---

### 2.3 Reset Password

**Endpoint:** `POST /api/password/reset-password`

**Aliases:** `POST /api/password/reset`

**Authorization:** Public (Requires reset token)

**Description:** Reset password using verified reset token.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "NewSecurePass123!@#",
  "confirmPassword": "NewSecurePass123!@#"
}
```

**Validation Rules:**
- New password: Minimum 12 characters, must contain uppercase, lowercase, number, and special character
- Password cannot be in password history (last 5 passwords)
- Passwords must match
- Code must be valid and not expired

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset successfully. You can now login with your new password.",
  "data": {
    "passwordResetAt": "2025-12-11T10:00:00.000Z",
    "passwordExpiresAt": "2026-03-11T10:00:00.000Z"
  }
}
```

**Error Responses:**
```json
{
  "success": false,
  "message": "Password was recently used. Please choose a different password.",
  "error": "PASSWORD_IN_HISTORY"
}
```

```json
{
  "success": false,
  "message": "Invalid or expired reset code",
  "error": "INVALID_RESET_CODE"
}
```

---

### 2.4 Recovery Login (Access Key)

**Endpoint:** `POST /api/password/recovery-login`

**Authorization:** Public

**Description:** Login using recovery access key (bypass password and 2FA).

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "accessKey": "AK-XXXX-XXXX-XXXX-XXXX"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Recovery login successful. Please change your password immediately.",
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "vendor_developer"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "requirePasswordChange": true
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Invalid access key",
  "error": "INVALID_ACCESS_KEY"
}
```

**Security Notes:**
- Access key is one-time use only
- User must change password after recovery login
- Access key is provided during registration (PDF download)
- Can be regenerated from authenticated session

---

## 3. Two-Factor Authentication Endpoints

### 3.1 Generate 2FA Secret

**Endpoint:** `POST /api/2fa/generate`

**Aliases:** `GET /api/2fa/generate`

**Authorization:** Protected (JWT Required)

**Description:** Generate 2FA secret and QR code for authenticator app setup.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "2FA secret generated successfully",
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCodeUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
    "manualEntryKey": "JBSWY3DPEHPK3PXP",
    "issuer": "Kenya DHA",
    "accountName": "user@example.com"
  }
}
```

**Usage Instructions:**
1. Scan QR code with authenticator app (Google Authenticator, Authy, etc.)
2. Or manually enter the key in your authenticator app
3. Verify the 6-digit code using the verify endpoint

**Error Response:**
```json
{
  "success": false,
  "message": "2FA is already enabled for this account",
  "error": "2FA_ENABLED"
}
```

---

### 3.2 Verify 2FA Code

**Endpoint:** `POST /api/2fa/verify`

**Authorization:** Protected (JWT Required)

**Description:** Verify 6-digit 2FA code and enable 2FA for the account.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "token": "123456"
}
```

**Validation Rules:**
- Token must be exactly 6 digits
- Token is time-based (30-second window)
- 2-window tolerance for clock skew

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Two-factor authentication enabled successfully",
  "data": {
    "twoFactorEnabled": true,
    "backupCodes": [
      "ABCD-1234-EFGH",
      "IJKL-5678-MNOP",
      "QRST-9012-UVWX"
    ],
    "enabledAt": "2025-12-11T10:00:00.000Z"
  }
}
```

**Error Responses:**
```json
{
  "success": false,
  "message": "Invalid 2FA code",
  "error": "AUTH-004"
}
```

```json
{
  "success": false,
  "message": "2FA is already enabled",
  "error": "2FA_ENABLED"
}
```

**Important Notes:**
- Save backup codes securely
- Backup codes can be used if authenticator is lost
- Each backup code is single-use only

---

### 3.3 Disable 2FA

**Endpoint:** `POST /api/2fa/disable`

**Authorization:** Protected (JWT Required)

**Description:** Disable two-factor authentication for the account.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "password": "CurrentPassword123!@#",
  "token": "123456"
}
```

**Validation Rules:**
- Password is required for security
- 2FA token or backup code required (if 2FA is enabled)

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Two-factor authentication disabled successfully",
  "data": {
    "twoFactorEnabled": false,
    "disabledAt": "2025-12-11T10:00:00.000Z"
  }
}
```

**Error Responses:**
```json
{
  "success": false,
  "message": "2FA is not enabled for this account",
  "error": "2FA_NOT_ENABLED"
}
```

```json
{
  "success": false,
  "message": "Invalid password",
  "error": "INVALID_PASSWORD"
}
```

---

## 4. Role Management Endpoints

### 4.1 Get All Roles

**Endpoint:** `GET /api/roles/`

**Authorization:** Admin Only (dha_system_administrator)

**Description:** Retrieve all available system roles with their permissions.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "roles": [
      {
        "name": "vendor_developer",
        "displayName": "Vendor/Developer",
        "description": "Software vendor or developer submitting applications for certification",
        "permissions": [
          "submit_application",
          "view_own_applications",
          "manage_team_members",
          "upload_documents"
        ],
        "portalAccess": "/vendor-portal"
      },
      {
        "name": "dha_system_administrator",
        "displayName": "DHA System Administrator",
        "description": "Full system access and control",
        "permissions": [
          "manage_users",
          "manage_roles",
          "view_audit_logs",
          "system_configuration"
        ],
        "portalAccess": "/admin-portal"
      }
    ],
    "total": 9
  }
}
```

---

### 4.2 Get Role Statistics

**Endpoint:** `GET /api/roles/statistics`

**Authorization:** Admin Only

**Description:** Get statistics about role distribution across users.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "statistics": [
      {
        "role": "vendor_developer",
        "count": 150,
        "percentage": 45.5
      },
      {
        "role": "dha_certification_officer",
        "count": 25,
        "percentage": 7.6
      }
    ],
    "totalUsers": 330
  }
}
```

---

### 4.3 Get User Role

**Endpoint:** `GET /api/roles/user/:userId`

**Authorization:** Protected

**Description:** Get specific user's role and permissions.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `userId` (string, required): User ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "role": "vendor_developer",
    "permissions": [
      "submit_application",
      "view_own_applications",
      "manage_team_members"
    ],
    "assignedAt": "2025-01-01T10:00:00.000Z",
    "assignedBy": "admin-user-uuid"
  }
}
```

---

### 4.4 Get Users by Role

**Endpoint:** `GET /api/roles/users/:role`

**Authorization:** Admin Only

**Description:** Get all users with a specific role.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `role` (string, required): Role name (e.g., "vendor_developer")

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-uuid",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "vendor_developer",
        "accountStatus": "active",
        "createdAt": "2025-01-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

---

### 4.5 Assign Role to User

**Endpoint:** `PATCH /api/roles/assign/:userId`

**Authorization:** Admin Only

**Description:** Assign or change a user's role.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**URL Parameters:**
- `userId` (string, required): User ID

**Request Body:**
```json
{
  "role": "dha_certification_officer",
  "reason": "Promoted to certification officer"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Role assigned successfully",
  "data": {
    "userId": "user-uuid",
    "previousRole": "vendor_developer",
    "newRole": "dha_certification_officer",
    "assignedAt": "2025-12-11T10:00:00.000Z",
    "assignedBy": {
      "id": "admin-uuid",
      "email": "admin@dha.go.ke"
    }
  }
}
```

---

### 4.6 Bulk Assign Roles

**Endpoint:** `POST /api/roles/bulk-assign`

**Authorization:** Admin Only

**Description:** Assign roles to multiple users at once.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "assignments": [
    {
      "userId": "user-uuid-1",
      "role": "dha_certification_officer"
    },
    {
      "userId": "user-uuid-2",
      "role": "testing_lab_staff"
    }
  ],
  "reason": "Organizational restructuring"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Bulk role assignment completed",
  "data": {
    "successful": 2,
    "failed": 0,
    "results": [
      {
        "userId": "user-uuid-1",
        "success": true,
        "newRole": "dha_certification_officer"
      },
      {
        "userId": "user-uuid-2",
        "success": true,
        "newRole": "testing_lab_staff"
      }
    ]
  }
}
```

---

## 5. Admin User Management Endpoints

### 5.1 Get All Users

**Endpoint:** `GET /api/admin/users/`

**Authorization:** Admin Only

**Description:** Retrieve all users with filtering and pagination.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 100)
- `role` (string, optional): Filter by role
- `status` (string, optional): Filter by account status
- `search` (string, optional): Search by name or email
- `sortBy` (string, optional): Sort field (default: "createdAt")
- `sortOrder` (string, optional): "asc" or "desc" (default: "desc")

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-uuid",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "vendor_developer",
        "accountStatus": "active",
        "twoFactorEnabled": true,
        "createdAt": "2025-01-01T10:00:00.000Z",
        "lastLogin": "2025-12-11T09:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 330,
      "pages": 17
    }
  }
}
```

---

### 5.2 Get User by ID

**Endpoint:** `GET /api/admin/users/:id`

**Authorization:** Admin Only

**Description:** Get detailed information about a specific user.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `id` (string, required): User ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "accountType": "individual",
      "firstName": "John",
      "lastName": "Doe",
      "phoneNumber": "+254712345678",
      "role": "vendor_developer",
      "permissions": ["submit_application", "view_own_applications"],
      "accountStatus": "active",
      "twoFactorEnabled": true,
      "county": "Nairobi",
      "createdAt": "2025-01-01T10:00:00.000Z",
      "lastLogin": "2025-12-11T09:00:00.000Z",
      "passwordChangedAt": "2025-10-01T10:00:00.000Z",
      "loginHistory": [
        {
          "timestamp": "2025-12-11T09:00:00.000Z",
          "ipAddress": "192.168.1.1",
          "success": true
        }
      ],
      "suspensions": [],
      "appeals": []
    }
  }
}
```

---

### 5.3 Create User (Admin)

**Endpoint:** `POST /api/admin/users/`

**Authorization:** Admin Only

**Description:** Create a new user account.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "phoneNumber": "+254712345678",
  "role": "dha_certification_officer",
  "accountType": "individual",
  "sendWelcomeEmail": true
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "newuser@example.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "role": "dha_certification_officer",
      "accountStatus": "pending_setup",
      "createdAt": "2025-12-11T10:00:00.000Z"
    }
  }
}
```

---

### 5.4 Update User Status

**Endpoint:** `PATCH /api/admin/users/:id/status`

**Authorization:** Admin Only

**Description:** Update user account status (activate, suspend, deactivate).

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**URL Parameters:**
- `id` (string, required): User ID

**Request Body:**
```json
{
  "status": "suspended",
  "reason": "Violation of terms of service",
  "suspensionDuration": 30
}
```

**Valid Status Values:**
- `active`: Active account
- `suspended`: Temporarily suspended
- `deactivated`: Permanently deactivated
- `pending_verification`: Awaiting email verification
- `pending_setup`: Awaiting initial setup

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "User status updated successfully",
  "data": {
    "userId": "user-uuid",
    "previousStatus": "active",
    "newStatus": "suspended",
    "reason": "Violation of terms of service",
    "updatedAt": "2025-12-11T10:00:00.000Z",
    "suspensionEndsAt": "2026-01-10T10:00:00.000Z"
  }
}
```

---

### 5.5 Update User Role

**Endpoint:** `PATCH /api/admin/users/:id/role`

**Authorization:** Admin Only

**Description:** Update user's role.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**URL Parameters:**
- `id` (string, required): User ID

**Request Body:**
```json
{
  "role": "dha_certification_officer",
  "reason": "Promoted to certification officer"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "User role updated successfully",
  "data": {
    "userId": "user-uuid",
    "previousRole": "vendor_developer",
    "newRole": "dha_certification_officer",
    "updatedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 5.6 Delete User

**Endpoint:** `DELETE /api/admin/users/:id`

**Authorization:** Admin Only

**Description:** Soft delete a user account.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `id` (string, required): User ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "User deleted successfully",
  "data": {
    "userId": "user-uuid",
    "deletedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 5.7 Export Users

**Endpoint:** `GET /api/admin/users/export`

**Authorization:** Admin Only

**Description:** Export users to CSV or Excel format.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `format` (string, optional): "csv" or "xlsx" (default: "csv")
- `role` (string, optional): Filter by role
- `status` (string, optional): Filter by status

**Success Response (200 OK):**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="users_export_2025-12-11.csv"

<CSV content>
```

---

## 6. Security Admin Endpoints

### 6.1 Get Security Statistics

**Endpoint:** `GET /api/admin/security/stats`

**Authorization:** Admin Only

**Description:** Get comprehensive security statistics and metrics.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "failedLogins": {
      "last24Hours": 45,
      "last7Days": 320,
      "last30Days": 1250
    },
    "activeSessions": 234,
    "blockedIPs": 12,
    "lockedAccounts": 5,
    "twoFactorCompliance": {
      "enabled": 180,
      "disabled": 150,
      "percentage": 54.5
    },
    "suspiciousActivities": {
      "last24Hours": 8,
      "last7Days": 56
    }
  }
}
```

---

### 6.2 Get Failed Login Attempts

**Endpoint:** `GET /api/admin/security/failed-logins`

**Authorization:** Admin Only

**Description:** Get list of failed login attempts with details.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page
- `search` (string, optional): Search by email or IP
- `startDate` (string, optional): Filter from date (ISO 8601)
- `endDate` (string, optional): Filter to date (ISO 8601)

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "attempts": [
      {
        "id": "attempt-uuid",
        "email": "user@example.com",
        "ipAddress": "192.168.1.100",
        "attemptTime": "2025-12-11T10:00:00.000Z",
        "reason": "Invalid password",
        "userAgent": "Mozilla/5.0...",
        "location": "Nairobi, Kenya"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 320,
      "pages": 16
    }
  }
}
```

---

### 6.3 Get All Active Sessions

**Endpoint:** `GET /api/admin/security/sessions`

**Authorization:** Admin Only

**Description:** Get all active user sessions across the system.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page
- `userId` (string, optional): Filter by user ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session-uuid",
        "userId": "user-uuid",
        "userEmail": "user@example.com",
        "device": "Chrome on Windows 10",
        "ipAddress": "192.168.1.1",
        "lastActivity": "2025-12-11T10:00:00.000Z",
        "createdAt": "2025-12-11T09:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 234,
      "pages": 5
    }
  }
}
```

---

### 6.4 Terminate Session (Admin)

**Endpoint:** `DELETE /api/admin/security/sessions/:sessionId`

**Authorization:** Admin Only

**Description:** Terminate any user's session.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `sessionId` (string, required): Session ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Session terminated successfully",
  "data": {
    "sessionId": "session-uuid",
    "userId": "user-uuid",
    "terminatedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 6.5 Get Blocked IPs

**Endpoint:** `GET /api/admin/security/blocked-ips`

**Authorization:** Admin Only

**Description:** Get list of blocked IP addresses.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "blockedIPs": [
      {
        "id": "block-uuid",
        "ipAddress": "192.168.1.200",
        "reason": "Multiple failed login attempts",
        "blockedAt": "2025-12-11T08:00:00.000Z",
        "expiresAt": "2025-12-11T14:00:00.000Z",
        "permanent": false,
        "attemptCount": 15
      }
    ],
    "total": 12
  }
}
```

---

### 6.6 Unblock IP Address

**Endpoint:** `DELETE /api/admin/security/blocked-ips/:ipAddress`

**Authorization:** Admin Only

**Description:** Remove IP address from blocklist.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `ipAddress` (string, required): IP address to unblock

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "IP address unblocked successfully",
  "data": {
    "ipAddress": "192.168.1.200",
    "unblockedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 6.7 Get Whitelisted IPs

**Endpoint:** `GET /api/admin/security/whitelisted-ips`

**Authorization:** Admin Only

**Description:** Get list of whitelisted IP addresses.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "whitelistedIPs": [
      {
        "id": "whitelist-uuid",
        "ipAddress": "10.0.0.1",
        "description": "Office network",
        "addedBy": "admin-uuid",
        "addedAt": "2025-01-01T10:00:00.000Z"
      }
    ],
    "total": 5
  }
}
```

---

### 6.8 Add Whitelisted IP

**Endpoint:** `POST /api/admin/security/whitelisted-ips`

**Authorization:** Admin Only

**Description:** Add IP address to whitelist.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "ipAddress": "10.0.0.5",
  "description": "VPN server"
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "IP address whitelisted successfully",
  "data": {
    "id": "whitelist-uuid",
    "ipAddress": "10.0.0.5",
    "description": "VPN server",
    "addedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 6.9 Remove Whitelisted IP

**Endpoint:** `DELETE /api/admin/security/whitelisted-ips/:id`

**Authorization:** Admin Only

**Description:** Remove IP address from whitelist.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `id` (string, required): Whitelist entry ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "IP address removed from whitelist",
  "data": {
    "id": "whitelist-uuid",
    "removedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 6.10 Get Audit Logs

**Endpoint:** `GET /api/admin/security/audit-logs`

**Authorization:** Admin Only

**Description:** Get system audit logs.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page
- `action` (string, optional): Filter by action type
- `userId` (string, optional): Filter by user
- `startDate` (string, optional): Filter from date
- `endDate` (string, optional): Filter to date

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log-uuid",
        "action": "USER_LOGIN",
        "userId": "user-uuid",
        "userEmail": "user@example.com",
        "ipAddress": "192.168.1.1",
        "details": {
          "success": true,
          "twoFactorUsed": true
        },
        "timestamp": "2025-12-11T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 5000,
      "pages": 100
    }
  }
}
```

---

### 6.11 Export Security Logs

**Endpoint:** `GET /api/admin/security/export`

**Authorization:** Admin Only

**Description:** Export security logs to CSV.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `type` (string, required): "failed-logins", "audit-logs", or "blocked-ips"
- `startDate` (string, optional): Export from date
- `endDate` (string, optional): Export to date

**Success Response (200 OK):**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="security_logs_2025-12-11.csv"

<CSV content>
```

---

### 6.12 Get Suspicious Activities

**Endpoint:** `GET /api/admin/security/suspicious-activities`

**Authorization:** Admin Only

**Description:** Get list of suspicious activities detected by the system.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page
- `severity` (string, optional): "low", "medium", "high", "critical"

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "activity-uuid",
        "type": "VPN_DETECTED",
        "severity": "medium",
        "ipAddress": "192.168.1.250",
        "userId": "user-uuid",
        "details": {
          "vpnProvider": "NordVPN",
          "action": "blocked"
        },
        "detectedAt": "2025-12-11T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 56,
      "pages": 3
    }
  }
}
```

---

## 7. Admin Dashboard Endpoints

### 7.1 Get Dashboard Metrics

**Endpoint:** `GET /api/admin/dashboard/metrics`

**Authorization:** Admin Only

**Description:** Get comprehensive dashboard metrics and statistics.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 330,
      "active": 285,
      "suspended": 10,
      "pending": 35
    },
    "security": {
      "failedLogins24h": 45,
      "activeSessions": 234,
      "blockedIPs": 12,
      "lockedAccounts": 5
    },
    "roles": {
      "vendor_developer": 150,
      "dha_certification_officer": 25,
      "testing_lab_staff": 30
    },
    "twoFactor": {
      "enabled": 180,
      "disabled": 150,
      "percentage": 54.5
    }
  }
}
```

---

### 7.2 Get Permission Matrix

**Endpoint:** `GET /api/admin/dashboard/permissions/matrix`

**Authorization:** Admin Only

**Description:** Get complete permission matrix showing all roles and their permissions.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "matrix": [
      {
        "role": "vendor_developer",
        "permissions": [
          {
            "name": "submit_application",
            "category": "applications",
            "granted": true
          },
          {
            "name": "approve_application",
            "category": "applications",
            "granted": false
          }
        ]
      }
    ]
  }
}
```

---

### 7.3 Get Role Details

**Endpoint:** `GET /api/admin/dashboard/permissions/roles/:role`

**Authorization:** Admin Only

**Description:** Get detailed information about a specific role.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `role` (string, required): Role name

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "role": {
      "name": "vendor_developer",
      "displayName": "Vendor/Developer",
      "description": "Software vendor or developer submitting applications",
      "permissions": [
        {
          "name": "submit_application",
          "description": "Submit new applications"
        }
      ],
      "userCount": 150,
      "portalAccess": "/vendor-portal"
    }
  }
}
```

---

### 7.4 Get User Activity

**Endpoint:** `GET /api/admin/dashboard/users/:userId/activity`

**Authorization:** Admin Only

**Description:** Get activity history for a specific user.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `userId` (string, required): User ID

**Query Parameters:**
- `startDate` (string, optional): Filter from date
- `endDate` (string, optional): Filter to date
- `limit` (number, optional): Number of activities to return

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "activities": [
      {
        "id": "activity-uuid",
        "action": "LOGIN",
        "timestamp": "2025-12-11T10:00:00.000Z",
        "ipAddress": "192.168.1.1",
        "details": {
          "success": true,
          "twoFactorUsed": true
        }
      }
    ],
    "total": 150
  }
}
```

---

## 8. Team Management Endpoints

### 8.1 Invite Team Member

**Endpoint:** `POST /api/team/invite`

**Authorization:** Protected (Requires `MANAGE_TEAM_MEMBERS` permission)

**Description:** Invite a new member to join the organization's team.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "newmember@example.com",
  "role": "developer",
  "permissions": ["view_applications", "upload_documents"],
  "message": "Welcome to our team!"
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Team member invited successfully",
  "data": {
    "invitationId": "invitation-uuid",
    "email": "newmember@example.com",
    "role": "developer",
    "invitedBy": "user-uuid",
    "invitedAt": "2025-12-11T10:00:00.000Z",
    "expiresAt": "2025-12-18T10:00:00.000Z",
    "invitationToken": "invitation-token"
  }
}
```

---

### 8.2 Accept Team Invitation

**Endpoint:** `POST /api/team/accept/:token`

**Authorization:** Public

**Description:** Accept a team invitation using the invitation token.

**URL Parameters:**
- `token` (string, required): Invitation token from email

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Team invitation accepted successfully",
  "data": {
    "teamMemberId": "member-uuid",
    "organizationId": "org-uuid",
    "organizationName": "Health Corp Ltd",
    "role": "developer",
    "acceptedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 8.3 Get Pending Invitations

**Endpoint:** `GET /api/team/invitations/pending`

**Authorization:** Protected (Requires `MANAGE_TEAM_MEMBERS` permission)

**Description:** Get list of pending team invitations.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "invitations": [
      {
        "id": "invitation-uuid",
        "email": "newmember@example.com",
        "role": "developer",
        "status": "pending",
        "invitedBy": "user-uuid",
        "invitedAt": "2025-12-11T10:00:00.000Z",
        "expiresAt": "2025-12-18T10:00:00.000Z"
      }
    ],
    "total": 3
  }
}
```

---

### 8.4 Get Team Members

**Endpoint:** `GET /api/team/members`

**Authorization:** Protected

**Description:** Get list of all team members in the organization.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "id": "member-uuid",
        "userId": "user-uuid",
        "email": "member@example.com",
        "firstName": "Jane",
        "lastName": "Doe",
        "role": "developer",
        "permissions": ["view_applications", "upload_documents"],
        "status": "active",
        "joinedAt": "2025-01-15T10:00:00.000Z",
        "lastActivity": "2025-12-11T09:00:00.000Z"
      }
    ],
    "total": 8
  }
}
```

---

### 8.5 Get Member Details

**Endpoint:** `GET /api/team/members/:memberId`

**Authorization:** Protected

**Description:** Get detailed information about a specific team member.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `memberId` (string, required): Team member ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "member": {
      "id": "member-uuid",
      "userId": "user-uuid",
      "email": "member@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "role": "developer",
      "permissions": ["view_applications", "upload_documents"],
      "status": "active",
      "joinedAt": "2025-01-15T10:00:00.000Z",
      "activityHistory": [
        {
          "action": "uploaded_document",
          "timestamp": "2025-12-11T09:00:00.000Z"
        }
      ]
    }
  }
}
```

---

### 8.6 Update Member Role

**Endpoint:** `PATCH /api/team/members/:memberId/role`

**Authorization:** Protected (Requires `MANAGE_TEAM_MEMBERS` permission)

**Description:** Update a team member's role.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**URL Parameters:**
- `memberId` (string, required): Team member ID

**Request Body:**
```json
{
  "role": "lead_developer",
  "reason": "Promoted to lead position"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Member role updated successfully",
  "data": {
    "memberId": "member-uuid",
    "previousRole": "developer",
    "newRole": "lead_developer",
    "updatedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 8.7 Update Member Permissions

**Endpoint:** `PATCH /api/team/members/:memberId/permissions`

**Authorization:** Protected (Requires `MANAGE_TEAM_MEMBERS` permission)

**Description:** Update a team member's permissions.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**URL Parameters:**
- `memberId` (string, required): Team member ID

**Request Body:**
```json
{
  "permissions": [
    "view_applications",
    "upload_documents",
    "manage_documents"
  ]
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Member permissions updated successfully",
  "data": {
    "memberId": "member-uuid",
    "permissions": [
      "view_applications",
      "upload_documents",
      "manage_documents"
    ],
    "updatedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 8.8 Revoke Member Access

**Endpoint:** `POST /api/team/members/:memberId/revoke`

**Authorization:** Protected (Requires `MANAGE_TEAM_MEMBERS` permission)

**Description:** Revoke a team member's access (soft deactivation).

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**URL Parameters:**
- `memberId` (string, required): Team member ID

**Request Body:**
```json
{
  "reason": "End of contract"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Member access revoked successfully",
  "data": {
    "memberId": "member-uuid",
    "status": "revoked",
    "revokedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 8.9 Remove Team Member

**Endpoint:** `DELETE /api/team/members/:memberId`

**Authorization:** Protected (Requires `MANAGE_TEAM_MEMBERS` permission)

**Description:** Permanently remove a team member from the organization.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `memberId` (string, required): Team member ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Team member removed successfully",
  "data": {
    "memberId": "member-uuid",
    "removedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 8.10 Get Team Hierarchy

**Endpoint:** `GET /api/team/hierarchy`

**Authorization:** Protected

**Description:** Get organizational hierarchy of team members.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "hierarchy": {
      "owner": {
        "userId": "user-uuid",
        "email": "owner@example.com",
        "role": "organization_owner"
      },
      "members": [
        {
          "userId": "member-uuid-1",
          "email": "lead@example.com",
          "role": "lead_developer",
          "reports": [
            {
              "userId": "member-uuid-2",
              "email": "dev@example.com",
              "role": "developer"
            }
          ]
        }
      ]
    }
  }
}
```

---

## 9. Suspension Appeal Endpoints

### 9.1 Submit Appeal

**Endpoint:** `POST /api/appeals/submit`

**Authorization:** Protected

**Description:** Submit an appeal against account suspension.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "I believe my account was suspended in error. I have not violated any terms of service.",
  "evidence": [
    "https://storage.example.com/evidence1.pdf",
    "https://storage.example.com/evidence2.pdf"
  ]
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Appeal submitted successfully",
  "data": {
    "appealId": "appeal-uuid",
    "status": "pending",
    "submittedAt": "2025-12-11T10:00:00.000Z",
    "estimatedReviewTime": "5-7 business days"
  }
}
```

---

### 9.2 Get My Appeals

**Endpoint:** `GET /api/appeals/my-appeals`

**Authorization:** Protected

**Description:** Get list of user's submitted appeals.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "appeals": [
      {
        "id": "appeal-uuid",
        "status": "under_review",
        "reason": "I believe my account was suspended in error.",
        "submittedAt": "2025-12-11T10:00:00.000Z",
        "reviewStartedAt": "2025-12-12T09:00:00.000Z",
        "reviewer": {
          "id": "admin-uuid",
          "email": "admin@dha.go.ke"
        }
      }
    ],
    "total": 1
  }
}
```

---

### 9.3 Get Appeal Details

**Endpoint:** `GET /api/appeals/:appealId`

**Authorization:** Protected

**Description:** Get detailed information about a specific appeal.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `appealId` (string, required): Appeal ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "appeal": {
      "id": "appeal-uuid",
      "userId": "user-uuid",
      "status": "under_review",
      "reason": "I believe my account was suspended in error.",
      "evidence": [
        "https://storage.example.com/evidence1.pdf"
      ],
      "submittedAt": "2025-12-11T10:00:00.000Z",
      "reviewStartedAt": "2025-12-12T09:00:00.000Z",
      "reviewer": {
        "id": "admin-uuid",
        "email": "admin@dha.go.ke"
      },
      "communications": [
        {
          "id": "comm-uuid",
          "from": "admin",
          "message": "We are reviewing your case",
          "timestamp": "2025-12-12T10:00:00.000Z"
        }
      ]
    }
  }
}
```

---

### 9.4 Add Communication to Appeal

**Endpoint:** `POST /api/appeals/:appealId/communicate`

**Authorization:** Protected

**Description:** Add a message/communication to an existing appeal.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**URL Parameters:**
- `appealId` (string, required): Appeal ID

**Request Body:**
```json
{
  "message": "I have additional evidence to support my case.",
  "attachments": [
    "https://storage.example.com/evidence3.pdf"
  ]
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Communication added successfully",
  "data": {
    "communicationId": "comm-uuid",
    "appealId": "appeal-uuid",
    "timestamp": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 9.5 Withdraw Appeal

**Endpoint:** `POST /api/appeals/:appealId/withdraw`

**Authorization:** Protected

**Description:** Withdraw a submitted appeal.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `appealId` (string, required): Appeal ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Appeal withdrawn successfully",
  "data": {
    "appealId": "appeal-uuid",
    "status": "withdrawn",
    "withdrawnAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 9.6 Get Pending Appeals (Admin)

**Endpoint:** `GET /api/appeals/pending`

**Authorization:** Admin Only (dha_system_administrator)

**Description:** Get list of all pending appeals for review.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page
- `status` (string, optional): Filter by status

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "appeals": [
      {
        "id": "appeal-uuid",
        "userId": "user-uuid",
        "userEmail": "user@example.com",
        "status": "pending",
        "submittedAt": "2025-12-11T10:00:00.000Z",
        "waitingDays": 2
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "pages": 1
    }
  }
}
```

---

### 9.7 Get Appeal Statistics (Admin)

**Endpoint:** `GET /api/appeals/statistics`

**Authorization:** Admin Only

**Description:** Get statistics about appeals.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "total": 100,
    "pending": 15,
    "under_review": 10,
    "approved": 60,
    "rejected": 15,
    "averageReviewTime": "4.5 days",
    "approvalRate": 60
  }
}
```

---

### 9.8 Start Appeal Review (Admin)

**Endpoint:** `POST /api/appeals/:appealId/review/start`

**Authorization:** Admin Only

**Description:** Start reviewing an appeal (assigns to admin).

**Request Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL Parameters:**
- `appealId` (string, required): Appeal ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Appeal review started",
  "data": {
    "appealId": "appeal-uuid",
    "status": "under_review",
    "reviewer": "admin-uuid",
    "reviewStartedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 9.9 Approve Appeal (Admin)

**Endpoint:** `POST /api/appeals/:appealId/approve`

**Authorization:** Admin Only

**Description:** Approve an appeal and reactivate the user's account.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**URL Parameters:**
- `appealId` (string, required): Appeal ID

**Request Body:**
```json
{
  "decision": "Appeal approved. Account suspension lifted.",
  "notes": "User provided sufficient evidence."
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Appeal approved successfully",
  "data": {
    "appealId": "appeal-uuid",
    "status": "approved",
    "userId": "user-uuid",
    "accountStatus": "active",
    "approvedAt": "2025-12-11T10:00:00.000Z",
    "approvedBy": "admin-uuid"
  }
}
```

---

### 9.10 Reject Appeal (Admin)

**Endpoint:** `POST /api/appeals/:appealId/reject`

**Authorization:** Admin Only

**Description:** Reject an appeal and maintain account suspension.

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**URL Parameters:**
- `appealId` (string, required): Appeal ID

**Request Body:**
```json
{
  "decision": "Appeal rejected. Suspension upheld.",
  "reason": "Insufficient evidence provided. Terms of service violation confirmed."
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Appeal rejected",
  "data": {
    "appealId": "appeal-uuid",
    "status": "rejected",
    "rejectedAt": "2025-12-11T10:00:00.000Z",
    "rejectedBy": "admin-uuid"
  }
}
```

---

### 9.11 Add Internal Note to Appeal (Admin)

**Endpoint:** `POST /api/appeals/:appealId/notes`

**Authorization:** Admin Only

**Description:** Add internal note to appeal (not visible to user).

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**URL Parameters:**
- `appealId` (string, required): Appeal ID

**Request Body:**
```json
{
  "note": "User has clean record. Consider approval."
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Internal note added",
  "data": {
    "noteId": "note-uuid",
    "appealId": "appeal-uuid",
    "addedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

## 10. Internal Service Endpoints

**Important:** These endpoints are for service-to-service communication only. They require the `x-service-request: true` header and are not accessible via regular user authentication.

### 10.1 Create Board Member User

**Endpoint:** `POST /api/auth/internal/board-member-user`

**Authorization:** Internal Service Only

**Description:** Create a user account for a board member (called by Governance Service).

**Request Headers:**
```
x-service-request: true
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "boardmember@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+254712345678",
  "boardRole": "member",
  "organizationId": "org-uuid"
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Board member user created successfully",
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "boardmember@example.com",
      "role": "certification_committee_member",
      "accountStatus": "pending_setup"
    },
    "setupToken": "setup-token"
  }
}
```

---

### 10.2 Get Organization Members

**Endpoint:** `GET /api/auth/internal/organization/:registrationNumber/members`

**Authorization:** Internal Service Only

**Description:** Get all team members of an organization.

**Request Headers:**
```
x-service-request: true
```

**URL Parameters:**
- `registrationNumber` (string, required): Organization registration number

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "organizationId": "org-uuid",
    "registrationNumber": "REG123456",
    "members": [
      {
        "userId": "user-uuid",
        "email": "member@example.com",
        "firstName": "Jane",
        "lastName": "Doe",
        "role": "developer",
        "status": "active"
      }
    ],
    "total": 5
  }
}
```

---

### 10.3 Find User by Email

**Endpoint:** `GET /api/auth/internal/user/by-email/:email`

**Authorization:** Internal Service Only

**Description:** Find user by email address.

**Request Headers:**
```
x-service-request: true
```

**URL Parameters:**
- `email` (string, required): User email address

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "vendor_developer",
      "accountStatus": "active",
      "organizationId": "org-uuid"
    }
  }
}
```

---

### 10.4 Check User Password Exists

**Endpoint:** `GET /api/auth/internal/user/:userId/password-exists`

**Authorization:** Internal Service Only

**Description:** Check if user has set a password.

**Request Headers:**
```
x-service-request: true
```

**URL Parameters:**
- `userId` (string, required): User ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "passwordExists": true
  }
}
```

---

### 10.5 Update User Board Role

**Endpoint:** `PATCH /api/auth/internal/user/:userId/board-role`

**Authorization:** Internal Service Only

**Description:** Update user's board role.

**Request Headers:**
```
x-service-request: true
Content-Type: application/json
```

**URL Parameters:**
- `userId` (string, required): User ID

**Request Body:**
```json
{
  "boardRole": "chairperson"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Board role updated successfully",
  "data": {
    "userId": "user-uuid",
    "boardRole": "chairperson",
    "updatedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 10.6 Update User Profile (Internal)

**Endpoint:** `PATCH /api/auth/internal/user/:userId/profile`

**Authorization:** Internal Service Only

**Description:** Update user profile from another service.

**Request Headers:**
```
x-service-request: true
Content-Type: application/json
```

**URL Parameters:**
- `userId` (string, required): User ID

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+254712345678"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "User profile updated successfully",
  "data": {
    "userId": "user-uuid",
    "updatedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 10.7 Update User Status (Internal)

**Endpoint:** `PATCH /api/auth/internal/user/:userId/status`

**Authorization:** Internal Service Only

**Description:** Update user account status from another service.

**Request Headers:**
```
x-service-request: true
Content-Type: application/json
```

**URL Parameters:**
- `userId` (string, required): User ID

**Request Body:**
```json
{
  "status": "suspended",
  "reason": "Payment overdue"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "User status updated successfully",
  "data": {
    "userId": "user-uuid",
    "previousStatus": "active",
    "newStatus": "suspended",
    "updatedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 10.8 Deactivate User (Internal)

**Endpoint:** `PATCH /api/auth/internal/user/:userId/deactivate`

**Authorization:** Internal Service Only

**Description:** Deactivate a user account.

**Request Headers:**
```
x-service-request: true
Content-Type: application/json
```

**URL Parameters:**
- `userId` (string, required): User ID

**Request Body:**
```json
{
  "reason": "Account closure requested"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "User deactivated successfully",
  "data": {
    "userId": "user-uuid",
    "status": "deactivated",
    "deactivatedAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 10.9 Send Internal Email

**Endpoint:** `POST /api/auth/internal/send-email`

**Authorization:** Internal Service Only

**Description:** Send email via the authentication service's email system.

**Request Headers:**
```
x-service-request: true
Content-Type: application/json
```

**Request Body:**
```json
{
  "to": "user@example.com",
  "subject": "Application Status Update",
  "template": "application_status",
  "data": {
    "applicationId": "app-uuid",
    "status": "approved"
  }
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "data": {
    "messageId": "msg-uuid",
    "sentAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### 10.10 Get User by ID (Internal)

**Endpoint:** `GET /api/auth/internal/user/:userId`

**Authorization:** Internal Service Only

**Description:** Get user details by ID.

**Request Headers:**
```
x-service-request: true
```

**URL Parameters:**
- `userId` (string, required): User ID

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "vendor_developer",
      "accountStatus": "active",
      "organizationId": "org-uuid",
      "phoneNumber": "+254712345678"
    }
  }
}
```

---

### 10.11 Get Users by IDs (Batch)

**Endpoint:** `POST /api/auth/internal/users/batch`

**Authorization:** Internal Service Only

**Description:** Get multiple users by their IDs in one request.

**Request Headers:**
```
x-service-request: true
Content-Type: application/json
```

**Request Body:**
```json
{
  "userIds": [
    "user-uuid-1",
    "user-uuid-2",
    "user-uuid-3"
  ]
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-uuid-1",
        "email": "user1@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "vendor_developer"
      },
      {
        "id": "user-uuid-2",
        "email": "user2@example.com",
        "firstName": "Jane",
        "lastName": "Smith",
        "role": "dha_certification_officer"
      }
    ],
    "found": 2,
    "notFound": ["user-uuid-3"]
  }
}
```

---

## Security Features

### Password Security

#### Password Requirements
- **Minimum Length:** 12 characters
- **Complexity Requirements:**
  - At least one uppercase letter (A-Z)
  - At least one lowercase letter (a-z)
  - At least one number (0-9)
  - At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
- **Password History:** Cannot reuse last 5 passwords
- **Expiry Policy:** Passwords expire after 90 days
- **Expiry Warnings:** Users receive warnings at 30, 14, 7, and 1 days before expiry

#### Password Hashing
- **Algorithm:** bcrypt
- **Salt Rounds:** 12
- **Storage:** Only hashed passwords stored, never plaintext

---

### Account Lockout

#### Lockout Policy
- **Failed Attempts Threshold:** 5 consecutive failed login attempts
- **Lockout Duration:** 30 minutes
- **Auto-Unlock:** Accounts automatically unlock after 30 minutes
- **Manual Unlock:** Admins can manually unlock accounts

#### Progressive Delays
Failed login attempts trigger progressive delays:
- 1st attempt: No delay
- 2nd attempt: 1 second delay
- 3rd attempt: 2 seconds delay
- 4th attempt: 4 seconds delay
- 5th attempt: 8 seconds delay
- 6th+ attempt: Account locked

#### Notifications
- Email notification sent when account is locked
- Email notification sent when account is auto-unlocked
- Security event logged for audit

---

### IP Security

#### VPN/Proxy Detection
The system detects and blocks common VPN providers:
- NordVPN, ExpressVPN, CyberGhost
- TunnelBear, Private Internet Access
- Surfshark, IPVanish
- And more...

#### IP Blocking
- **Temporary Blocks:** 6-hour block after 10 failed attempts from single IP
- **Global Blocks:** Permanent block after 25 failed attempts across all accounts
- **Whitelist:** Admins can whitelist trusted IP ranges
- **Automatic Cleanup:** Temporary blocks expire automatically

#### Suspicious Activity Detection
System monitors for:
- Multiple failed login attempts
- Login from unusual locations
- Rapid requests (potential bot activity)
- Known attack patterns
- SQL injection attempts
- XSS attempts
- Command injection attempts

---

### Two-Factor Authentication (2FA)

#### Implementation
- **Algorithm:** TOTP (Time-based One-Time Password)
- **Standard:** RFC 6238
- **Code Length:** 6 digits
- **Time Window:** 30 seconds
- **Tolerance:** 2-window tolerance for clock skew

#### Setup Process
1. User generates 2FA secret
2. System provides QR code and manual entry key
3. User scans QR code with authenticator app
4. User verifies with first 6-digit code
5. System provides backup codes

#### Backup Codes
- Generated during 2FA setup
- Single-use only
- Can be used if authenticator is lost
- 8 codes provided initially

#### Supported Authenticator Apps
- Google Authenticator
- Microsoft Authenticator
- Authy
- Any TOTP-compatible app

---

### Session Management

#### JWT Tokens
- **Algorithm:** HS256
- **Expiration:** 24 hours (configurable)
- **Storage:** HttpOnly, Secure cookies
- **Versioning:** Token version field for invalidation

#### Session Features
- **Multi-Device Support:** Users can have multiple active sessions
- **Session Tracking:** Device, browser, OS, IP, location
- **Remote Termination:** Users can terminate sessions from other devices
- **Admin Termination:** Admins can terminate any user's session

#### Token Invalidation
- Logout invalidates current token
- Token version increment invalidates all tokens
- Password change increments token version
- Role change increments token version

---

### Rate Limiting

#### Endpoint-Specific Limits
| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Password Reset | 5 requests | 1 hour |
| CAPTCHA Generation | 20 requests | 15 minutes |
| Sensitive Operations | 50 requests | 1 hour |
| General API | 1000 requests | 15 minutes |

#### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
Retry-After: 900
```

---

### CAPTCHA Protection

#### Implementation
- **Type:** Text-based CAPTCHA
- **Generation:** Server-side
- **Validation:** One-time use
- **Expiry:** 15 minutes
- **Required For:** User registration

---

### Audit Logging

#### Logged Events
All significant security events are logged:
- User login/logout
- Failed login attempts
- Password changes
- Role assignments
- Account status changes
- 2FA enable/disable
- Session terminations
- Profile updates
- Admin actions

#### Log Details
Each log entry includes:
- Timestamp (ISO 8601)
- User ID and email
- Action performed
- IP address
- User agent
- Location (if available)
- Success/failure status
- Additional metadata

#### Log Retention
- Audit logs retained for 2 years
- Failed login attempts retained for 90 days
- Session history retained for 30 days

---

### Separation of Duties (SOD)

#### Enforcement Rules
- Users cannot approve their own applications
- Organization members cannot approve organization's applications
- Contributors cannot approve their own submissions
- Admins cannot modify their own roles

#### SOD Violation Codes
- `SOD_SELF_APPROVAL`: User attempting to approve own work
- `SOD_ORG_APPROVAL`: Organization member approving org work
- `SOD_CONTRIBUTOR`: Contributor approving own contribution

---

### Data Protection

#### Encryption
- **In Transit:** TLS 1.2+ for all communications
- **At Rest:** Database encryption for sensitive fields
- **Passwords:** bcrypt hashing (12 rounds)
- **Tokens:** Cryptographically signed JWTs

#### Data Sanitization
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- NoSQL injection prevention
- XSS prevention (output encoding)
- CSRF protection

#### PII Protection
- Email addresses stored encrypted
- Phone numbers stored encrypted
- ID numbers stored encrypted
- Minimal data exposure in API responses

---

## Roles & Permissions

### Available Roles

#### 1. Vendor/Developer (`vendor_developer`)
**Portal Access:** `/vendor-portal`

**Permissions:**
- `submit_application` - Submit new applications for certification
- `view_own_applications` - View own submitted applications
- `update_own_applications` - Update/modify own applications
- `manage_team_members` - Invite and manage organization team members
- `upload_documents` - Upload required documents and files
- `view_test_results` - View testing results for applications
- `pay_fees` - Submit payment for application fees

**Description:** Software vendor or developer submitting applications for digital health product certification.

---

#### 2. Vendor Technical Lead (`vendor_technical_lead`)
**Portal Access:** `/vendor-portal`

**Permissions:**
- All `vendor_developer` permissions
- `approve_submissions` - Approve submissions before final submission
- `manage_technical_docs` - Manage technical documentation
- `coordinate_testing` - Coordinate with testing lab

**Description:** Senior technical lead responsible for overseeing vendor submissions and technical compliance.

---

#### 3. Vendor Compliance Officer (`vendor_compliance_officer`)
**Portal Access:** `/vendor-portal`

**Permissions:**
- All `vendor_developer` permissions
- `manage_compliance_docs` - Manage compliance documentation
- `view_audit_reports` - View compliance audit reports
- `submit_compliance_reports` - Submit periodic compliance reports

**Description:** Compliance officer ensuring regulatory compliance for vendor organizations.

---

#### 4. DHA System Administrator (`dha_system_administrator`)
**Portal Access:** `/admin-portal`

**Permissions:**
- `manage_users` - Full user management (create, update, delete)
- `manage_roles` - Assign and modify user roles
- `manage_permissions` - Modify role permissions
- `view_audit_logs` - View complete audit logs
- `manage_security_settings` - Configure security settings
- `system_configuration` - Configure system-wide settings
- `manage_ip_blocks` - Manage IP blocklist and whitelist
- `terminate_sessions` - Terminate any user session
- `export_data` - Export system data
- `manage_appeals` - Review and decide suspension appeals
- `view_all_applications` - View all applications in system
- `override_decisions` - Override system decisions

**Description:** Full system administrator with complete access to all system functions and data.

---

#### 5. DHA Certification Officer (`dha_certification_officer`)
**Portal Access:** `/certification-portal`

**Permissions:**
- `view_applications` - View submitted applications
- `review_applications` - Review and assess applications
- `approve_applications` - Approve applications for certification
- `reject_applications` - Reject applications
- `request_modifications` - Request modifications to applications
- `issue_certificates` - Issue digital health certificates
- `manage_certifications` - Manage active certifications
- `view_test_reports` - View testing lab reports

**Description:** DHA officer responsible for reviewing and approving certification applications.

---

#### 6. Testing Lab Staff (`testing_lab_staff`)
**Portal Access:** `/lab-portal`

**Permissions:**
- `view_assigned_tests` - View applications assigned for testing
- `upload_test_results` - Upload test results and reports
- `update_test_status` - Update testing status
- `generate_test_reports` - Generate standardized test reports
- `flag_issues` - Flag technical issues found during testing

**Description:** Testing laboratory staff conducting technical testing and validation.

---

#### 7. Certification Committee Member (`certification_committee_member`)
**Portal Access:** `/committee-portal`

**Permissions:**
- `view_applications` - View applications under committee review
- `vote_on_applications` - Cast votes on application approvals
- `add_comments` - Add comments and feedback
- `view_committee_reports` - View committee reports
- `participate_in_meetings` - Access to meeting materials

**Description:** Member of the certification committee involved in decision-making for complex applications.

---

#### 8. County Health Officer (`county_health_officer`)
**Portal Access:** `/county-portal`

**Permissions:**
- `view_county_data` - View health data for assigned county
- `view_certified_products` - View certified products
- `submit_feedback` - Submit feedback on deployed products
- `view_county_reports` - View county-specific reports

**Description:** County-level health officer monitoring certified digital health products in their jurisdiction.

---

#### 9. Public User (`public_user`)
**Portal Access:** `/dashboard`

**Permissions:**
- `view_public_directory` - View directory of certified products
- `search_products` - Search certified products
- `view_product_details` - View basic product information
- `submit_feedback` - Submit public feedback

**Description:** General public user with read-only access to certified product directory.

---

### Permission Matrix

| Permission | Vendor | Tech Lead | Compliance | Admin | Cert Officer | Lab Staff | Committee | County | Public |
|------------|--------|-----------|------------|-------|--------------|-----------|-----------|--------|--------|
| submit_application | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| view_own_applications | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| manage_team_members | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| approve_applications | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| manage_users | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| view_audit_logs | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| upload_test_results | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| view_public_directory | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

### Role Hierarchy

```
Level 1 (System Admin)
└── dha_system_administrator

Level 2 (DHA Officials)
├── dha_certification_officer
└── certification_committee_member

Level 3 (External Services)
├── testing_lab_staff
└── county_health_officer

Level 4 (Vendors)
├── vendor_technical_lead
├── vendor_compliance_officer
└── vendor_developer

Level 5 (Public)
└── public_user
```

---

## Middleware & Validation

### Authentication Middleware

#### `protect` / `auth`
- Verifies JWT token from cookie or Authorization header
- Validates token signature and expiration
- Checks token version against user's current version
- Loads user data into request object
- Handles admin impersonation
- Checks for maintenance mode

**Usage:**
```javascript
router.get('/protected', protect, controller.method);
```

---

### Authorization Middleware

#### `requireRole(roles)`
- Checks if user has one of the specified roles
- Accepts single role or array of roles
- Returns 403 if user doesn't have required role

**Usage:**
```javascript
router.post('/admin', auth, requireRole(['dha_system_administrator']), controller.method);
```

#### `requirePermission(permissions)`
- Checks if user has ANY of the specified permissions (OR logic)
- Accepts single permission or array of permissions
- Returns 403 if user doesn't have required permission

**Usage:**
```javascript
router.post('/submit', auth, requirePermission(['submit_application']), controller.method);
```

#### `requireAllPermissions(permissions)`
- Checks if user has ALL specified permissions (AND logic)
- Returns 403 if user is missing any permission

**Usage:**
```javascript
router.post('/approve', auth, requireAllPermissions(['view_applications', 'approve_applications']), controller.method);
```

#### `requireAdminRole()`
- Checks if user is DHA System Administrator
- Shortcut for `requireRole(['dha_system_administrator'])`

**Usage:**
```javascript
router.get('/admin/users', auth, requireAdminRole(), controller.method);
```

---

### Validation Middleware

#### `validate(schema)`
- Validates request body against Joi schema
- Returns 400 with detailed validation errors
- Sanitizes input data

**Usage:**
```javascript
router.post('/register', validate(registerSchema), controller.register);
```

---

### Security Middleware

#### `checkPasswordExpiry`
- Checks if user's password has expired
- Returns 401 with password expiry warning
- Adds expiry warning headers to response

#### `autoUnlockMiddleware`
- Automatically unlocks accounts after 30-minute lockout period
- Runs before login attempt

#### `checkIPSecurity()`
- Validates IP address against blocklist
- Detects VPN/Proxy usage
- Tracks failed attempts per IP
- Blocks suspicious activity

#### `separationOfDuties()`
- Enforces separation of duties rules
- Prevents self-approval
- Prevents organization conflicts of interest

#### `auditLog(action)`
- Logs action to audit trail
- Captures user, IP, timestamp, and details

**Usage:**
```javascript
router.post('/approve', auth, auditLog('APPROVE_APPLICATION'), controller.approve);
```

---

### Rate Limiting Middleware

#### `forgotPasswordLimiter`
- 5 requests per hour
- Applied to password reset endpoints

#### `captchaLimiter`
- 20 requests per 15 minutes
- Applied to CAPTCHA generation

#### `sensitiveOperationsLimiter`
- 50 requests per hour
- Applied to sensitive operations

---

## Example Integration

### Authentication Flow

```javascript
// 1. Register
POST /api/auth/register
{
  "email": "developer@healthtech.co.ke",
  "password": "SecurePass123!@#",
  "firstName": "John",
  "lastName": "Doe",
  ...
}

// 2. Setup Password (from email link)
POST /api/auth/setup-password
{
  "token": "setup-token-from-email",
  "password": "SecurePass123!@#",
  "confirmPassword": "SecurePass123!@#"
}

// 3. Login
POST /api/auth/login
{
  "identifier": "developer@healthtech.co.ke",
  "password": "SecurePass123!@#"
}

// Response includes token
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { ... }
  }
}

// 4. Use token in subsequent requests
GET /api/auth/me
Headers: {
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
}
```

---

### Two-Factor Authentication Flow

```javascript
// 1. Enable 2FA - Generate Secret
POST /api/2fa/generate
Headers: { "Authorization": "Bearer <token>" }

// Response includes QR code
{
  "success": true,
  "data": {
    "qrCodeUrl": "data:image/png;base64,...",
    "secret": "JBSWY3DPEHPK3PXP"
  }
}

// 2. Scan QR code with authenticator app

// 3. Verify and Enable 2FA
POST /api/2fa/verify
{
  "token": "123456"
}

// Response includes backup codes
{
  "success": true,
  "data": {
    "twoFactorEnabled": true,
    "backupCodes": ["ABCD-1234", ...]
  }
}

// 4. Login with 2FA
POST /api/auth/login
{
  "identifier": "user@example.com",
  "password": "SecurePass123!@#"
}

// Response indicates 2FA required
{
  "success": true,
  "data": {
    "require2FA": true,
    "tempToken": "temp-token"
  }
}

// 5. Submit 2FA code
POST /api/2fa/verify
{
  "token": "123456",
  "tempToken": "temp-token"
}

// Final response with full token
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { ... }
  }
}
```

---

## Support & Contact

For API support and technical assistance:
- **Email:** api-support@dha.go.ke
- **Documentation:** https://docs.dha.go.ke
- **Developer Portal:** https://developer.dha.go.ke

---

**Document Version:** 1.0  
**Last Updated:** December 11, 2025  
**API Version:** v1  

---

