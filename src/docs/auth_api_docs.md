# Authentication API Documentation

## Overview

This API provides comprehensive authentication and user management functionality with advanced security features including rate limiting, device tracking, two-factor authentication, and threat detection.

## Security Features

- **Multi-layer Rate Limiting**: Account-based and IP-based protection
- **Device Fingerprinting**: Track and alert on new device logins
- **Session Management**: Maximum 5 concurrent sessions per user
- **Account Suspension**: Automatic suspension after failed attempts
- **Security Event Logging**: Comprehensive audit trail
- **Two-Factor Authentication**: TOTP support
- **Password Security**: Bcrypt hashing with salt rounds

## Base URL

```
https://your-api-domain.com/api/auth
```

## Authentication

Most endpoints require authentication via JWT token sent as:
- **Cookie**: `token` (recommended)
- **Header**: `Authorization: Bearer <token>`

### Frontend Configuration

**Important**: When making requests from frontend applications, always include `credentials: 'include'` in your fetch requests:

```javascript
fetch('/api/auth/endpoint', {
  method: 'POST',
  credentials: 'include', // Essential for cookie-based authentication
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data)
});
```

**Why `credentials: 'include'` is required**:
- The API uses **httpOnly cookies** for secure token storage
- httpOnly cookies cannot be accessed by JavaScript (prevents XSS attacks)
- `credentials: 'include'` tells the browser to automatically send cookies with requests
- Without this setting, authentication cookies won't be sent, causing 401 Unauthorized errors
- This is essential for maintaining secure, stateful authentication across requests

---

## Endpoints

### 1. Register User

Create a new user account (individual or organization).

**Endpoint**: `POST /register`

**Request Body**:

For Individual Registration:
```json
{
  "type": "individual",
  "username": "johndoe",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "password": "securePassword123",
  "receiveSystemAlerts": true
}
```

For Organization Registration:
```json
{
  "type": "organization",
  "organizationName": "Acme Corp",
  "legalTrack": "Private Limited",
  "county": "Nairobi",
  "subCounty": "Westlands",
  "organizationEmail": "info@acme.com",
  "organizationPhone": "+1234567890",
  "yearOfEstablishment": 2020,
  "password": "securePassword123",
  "receiveSystemAlerts": false
}
```

**Response** (201 Created):
```json
{
  "user": {
    "_id": "user_id",
    "type": "individual",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "role": "user",
    "logo": {
      "url": "https://cloudinary.com/default-logo-1.png"
    }
  },
  "token": "jwt_token",
  "recoveryKey": "ABCD-EFGH-IJKL-MNOP",
  "recoveryPDF": "/recovery/recovery-key.pdf",
  "message": "Registration successful!"
}
```

**Error Responses**:
- `400`: Missing required fields or invalid type
- `409`: Username/email already exists
- `403`: High-risk registration blocked
- `500`: Registration failed

---

### 2. Login

Authenticate user and create session.

**Endpoint**: `POST /login`

**Request Body**:
```json
{
  "identifier": "john@example.com",
  "password": "securePassword123"
}
```

**Response** (200 OK):
```json
{
  "user": {
    "_id": "user_id",
    "type": "individual",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "role": "user",
    "logo": {
      "url": "https://cloudinary.com/user-logo.png"
    }
  },
  "token": "jwt_token"
}
```

**2FA Required Response** (206 Partial Content):
```json
{
  "message": "2FA_REQUIRED",
  "code": "2FA_REQUIRED"
}
```

**Error Responses**:
- `400`: Missing credentials
- `401`: Invalid credentials
- `423`: Account suspended
- `429`: IP temporarily blocked
- `500`: Login failed

**Security Features**:
- Account suspension after 5 failed attempts
- IP temporary blocking after 10 failed attempts
- New device email alerts
- Session limit enforcement (max 5 sessions)

---

### 3. Get Profile

Retrieve user profile information.

**Endpoint**: `GET /profile`

**Headers**: `Authorization: Bearer <token>`

**Response** (200 OK):
```json
{
  "user": {
    "_id": "user_id",
    "type": "individual",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "role": "user",
    "logo": {
      "url": "https://cloudinary.com/user-logo.png"
    },
    "lastLogin": "2025-08-05T10:30:00Z",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-08-05T10:30:00Z",
    "lastUpdated": "2025-08-05T10:30:00Z"
  }
}
```

**Error Responses**:
- `404`: User not found
- `500`: Profile fetch failed

---

### 4. Update Profile

Update user profile information.

