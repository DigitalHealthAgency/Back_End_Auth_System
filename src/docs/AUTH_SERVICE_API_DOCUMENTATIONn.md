#  Kenya DHA Auth Service - Complete API Documentation

**Base URL:** `http://localhost:8000/api/auth` (via API Gateway)
**Direct URL:** `http://localhost:5000/api/auth` (for internal Docker services only)
**Service:** Authentication & User Management Service
**Version:** 1.0.0
**Last Updated:** December 2, 2025

---

##  Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [User Management](#user-management)
3. [Password Management](#password-management)
4. [Two-Factor Authentication (2FA)](#two-factor-authentication-2fa)
5. [Session Management](#session-management)
6. [Security & Audit](#security--audit)
7. [Notifications](#notifications)
8. [Internal Service APIs](#internal-service-apis)
9. [User Service APIs](#user-service-apis)
10. [Analytics APIs](#analytics-apis)
11. [Cron Job Management](#cron-job-management)
12. [Recovery & File Downloads](#recovery--file-downloads)
13. [Error Codes](#error-codes)
14. [Authentication Headers](#authentication-headers)

---

##  Authentication & Authorization

### 1. Register User (Individual)

**POST** `/api/auth/register`

Register a new individual user account.

#### Request Body

```json
{
  "type": "individual",
  "username": "john_doe",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+254712345678",
  "password": "SecurePassword123!",
  "acceptTerms": true,
  "receiveSystemAlerts": true
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "message": "Registration successful",
  "user": {
    "_id": "676d8f9e7c8b4a001c9e8f7d",
    "username": "john_doe",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+254712345678",
    "role": "public_user",
    "type": "individual",
    "accountStatus": "active",
    "createdAt": "2025-12-02T10:30:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "recoveryKey": "DHA-RK-ABC123XYZ789-2025"
}
```

**Notes:**
- Recovery key is **ONLY** returned once during registration
- User is automatically assigned `public_user` role
- Token is valid for 7 days
- Phone must be in Kenyan format: `07xxxxxxxx`, `01xxxxxxxx`, or `+254xxxxxxxxx`

---

### 2. Register Organization

**POST** `/api/auth/register`

Register a new organization account.

#### Request Body

```json
{
  "type": "organization",
  "organizationType": "HOSPITAL",
  "organizationName": "Nairobi General Hospital",
  "organizationEmail": "admin@nairobigeneral.co.ke",
  "organizationPhone": "+254700123456",
  "organizationWebsite": "https://nairobigeneral.co.ke",
  "organizationAddress": "123 Healthcare Ave, Nairobi",
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@nairobigeneral.co.ke",
  "phone": "+254711222333",
  "jobTitle": "Chief Administrator",
  "password": "OrgSecurePass123!",
  "acceptTerms": true
}
```

#### Organization Types
- `HOSPITAL` - Hospital
- `CLINIC` - Clinic
- `HEALTH_CENTER` - Health Centre
- `DISPENSARY` - Dispensary
- `LABORATORY` - Laboratory
- `EHR_VENDOR` - Electronic Health Record Vendor
- `EMRS_VENDOR` - Electronic Medical Record System Vendor
- `HIS_VENDOR` - Health Information System Vendor
- `TELEMEDICINE_VENDOR` - Telemedicine Platform Vendor
- `MOBILE_HEALTH_VENDOR` - Mobile Health (mHealth) Vendor
- `PHARMACY_VENDOR` - Pharmacy Management System Vendor
- `LAB_VENDOR` - Laboratory Information System Vendor
- `IMAGING_VENDOR` - Medical Imaging System Vendor
- `BILLING_VENDOR` - Healthcare Billing System Vendor
- `HEALTH_ANALYTICS_VENDOR` - Health Analytics Platform Vendor
- `OTHER_VENDOR` - Other Digital Health Vendor

#### Response (201 Created)

```json
{
  "success": true,
  "message": "Organization registration successful",
  "user": {
    "_id": "676d8f9e7c8b4a001c9e8f7e",
    "organizationName": "Nairobi General Hospital",
    "organizationEmail": "admin@nairobigeneral.co.ke",
    "organizationType": "HOSPITAL",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@nairobigeneral.co.ke",
    "role": "public_user",
    "type": "organization",
    "accountStatus": "pending_registration",
    "createdAt": "2025-12-02T10:35:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "recoveryKey": "DHA-ORG-RK-DEF456GHI012-2025"
}
```

**Notes:**
- Organization accounts start with `accountStatus: "pending_registration"`
- Must complete full registration process in Organization Service
- Recovery key is prefixed with `DHA-ORG-RK-`

---

### 3. Login

**POST** `/api/auth/login`

Authenticate user and receive JWT token.

#### Request Body

```json
{
  "identifier": "john.doe@example.com",
  "password": "SecurePassword123!"
}
```

**Identifier can be:**
- Email address
- Username
- Organization email
- Phone number (Kenyan format)

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "_id": "676d8f9e7c8b4a001c9e8f7d",
    "username": "john_doe",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "role": "public_user",
    "type": "individual",
    "accountStatus": "active",
    "twoFactorEnabled": false
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Response with 2FA Required (403 Forbidden)

```json
{
  "success": false,
  "message": "2FA verification required",
  "requiresTwoFactor": true,
  "tempToken": "temp_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Notes:**
- Token expires after 7 days of inactivity
- If 2FA is enabled, use `tempToken` with `/api/two-factor/verify` endpoint
- Failed login attempts are logged in security events

---

### 4. Logout

**GET** `/api/auth/logout`

Log out user and invalidate session.

#### Headers
```
Authorization: Bearer <token>
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Notes:**
- Clears HttpOnly cookie
- Invalidates JWT token
- Logs security event

---

### 5. Setup Password (Board Members)

**POST** `/api/auth/setup-password`

Set password for board members created without passwords.

#### Request Body

```json
{
  "userId": "676d8f9e7c8b4a001c9e8f7d",
  "password": "NewSecurePassword123!",
  "confirmPassword": "NewSecurePassword123!"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Password setup successful",
  "user": {
    "_id": "676d8f9e7c8b4a001c9e8f7d",
    "email": "boardmember@example.com",
    "hasPassword": true
  }
}
```

**Notes:**
- Used when board members are created via governance service
- One-time use - password must not already exist
- Password must meet complexity requirements

---

##  User Management

### 6. Get Current User Profile

**GET** `/api/auth/me`

Get authenticated user's profile information.

#### Headers
```
Authorization: Bearer <token>
```

#### Response (200 OK)

```json
{
  "success": true,
  "user": {
    "_id": "676d8f9e7c8b4a001c9e8f7d",
    "username": "john_doe",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+254712345678",
    "role": "public_user",
    "type": "individual",
    "accountStatus": "active",
    "twoFactorEnabled": false,
    "profilePicture": null,
    "createdAt": "2025-12-02T10:30:00.000Z",
    "lastLogin": "2025-12-02T11:00:00.000Z"
  }
}
```

---

### 7. Update User Profile

**PATCH** `/api/auth/me`

Update authenticated user's profile information.

#### Headers
```
Authorization: Bearer <token>
```

#### Request Body

```json
{
  "firstName": "Johnny",
  "lastName": "Doe",
  "phone": "+254712345679",
  "bio": "Healthcare professional",
  "location": "Nairobi, Kenya"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "_id": "676d8f9e7c8b4a001c9e8f7d",
    "username": "john_doe",
    "firstName": "Johnny",
    "lastName": "Doe",
    "phone": "+254712345679",
    "bio": "Healthcare professional",
    "location": "Nairobi, Kenya"
  }
}
```

**Notes:**
- Cannot update: `email`, `username`, `role`, `accountStatus`
- Use dedicated endpoints for password change and email update

---

### 8. Change Password

**PATCH** `/api/auth/change-password`

Change authenticated user's password.

#### Headers
```
Authorization: Bearer <token>
```

#### Request Body

```json
{
  "currentPassword": "SecurePassword123!",
  "newPassword": "NewSecurePassword456!",
  "confirmPassword": "NewSecurePassword456!"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Notes:**
- Current password must be correct
- New password must meet complexity requirements:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
- All active sessions are invalidated (user must login again)

---

### 9. Upload Logo/Profile Picture

**POST** `/api/auth/me/logo`

Upload user profile picture or organization logo.

#### Headers
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

#### Request Body (Form Data)

```
logo: <file> (image file: PNG, JPG, JPEG, GIF, WebP)
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Logo uploaded successfully",
  "logoUrl": "https://res.cloudinary.com/dqmo5qzze/image/upload/v1234567890/logos/user-logo.png"
}
```

**Notes:**
- Maximum file size: 5MB
- Supported formats: PNG, JPG, JPEG, GIF, WebP
- Images stored on Cloudinary
- Previous logo is automatically deleted

---

### 10. Delete Logo/Profile Picture

**DELETE** `/api/auth/logo`

Delete user profile picture or organization logo.

#### Headers
```
Authorization: Bearer <token>
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Logo deleted successfully"
}
```

---

### 11. Regenerate Access Key

**POST** `/api/auth/regenerate-access-key`

Generate new recovery access key (invalidates old one).

#### Headers
```
Authorization: Bearer <token>
```

#### Request Body

```json
{
  "password": "SecurePassword123!"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "New access key generated",
  "recoveryKey": "DHA-RK-NEW789XYZ456-2025"
}
```

**Notes:**
- Requires password confirmation
- Old recovery key becomes invalid
- Save new key securely - cannot be retrieved later

---

### 12. Terminate Account

**POST** `/api/auth/terminate`

Request account termination (30-day grace period).

#### Headers
```
Authorization: Bearer <token>
```

#### Request Body

```json
{
  "reason": "No longer need the service",
  "password": "SecurePassword123!"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Account termination scheduled",
  "terminationDate": "2026-01-01T10:00:00.000Z"
}
```

**Notes:**
- Account marked for deletion after 30 days
- Can abort termination before deletion date
- User loses access immediately after termination request

---

### 13. Abort Account Termination

**POST** `/api/auth/abort-termination`

Cancel account termination request.

#### Headers
```
Authorization: Bearer <token>
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Account termination cancelled"
}
```

---

##  Password Management

### 14. Forgot Password (Request Code)

**POST** `/api/password/forgot-password`

Request password reset code via email.

#### Request Body

```json
{
  "email": "john.doe@example.com"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Password reset code sent to your email"
}
```

**Notes:**
- Rate limited: 3 requests per 15 minutes per IP
- Code expires after 10 minutes
- Code is 6 digits (e.g., `123456`)

---

### 15. Verify Reset Code

**POST** `/api/password/verify-code`

Verify the password reset code.

#### Request Body

```json
{
  "email": "john.doe@example.com",
  "code": "123456"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Code verified successfully",
  "resetToken": "reset_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Notes:**
- Returns temporary reset token
- Token valid for 15 minutes
- Use this token with recovery login endpoint

---

### 16. Recovery Login (Reset Password)

**POST** `/api/password/recovery-login`

Complete password reset using recovery key or reset token.

#### Request Body (with Reset Token)

```json
{
  "email": "john.doe@example.com",
  "resetToken": "reset_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newPassword": "NewSecurePassword789!",
  "confirmPassword": "NewSecurePassword789!"
}
```

#### Request Body (with Recovery Key)

```json
{
  "email": "john.doe@example.com",
  "recoveryKey": "DHA-RK-ABC123XYZ789-2025",
  "newPassword": "NewSecurePassword789!",
  "confirmPassword": "NewSecurePassword789!"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Password reset successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Notes:**
- Accepts either `resetToken` (from email) or `recoveryKey` (from registration)
- All active sessions are invalidated
- User is automatically logged in with new token

---

##  Two-Factor Authentication (2FA)

### 17. Generate 2FA Secret

**GET** `/api/two-factor/generate`

Generate 2FA secret and QR code for setup.

#### Headers
```
Authorization: Bearer <token>
```

#### Response (200 OK)

```json
{
  "success": true,
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "otpAuthUrl": "otpauth://totp/DHA:john.doe@example.com?secret=JBSWY3DPEHPK3PXP&issuer=DHA"
}
```

**Notes:**
- QR code is base64-encoded PNG image
- Scan with authenticator app (Google Authenticator, Authy, etc.)
- 2FA is NOT enabled until code is verified

---

### 18. Verify 2FA Code (Enable 2FA)

**POST** `/api/two-factor/verify`

Verify 2FA code to enable two-factor authentication.

#### Headers
```
Authorization: Bearer <token>
```

#### Request Body

```json
{
  "twoFactorCode": "123456"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Two-factor authentication enabled successfully"
}
```

**Notes:**
- Must call `/generate` endpoint first to get secret
- Code must be valid 6-digit TOTP code
- 2FA is permanently enabled after verification
- User will be prompted for 2FA code on every login

---

### 19. Disable 2FA

**POST** `/api/two-factor/disable`

Disable two-factor authentication.

#### Headers
```
Authorization: Bearer <token>
```

#### Request Body

```json
{
  "password": "SecurePassword123!",
  "twoFactorCode": "123456"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Two-factor authentication disabled successfully"
}
```

**Notes:**
- Requires both password and current valid 2FA code
- Security event is logged
- User no longer needs 2FA code for login

---

##  Session Management

### 20. Get Active Sessions

**GET** `/api/auth/sessions`

Get all active sessions for the authenticated user.

#### Headers
```
Authorization: Bearer <token>
```

#### Response (200 OK)

```json
{
  "success": true,
  "sessions": [
    {
      "_id": "676d8f9e7c8b4a001c9e8f80",
      "deviceInfo": {
        "device": "Desktop",
        "browser": "Chrome 120",
        "os": "Windows 10"
      },
      "ip": "197.232.45.67",
      "location": {
        "country": "Kenya",
        "city": "Nairobi"
      },
      "lastActive": "2025-12-02T11:00:00.000Z",
      "createdAt": "2025-12-02T10:30:00.000Z",
      "isCurrent": true
    },
    {
      "_id": "676d8f9e7c8b4a001c9e8f81",
      "deviceInfo": {
        "device": "Mobile",
        "browser": "Safari 17",
        "os": "iOS 17"
      },
      "ip": "197.232.45.89",
      "location": {
        "country": "Kenya",
        "city": "Mombasa"
      },
      "lastActive": "2025-12-01T09:00:00.000Z",
      "createdAt": "2025-12-01T08:00:00.000Z",
      "isCurrent": false
    }
  ]
}
```

---

### 21. Terminate Session

**DELETE** `/api/auth/sessions/:sessionId`

Terminate a specific session (logout from that device).

#### Headers
```
Authorization: Bearer <token>
```

#### URL Parameters
- `sessionId` - Session ID to terminate

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Session terminated successfully"
}
```

**Notes:**
- Cannot terminate current session (use `/logout` instead)
- User will be logged out from that device
- Security event is logged

---

##  Security & Audit

### 22. Get Security Logs

**GET** `/api/security/logs`

Get security audit logs for authenticated user.

#### Headers
```
Authorization: Bearer <token>
```

#### Query Parameters
- `limit` (optional) - Number of logs to return (default: 50, max: 100)
- `skip` (optional) - Number of logs to skip (pagination)
- `action` (optional) - Filter by action type
- `severity` (optional) - Filter by severity: `low`, `medium`, `high`, `critical`

#### Response (200 OK)

```json
{
  "success": true,
  "logs": [
    {
      "_id": "676d8f9e7c8b4a001c9e8f82",
      "action": "Login Successful",
      "severity": "low",
      "ip": "197.232.45.67",
      "device": "Chrome 120 on Windows 10",
      "location": {
        "country": "Kenya",
        "city": "Nairobi"
      },
      "details": {},
      "riskScore": 0,
      "createdAt": "2025-12-02T11:00:00.000Z"
    },
    {
      "_id": "676d8f9e7c8b4a001c9e8f83",
      "action": "Failed Login",
      "severity": "medium",
      "ip": "203.45.67.89",
      "device": "Unknown",
      "location": {
        "country": "Unknown",
        "city": "Unknown"
      },
      "details": {
        "reason": "Invalid password",
        "attemptNumber": 2
      },
      "riskScore": 45,
      "createdAt": "2025-12-02T10:45:00.000Z"
    }
  ],
  "pagination": {
    "total": 127,
    "limit": 50,
    "skip": 0,
    "hasMore": true
  }
}
```

**Security Event Actions:**
- `Login Successful`
- `Failed Login`
- `Authentication Failed`
- `Account Registered`
- `Registration Successful`
- `Password Changed`
- `Profile Updated`
- `2FA Required`
- `Suspicious Activity Detected`
- `Account Locked`
- `Session Terminated`
- `Recovery Key Generated`
- And more...

---

## 🔔 Notifications

### 23. Get User Notifications

**GET** `/api/notifications`

Get all notifications for authenticated user.

#### Headers
```
Authorization: Bearer <token>
```

#### Query Parameters
- `unreadOnly` (optional) - Return only unread notifications: `true`/`false`
- `limit` (optional) - Number of notifications (default: 20)
- `skip` (optional) - Pagination offset

#### Response (200 OK)

```json
{
  "success": true,
  "notifications": [
    {
      "_id": "676d8f9e7c8b4a001c9e8f84",
      "type": "security",
      "title": "New login detected",
      "message": "Your account was accessed from a new device in Nairobi, Kenya",
      "data": {
        "device": "Chrome 120",
        "location": "Nairobi"
      },
      "isRead": false,
      "createdAt": "2025-12-02T11:00:00.000Z"
    },
    {
      "_id": "676d8f9e7c8b4a001c9e8f85",
      "type": "info",
      "title": "Profile updated",
      "message": "Your profile information was successfully updated",
      "data": {},
      "isRead": true,
      "createdAt": "2025-12-01T14:00:00.000Z"
    }
  ],
  "unreadCount": 5,
  "totalCount": 23
}
```

**Notification Types:**
- `security` - Security-related alerts
- `info` - Informational messages
- `warning` - Warning messages
- `success` - Success confirmations
- `error` - Error notifications

---

### 24. Mark Notification as Read

**PATCH** `/api/notifications/:id/read`

Mark a specific notification as read.

#### Headers
```
Authorization: Bearer <token>
```

#### URL Parameters
- `id` - Notification ID

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

---

##  Internal Service APIs

These endpoints are for **microservice-to-microservice** communication only. They require the `x-internal-service: true` header.

### 25. Create Board Member User

**POST** `/api/auth/internal/board-member-user`

Create user account for board member (without password).

#### Headers
```
x-internal-service: true
Authorization: Bearer <service-token>
```

#### Request Body

```json
{
  "email": "boardmember@governance.dha.ke",
  "firstName": "Alice",
  "lastName": "Mutua",
  "phone": "+254722334455",
  "role": "certification_committee_member",
  "boardRole": "Chairperson",
  "organizationId": "676d8f9e7c8b4a001c9e8f90",
  "registrationNumber": "ORG-2025-001"
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "message": "Board member user created successfully",
  "user": {
    "_id": "676d8f9e7c8b4a001c9e8f95",
    "email": "boardmember@governance.dha.ke",
    "firstName": "Alice",
    "lastName": "Mutua",
    "role": "certification_committee_member",
    "boardRole": "Chairperson",
    "hasPassword": false,
    "accountStatus": "active"
  },
  "setupPasswordUrl": "http://localhost:8080/setup-password?userId=676d8f9e7c8b4a001c9e8f95"
}
```

---

### 26. Get Organization Members

**GET** `/api/auth/internal/organization/:registrationNumber/members`

Get all users belonging to an organization.

#### Headers
```
x-internal-service: true
```

#### URL Parameters
- `registrationNumber` - Organization registration number

#### Response (200 OK)

```json
{
  "success": true,
  "members": [
    {
      "_id": "676d8f9e7c8b4a001c9e8f96",
      "email": "admin@hospital.ke",
      "firstName": "John",
      "lastName": "Kamau",
      "role": "vendor_technical_lead",
      "accountStatus": "active",
      "createdAt": "2025-12-02T10:00:00.000Z"
    }
  ],
  "totalCount": 5
}
```

---

### 27. Find User by Email

**GET** `/api/auth/internal/user/by-email/:email`

Find user account by email address.

#### Headers
```
x-internal-service: true
```

#### URL Parameters
- `email` - User email address

#### Response (200 OK)

```json
{
  "success": true,
  "user": {
    "_id": "676d8f9e7c8b4a001c9e8f97",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "public_user",
    "accountStatus": "active",
    "type": "individual"
  }
}
```

#### Response (404 Not Found)

```json
{
  "success": false,
  "message": "User not found"
}
```

---

### 28. Check User Password Exists

**GET** `/api/auth/internal/user/:userId/password-exists`

Check if user has set a password.

#### Headers
```
x-internal-service: true
```

#### URL Parameters
- `userId` - User ID

#### Response (200 OK)

```json
{
  "success": true,
  "hasPassword": true,
  "userId": "676d8f9e7c8b4a001c9e8f97"
}
```

---

### 29. Update User Board Role

**PATCH** `/api/auth/internal/user/:userId/board-role`

Update user's board role (for governance service).

#### Headers
```
x-internal-service: true
```

#### Request Body

```json
{
  "boardRole": "Vice Chairperson",
  "committeeId": "676d8f9e7c8b4a001c9e8f98"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Board role updated successfully",
  "user": {
    "_id": "676d8f9e7c8b4a001c9e8f97",
    "email": "user@example.com",
    "boardRole": "Vice Chairperson"
  }
}
```

---

### 30. Update User Profile (Internal)

**PATCH** `/api/auth/internal/user/:userId/profile`

Update user profile from internal service.

#### Headers
```
x-internal-service: true
```

#### Request Body

```json
{
  "firstName": "Updated",
  "lastName": "Name",
  "phone": "+254700111222",
  "jobTitle": "Manager"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

---

### 31. Update User Account Status

**PATCH** `/api/auth/internal/user/:userId/status`

Update user account status from internal service.

#### Headers
```
x-internal-service: true
```

#### Request Body

```json
{
  "accountStatus": "active",
  "registrationNumber": "ORG-2025-001",
  "organizationStatus": "approved"
}
```

**Valid Account Statuses:**
- `pending` - Pending verification
- `active` - Active account
- `suspended` - Suspended account
- `cancelled` - Cancelled account
- `pending_registration` - Registration not complete
- `submitted` - Application submitted
- `under_review` - Under review
- `clarification` - Needs clarification
- `approved` - Approved
- `rejected` - Rejected
- `certified` - Certified

#### Response (200 OK)

```json
{
  "success": true,
  "message": "User status updated successfully",
  "data": {
    "userId": "676d8f9e7c8b4a001c9e8f97",
    "accountStatus": "active",
    "organizationStatus": "approved",
    "registrationNumber": "ORG-2025-001"
  }
}
```

---

### 32. Deactivate User

**PATCH** `/api/auth/internal/user/:userId/deactivate`

Deactivate user account.

#### Headers
```
x-internal-service: true
```

#### Request Body

```json
{
  "reason": "Violated terms of service"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "User deactivated successfully"
}
```

---

### 33. Send Internal Email

**POST** `/api/auth/internal/send-email`

Send email from internal service.

#### Headers
```
x-internal-service: true
```

#### Request Body

```json
{
  "to": "user@example.com",
  "subject": "Account Approved",
  "text": "Your account has been approved",
  "html": "<h1>Account Approved</h1><p>Your account has been approved</p>"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

---

### 34. Get User by ID (Internal)

**GET** `/api/auth/internal/user/:userId`

Get user by ID from internal service.

#### Headers
```
x-internal-service: true
```

#### URL Parameters
- `userId` - User ID

#### Response (200 OK)

```json
{
  "success": true,
  "user": {
    "_id": "676d8f9e7c8b4a001c9e8f97",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "public_user",
    "type": "individual",
    "accountStatus": "active"
  }
}
```

---

### 35. Get Users by IDs (Batch)

**POST** `/api/auth/internal/users/batch`

Get multiple users by their IDs.

#### Headers
```
x-internal-service: true
```

#### Request Body

```json
{
  "userIds": [
    "676d8f9e7c8b4a001c9e8f97",
    "676d8f9e7c8b4a001c9e8f98",
    "676d8f9e7c8b4a001c9e8f99"
  ]
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "users": [
    {
      "_id": "676d8f9e7c8b4a001c9e8f97",
      "email": "user1@example.com",
      "firstName": "Jane",
      "lastName": "Doe"
    },
    {
      "_id": "676d8f9e7c8b4a001c9e8f98",
      "email": "user2@example.com",
      "firstName": "John",
      "lastName": "Smith"
    }
  ]
}
```

---

##  User Service APIs

These endpoints provide user information for **microservice communication**. They require the `x-service-request: true` header.

### 36. Get User by ID

**GET** `/api/users/:id`

Get user information by user ID.

#### Headers
```
x-service-request: true
```

#### URL Parameters
- `id` - User MongoDB ObjectId

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "_id": "676d8f9e7c8b4a001c9e8f97",
    "username": "john_doe",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+254712345678",
    "role": "public_user",
    "type": "individual",
    "accountStatus": "active"
  }
}
```

---

### 37. Get Users Batch

**POST** `/api/users/batch`

Get multiple users by their IDs.

#### Headers
```
x-service-request: true
```

#### Request Body

```json
{
  "userIds": [
    "676d8f9e7c8b4a001c9e8f97",
    "676d8f9e7c8b4a001c9e8f98"
  ]
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "_id": "676d8f9e7c8b4a001c9e8f97",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com"
    },
    {
      "_id": "676d8f9e7c8b4a001c9e8f98",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane.smith@example.com"
    }
  ]
}
```

---

### 38. Get User Snapshot

**GET** `/api/users/:id/snapshot`

Get user snapshot for audit purposes.

#### Headers
```
x-service-request: true
```

#### URL Parameters
- `id` - User ID

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "userId": "676d8f9e7c8b4a001c9e8f97",
    "email": "john.doe@example.com",
    "name": "John Doe",
    "role": "public_user",
    "phone": "+254712345678",
    "accountType": "individual",
    "accountStatus": "active",
    "snapshotAt": "2025-12-02T11:00:00.000Z"
  }
}
```

---

### 39. Validate User

**GET** `/api/users/:id/validate`

Validate user exists and is active.

#### Headers
```
x-service-request: true
```

#### URL Parameters
- `id` - User ID

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "isValid": true,
    "accountStatus": "active",
    "suspended": false,
    "accountType": "individual"
  }
}
```

#### Response (User Not Found)

```json
{
  "success": true,
  "data": {
    "isValid": false,
    "reason": "User not found"
  }
}
```

---

### 40. Update User Status (Service)

**PATCH** `/api/users/:id/status`

Update user account status from another service.

#### Headers
```
x-service-request: true
```

#### URL Parameters
- `id` - User ID

#### Request Body

```json
{
  "accountStatus": "active",
  "registrationNumber": "ORG-2025-001",
  "organizationStatus": "approved"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "userId": "676d8f9e7c8b4a001c9e8f97",
    "accountStatus": "active",
    "organizationStatus": "approved",
    "registrationNumber": "ORG-2025-001",
    "lastUpdated": "2025-12-02T11:00:00.000Z"
  },
  "message": "User status updated successfully"
}
```

---

##  Analytics APIs

All analytics endpoints require authentication.

### 41. Get Dashboard Analytics

**GET** `/api/analytics/dashboard`

Get comprehensive dashboard analytics.

#### Headers
```
Authorization: Bearer <token>
```

#### Query Parameters
- `period` (optional) - `daily`, `weekly`, `monthly`, `quarterly`, `yearly`
- `startDate` (optional) - ISO 8601 date
- `endDate` (optional) - ISO 8601 date

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRevenue": 450000,
      "totalInvoices": 45,
      "paidInvoices": 35,
      "overdueInvoices": 5
    },
    "trends": {
      "revenueGrowth": 15.5,
      "invoiceGrowth": 10.2
    }
  }
}
```

---

### 42. Get Quick Summary

**GET** `/api/analytics/summary`

Get quick analytics summary.

#### Headers
```
Authorization: Bearer <token>
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "totalUsers": 1250,
    "activeUsers": 980,
    "newUsersToday": 15,
    "totalRevenue": 450000
  }
}
```

---

### 43. Track Analytics Event

**POST** `/api/analytics/events`

Track custom analytics event.

#### Headers
```
Authorization: Bearer <token>
```

#### Request Body

```json
{
  "eventType": "quotation_sent",
  "entityId": "676d8f9e7c8b4a001c9e8f97",
  "entityType": "quotation",
  "metadata": {
    "amount": 50000,
    "clientId": "676d8f9e7c8b4a001c9e8f98"
  }
}
```

**Event Types:**
- `quotation_sent`, `quotation_viewed`, `quotation_accepted`, `quotation_rejected`
- `invoice_sent`, `invoice_viewed`, `invoice_paid`, `invoice_overdue`
- `email_opened`, `email_clicked`
- `client_created`, `client_updated`

#### Response (201 Created)

```json
{
  "success": true,
  "message": "Event tracked successfully"
}
```

---

##  Cron Job Management

Admin-only endpoints for managing scheduled jobs.

### 44. Get Cron Status

**GET** `/api/cron/status`

Get status of all cron jobs.

#### Headers
```
Authorization: Bearer <admin-token>
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "status": {
      "accountCleanup": {
        "enabled": true,
        "running": false,
        "lastRun": "2025-12-02T00:00:00.000Z",
        "nextRun": "2025-12-03T00:00:00.000Z"
      }
    },
    "statistics": {
      "totalJobs": 5,
      "activeJobs": 3,
      "completedRuns": 127
    },
    "timestamp": "2025-12-02T11:00:00.000Z"
  }
}
```

**Note:** Requires `admin` role

---

### 45. Trigger Cron Job

**POST** `/api/cron/:jobName/trigger`

Manually trigger a cron job.

#### Headers
```
Authorization: Bearer <admin-token>
```

#### URL Parameters
- `jobName` - Name of the job to trigger

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "jobName": "accountCleanup",
    "executed": true,
    "timestamp": "2025-12-02T11:00:00.000Z"
  },
  "message": "Job 'accountCleanup' triggered successfully"
}
```

---

### 46. Enable/Disable Cron Job

**PATCH** `/api/cron/:jobName/enable`
**PATCH** `/api/cron/:jobName/disable`

Enable or disable a cron job.

#### Headers
```
Authorization: Bearer <admin-token>
```

#### URL Parameters
- `jobName` - Name of the job

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Job 'accountCleanup' enabled successfully"
}
```

---

### 47. Start/Stop Cron Job

**POST** `/api/cron/:jobName/start`
**POST** `/api/cron/:jobName/stop`

Start or stop a cron job.

#### Headers
```
Authorization: Bearer <admin-token>
```

#### URL Parameters
- `jobName` - Name of the job

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Job 'accountCleanup' started successfully"
}
```

---

### 48. Cron Health Check

**GET** `/api/cron/health`

Get cron manager health status.

#### Headers
```
Authorization: Bearer <admin-token>
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "cronManager": {
      "status": "healthy",
      "uptime": 86400
    }
  },
  "healthy": true
}
```

---

##  Recovery & File Downloads

### 49. Download Recovery Key PDF

**GET** `/recovery/:filename`

Download recovery key PDF file.

#### URL Parameters
- `filename` - PDF filename (e.g., `recovery-key-ABC123.pdf`)

#### Response (200 OK)

Returns PDF file with headers:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="recovery-key-ABC123.pdf"
```

