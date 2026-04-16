# CLAUDE_PROTOCOL.md

> **This document defines how AI assistants must operate when working on the Mudhiyan Workshop codebase.**
> Following this protocol is not optional. It protects the codebase from unintended side effects, keeps documentation in sync with code, and ensures every change is traceable and intentional.

---

## 1. Purpose

AI-assisted development is powerful but introduces risks specific to codebases with business logic, state machines, and production data. The most common failure modes are:

- Making changes without understanding the system's safety constraints
- Implementing correct-looking code that silently violates architectural rules
- Leaving documentation out of sync with the implementation
- Applying generic best-practice patterns that conflict with project-specific design decisions
- Producing code that works in isolation but breaks the state machine or audit trail

This protocol exists to prevent those failure modes. It defines what Claude must do before, during, and after every task.

---

## 2. Core Engineering Principles

These principles govern every decision made on this codebase.

**Principle 1 — Correctness before convenience**
The state machine, audit trail, and role enforcement exist for business correctness. Never trade them away for a simpler implementation.

**Principle 2 — Explicit over implicit**
Make intent visible in code. Named error types, explicit role checks, documented transitions. No silent fallbacks or hidden state changes.

**Principle 3 — Fail loudly on violation**
When a business rule is violated, throw a typed error. Do not silently return a default, swallow an exception, or degrade gracefully into an incorrect state.

**Principle 4 — Documentation is part of the code**
A change that is not reflected in the playbook, ADRs, or invariants is an incomplete change. Documentation is not a post-task chore — it is part of the definition of done.

**Principle 5 — The service layer owns business logic**
Routes validate and delegate. Services decide and act. This boundary is inviolable.

**Principle 6 — Audit trail is non-negotiable**
Every status transition must produce a history record. There is no case where it is acceptable to skip the audit log.

**Principle 7 — Minimize surprise**
Changes should do exactly what they claim to do and nothing more. Side effects must be explicit and documented.

---

## 3. Pre-Task Requirements

Before writing any code, Claude must complete the following steps.

**Step 1 — Read governance documentation**

Claude must read and acknowledge the following files before starting any task:
- `CLAUDE_PLAYBOOK.md` — system design, rules, and conventions
- `PROJECT_GUARDRAILS.md` — hard safety boundaries
- `SYSTEM_INVARIANTS.md` — truths that must never be violated
- `ARCHITECTURE_DECISIONS.md` — prior decisions that constrain design choices

For small UI tasks (text changes, styling), reading the UI Design Standards section of the playbook is sufficient. For any task touching the server, services, routes, or database, all four documents must be reviewed.

**Step 2 — Identify affected areas**

Explicitly list every file and module that the task will touch. For each one, check:
- Is this file in the critical areas list in `PROJECT_GUARDRAILS.md`?
- Does the change affect the state machine, authentication, role enforcement, or database schema?
- Does the change affect data that is externally visible (labels, QR codes, customer token, order number)?

**Step 3 — State the plan**

Before modifying any file, Claude must write a brief implementation plan in the conversation:
- What is being changed and why
- Which files will be modified
- What the expected behavior is after the change
- Whether any documentation needs to be updated

The plan must be confirmed by the human before execution begins on tasks that touch critical areas.

**Step 4 — Check for invariant violations**

Review `SYSTEM_INVARIANTS.md`. Confirm the planned implementation does not violate any invariant. If it does, stop and follow the invariant enforcement protocol.

---

## 4. Implementation Rules

**4.1 — One logical change per task**
Do not bundle unrelated changes into a single task. If implementing a feature requires a refactor of an unrelated module, surface that separately.

**4.2 — No scope creep**
Implement exactly what was requested. Do not add helper utilities, refactor surrounding code, add comments, or improve unrelated functions unless explicitly asked.

**4.3 — Service layer for all business logic**
If the implementation requires making a decision about what the system should do (not just how to format data), that decision belongs in a service function, not a route handler.

**4.4 — Typed errors for business violations**
When a business rule is violated, throw the appropriate typed error from `server/errors/index.js`. Do not return a generic `500` or a plain `Error`. Use `InvalidTransitionError`, `BusinessRuleViolationError`, `PermissionError`, `OrderLockedError`, or `PaymentRequiredError` as appropriate.

**4.5 — Role check before data access**
Every route that accesses order data must check `requireAuth` and `requireRole` before any database call. The check must come first in the handler.

**4.6 — Validate all external input**
Any value from `req.body`, `req.params`, or `req.query` is untrusted. Validate type, range, and allowed values before use. Use `parseInt(..., 10)` for numbers. Check enum membership for status values.

**4.7 — Preserve the barcode route order**
In `server/routes/orders.js`, `GET /api/orders/barcode/:value` must always be declared above `GET /api/orders/:id`. Never reorder these routes.

**4.8 — No direct SQL string interpolation**
All user-controlled values must be passed as bound parameters. Never build a SQL string by concatenating user input.

**4.9 — Test coverage for new paths**
Any new route, transition rule, or service function must have at least one test in `server/tests/`. Happy path and at least one failure case.

---

## 5. UI Development Rules

**5.1 — RTL is required**
All text is Arabic and flows right-to-left. Do not add `direction: ltr` or `text-align: left` to any element that contains user-visible Arabic text.

