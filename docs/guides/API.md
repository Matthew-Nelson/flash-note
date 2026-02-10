# FlashNote API Documentation

## Base URL

- **Development:** `http://localhost:4000`
- **Production:** `https://api.flashnote.co`

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

---

## Endpoints

### Health Check

```
GET /health
```

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-20T12:00:00Z"
}
```

---

### Authentication

#### Register

```
POST /auth/register
```

**Request:**
```json
{
  "email": "therapist@clinic.com",
  "password": "SecurePass123",
  "acceptedLegalTerms": true,
  "inviteCode": "AB3K-M7RN"
}
```

> `inviteCode` is required when `REGISTRATION_MODE=invite`, ignored when `open`, rejected when `closed`.

**Response 201:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "therapist@clinic.com",
      "subscriptionStatus": "trialing",
      "trialEndsAt": "2025-02-03T12:00:00Z",
      "emailVerified": false,
      "organizationId": null
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "csrfToken": "...",
    "emailVerificationRequired": true
  }
}
```

**Errors:**
- `400` - Validation error (invalid email, weak password)
- `400 invite_code_required` - Invite code missing when `REGISTRATION_MODE=invite`
- `400 invalid_invite_code` - Code is expired, already used, revoked, or not found
- `403 registration_closed` - Registration is disabled (`REGISTRATION_MODE=closed`)
- `409` - Email already registered

#### Validate Invite Code

```
POST /auth/invite-codes/validate
```

Pre-check whether an invite code is valid before submitting registration. Only returns meaningful results when `REGISTRATION_MODE=invite`.

**Request:**
```json
{
  "code": "AB3K-M7RN"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": { "valid": true }
}
```

> Returns `{ "valid": false }` for invalid/expired/used codes or when `REGISTRATION_MODE` is not `invite`.

**Rate limit:** 10 requests per minute.

---

#### Login

```
POST /auth/login
```

**Request:**
```json
{
  "email": "therapist@clinic.com",
  "password": "SecurePass123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "therapist@clinic.com",
      "subscriptionStatus": "active",
      "emailVerified": true,
      "organizationId": null
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "csrfToken": "..."
  }
}
```

**Errors:**
- `401` - Invalid credentials
- `429` - Too many attempts

#### Refresh Token

```
POST /auth/refresh
```

**Request:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "therapist@clinic.com",
      "subscriptionStatus": "active",
      "emailVerified": true,
      "organizationId": null
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "csrfToken": "..."
  }
}
```

#### Logout

```
POST /auth/logout
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

#### Verify Email

```
POST /auth/verify-email
```

**Request:**
```json
{
  "token": "verification_token_from_email"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully"
  }
}
```

**Errors:**
- `400` - Invalid or expired token
- `429` - Too many attempts

#### Resend Verification Email

```
POST /auth/resend-verification
```

**Request:**
```json
{
  "email": "therapist@clinic.com"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "If an account exists with this email, a verification link has been sent."
  }
}
```

> **Note:** This endpoint always returns success to prevent email enumeration attacks.

**Errors:**
- `429` - Too many attempts

#### Request Password Reset

```
POST /auth/request-password-reset
```

**Request:**
```json
{
  "email": "therapist@clinic.com"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "If an account exists with this email, a password reset link has been sent."
  }
}
```

> **Note:** This endpoint always returns success to prevent email enumeration attacks.

**Errors:**
- `429` - Too many attempts

#### Validate Reset Token

```
GET /auth/validate-reset-token?token=reset_token
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "valid": true
  }
}
```

#### Reset Password

```
POST /auth/reset-password
```

**Request:**
```json
{
  "token": "reset_token_from_email",
  "password": "NewSecurePass123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Password reset successfully. Please log in with your new password."
  }
}
```

**Errors:**
- `400` - Invalid or expired token, or password doesn't meet requirements
- `429` - Too many attempts

---

### Organization

#### Join Organization

```
POST /organization/join
Authorization: Bearer <token>
X-CSRF-Token: <csrf_token>
```

Join an organization using a clinic invite code. The authenticated user must not already be a member of any organization. Seat availability is checked transactionally.

**Request:**
```json
{
  "inviteCode": "AB3K-M7RN"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "organizationId": "uuid",
    "organizationName": "Acme Physical Therapy"
  }
}
```

**Errors:**
- `400 invalid_invite_code` - Code is expired, already used, revoked, or not found
- `400 invalid_code_type` - Code is not a clinic invite code (e.g., beta code)
- `401` - Not authenticated
- `409 already_in_organization` - User is already a member of an organization
- `409 no_seats_available` - Clinic has reached max billable seats
- `429` - Too many attempts

**Rate limit:** 5 requests per 15 minutes.

---

### User

#### Get Current User

```
GET /user/me
Authorization: Bearer <token>
```