**Endpoint**: `PUT /profile`

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "firstName": "John",
  "middleName": "Michael",
  "surname": "Doe",
  "companyName": "Acme Corp",
  "position": "Developer",
  "phone": "+1234567890",
  "address": "123 Main St, City, Country",
  "quoteTerms": "Payment due in 30 days",
  "invoiceTerms": "Net 30",
  "receiptTerms": "Thank you for your business",
  "estimateTerms": "Valid for 30 days"
}
```

**Response** (200 OK):
```json
{
  "message": "Profile updated successfully",
  "user": {
    "_id": "user_id",
    "firstName": "John",
    "middleName": "Michael",
    "surname": "Doe",
    // ... other updated fields
  }
}
```

**Error Responses**:
- `404`: User not found
- `500`: Update failed

**Allowed Fields**:
- `firstName`, `middleName`, `surname`
- `companyName`, `position`
- `phone`, `address`
- `quoteTerms`, `invoiceTerms`, `receiptTerms`, `estimateTerms`

---

### 5. Change Password

Update user password with current password verification.

**Endpoint**: `PUT /change-password`

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword456"
}
```

**Response** (200 OK):
```json
{
  "message": "Password updated successfully. Please log in again.",
  "code": "PASSWORD_CHANGED"
}
```

**Error Responses**:
- `400`: Missing passwords or weak new password
- `401`: Incorrect current password
- `404`: User not found
- `500`: Password change failed

**Security Features**:
- Current password verification required
- Minimum 8 character requirement for new password
- Token version increment (invalidates existing sessions)
- Security event logging
- User notification

---

### 6. Regenerate Recovery Key

Generate new account recovery key and PDF.

**Endpoint**: `POST /regenerate-recovery-key`

**Headers**: `Authorization: Bearer <token>`

**Response** (200 OK):
```json
{
  "message": "New recovery key generated successfully!",
  "recoveryKey": "WXYZ-ABCD-EFGH-IJKL",
  "downloadLink": "/recovery/recovery-key-new.pdf"
}
```

**Error Responses**:
- `404`: User not found
- `500`: Key regeneration failed

**Security Features**:
- PDF auto-deletion after 5 minutes
- Security event logging
- Bcrypt hashed storage

---

### 7. Upload Logo

Upload user/organization logo image.

**Endpoint**: `POST /upload-logo`

**Headers**: 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body**: Form data with `logo` file field

**Response** (200 OK):
```json
{
  "message": "Logo uploaded successfully",
  "logo": {
    "url": "https://cloudinary.com/user-logo.png",
    "public_id": "folder/filename"
  }
}
```

**Error Responses**:
- `400`: No logo uploaded
- `404`: User not found
- `500`: Upload failed

**Features**:
- Cloudinary integration
- Automatic previous logo deletion
- Secure URL generation

---

### 8. Delete Logo

Remove user/organization logo.

**Endpoint**: `DELETE /logo`

**Headers**: `Authorization: Bearer <token>`

**Response** (200 OK):
```json
{
  "message": "Logo Removed successfully"
}
```

**Error Responses**:
- `404`: No logo to remove
- `500`: Delete failed

---

### 9. Request Account Termination

Schedule account for deletion in 7 days.

