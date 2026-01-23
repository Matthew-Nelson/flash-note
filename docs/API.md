# FlashNote API Documentation

## Base URL

- **Development:** `http://localhost:4000`
- **Production:** `https://api.flashnote.com`

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
  "password": "SecurePass123"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "therapist@clinic.com",
      "subscriptionStatus": "trialing",
      "trialEndsAt": "2025-02-03T12:00:00Z"
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**Errors:**
- `400` - Validation error (invalid email, weak password)
- `409` - Email already registered

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
      "subscriptionStatus": "active"
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
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
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
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
    "metadata": {
      "model": "gemini-2.0-flash",
      "tokensUsed": 847,
      "generationTimeMs": 1234
    }
  }
}
```

**Errors:**
- `400` - Validation error
- `401` - Not authenticated
- `402` - Subscription required / trial expired
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
| `validation_error` | 400 | Input validation failed |
| `trial_expired` | 402 | Free trial ended |
| `subscription_required` | 402 | Payment required |
| `rate_limit_exceeded` | 429 | Too many requests |
| `ai_error` | 500 | LLM generation failed |
| `internal_error` | 500 | Unexpected server error |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /auth/login` | 5 requests | 15 minutes |
| `POST /auth/register` | 3 requests | 1 hour |
| `POST /notes/generate` | 30 requests | 1 minute |
| All other endpoints | 100 requests | 1 minute |