#### Response (404 Not Found)

```json
{
  "message": "Recovery PDF not found or expired."
}
```

**Notes:**
- PDF files are stored temporarily in `/temp` folder
- Files may be deleted after download (based on server configuration)
- Access does not require authentication (public URL)

---

##  Error Codes

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid request data |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions or 2FA required |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |
| 503 | Service Unavailable - Service temporarily unavailable |

### Common Error Responses

#### Validation Error (400)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Valid email is required"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

#### Authentication Error (401)

```json
{
  "success": false,
  "message": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

#### Forbidden Error (403)

```json
{
  "success": false,
  "message": "Access denied",
  "code": "FORBIDDEN"
}
```

#### Rate Limit Error (429)

```json
{
  "success": false,
  "message": "Too many requests. Please try again later.",
  "retryAfter": 900
}
```

#### Server Error (500)

```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Detailed error message (development only)"
}
```

---

##  Authentication Headers

### Standard Authentication

Most endpoints require the `Authorization` header with a Bearer token:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Internal Service Authentication

Internal service endpoints require the `x-internal-service` header:

```
x-internal-service: true
Authorization: Bearer <service-token>
```

### Microservice Communication

User service endpoints require the `x-service-request` header:

```
x-service-request: true
```

### Cookie Authentication

The service also supports HttpOnly cookies for browser-based authentication:

```
Cookie: token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🌍 User Roles