**5.2 — Design system only**
Use the CSS variables defined in `client/src/index.css` for colors, fonts, and spacing. Do not introduce new color literals. The gold accent is `#D4A843`. Use it via the CSS variable, not as a hardcode.

**5.3 — Role-based rendering**
Buttons and actions must be conditionally rendered based on `req.user.role`. A button that the current user cannot act on must be absent from the DOM, not merely disabled.

**5.4 — Locked order UI**
If an order has `locked_at` set, all action buttons must be hidden. The order is read-only. Do not show a disabled action panel — hide it entirely.

**5.5 — Mobile-first**
The application is used on phones at shop counters. Every new component must be tested at 375px width. Use Tailwind responsive utilities, not hardcoded pixel widths.

**5.6 — No StrictMode around BarcodeScanner**
React StrictMode causes double-mounting, which crashes `html5-qrcode`. Do not wrap `BarcodeScanner.jsx` or its parent `ScanPage.jsx` in a StrictMode boundary.

**5.7 — API calls through the api layer only**
All `fetch` calls must go through functions in `client/src/api/`. No inline `fetch` in components or pages.

**5.8 — WhatsApp links open in new tab**
All `wa.me` links must use `target="_blank" rel="noopener noreferrer"`. They must never navigate away from the current page.

---

## 6. Safety Rules

**6.1 — If a guardrail is triggered, stop**
Do not find a clever workaround. Stop, identify the guardrail, explain the violation, propose a safe alternative.

**6.2 — If an invariant would be violated, stop**
Do not implement a workaround that preserves the appearance of correctness while breaking an invariant. Stop, explain, propose.

**6.3 — Do not modify authentication logic without explicit approval**
Authentication is a critical security boundary. Even cosmetic refactors to `server/middleware/auth.js` require explicit instruction.

**6.4 — Do not remove error handling**
When refactoring, every `try/catch`, every error class throw, and every HTTP error response must be preserved. Removing error handling to simplify code is not acceptable.

**6.5 — Do not delete test files**
Test files document expected behavior. If a feature is changed, the test must be updated to match, not deleted.

**6.6 — Flag unexpected state**
If Claude encounters an unexpected file, an unfamiliar configuration, or code that contradicts the playbook, it must flag this to the human before proceeding. Do not silently overwrite unknown state.

---

## 7. Change Management Rules

**7.1 — Update documentation with code**
Every change that affects system behavior must be accompanied by an update to the relevant documentation:

| Change Type | Documentation to Update |
|-------------|--------------------------|
| New status or transition | CLAUDE_PLAYBOOK.md (state machine), SYSTEM_INVARIANTS.md if relevant |
| New route or endpoint | CLAUDE_PLAYBOOK.md (API reference section) |
| New role or permission change | CLAUDE_PLAYBOOK.md (auth section), SYSTEM_INVARIANTS.md |
| New database column or table | CLAUDE_PLAYBOOK.md (database section) |
| Architecture decision | ARCHITECTURE_DECISIONS.md (new ADR entry) |
| Feature addition or removal | CLAUDE_PLAYBOOK.md (change history) |
| Guardrail or invariant change | PROJECT_GUARDRAILS.md or SYSTEM_INVARIANTS.md |

**7.2 — Change history is required**
Every completed feature or significant change must append an entry to the Change History section of `CLAUDE_PLAYBOOK.md` with the date and a description.

**7.3 — ADR for architectural decisions**
Any decision that changes the system's architecture — adding a new pattern, changing how services are structured, adopting a new library for a critical function — must produce a new ADR entry in `ARCHITECTURE_DECISIONS.md`.

---

## 8. Task Execution Format

When Claude begins a task, it must communicate using this structure:

```
## Task: [Task name]

### What I understand
[One or two sentences describing the goal]

### Files I will touch
- server/routes/orders.js — [reason]
- client/src/components/OrderDetail.jsx — [reason]

### Guardrail check
[Confirm no guardrails are triggered, or identify which ones apply]

### Invariant check
[Confirm no invariants are violated, or identify which ones apply]

### Documentation that needs updating
- [file] — [what changes]

### Implementation plan
[Step-by-step description of what will be done]
```

This format must be used before any code change on tasks that touch critical areas. For purely cosmetic changes (CSS, text strings), a brief one-line plan is sufficient.

---

## 9. Self-Audit Requirement

After completing any task that touches server-side code, database logic, or the state machine, Claude must perform a self-audit before reporting the task as done.

**Self-Audit Checklist:**

- [ ] Does every new or modified route call `requireAuth` and `requireRole`?
- [ ] Does every status transition go through `OrderService.transition()`?
- [ ] Is there an audit log entry for every status change?
- [ ] Are locked orders (`locked_at != null`) rejected from all write endpoints?
- [ ] Are all user inputs validated before use?
- [ ] Are bound parameters used for all SQL queries with user data?
- [ ] Does the change maintain shop isolation for `shop_employee` users?
- [ ] Have all affected documentation files been updated?
- [ ] Has a change history entry been added to `CLAUDE_PLAYBOOK.md`?
- [ ] Are there test cases covering the new or changed behavior?

If any item on this checklist is not satisfied, the task is not complete. Claude must address the gap before reporting completion.
