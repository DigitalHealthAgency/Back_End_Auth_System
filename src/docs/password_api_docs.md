# Password Reset API Documentation

## Overview

This API provides secure password reset functionality with multiple authentication methods including email verification codes and recovery keys. All endpoints support dual email fields (standard email and organization email) for user identification.

## Base URL
```
/api/password
```

## Rate Limiting
- **Forgot Password**: Rate limited to prevent abuse
- **Other endpoints**: Standard rate limiting applies

---

## Endpoints

### 1. Request Password Reset

**Endpoint:** `POST /forgot-password`

**Description:** Initiates the password reset process by sending a verification code to the user's email address.

#### Request Body
```json
{
  "email": "user@example.com"
}
```

#### Parameters
| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| email     | string | Yes      | User's email address (supports both regular email and organization email) |

#### Success Response
**Status Code:** `200 OK`
```json
{
  "message": "Reset code sent to email"
}
```

#### Error Responses
**Status Code:** `404 Not Found`
```json
{
  "message": "User not found"
}
```

**Status Code:** `429 Too Many Requests`
```json
{
  "message": "Too many requests, please try again later"
}
```

**Status Code:** `500 Internal Server Error`
```json
{
  "message": "Something went wrong"
}
```

#### Features
- Generates a 6-digit verification code
- Code expires after 10 minutes
- Supports lookup by both email and organizationEmail fields
- Logs password reset requests for security auditing
- Sends formatted HTML email with reset code

---

### 2. Verify Reset Code

**Endpoint:** `POST /verify-code`

**Description:** Verifies the password reset code and logs the user in if valid.

#### Request Body
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

#### Parameters
| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| email     | string | Yes      | User's email address |
| code      | string | Yes      | 6-digit verification code received via email |

#### Success Response
**Status Code:** `200 OK`
```json
{
  "message": "Code verified",
  "user": {
    "_id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    // ... other user fields
  },
  "token": "jwt_token_string"
}
```

#### Response Headers
```
Set-Cookie: token=jwt_token_string; HttpOnly; Secure
```

#### Error Responses
**Status Code:** `400 Bad Request`
```json
{
  "message": "Invalid or expired code"
}
```

**Status Code:** `400 Bad Request`
```json
{
  "message": "Code expired"
}
```

**Status Code:** `404 Not Found`
```json
{
  "message": "User not found"
}
```

**Status Code:** `500 Internal Server Error`
```json
{
  "message": "Verification failed"
}
```

#### Features
- Automatically deletes used verification codes
- Creates new user session with unique session ID
- Maintains up to 5 active sessions per user
- Sets secure HTTP-only cookie with JWT token
- Tracks device and IP information

---

### 3. Recovery Key Login

**Endpoint:** `POST /recovery-login`

**Description:** Allows users to log in using their recovery key as an alternative authentication method.

#### Request Body
```json
{
  "email": "user@example.com",
  "recoveryKey": "recovery-key-string"
}
```

#### Parameters
| Parameter   | Type   | Required | Description |
|-------------|--------|----------|-------------|
| email       | string | Yes      | User's email address |
| recoveryKey | string | Yes      | User's recovery key |

#### Success Response
**Status Code:** `200 OK`
```json
{
  "message": "Logged in with recovery key",
  "user": {
    "_id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    // ... other user fields
  },
  "token": "jwt_token_string"
}
```

#### Response Headers
```
Set-Cookie: token=jwt_token_string; HttpOnly; Secure
```

#### Error Responses
**Status Code:** `404 Not Found`
```json
{
  "message": "User or recovery key not found"
}
```

**Status Code:** `401 Unauthorized`
```json
{
  "message": "Invalid recovery key"
}
```

**Status Code:** `500 Internal Server Error`
```json
{
  "message": "Recovery login failed"
}
```

#### Features
- Validates recovery key using bcrypt comparison
- Creates new user session with unique session ID
- Maintains up to 5 active sessions per user
- Sets secure HTTP-only cookie with JWT token
- Logs recovery login attempts for security auditing

---

## Authentication & Security

### JWT Token Structure
The API returns JWT tokens containing:
- User ID
- Session ID
- Token version for invalidation
- IP address
- Device information
- Two-factor authentication status

### Security Features
- **Rate Limiting**: Prevents brute force attacks on password reset requests
- **Code Expiration**: Reset codes expire after 10 minutes
- **Session Management**: Automatic cleanup of old sessions (max 5 per user)
- **Activity Logging**: All password reset activities are logged
- **Secure Cookies**: HTTP-only, secure cookies in production
- **Recovery Key Hashing**: Recovery keys are stored as bcrypt hashes

### Cookie Configuration
```javascript
{
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production'
}
```

---

## Error Handling

All endpoints follow consistent error response patterns:

- **4xx Client Errors**: Invalid input, authentication failures
- **5xx Server Errors**: Internal server issues
- **Validation Errors**: Handled by middleware before reaching controllers

## Data Models

### User Lookup
Users can be found using either:
- `email` field (standard user email)
- `organizationEmail` field (organization-specific email)

### Session Management
Each successful authentication creates a session object:
```javascript
{
  sessionId: "uuid-string",
  ip: "client-ip-address",
  device: "user-agent-string",
  createdAt: "timestamp"
}
```

## Dependencies

- **bcryptjs**: Password and recovery key hashing
- **Express**: Web framework
- **Mongoose**: MongoDB ODM
- **JWT**: Token generation and validation
- **Rate limiting middleware**: Request throttling
- **Validation middleware**: Input validation

## Environment Variables

- `NODE_ENV`: Determines cookie security settings
- Database connection settings
- Email service configuration
- JWT secret keys