The system supports 9 user roles with different access levels:

| Role Code | Portal | Description |
|-----------|--------|-------------|
| `vendor_developer` | Vendor Portal | Software developer from vendor organization |
| `vendor_technical_lead` | Vendor Portal | Technical lead from vendor organization |
| `vendor_compliance_officer` | Vendor Portal | Compliance officer from vendor organization |
| `dha_system_administrator` | Admin Portal | DHA system administrator (full access) |
| `dha_certification_officer` | Certification Portal | DHA certification officer |
| `testing_lab_staff` | Lab Portal | Testing laboratory staff |
| `certification_committee_member` | Committee Portal | Certification committee member |
| `county_health_officer` | County Portal | County health officer |
| `public_user` | Public Portal | Public user (default for new registrations) |

**Default Role:** All new registrations are assigned the `public_user` role. DHA System Administrator must change roles via Admin Portal.

---

## 📞 Support

For API support or to report issues:

- **Email:** certification@dha.go.ke
- **Phone:** +254 20 123 4567
- **Documentation:** http://localhost:8080/docs
- **System URL:** http://localhost:8080

---

##  Rate Limits

**Note:** Rate limiting is handled by the API Gateway layer. The following limits apply:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/password/forgot-password` | 3 requests | 15 minutes |
| Global API requests | 100 requests | 15 minutes |

Exceeding rate limits will return a `429 Too Many Requests` response.

---

##  Notes

1. **MongoDB Atlas Cloud:** All user data is stored in MongoDB Atlas Cloud, not local MongoDB
2. **API Gateway:** All frontend requests should go through API Gateway at `http://localhost:8000`
3. **Token Expiry:** JWT tokens expire after 7 days of inactivity
4. **Password Requirements:**
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character
5. **Phone Format:** Kenya format only: `07xxxxxxxx`, `01xxxxxxxx`, or `+254xxxxxxxxx`
6. **Security Events:** All authentication actions are logged in security events collection
7. **Recovery Keys:** Generated once during registration - cannot be retrieved later (only regenerated)

---

**Generated:** December 2, 2025
**Service Version:** 1.0.0
**Status:** Production Ready 
