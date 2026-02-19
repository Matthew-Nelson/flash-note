# API Response Validation (H-5, H-6)

## Problem

CLAUDE.md Rule 3 requires runtime validation of all external data with Zod. Two HIGH audit findings (from `docs/compliance/CONSOLIDATED_AUDIT_2026_02.md`) identify violations:

- **H-5**: `extension/src/shared/api.ts:109,152` and `web/src/lib/api.ts:169` cast API responses with `as ApiResponse<T>` — no runtime validation. A malformed backend response (or a MITM/proxy injection) would be silently accepted and used.
- **H-6**: `extension/src/shared/storage.ts:28` and `web/src/lib/storage.ts:27-32` cast `chrome.storage` / `sessionStorage` reads without schema validation. Corrupted or tampered storage data is trusted as-is.

## Scope

Extension and web API clients + storage layers. Backend is not affected (it validates inbound requests with Zod already).

## Existing Schemas

`extension/src/shared/schemas.ts` already exports Zod schemas for:
- `AuthResponse` (user, tokens)
- `GeneratedNote` (SOAP sections + metadata)
- `GenerateNoteInput` (form validation)

These can be reused for API response validation. Storage types (`StoredAuth`, `StoredPreferences`) need new schemas.

## Approach

### API Responses (H-5)

Add a generic `parseResponse<T>` helper that wraps `response.json()` + Zod parse:

```typescript
private async parseResponse<T>(response: Response, schema: z.ZodType<T>): Promise<ApiResponse<T>> {
  const json: unknown = await response.json();
  return apiResponseSchema(schema).parse(json);
}
```

Where `apiResponseSchema(dataSchema)` validates the envelope (`success`, `error.code`, `error.message`) and the inner `data` field.

Apply to:
- `ApiClient.request()` — replace `as ApiResponse<T>` cast
- `ApiClient.refreshToken()` — replace `as ApiResponse<AuthResponse>` cast
- `ApiClient.refreshUser()` — replace `as ApiResponse<AuthResponse>` cast

Callers (`login`, `register`, `generateNote`, etc.) must pass their expected response schema. This changes the method signatures.

### Storage Reads (H-6)

Add Zod schemas for `StoredAuth` and `StoredPreferences`. Validate on read in `storage.getAuth()` and `storage.getPreferences()`. On validation failure: clear the corrupted storage entry and return null/defaults (fail safe, don't crash).

### Error Handling

Validation failures should:
1. Log to Sentry with `source: 'api_client'` / `source: 'extension_storage'`
2. Return a user-friendly error (not the Zod error details)
3. For storage: clear the bad data and force re-auth

## PR Strategy

Ship H-5 and H-6 together in one PR — they share the same Zod infrastructure and the storage validation is small. Separate from the PR-5 extension security work (already 10 items).