**Endpoint**: `POST /terminate-account`

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "password": "userPassword123"
}
```

**Response** (200 OK):
```json
{
  "message": "Account termination scheduled. Your account will be deleted in 7 days.",
  "terminationDate": "2025-08-12T10:30:00Z"
}
```

**Error Responses**:
- `401`: Invalid password
- `404`: User not found
- `500`: Termination request failed

**Security Features**:
- Password verification required
- 7-day grace period
- Activity logging
- Security event tracking

---

### 10. Abort Account Termination

Cancel scheduled account termination.

**Endpoint**: `POST /abort-termination`

**Headers**: `Authorization: Bearer <token>`

**Response** (200 OK):
```json
{
  "message": "Account termination cancelled successfully"
}
```

**Error Responses**:
- `400`: No termination was scheduled
- `404`: User not found
- `500`: Abort failed

---

### 11. Logout

End user session and clear authentication.

**Endpoint**: `POST /logout`

**Headers**: `Authorization: Bearer <token>`

**Response** (200 OK):
```json
{
  "message": "Logged out successfully"
}
```

**Features**:
- Cookie clearing
- Activity logging
- Graceful error handling

---

## Security Events

The API logs comprehensive security events including:

- **Authentication Events**: Login attempts, 2FA verification, logout
- **Account Events**: Registration, suspension, termination requests
- **Security Threats**: Failed attempts, IP blocking, high-risk activities
- **Profile Changes**: Updates, password changes, logo uploads

### Event Severity Levels

- **Low**: Routine activities (profile updates, successful logins)
- **Medium**: Important events (new device login, password change)
- **High**: Security threats (account suspension, multiple failures)

---

## Rate Limiting

### Account-Based Limits
- **Account Lock**: 5 failed login attempts → Account suspension
- **Recovery**: Reset on successful login

### IP-Based Limits
- **Temporary Block**: 10 failed attempts in 30 minutes
- **Block Duration**: Progressive (up to 60 minutes)
- **Whitelist**: Localhost IPs have modified handling

---

## Session Management

- **Maximum Sessions**: 5 concurrent sessions per user
- **Session Data**: IP address, device info, creation time
- **Automatic Cleanup**: Oldest sessions removed when limit exceeded
- **Security**: Session invalidation on password change

---

## Device Tracking

- **New Device Detection**: Based on IP + User Agent combination
- **Email Alerts**: Sent for logins from unrecognized devices
- **Device Storage**: Known devices tracked for security
- **Privacy**: Device info anonymized in logs

---

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_TYPE` | Invalid registration type |
| `MISSING_FIELDS` | Required fields missing |
| `USER_EXISTS` | Username/email already exists |
| `ORG_EXISTS` | Organization already exists |
| `HIGH_RISK` | Registration blocked (high risk) |
| `MISSING_CREDENTIALS` | Login credentials missing |
| `INVALID_CREDENTIALS` | Invalid username/password |
| `ACCOUNT_SUSPENDED` | Account suspended |
| `IP_TEMP_BLOCKED` | IP temporarily blocked |
| `2FA_REQUIRED` | Two-factor authentication required |
| `USER_NOT_FOUND` | User not found |
| `WEAK_PASSWORD` | Password doesn't meet requirements |
| `INVALID_CURRENT_PASSWORD` | Current password incorrect |

---

## Best Practices

### For Developers

1. **Always use HTTPS** in production
2. **Always include `credentials: 'include'`** in frontend fetch requests for cookie-based auth
3. **Implement proper error handling** for all status codes
4. **Store tokens securely** (httpOnly cookies recommended)
5. **Handle 2FA flow** appropriately
6. **Implement client-side rate limiting** to avoid blocks
7. **Monitor error responses** for security events

### For Security

1. **Regular password updates** encouraged
2. **Monitor login alerts** for unauthorized access
3. **Use strong passwords** (minimum 8 characters)
4. **Enable 2FA** when available
5. **Review active sessions** regularly
6. **Report suspicious activity** immediately

---

## Integration Examples

### JavaScript/Fetch

```javascript
// Registration
const registerUser = async (userData) => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    credentials: 'include', // Required for cookie-based auth
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });
  
  if (response.ok) {
    const data = await response.json();
    console.log('Registration successful:', data);
    return data;
  } else {
    const error = await response.json();
    throw new Error(error.message);
  }
};

// Login
const loginUser = async (identifier, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include', // Essential - allows httpOnly cookies to be sent/received
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ identifier, password }),
  });
  
  const data = await response.json();
  
  if (response.status === 206) {
    // Handle 2FA requirement
    return { requires2FA: true };
  } else if (response.ok) {
    return data;
  } else {
    throw new Error(data.message);
  }
};

// Profile Update
const updateProfile = async (updates, token) => {
  const response = await fetch('/api/auth/profile', {
    method: 'PUT',
    credentials: 'include', // Required for cookie authentication
    headers: {
      'Content-Type': 'application/json',
      // Note: Token can be sent via header OR cookie (cookie preferred)
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });
  
  if (response.ok) {
    return await response.json();
  } else {
    const error = await response.json();
    throw new Error(error.message);
  }
};

// Generic API helper with proper credential handling
const apiRequest = async (endpoint, options = {}) => {
  const config = {
    credentials: 'include', // Always include for this API
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(endpoint, config);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }
  
  return response.json();
};
```

### cURL Examples

```bash
# Register Individual User
curl -X POST https://api.example.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "type": "individual",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "password": "securePassword123"
  }'

# Login
curl -X POST https://api.example.com/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "identifier": "john@example.com",
    "password": "securePassword123"
  }'

# Get Profile (using cookie)
curl -X GET https://api.example.com/auth/profile \
  -b cookies.txt

# Change Password
curl -X PUT https://api.example.com/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "currentPassword": "oldPassword123",
    "newPassword": "newSecurePassword456"
  }'
```

---

## Support

For technical support or security concerns, please contact the development team or refer to the system administrator.

**Last Updated**: August 2025
**API Version**: 1.0