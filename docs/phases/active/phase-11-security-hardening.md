# Phase 11 — Security Hardening

> ⚠️ Do not proceed until Phase 10 is fully completed and validated.
> ⚠️ CSP headers may break Google Fonts or Web Bluetooth. Test in Chrome/Edge after applying.
> ⚠️ Structured logging must never log JWT tokens, password hashes, or full phone numbers.

---

## Purpose

Reduce the attack surface. Implement defense-in-depth for the most sensitive operations.
Prepare the system for external exposure with minimal residual risk.

This phase assumes the system is already correctly built (Phases 6–10). Security hardening is applied on top of a correct foundation.

---

## Status: Planned

---

## Tasks

### 11.1 — Security Headers (Helmet)

Add `helmet` middleware to `server/app.js`:

```js
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
    }
  }
}));
```

Required headers enabled by helmet:
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` — as above

**Test after applying:** Confirm the following still work:
- Almarai font loads from Google Fonts CDN
- `wa.me` links open (external link, not a connect target)
- Web Bluetooth API works in Chrome/Edge on localhost

**Install:** `npm install helmet --prefix server`

### 11.2 — Input Sanitization

Add `validator.js` for input sanitization:

- `customer_name`: strip HTML tags before storing
- `notes` (orders): strip HTML tags
- `workshop_comment` (items): strip HTML tags
- `repair_description` (items): strip HTML tags
- `body` (comments): strip HTML tags

```js
const validator = require('validator');
const sanitize = (str) => str ? validator.escape(str.trim()) : str;
```

Confirm no user-controlled string is rendered as raw HTML in the frontend:
- `grep -rn "dangerouslySetInnerHTML" client/src/` must return zero results

**Install:** `npm install validator --prefix server`

### 11.3 — JWT Expiry and Client-Side Check

Current token expiry: 7 days. There is no refresh mechanism.

Add a client-side expiry check in `client/src/App.jsx` or the auth context:
- On page load (or route change), decode the JWT and check `exp`
- If expired: clear `localStorage`, redirect to `/login`
- Do not silently continue with an expired token

```js
import { jwtDecode } from 'jwt-decode';

