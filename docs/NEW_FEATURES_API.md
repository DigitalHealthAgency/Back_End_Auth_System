# DHA Authentication System - New Features API Documentation

## Overview

This document describes the newly implemented features for the Kenya Digital Health Agency (DHA) Authentication System:

1. **Enhanced User State Management** with state machine validation
2. **Team Management System** for multi-user organizational management
3. **Suspension Appeal Workflow** for users to appeal account suspensions

---

## Table of Contents

- [1. User State Management](#1-user-state-management)
- [2. Team Management API](#2-team-management-api)
- [3. Suspension Appeal API](#3-suspension-appeal-api)
- [4. State Transition Middleware](#4-state-transition-middleware)

---

## 1. User State Management

### Enhanced User States

The system now supports 17 distinct user states with strict transition validation:

#### Initial States
- `pending_verification` - Account created, awaiting email verification
- `pending_registration` - Registration started but not completed
- `pending_setup` - Account created, needs first-time password setup

#### Active States
- `active` - Fully operational account
- `role_update_pending` - Role change in progress

#### Workflow States (Organizations)
- `submitted` - Organization application submitted
- `under_review` - Under DHA review
- `clarification` - Needs clarification from user
- `approved` - Application approved
- `certified` - Fully certified

#### Disabled States
- `inactive` - Temporarily disabled (can be reactivated)
- `suspended` - Temporarily suspended by admin (can appeal)
- `terminated` - Account ended (can be reactivated by admin)
- `cancelled` - User-initiated cancellation (can be reactivated)
- `deactivated` - Permanently disabled (cannot be reactivated - **terminal state**)
- `rejected` - Application rejected (can reapply)

### State Transition Rules

State transitions are strictly validated using a state machine. Example valid transitions:

```
pending_verification → active, pending_setup, cancelled, terminated
active → role_update_pending, submitted, inactive, suspended, terminated, cancelled, deactivated
suspended → active (after appeal approval), terminated, deactivated
deactivated → NO TRANSITIONS (terminal state)
```

### Role-Based Transition Permissions

Certain state transitions require specific roles:

| Target State | Required Role(s) |
|-------------|------------------|
| `suspended` | `dha_system_administrator` |
| `terminated` | `dha_system_administrator` |
| `deactivated` | `dha_system_administrator` |
| `under_review` | `dha_certification_officer`, `dha_system_administrator` |
| `approved` | `dha_certification_officer`, `certification_committee_member` |
| `certified` | `certification_committee_member`, `dha_certification_officer` |
| `rejected` | `dha_certification_officer`, `dha_system_administrator` |

### API: Get Available State Transitions

**GET** `/api/users/:userId/available-transitions`

**Description:** Get valid state transitions for a user based on their current state and the requesting user's role.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "currentState": "active",
    "availableTransitions": ["role_update_pending", "submitted", "inactive", "suspended", "terminated"],
    "isTerminal": false,
    "canLogin": true
  }
}
```

---

## 2. Team Management API

### Overview

The Team Management system allows organizations to invite team members, assign internal roles, manage permissions, and maintain team hierarchy.

### Internal Roles

Organizations can assign these internal roles to team members:

- `technical_lead` - Technical documentation and API lead
- `compliance_officer` - Compliance and legal lead
- `project_manager` - Project management
- `developer` - General developer
- `tester` - QA/Testing
- `support` - Support staff
- `viewer` - Read-only access

### Hierarchy Levels

- `1` - Owner (highest authority)
- `2` - Admin (can manage members)
- `3` - Lead (team lead)
- `4` - Member (regular member)
- `5` - Viewer (read-only, lowest authority)

### Team Member Status

- `pending` - Invitation sent, not yet accepted
- `active` - Active team member
- `inactive` - Temporarily inactive
- `revoked` - Access revoked
- `left` - Member left voluntarily

---

### 2.1 Team Member Invitation

#### Invite Team Member

**POST** `/api/team/invite`

**Description:** Invite a new team member to the organization.

**Authentication:** Required (Organization with `MANAGE_TEAM_MEMBERS` permission)

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "internalRole": "technical_lead",
  "department": "Engineering",
  "title": "Senior Developer",
  "notes": "Lead developer for API integration"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Team member invited successfully",
  "data": {
    "teamMember": {
      "id": "60d0fe4f5311236168a109ca",
      "email": "john.doe@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "internalRole": "technical_lead",
      "status": "pending",
      "invitedAt": "2025-12-04T10:00:00.000Z",
      "expiresAt": "2025-12-11T10:00:00.000Z"
    }
  }
}
```

**Notes:**
- Invitation link is sent via email
- Invitation expires after 7 days
- If user doesn't exist, a new account is created with `pending_verification` status

---

#### Accept Team Invitation

**POST** `/api/team/accept/:token`

**Description:** Accept a team invitation using the invitation token.

**Authentication:** Not required (uses token)

**URL Parameters:**
- `token` (string) - Invitation token from email

**Response:**
```json
{
  "success": true,
  "message": "Invitation accepted successfully",
  "data": {
    "organizationName": "HealthTech Solutions",
    "internalRole": "technical_lead"
  }
}
```

---

### 2.2 Team Member Management

#### Get Team Members

**GET** `/api/team/members`

**Description:** Get all active team members in the organization.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "_id": "60d0fe4f5311236168a109ca",
        "userId": {
          "_id": "60d0fe4f5311236168a109cb",
          "firstName": "John",
          "lastName": "Doe",
          "email": "john.doe@example.com",
          "role": "vendor_developer"
        },
        "internalRole": "technical_lead",
        "hierarchyLevel": 3,
        "status": "active",
        "permissions": {
          "canCreateApplications": false,
          "canEditApplications": true,
          "canSubmitApplications": false,
          "canDeleteApplications": false,
          "canUploadDocuments": true,
          "canEditDocuments": true,
          "canDeleteDocuments": true,
          "canInviteMembers": false,
          "canRemoveMembers": false,
          "canAssignRoles": false,
          "canViewFinancials": false,
          "canManagePayments": false
        },
        "department": "Engineering",
        "title": "Senior Developer",
        "invitedAt": "2025-12-01T10:00:00.000Z",
        "acceptedAt": "2025-12-01T14:30:00.000Z"
      }
    ],
    "count": 1
  }
}
```

---

#### Get Pending Invitations

**GET** `/api/team/invitations/pending`

**Description:** Get all pending (not yet accepted) team invitations.

**Authentication:** Required (with `MANAGE_TEAM_MEMBERS` permission)

**Response:**
```json
{
  "success": true,
  "data": {
    "invitations": [
      {
        "_id": "60d0fe4f5311236168a109cc",
        "userId": {
          "firstName": "Jane",
          "lastName": "Smith",
          "email": "jane.smith@example.com"
        },
        "internalRole": "compliance_officer",
        "status": "pending",
        "invitedAt": "2025-12-03T15:00:00.000Z",
        "invitationExpiresAt": "2025-12-10T15:00:00.000Z",
        "invitedBy": {
          "firstName": "Admin",
          "lastName": "User"
        }
      }
    ],
    "count": 1
  }
}
```

---

#### Update Team Member Role

**PATCH** `/api/team/members/:memberId/role`

**Description:** Update a team member's internal role.

**Authentication:** Required (with `MANAGE_TEAM_MEMBERS` permission)

**URL Parameters:**
- `memberId` (string) - Team member ID

**Request Body:**
```json
{
  "internalRole": "project_manager"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Team member role updated successfully",
  "data": {
    "memberId": "60d0fe4f5311236168a109ca",
    "internalRole": "project_manager",
    "hierarchyLevel": 3,
    "permissions": {
      "canCreateApplications": true,
      "canEditApplications": true,
      "canSubmitApplications": true,
      "canDeleteApplications": false,
      "canUploadDocuments": true,
      "canEditDocuments": true,
      "canDeleteDocuments": false,
      "canInviteMembers": true,
      "canRemoveMembers": false,
      "canAssignRoles": false,
      "canViewFinancials": true,
      "canManagePayments": false
    }
  }
}
```

**Notes:**
- Permissions are automatically updated based on the new role
- Hierarchy level is also updated accordingly

---

#### Update Team Member Permissions

**PATCH** `/api/team/members/:memberId/permissions`

**Description:** Update specific permissions for a team member (fine-grained control).

**Authentication:** Required (with `MANAGE_TEAM_MEMBERS` permission)

**URL Parameters:**
- `memberId` (string) - Team member ID

**Request Body:**
```json
{
  "permissions": {
    "canDeleteDocuments": true,
    "canViewFinancials": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Team member permissions updated successfully",
  "data": {
    "memberId": "60d0fe4f5311236168a109ca",
    "permissions": {
      "canCreateApplications": true,
      "canEditApplications": true,
      "canSubmitApplications": true,
      "canDeleteApplications": false,
      "canUploadDocuments": true,
      "canEditDocuments": true,
      "canDeleteDocuments": true,
      "canInviteMembers": true,
      "canRemoveMembers": false,
      "canAssignRoles": false,
      "canViewFinancials": true,
      "canManagePayments": false
    }
  }
}
```

---

### 2.3 Team Member Revocation

#### Revoke Team Member Access

**POST** `/api/team/members/:memberId/revoke`

**Description:** Revoke a team member's access to the organization.

**Authentication:** Required (with `MANAGE_TEAM_MEMBERS` permission)

**URL Parameters:**
- `memberId` (string) - Team member ID

**Request Body:**
```json
{
  "reason": "Violation of company policies and unauthorized access to sensitive data"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Team member access revoked successfully",
  "data": {
    "memberId": "60d0fe4f5311236168a109ca",
    "status": "revoked",
    "revokedAt": "2025-12-04T10:00:00.000Z"
  }
}
```

**Notes:**
- Reason must be at least 10 characters
- Revoked member receives email notification
- Status changed to `revoked`, member can no longer access organization resources

---

#### Remove Team Member

**DELETE** `/api/team/members/:memberId`

**Description:** Permanently remove a team member from the organization (hard delete).

**Authentication:** Required (with `MANAGE_TEAM_MEMBERS` permission)

**URL Parameters:**
- `memberId` (string) - Team member ID

**Response:**
```json
{
  "success": true,
  "message": "Team member removed successfully"
}
```

---

### 2.4 Team Hierarchy

#### Get Team Hierarchy

**GET** `/api/team/hierarchy`

**Description:** Get team members grouped by hierarchy level.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "hierarchy": {
      "owner": [],
      "admin": [],
      "lead": [
        {
          "id": "60d0fe4f5311236168a109ca",
          "user": {
            "_id": "60d0fe4f5311236168a109cb",
            "firstName": "John",
            "lastName": "Doe",
            "email": "john.doe@example.com"
          },
          "internalRole": "technical_lead",
          "department": "Engineering",
          "title": "Senior Developer"
        }
      ],
      "member": [],
      "viewer": []
    }
  }
}
```

---

#### Get Team Member Details

**GET** `/api/team/members/:memberId`

**Description:** Get detailed information about a specific team member.

**Authentication:** Required

**URL Parameters:**
- `memberId` (string) - Team member ID

**Response:**
```json
{
  "success": true,
  "data": {
    "member": {
      "_id": "60d0fe4f5311236168a109ca",
      "userId": {
        "_id": "60d0fe4f5311236168a109cb",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com",
        "phone": "+254712345678",
        "role": "vendor_developer",
        "accountStatus": "active"
      },
      "internalRole": "technical_lead",
      "hierarchyLevel": 3,
      "status": "active",
      "permissions": { ... },
      "invitedBy": {
        "firstName": "Admin",
        "lastName": "User"
      },
      "invitedAt": "2025-12-01T10:00:00.000Z",
      "acceptedAt": "2025-12-01T14:30:00.000Z",
      "department": "Engineering",
      "title": "Senior Developer",
      "notes": "Lead developer for API integration",
      "lastActivityAt": "2025-12-04T09:30:00.000Z"
    }
  }
}
```

---

## 3. Suspension Appeal API

### Overview

The Suspension Appeal system allows users to appeal account suspensions. Admins can review and approve/reject appeals.

### Appeal Status

- `pending` - Appeal submitted, awaiting review
- `under_review` - Being reviewed by admin
- `approved` - Appeal approved, suspension lifted
- `rejected` - Appeal rejected, suspension remains
- `withdrawn` - User withdrew appeal

### Appeal Priority

- `low` - Low priority
- `medium` - Medium priority (default)
- `high` - High priority
- `urgent` - Urgent priority

---

### 3.1 Submit Appeal

**POST** `/api/appeals/submit`

**Description:** Submit a suspension appeal.

**Authentication:** Required (suspended user)

**Request Body:**
```json
{
  "appealReason": "I believe my account was suspended due to a misunderstanding. I was not involved in any unauthorized activities. I have always followed the system guidelines and would like to request a review of my case. I can provide additional documentation if needed.",
  "supportingDocuments": [
    {
      "filename": "evidence.pdf",
      "url": "https://cloudinary.com/uploads/evidence.pdf",
      "uploadedAt": "2025-12-04T09:00:00.000Z"
    }
  ]
}
```

**Validation:**
- `appealReason` must be 50-2000 characters
- Only users with `suspended` status can submit appeals
- Users cannot submit multiple pending appeals

**Response:**
```json
{
  "success": true,
  "message": "Appeal submitted successfully",
  "data": {
    "appealId": "60d0fe4f5311236168a109cd",
    "status": "pending",
    "submittedAt": "2025-12-04T10:00:00.000Z"
  }
}
```

**Notes:**
- User receives confirmation email
- Admins receive notification email

---

### 3.2 View Appeals

#### Get My Appeals

**GET** `/api/appeals/my-appeals`

**Description:** Get all appeals submitted by the authenticated user.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "appeals": [
      {
        "_id": "60d0fe4f5311236168a109cd",
        "suspensionReason": "Multiple failed login attempts",
        "suspendedAt": "2025-12-03T10:00:00.000Z",
        "suspendedBy": {
          "_id": "60d0fe4f5311236168a109ce",
          "firstName": "Admin",
          "lastName": "User"
        },
        "appealReason": "I believe my account was suspended due to...",
        "supportingDocuments": [],
        "status": "pending",
        "priority": "medium",
        "createdAt": "2025-12-04T10:00:00.000Z",
        "daysSinceAppeal": 0
      }
    ],
    "count": 1
  }
}
```

---

#### Get Pending Appeals (Admin Only)

**GET** `/api/appeals/pending`

**Description:** Get all pending appeals for admin review.

**Authentication:** Required (`dha_system_administrator` role)

**Response:**
```json
{
  "success": true,
  "data": {
    "appeals": [
      {
        "_id": "60d0fe4f5311236168a109cd",
        "userId": {
          "_id": "60d0fe4f5311236168a109cf",
          "firstName": "John",
          "lastName": "Doe",
          "email": "john.doe@example.com",
          "organizationName": null
        },
        "suspensionReason": "Multiple failed login attempts",
        "suspendedAt": "2025-12-03T10:00:00.000Z",
        "suspendedBy": {
          "firstName": "Admin",
          "lastName": "User"
        },
        "appealReason": "I believe my account was suspended due to...",
        "status": "pending",
        "priority": "medium",
        "createdAt": "2025-12-04T10:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

---

#### Get Appeal Statistics (Admin Only)

**GET** `/api/appeals/statistics`

**Description:** Get statistics on all appeals.

**Authentication:** Required (`dha_system_administrator` role)

**Response:**
```json
{
  "success": true,
  "data": {
    "statistics": {
      "total": 25,
      "pending": 5,
      "under_review": 3,
      "approved": 10,
      "rejected": 6,
      "withdrawn": 1
    }
  }
}
```

---

#### Get Appeal Details

**GET** `/api/appeals/:appealId`

**Description:** Get detailed information about a specific appeal.

**Authentication:** Required (user can view own appeals, admin can view all)

**URL Parameters:**
- `appealId` (string) - Appeal ID

**Response:**
```json
{
  "success": true,
  "data": {
    "appeal": {
      "_id": "60d0fe4f5311236168a109cd",
      "userId": { ... },
      "suspensionReason": "Multiple failed login attempts",
      "suspendedAt": "2025-12-03T10:00:00.000Z",
      "suspendedBy": { ... },
      "appealReason": "I believe my account was suspended due to...",
      "supportingDocuments": [],
      "status": "under_review",
      "reviewedBy": {
        "_id": "60d0fe4f5311236168a109ce",
        "firstName": "Admin",
        "lastName": "User"
      },
      "reviewedAt": "2025-12-04T11:00:00.000Z",
      "reviewNotes": "Under review by admin team",
      "priority": "medium",
      "communications": [
        {
          "from": {
            "_id": "60d0fe4f5311236168a109ce",
            "firstName": "Admin",
            "lastName": "User"
          },
          "message": "We are reviewing your appeal. Please provide more details.",
          "sentAt": "2025-12-04T11:30:00.000Z",
          "isInternal": false
        }
      ],
      "createdAt": "2025-12-04T10:00:00.000Z",
      "updatedAt": "2025-12-04T11:30:00.000Z"
    }
  }
}
```

**Notes:**
- Internal notes are hidden from non-admin users
- Internal communications are hidden from non-admin users

---

### 3.3 Review Appeals (Admin Only)

#### Start Review

**POST** `/api/appeals/:appealId/review/start`

**Description:** Start reviewing an appeal (changes status to `under_review`).

**Authentication:** Required (`dha_system_administrator` role)

**URL Parameters:**
- `appealId` (string) - Appeal ID

**Response:**
```json
{
  "success": true,
  "message": "Appeal review started",
  "data": {
    "appealId": "60d0fe4f5311236168a109cd",
    "status": "under_review",
    "reviewedBy": "60d0fe4f5311236168a109ce",
    "reviewedAt": "2025-12-04T11:00:00.000Z"
  }
}
```

---

#### Approve Appeal

**POST** `/api/appeals/:appealId/approve`

**Description:** Approve an appeal and lift suspension.

**Authentication:** Required (`dha_system_administrator` role)

**URL Parameters:**
- `appealId` (string) - Appeal ID

**Request Body:**
```json
{
  "decision": "After careful review, we have determined that the suspension was issued in error. Your account has been reactivated and all restrictions have been lifted."
}
```

**Validation:**
- `decision` must be at least 20 characters

**Response:**
```json
{
  "success": true,
  "message": "Appeal approved and suspension lifted",
  "data": {
    "appealId": "60d0fe4f5311236168a109cd",
    "status": "approved",
    "resolvedAt": "2025-12-04T12:00:00.000Z"
  }
}
```

**Side Effects:**
- User's `accountStatus` changed to `active`
- `suspended`, `suspensionReason`, `suspendedAt`, `suspendedBy` fields cleared
- User receives approval email notification

---

#### Reject Appeal

**POST** `/api/appeals/:appealId/reject`

**Description:** Reject an appeal (suspension remains).

**Authentication:** Required (`dha_system_administrator` role)

**URL Parameters:**
- `appealId` (string) - Appeal ID

**Request Body:**
```json
{
  "decision": "After reviewing your appeal and the circumstances surrounding your suspension, we have determined that the suspension was warranted. The suspension will remain in effect."
}
```

**Validation:**
- `decision` must be at least 20 characters

**Response:**
```json
{
  "success": true,
  "message": "Appeal rejected",
  "data": {
    "appealId": "60d0fe4f5311236168a109cd",
    "status": "rejected",
    "resolvedAt": "2025-12-04T12:00:00.000Z"
  }
}
```

**Side Effects:**
- User receives rejection email notification
- Suspension remains in place

---

### 3.4 Appeal Management

#### Withdraw Appeal

**POST** `/api/appeals/:appealId/withdraw`

**Description:** Withdraw an appeal (user action).

**Authentication:** Required (appeal owner)

**URL Parameters:**
- `appealId` (string) - Appeal ID

**Response:**
```json
{
  "success": true,
  "message": "Appeal withdrawn successfully",
  "data": {
    "appealId": "60d0fe4f5311236168a109cd",
    "status": "withdrawn"
  }
}
```

**Notes:**
- Only pending appeals can be withdrawn

---

#### Add Internal Note (Admin Only)

**POST** `/api/appeals/:appealId/notes`

**Description:** Add an internal note to an appeal (not visible to user).

**Authentication:** Required (`dha_system_administrator` role)

**URL Parameters:**
- `appealId` (string) - Appeal ID

**Request Body:**
```json
{
  "note": "User has a history of security violations. Recommend rejection."
}
```

**Validation:**
- `note` must be at least 10 characters

**Response:**
```json
{
  "success": true,
  "message": "Internal note added successfully"
}
```

---

#### Add Communication

**POST** `/api/appeals/:appealId/communicate`

**Description:** Add a message/communication to an appeal.

**Authentication:** Required (appeal owner or admin)

**URL Parameters:**
- `appealId` (string) - Appeal ID

**Request Body:**
```json
{
  "message": "Thank you for reviewing my appeal. I would like to provide additional information...",
  "isInternal": false
}
```

**Validation:**
- `message` must be at least 10 characters
- Only admins can set `isInternal: true`

**Response:**
```json
{
  "success": true,
  "message": "Communication added successfully"
}
```

**Notes:**
- If `isInternal: false`, recipient receives email notification
- Internal communications are hidden from non-admin users

---

## 4. State Transition Middleware

### Validate State Change

**Middleware:** `validateStateChange`

**Usage:** Apply to routes that update `accountStatus`

**Description:** Validates state transitions before they are applied. Checks:
- If transition is valid according to state machine
- If user has required role for the transition

**Example:**
```javascript
router.patch(
  '/users/:userId/status',
  protect,
  validateStateChange,
  canSuspendAccounts,
  updateUserStatus
);
```

**Error Response (Invalid Transition):**
```json
{
  "success": false,
  "message": "Invalid state transition",
  "details": {
    "currentState": "active",
    "attemptedState": "certified",
    "reason": "Invalid transition from 'active' to 'certified'. Allowed transitions: role_update_pending, submitted, inactive, suspended, terminated, cancelled, deactivated",
    "allowedStates": ["role_update_pending", "submitted", "inactive", "suspended", "terminated", "cancelled", "deactivated"]
  }
}
```

---

### Enforce Login Status

**Middleware:** `enforceLoginStatus`

**Usage:** Apply to protected routes to check if user's state allows login

**Description:** Prevents login for users in disabled states

**Allowed Login States:**
- `active`
- `role_update_pending`
- `submitted`
- `under_review`
- `clarification`
- `approved`
- `certified`

**Error Response:**
```json
{
  "success": false,
  "message": "Account cannot login in current state: suspended",
  "accountStatus": "suspended",
  "details": {
    "suspended": true,
    "terminated": false,
    "deactivated": false,
    "needsVerification": false,
    "needsSetup": false
  }
}
```

---

### Prevent Terminal State Modification

**Middleware:** `preventTerminalStateModification`

**Usage:** Apply to routes that modify user accounts

**Description:** Prevents any modifications to accounts in terminal state (`deactivated`)

**Error Response:**
```json
{
  "success": false,
  "message": "Cannot modify account in terminal state",
  "accountStatus": "deactivated",
  "details": {
    "reason": "Account is permanently deactivated and cannot be modified"
  }
}
```

---

## Error Codes

### Team Management Errors

| Code | Message | Status |
|------|---------|--------|
| `VAL-001` | Invalid internal role | 400 |
| `VAL-002` | User is already a team member | 400 |
| `NOT_FOUND` | Team member not found | 404 |
| `FORBIDDEN` | Access denied | 403 |
| `SOD-001` | Separation of duties violation | 403 |

### Suspension Appeal Errors

| Code | Message | Status |
|------|---------|--------|
| `VAL-001` | Appeal reason too short (< 50 chars) | 400 |
| `VAL-002` | Appeal reason too long (> 2000 chars) | 400 |
| `VAL-003` | Only suspended accounts can submit appeals | 400 |
| `VAL-004` | User already has a pending appeal | 400 |
| `VAL-005` | Decision explanation required (min 20 chars) | 400 |
| `NOT_FOUND` | Appeal not found | 404 |
| `FORBIDDEN` | Access denied | 403 |

### State Transition Errors

| Code | Message | Status |
|------|---------|--------|
| `STATE-001` | Invalid state transition | 400 |
| `STATE-002` | Insufficient permissions for transition | 403 |
| `STATE-003` | Cannot modify terminal state | 403 |
| `STATE-004` | Account cannot login in current state | 403 |

---

## Email Notifications

The system sends email notifications for the following events:

### Team Management
- Team invitation sent
- Access revoked

### Suspension Appeals
- Appeal received (user confirmation)
- New appeal submitted (admin notification)
- Appeal approved
- Appeal rejected
- New message on appeal

---

## Environment Variables

Add these to your `.env` file for email functionality:

```env
# SMTP Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
SMTP_FROM=DHA System <noreply@dha.go.ke>

# Frontend URL (for invitation links)
FRONTEND_URL=http://localhost:5173
```

---

## Implementation Checklist

### Backend
- [x] User model updated with new states
- [x] State machine validation implemented
- [x] TeamMember model created
- [x] SuspensionAppeal model created
- [x] Team management controller implemented
- [x] Suspension appeal controller implemented
- [x] Routes registered in app.js
- [x] Email service utility created
- [x] State transition middleware implemented

### Frontend
- [x] TypeScript types for team management
- [x] TypeScript types for suspension appeals
- [x] TypeScript types for user states
- [ ] UI components for team management
- [ ] UI components for suspension appeals
- [ ] UI components for state visualization

### Testing
- [ ] Unit tests for state machine
- [ ] Integration tests for team management API
- [ ] Integration tests for suspension appeal API
- [ ] E2E tests for workflows

---

## Support

For questions or issues, contact:
- Email: support@dha.go.ke
- Documentation: https://docs.dha.go.ke

---

**Document Version:** 1.0.0
**Last Updated:** December 4, 2025
**Author:** Claude Code (AI Assistant)