Returns the authenticated user's current profile data. This is a lightweight read-only endpoint that does **not** rotate tokens or create sessions, making it suitable for polling state changes (subscription status, email verification).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "therapist@clinic.com",
      "subscriptionStatus": "active",
      "trialEndsAt": "2025-02-03T12:00:00Z",
      "emailVerified": true,
      "organizationId": null
    }
  }
}
```

**Errors:**
- `401` - Not authenticated (missing or invalid token)
- `404` - User not found
- `429` - Rate limit exceeded

---

### Notes

#### Generate SOAP Note

```
POST /notes/generate
Authorization: Bearer <token>
```

**Request:**
```json
{
  "noteType": "daily_note",
  "patientContext": "John Smith, 52M, chronic LBP, visit 5/12",
  "quickNotes": "reports 40% pain reduction. flex ROM 50->65. MFR lumbar paraspinals. grade III mobs L4-5."
}
```

**Note Types:**
- `daily_note` - Standard daily treatment note
- `initial_eval` - Initial evaluation
- `progress_note` - Progress note (every 10 visits)
- `discharge` - Discharge summary

**Response 200:**
```json
{
  "success": true,
  "data": {
    "subjective": "Patient reports approximately 40% reduction...",
    "objective": "Lumbar AROM: Flexion improved from 50° to 65°...",
    "assessment": "Patient demonstrating good progress...",
    "plan": "Continue current plan of care...",
    "billing": {
      "codes": [
        { "code": "97110", "description": "Therapeutic exercises", "units": 2 }
      ],
      "totalUnits": 2,
      "notes": "Consider adding manual therapy code if MFR exceeded 8 minutes"
    },
    "goals": {
      "shortTerm": [
        { "goal": "Increase lumbar flexion to 70°", "status": "in_progress", "notes": "Currently at 65°" }
      ],
      "longTerm": [
        { "goal": "Return to full work duties", "status": "in_progress" }
      ]
    },
    "alerts": [
      "Consider progress note - approaching 10th visit"
    ],
    "metadata": {
      "generationTimeMs": 1234
    }
  }
}
```

> **Note:** The `billing`, `goals`, and `alerts` fields are optional and may not be present in all responses. The `metadata.model` and `metadata.tokensUsed` fields are intentionally excluded from client responses for security reasons.

**Errors:**
- `400` - Validation error
- `401` - Not authenticated
- `402` - Subscription required / trial expired
- `403` - Email not verified
- `429` - Rate limit exceeded

---

### Billing

#### Create Checkout Session

```
POST /billing/checkout
Authorization: Bearer <token>
```

**Request:**
```json
{
  "priceId": "price_xxx"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/..."
  }
}
```

#### Customer Portal

```
POST /billing/portal
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "portalUrl": "https://billing.stripe.com/..."
  }
}
```

---

## Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "error_code",
    "message": "Human readable message",
    "details": {}
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `missing_token` | 401 | No authorization header |
| `invalid_token` | 401 | Token expired or malformed |
| `invalid_credentials` | 401 | Wrong email or password |
| `user_not_found` | 404 | User doesn't exist |
| `email_exists` | 409 | Email already registered |
| `email_not_verified` | 403 | Email verification required |
| `validation_error` | 400 | Input validation failed |
| `trial_expired` | 402 | Free trial ended |
| `subscription_required` | 402 | Payment required |
| `clinic_subscription_expired` | 402 | Org subscription lapsed |
| `invalid_code_type` | 400 | Wrong invite code type for endpoint |
| `no_seats_available` | 409 | Clinic seat limit reached |
| `already_in_organization` | 409 | User already in an org |
| `no_organization` | 403 | No active org membership |
| `insufficient_permissions` | 403 | Org role insufficient |
| `too_many_attempts` | 429 | Rate limit on auth endpoints |
| `rate_limit_exceeded` | 429 | Too many requests |
| `ai_error` | 500 | LLM generation failed |
| `ai_rate_limited` | 429 | AI service rate limited |
| `ai_timeout` | 504 | Note generation timed out |
| `ai_unavailable` | 502 | AI service temporarily unavailable |
| `internal_error` | 500 | Unexpected server error |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /auth/login` | 5 requests | 15 minutes |
| `POST /auth/register` | 3 requests | 1 hour |
| `POST /auth/refresh` | 30 requests | 15 minutes |
| `POST /auth/verify-email` | 10 requests | 15 minutes |
| `POST /auth/resend-verification` | 3 requests | 1 hour |
| `POST /auth/request-password-reset` | 3 requests | 1 hour |
| `POST /auth/reset-password` | 5 requests | 15 minutes |
| `POST /auth/invite-codes/validate` | 10 requests | 1 minute |
| `POST /organization/join` | 5 requests | 15 minutes |
| `POST /notes/generate` | 30 requests | 1 minute |
| `GET /user/me` | 100 requests | 1 minute |
| All other endpoints | 100 requests | 1 minute |