const token = localStorage.getItem('token');
if (token) {
  const { exp } = jwtDecode(token);
  if (Date.now() >= exp * 1000) {
    localStorage.clear();
    window.location.href = '/login';
  }
}
```

Document the trade-off (no server-side revocation) in `ARCHITECTURE_DECISIONS.md` as a note on ADR-006.

**Install:** `npm install jwt-decode --prefix client`

### 11.4 — Structured Logging

Add `pino` for structured JSON logging:

```js
const pino = require('pino');
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty' }
    : undefined,
});
```

Log the following events:
- Every status transition: `{ order_id, from, to, user, timestamp }`
- Every auth failure: `{ ip, username, timestamp, reason }`
- Every 4xx/5xx response: `{ method, path, status, duration_ms }`
- Server startup: `{ port, node_env, jwt_secret_set: boolean }`

**Never log:**
- JWT tokens (full or partial)
- Password hashes
- Full phone numbers (log last 4 digits only: `****1234`)
- `customer_token` (it's a tracking secret)

**Install:** `npm install pino pino-pretty --prefix server`

### 11.5 — Dependency Vulnerability Audit

Run `npm audit` in both `server/` and `client/`:

```bash
npm audit --prefix server
npm audit --prefix client
```

- Fix any high-severity vulnerabilities
- Document any vulnerabilities that cannot be fixed (with reason)
- Add a `npm audit --audit-level=high` step to the GitHub Actions CI workflow

This must pass with zero high-severity findings before the phase is complete.

### 11.6 — SQL Injection Review

Audit all SQL statements in `server/db.js` and all `server/routes/*.js` files:

- Every user-controlled value must be passed as a bound parameter (`?`)
- No string interpolation in SQL queries: no template literals, no string concatenation with request data

Run: `grep -n "query\|sql\|prepare" server/routes/*.js | grep -v "?"` to identify potential raw string SQL.

Document any finding. Fix immediately.

### 11.7 — CORS Configuration Review

Review `server/app.js` CORS whitelist:
- Confirm the `192.168.x.x` LAN subnet pattern is appropriate for the deployment environment
- If the system is only used from a specific subnet (e.g., `192.168.1.x`), narrow the pattern
- Document the expected allowed origins in a comment in `app.js`
- Confirm CORS is never set to `*` (wildcard) — guardrail 8.4

### 11.8 — Secrets Audit

Scan the repository for accidentally committed secrets:

```bash
git log -p -- server/ | grep -E "(JWT_SECRET|password|secret|token)" | grep -v "//\|#\|test"
```

Also run:
```bash
grep -rn "dev-secret" server/ client/
grep -rn "password_hash\s*=" server/
```

Add a pre-commit hook (`.git/hooks/pre-commit`) that blocks commits containing common secret patterns:
```bash
if git diff --cached | grep -qE "(JWT_SECRET\s*=\s*['\"][^$]|password\s*=\s*['\"](?!\\$|#)[^'\"]{6})"; then
  echo "ERROR: Potential secret detected in staged changes."
  exit 1
fi
```

Document any finding from the git log scan.

---

## Implementation Checklist

### Headers
- [ ] 11.1 — `helmet` installed and configured
- [ ] 11.1 — CSP allows Google Fonts
- [ ] 11.1 — Almarai font still loads after CSP
- [ ] 11.1 — Web Bluetooth works after CSP (test in Chrome)
- [ ] 11.1 — WhatsApp links still work (external nav, not fetch)

### Input Sanitization
- [ ] 11.2 — HTML stripped from all user text inputs before storage
- [ ] 11.2 — Zero `dangerouslySetInnerHTML` in codebase

### JWT
- [ ] 11.3 — Client-side JWT expiry check on page load
- [ ] 11.3 — Expired token → clear storage → redirect to login
- [ ] 11.3 — ADR-006 updated with trade-off note

### Logging
- [ ] 11.4 — `pino` installed and configured
- [ ] 11.4 — Every status transition logged with user and timestamp
- [ ] 11.4 — Every auth failure logged with IP and username
- [ ] 11.4 — Every 4xx/5xx logged
- [ ] 11.4 — No sensitive data (tokens, hashes, phone numbers) in logs

### Dependencies
- [ ] 11.5 — `npm audit` passes with zero high-severity findings in `server/`
- [ ] 11.5 — `npm audit` passes with zero high-severity findings in `client/`
- [ ] 11.5 — `npm audit --audit-level=high` added to CI workflow

### SQL Safety
- [ ] 11.6 — All SQL uses bound parameters
- [ ] 11.6 — Zero string-interpolated SQL queries found

### CORS & Secrets
- [ ] 11.7 — CORS origins documented and narrowed if applicable
- [ ] 11.8 — No secrets found in git history
- [ ] 11.8 — Pre-commit hook in place

---

## Validation Steps (Phase Exit Criteria)

- [ ] `helmet` applied: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy all present
- [ ] Google Fonts and WhatsApp links still work after CSP
- [ ] No `dangerouslySetInnerHTML` in the codebase
- [ ] `npm audit` returns zero high-severity findings (both `server/` and `client/`)
- [ ] All SQL uses bound parameters (no interpolation found in audit)
- [ ] Structured logs appear on every status transition
- [ ] Auth failures are logged with IP and username
- [ ] No secrets in git history
- [ ] Full test suite passes with no regressions

---

## Risks

- CSP headers may break unexpected third-party resources. Test every major user flow (login, print label, WhatsApp, track page) after applying.
- `pino-pretty` is for development only. In production, logs must be plain JSON for ingestion by log aggregators. Confirm `NODE_ENV` is set correctly in PM2 config.
- The pre-commit hook uses `.git/hooks/` which is local to each developer's machine and is not committed. Consider adding a `husky` setup if the team has multiple contributors.
- Narrowing the LAN CORS rule (11.7) may break access for users on a different subnet. Confirm all office devices are on the same subnet before narrowing.
