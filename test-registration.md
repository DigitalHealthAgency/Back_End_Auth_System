# Registration Requirements

## Password Requirements (SRS Compliance)
- **Minimum 12 characters** (changed from 8)
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 number (0-9)
- At least 1 special character (!@#$%^&*()_+-=[]{}|;:,.<>?)

### Example Valid Passwords:
- `MyP@ssw0rd123`
- `SecurePass123!`
- `Admin@2024Test`

## Phone Number Requirements
Must be a **Kenyan mobile number**:
- Format: `+254` or `0` followed by `7` or `1` and 8 more digits
- Examples:
  - `+254712345678` ✅
  - `0712345678` ✅
  - `+254112345678` ✅ (Safaricom)
  - `0112345678` ✅
  - `1234567890` ❌ (invalid - must start with +254 or 0)
  - `+254812345678` ❌ (invalid - 8 is not valid after country code)

## Individual Registration Example

```json
{
  "type": "individual",
  "username": "johndoe",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+254712345678",
  "password": "MyP@ssw0rd123",
  "receiveSystemAlerts": true
}
```

## Organization Registration Example

```json
{
  "type": "organization",
  "organizationName": "Example Hospital",
  "organizationType": "HOSPITAL",
  "county": "Nairobi",
  "subCounty": "Westlands",
  "organizationEmail": "info@examplehospital.co.ke",
  "organizationPhone": "+254712345678",
  "yearOfEstablishment": 2020,
  "password": "OrgP@ssw0rd123",
  "receiveSystemAlerts": true
}
```

## Valid Organization Types
- HOSPITAL
- CLINIC
- HEALTH_CENTER
- DISPENSARY
- LABORATORY
- PHARMACY
- DENTAL
- IMAGING
- SPECIALIST
- REHAB
- EMR (Electronic Medical Records)
- EHR (Electronic Health Records)
- LIS (Laboratory Information System)
- PIS (Pharmacy Information System)
- RIS (Radiology Information System)
- HMIS (Health Management Information System)
- TELEMED (Telemedicine)
- HEALTH_APP (Health Application)
- HIE (Health Information Exchange)
- INSURANCE (Health Insurance)
- PUBLIC_HEALTH (Public Health System)

## Common Registration Errors

### 400 Bad Request - Validation Errors
Check that:
1. Password is at least 12 characters with uppercase, lowercase, number, and special character
2. Phone number is in Kenyan format (+254... or 0...)
3. All required fields are provided
4. Email is valid format
5. Organization type is from the valid list above
6. Year of establishment is between 1900 and current year

### 409 Conflict
- Username, email, organization name, or organization email already exists

### 500 Internal Server Error
- Database connection issue or server error
