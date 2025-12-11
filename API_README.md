# Kenya DHA Authentication Service - API Documentation

## 📚 Documentation Files

This authentication service comes with comprehensive API documentation:

### 1. **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** (96 KB, 4,493 lines)
**The Complete Reference** - Full, detailed API documentation covering every endpoint with:
- Request/response examples
- Authentication requirements
- Validation rules
- Error codes and handling
- Security features
- Role-based access control
- Middleware documentation
- Integration examples

### 2. **[API_DOCUMENTATION_SUMMARY.md](./API_DOCUMENTATION_SUMMARY.md)** (8 KB)
**Quick Start Guide** - Condensed reference with:
- Quick stats and overview
- Getting started steps
- Endpoint categories
- Security features summary
- Common error codes
- Example requests

### 3. **[API_ENDPOINTS_LIST.md](./API_ENDPOINTS_LIST.md)** (12 KB)
**Endpoint Reference** - Complete list of all 94 endpoints organized by:
- Authentication type (Public, Protected, Admin, Internal)
- Category (Auth, Password, 2FA, Roles, Admin, etc.)
- HTTP methods
- Endpoint counts and statistics

---

## 🚀 Quick Start

### 1. Registration
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@example.com",
    "password": "SecurePass123!@#",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+254712345678",
    "accountType": "individual",
    "county": "Nairobi",
    "captchaText": "ABCD123",
    "captchaId": "captcha-uuid"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "developer@example.com",
    "password": "SecurePass123!@#"
  }'
```

### 3. Access Protected Endpoints
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📊 API Statistics

| Metric | Count |
|--------|-------|
| **Total Endpoints** | 94 |
| Public Endpoints | 12 |
| Protected Endpoints | 25 |
| Admin-Only Endpoints | 46 |
| Internal Service Endpoints | 11 |
| **System Roles** | 9 |
| **Permissions** | 30+ |
| **Documentation Lines** | 4,493 |

---

## 🔐 Security Features

- ✅ **JWT Authentication** with token versioning
- ✅ **Two-Factor Authentication (2FA)** using TOTP
- ✅ **Password Security** - 12+ chars, 90-day expiry, history tracking
- ✅ **Account Lockout** - 5 failed attempts, 30-minute lockout
- ✅ **IP Security** - VPN detection, automatic blocking
- ✅ **Rate Limiting** - Protection against brute force
- ✅ **Session Management** - Multi-device, remote termination
- ✅ **Audit Logging** - Comprehensive activity tracking
- ✅ **RBAC** - 9 roles with granular permissions
- ✅ **CAPTCHA** - Protection for registration

---

## 👥 System Roles

| Role | Portal | Description |
|------|--------|-------------|
| `vendor_developer` | `/vendor-portal` | Software vendors submitting applications |
| `vendor_technical_lead` | `/vendor-portal` | Technical leads overseeing submissions |
| `vendor_compliance_officer` | `/vendor-portal` | Compliance officers |
| `dha_system_administrator` | `/admin-portal` | Full system administrators |
| `dha_certification_officer` | `/certification-portal` | Certification reviewers |
| `testing_lab_staff` | `/lab-portal` | Testing lab personnel |
| `certification_committee_member` | `/committee-portal` | Committee members |
| `county_health_officer` | `/county-portal` | County health officers |
| `public_user` | `/dashboard` | Public users |

---

## 📦 Endpoint Categories

### Authentication (16 endpoints)
Register, login, logout, profile management, password changes, session management

### Password Management (4 endpoints)
Forgot password, reset password, verify codes, recovery login

### Two-Factor Authentication (3 endpoints)
Generate 2FA, verify codes, disable 2FA

### Role Management (6 endpoints)
Get roles, assign roles, statistics, bulk operations

### Admin User Management (7 endpoints)
User CRUD, status updates, exports

### Security Administration (12 endpoints)
Security stats, failed logins, session management, IP blocking, audit logs

### Dashboard (8 endpoints)
Metrics, user activity, permission matrix

### Team Management (10 endpoints)
Invitations, member management, role assignments

### Suspension Appeals (11 endpoints)
Submit appeals, review process, admin decisions

### Internal Services (11 endpoints)
Service-to-service communication, user lookups, status updates

---

## 🔗 Related Documentation

- **[src/docs/AUTH_SERVICE_API_DOCUMENTATIONn.md](./src/docs/AUTH_SERVICE_API_DOCUMENTATIONn.md)** - Original documentation
- **[tests/README.md](./tests/README.md)** - Testing documentation
- **[DOCKER_README.md](./DOCKER_README.md)** - Docker deployment guide
- **[docs/cron-system.md](./docs/cron-system.md)** - Cron job documentation

---

## 🛠️ Technology Stack

- **Runtime:** Node.js / Express
- **Database:** MongoDB with Mongoose
- **Authentication:** JWT (jsonwebtoken)
- **Password Hashing:** bcrypt (12 salt rounds)
- **2FA:** speakeasy (TOTP)
- **Security:** Helmet, express-rate-limit
- **Validation:** Joi
- **Email:** Nodemailer
- **File Upload:** Multer
- **PDF Generation:** PDFKit

---

## 🌍 Environment Variables

Key environment variables required:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/dha_auth

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRE=24h

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password

# Security
CAPTCHA_SECRET=your-captcha-secret
ALLOWED_ORIGINS=http://localhost:3000

# Internal Services
INTERNAL_SERVICE_KEY=your-internal-key
```

---

## 📞 Support & Resources

- **Email Support:** api-support@dha.go.ke
- **Developer Portal:** https://developer.dha.go.ke
- **Documentation:** https://docs.dha.go.ke
- **GitHub Issues:** Report bugs and request features

---

## 📝 API Versioning

- **Current Version:** v1
- **Base Path:** `/api`
- **Documentation Version:** 1.0
- **Last Updated:** December 11, 2025

---

## 🧪 Testing the API

### Using cURL
See examples in [API_DOCUMENTATION.md](./API_DOCUMENTATION.md#example-integration)

### Using Postman
Import the endpoints from [API_ENDPOINTS_LIST.md](./API_ENDPOINTS_LIST.md)

### Running Tests
```bash
npm test                  # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run test:security    # Security tests
```

---

## 📄 License

This API is part of the Kenya Digital Health Authority (DHA) system and is subject to DHA licensing terms.

---

## 🔄 Updates & Changelog

**Version 1.0 (December 11, 2025)**
- Initial comprehensive API documentation
- 94 documented endpoints
- Complete security features documentation
- Full RBAC documentation
- Integration examples and guides

---

**For detailed information, please refer to [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**
