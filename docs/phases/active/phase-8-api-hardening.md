# Phase 8 — API Hardening

> ⚠️ Do not proceed until Phase 7 is fully completed and validated.
> ⚠️ Response format changes are breaking. Coordinate with frontend before applying.
> ⚠️ Global error handler change requires structured logging to be in place simultaneously.

---

## Purpose

Standardize error responses, tighten input handling, and make the API contract predictable and explicit for all consumers.

After this phase, every endpoint returns the same envelope, every error uses the correct HTTP status code, and the API is hardened against malformed input and brute-force attacks.

---

## Status: Completed — 2026-04-17 (8.4 deferred to Phase 9)

---

## Issues Identified (Diagnosis 2026-04-16)

| ID  | Severity | Description |
|-----|----------|-------------|
| H1  | High | HTTP status codes don't match the playbook: `OrderLockedError` → 403 (should be 409), `InvalidTransitionError` → 400 (should be 409), `PaymentRequiredError` → 400 (should be 422), `BusinessRuleViolationError` → 400 (should be 422) |
| M4  | Medium | API response format deviates from standard: `GET /api/orders` returns bare array, not `{ success, data, total }` |

Note: `OrderLockedError` status code fix (403 → 409) is partially addressed in Phase 6 task 6.9. Phase 8 completes the remaining HTTP status code corrections.

---

## Tasks

### 8.1 — Consistent Error Response Format

Audit all routes for consistent `{ error: "..." }` format.

Any route returning:
- A plain string body
- An object without the `error` key
- An HTML error page (Express default 500)

...must be corrected to return `{ error: "Human-readable message" }`.

Check every route file: `orders.js`, `track.js`, `auth.js`, `admin.js`, `customers.js`, `orderItems.js`, `services.js`, `technicians.js`, `inventory.js`.

### 8.2 — Global Error Handler

Add a global Express error handler in `server/app.js` as the last middleware:

```js
app.use((err, req, res, next) => {
  const status = errorToHttpStatus(err);
  const message = process.env.NODE_ENV === 'production'
    ? (status >= 500 ? 'خطأ في الخادم' : err.message)
    : err.message;
  res.status(status).json({ error: message });
});
```

This catches any `next(err)` call and any unhandled thrown error.
**No stack traces in production.** `NODE_ENV === 'production'` must suppress stack trace from response.

### 8.3 — HTTP Status Code Corrections

Fix `errorToHttpStatus()` in `server/errors/index.js` to match the playbook:

| Error | Current | Correct | Reason |
|-------|---------|---------|--------|
| `InvalidTransitionError` | 400 | 409 | Conflict state, not bad input |
| `OrderLockedError` | 403 | 409 | Conflict, not permission denied |
| `PaymentRequiredError` | 400 | 422 | Business rule violation |
| `BusinessRuleViolationError` | 400 | 422 | Business rule violation |
| `PermissionError` | 403 | 403 | Correct ✅ |
| `AuditWriteError` | 500 | 500 | Correct ✅ |
| `StateUpdateError` | 500 | 500 | Correct ✅ |
| `NotFoundError` | 404 | 404 | Correct ✅ |

**Coordinate with frontend** before applying — the client currently checks specific codes.

### 8.4 — Standardized Success Response Format

Update list endpoints to return the standard envelope:

```json
{
  "success": true,
  "data": [ ... ],
  "total": 42
}
```

Where `total` is the count of all matching records before pagination (requires a `COUNT(*)` subquery), not the count of returned records.

Update single-resource endpoints to return:
```json
{
  "success": true,
  "data": { ... }
}
```

**Affected endpoints (currently returning bare data):**
- `GET /api/orders` — returns bare array
- `GET /api/orders/:id` — returns bare object
- `GET /api/orders/barcode/:value` — returns bare object
- `GET /api/orders/:id/history` — returns bare array
- `GET /api/orders/stats` — returns bare object
- `POST /api/orders` — returns bare object
- `GET /api/track/:token` — public endpoint; keep its current shape (customer-facing)

**This is a breaking change.** Update all frontend `api/*.js` wrapper functions simultaneously.

### 8.5 — 404 for Unknown Resources

Confirm every single-resource endpoint returns 404 (not 200 with null, not 500) when the resource does not exist:

- `GET /api/orders/:id` — confirmed returns 404 ✅
- `GET /api/orders/barcode/:value` — confirmed returns 404 ✅
- `GET /api/track/:token` — confirmed returns 404 ✅
- `GET /api/order-items/:id` — review
- `GET /api/customers/:id` — review
- `GET /api/technicians/:id` — review

Add tests for each: request non-existent ID → 404.

### 8.6 — Transition Error Clarity

When `OrderService.transition()` throws `InvalidTransitionError`, the HTTP response must clearly communicate the current and attempted status:

Current: `"Invalid transition: in_repair → delivered"`

Required: Include the order context. The route handler should add clarity:
```js
res.status(409).json({
  error: `لا يمكن الانتقال من '${err.from}' إلى '${err.to}'`,
  from: err.from,
  to: err.to,
});
```

Update `InvalidTransitionError` to expose `err.from` and `err.to` — already done ✅. Ensure the route handler uses them.

### 8.7 — Rate Limiting on Auth Endpoint

Add `express-rate-limit` to `POST /api/auth/login`:
- Limit: 10 attempts per 15-minute window per IP
- Response on breach: 429 with `{ error: "محاولات كثيرة، حاول بعد قليل" }`
- Window reset: sliding

```js
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'محاولات كثيرة، حاول بعد قليل' },
  standardHeaders: true,
  legacyHeaders: false,
});
router.post('/login', loginLimiter, (req, res) => { ... });
```

**Install:** `npm install express-rate-limit --prefix server`

### 8.8 — Rate Limiting on Public Track Endpoints

Apply a more lenient rate limit to the public customer-facing endpoints:
- Limit: 60 requests per minute per IP
- Applies to: `GET /api/track/:token`, `POST /api/track/:token/approve`, `POST /api/track/:token/reject`

---

## Implementation Checklist

### Error Format
- [ ] 8.1 — All routes return `{ error: "..." }` for all error responses
- [ ] 8.2 — Global error handler added to `app.js` as last middleware
- [ ] 8.2 — No stack traces in production error responses

### Status Codes
- [ ] 8.3 — `InvalidTransitionError` → 409
- [ ] 8.3 — `OrderLockedError` → 409 (completed in 6.9, confirm here)
- [ ] 8.3 — `PaymentRequiredError` → 422
- [ ] 8.3 — `BusinessRuleViolationError` → 422

### Response Envelope
- [ ] 8.4 — `GET /api/orders` returns `{ success, data, total }`
- [ ] 8.4 — `GET /api/orders/:id` returns `{ success, data }`
- [ ] 8.4 — `POST /api/orders` returns `{ success, data }` with 201
- [ ] 8.4 — Frontend `api/orders.js` updated to unwrap `.data`
- [ ] 8.4 — All frontend components updated to use `.data` not raw response

### 404 Coverage
- [ ] 8.5 — Every single-resource GET returns 404 for missing resource
- [ ] 8.5 — Tests added for each

### Transition Errors
- [ ] 8.6 — Invalid transition response includes `from` and `to` fields

### Rate Limiting
- [ ] 8.7 — `express-rate-limit` installed
- [ ] 8.7 — Login endpoint rate-limited at 10/15min
- [ ] 8.8 — Track endpoints rate-limited at 60/min
- [ ] Rate limit tests added (mock timer or integration test)

---

## Validation Steps (Phase Exit Criteria)

- [ ] All error responses use `{ error: "..." }` format
- [ ] No stack traces returned in `NODE_ENV=production`
- [ ] `GET /api/orders` returns `total` as count of all matching records
- [ ] Unknown order IDs return 404 from all single-resource endpoints
- [ ] Invalid transitions return 409 with `from` and `to` in response body
- [ ] Business rule violations return 422
- [ ] `POST /api/auth/login` is rate-limited at 10 per 15 minutes
- [ ] Full test suite passes with no regressions

---

## Risks

- Response format change (8.4) is a breaking change for all frontend API consumers. Coordinate with UI work in Phase 9.
- The global error handler (8.2) may suppress errors that are currently visible in logs. Add structured logging (Phase 11) before relying on it fully.
- Rate limiting in development may interfere with rapid manual testing. Rate limiter should be skippable in test environments (`NODE_ENV === 'test'`).
