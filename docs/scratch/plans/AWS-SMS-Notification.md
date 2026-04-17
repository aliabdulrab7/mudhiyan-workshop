AWS SNS SMS Notifications — Implementation Plan

Context

Currently, customer notifications in Mudhiyan Workshop are manual only: the app generates
wa.me WhatsApp deep links, and a shop employee must click the button to send. If the
employee forgets, the customer gets no notification. This is particularly critical for the
cost approval step (waiting_approval) where the customer must act.

The goal is to add automatic SMS notifications via AWS SNS for key status transitions,
sent directly to the customer's phone without employee intervention. WhatsApp links remain
as a manual fallback/supplement — this is an addition, not a replacement.

---

Existing Bugs to Fix First

1.  Stale key in NotificationService.js:23: MESSAGE_BUILDERS has ready_for_pickup but the
    state machine uses ready_for_return. This means the "ready for pickup" WhatsApp
    notification has been silently broken — it never fires.
2.  Hardcoded URL in NotificationService.js:21: Tracking URL is hardcoded as
    https://mudhiyan.app/track/... instead of using process.env.PUBLIC_HOST.

---

AWS Prerequisites (Start Immediately — Long Lead Time)

These are blocking and take weeks. Start before any code:

┌───────────────────┬────────────┬────────────────────────────────────────────────────┐
│ Task │ Lead Time │ How │
├───────────────────┼────────────┼────────────────────────────────────────────────────┤
│ Request SNS │ 1-3 │ AWS Support case: "Service limit increase" for SNS │
│ production access │ business │ SMS │
│ (exit sandbox) │ days │ │
├───────────────────┼────────────┼────────────────────────────────────────────────────┤
│ │ │ AWS Pinpoint console → Sender ID registration for │
│ Register CITC │ 2-6 weeks │ Saudi Arabia. Business name: "MUDHIYAN" (max 11 │
│ sender ID │ │ chars). CITC is the Saudi regulator — AWS submits │
│ │ │ on your behalf │
├───────────────────┼────────────┼────────────────────────────────────────────────────┤
│ Increase SMS │ Immediate │ SNS console → Set monthly spend limit (default is │
│ spending limit │ │ $1.00) │
├───────────────────┼────────────┼────────────────────────────────────────────────────┤
│ │ │ IAM policy: sns:Publish + sns:GetSMSAttributes on │
│ Create IAM role │ 30 min │ Resource: "\*". Attach role to EC2 instance. SDK │
│ for EC2 │ │ auto-discovers credentials via IMDS — no env vars │
│ │ │ needed │
└───────────────────┴────────────┴────────────────────────────────────────────────────┘

Saudi Arabia specifics:

- Without a registered sender ID, SMS may be silently dropped by Saudi carriers (STC,
  Mobily, Zain)
- AWS SNS supports +966 numbers from me-south-1 (Bahrain), us-east-1, eu-west-1

---

Cost Estimation

Per-Message Cost

┌──────────────────────────┬─────────────────────────────────────────────────┐
│ Factor │ Detail │
├──────────────────────────┼─────────────────────────────────────────────────┤
│ SNS rate to Saudi Arabia │ ~$0.0458 per SMS segment │
├──────────────────────────┼─────────────────────────────────────────────────┤
│ Arabic encoding (UCS-2) │ 70 chars/segment; multi-part = 67 chars/segment │
├──────────────────────────┼─────────────────────────────────────────────────┤
│ Typical message │ ~100 Arabic chars = 2 segments │
├──────────────────────────┼─────────────────────────────────────────────────┤
│ Cost per notification │ 2 x $0.0458 = ~$0.092 │
└──────────────────────────┴─────────────────────────────────────────────────┘

Monthly Projections

┌────────────────┬───────────┬───────────┬──────────────┬───────────┐
│ Volume │ SMS/order │ SMS/month │ Monthly Cost │ SAR/month │
├────────────────┼───────────┼───────────┼──────────────┼───────────┤
│ 50 orders/day │ 2 │ 3,000 │ ~$275 │ ~1,030 │
├────────────────┼───────────┼───────────┼──────────────┼───────────┤
│ 100 orders/day │ 2.5 │ 7,500 │ ~$687 │ ~2,575 │
├────────────────┼───────────┼───────────┼──────────────┼───────────┤
│ 200 orders/day │ 3 │ 18,000 │ ~$1,649 │ ~6,184 │
└────────────────┴───────────┴───────────┴──────────────┴───────────┘

Cost Controls

- Set MonthlySpendLimit in SNS to cap spending
- CloudWatch alarm on SMSMonthToDateSpentUSD at 80% of budget
- Send fewer SMS: only waiting_approval + returned_to_shop = 2 per order
- Shorten messages to 1 segment (under 70 Arabic chars) where possible

Alternative: Unifonic (Saudi-Local)

If SNS costs are too high, https://www.unifonic.com/ is a Saudi-based SMS provider with
potentially better local rates. Would require a different SDK but same architecture.

---

Which Transitions Send SMS

┌─────────────────────┬──────────┬───────────────────────────────────────────────────┐
│ Status Target │ Send │ Reason │
│ │ SMS? │ │
├─────────────────────┼──────────┼───────────────────────────────────────────────────┤
│ waiting_approval │ YES │ Customer must act (approve/reject). │
│ │ │ Business-critical. │
├─────────────────────┼──────────┼───────────────────────────────────────────────────┤
│ returned_to_shop │ YES │ Customer can come pick up. Drives collection. │
├─────────────────────┼──────────┼───────────────────────────────────────────────────┤
│ ready_for_return │ Optional │ Item leaving workshop. Less actionable for │
│ │ │ customer. │
├─────────────────────┼──────────┼───────────────────────────────────────────────────┤
│ delivered │ Optional │ Thank-you message. Nice-to-have, costs money for │
│ │ │ no action. │
├─────────────────────┼──────────┼───────────────────────────────────────────────────┤
│ All other │ No │ Internal workflow — customer doesn't need to know │
│ transitions │ │ │
└─────────────────────┴──────────┴───────────────────────────────────────────────────┘

Default: waiting_approval and returned_to_shop only. Configurable via SMS_TRANSITIONS env
var.

---

Implementation Steps

Step 1 — Fix existing NotificationService bugs

Files: server/services/NotificationService.js

- Rename ready_for_pickup → ready_for_return in MESSAGE_BUILDERS (line 23)
- Replace hardcoded https://mudhiyan.app with process.env.PUBLIC_HOST (line 21)

Step 2 — Install AWS SDK

npm install --prefix server @aws-sdk/client-sns

One package, ~2-3 MB. AWS SDK v3 is modular — no bloat.

Step 3 — Create server/services/SmsService.js (new file, ~80-100 lines)

SmsService
├── SNS client (lazy init, created on first use)
├── sendSms(phone, message) — core send function
│ ├── Convert 966XXXXXXXXX → +966XXXXXXXXX
│ ├── Call SNS PublishCommand
│ ├── Set SMSType = 'Transactional'
│ ├── Set SenderID from env var
│ └── Log result (last 4 digits of phone only)
├── sendNotification(status, order) — template selector
│ ├── Check SMS_ENABLED !== 'true' → return null
│ ├── Check NODE_ENV === 'test' → return null
│ ├── Check PUBLIC_HOST is set → warn + return null if missing
│ ├── Look up status in SMS_MESSAGES map
│ ├── If no match → return null
│ ├── Build message from template
│ └── Call sendSms() — catch all errors, never throw
└── SMS_MESSAGES (Arabic templates for each status)

Key design decisions:

- Separate file from NotificationService — NotificationService is a pure synchronous
  builder. SmsService is async with external dependency. Keeps responsibilities clean.
- Feature flag: SMS_ENABLED=true required to send. Default is off.
- Test guard: NODE_ENV=test always disables sending regardless of feature flag.
- Never throws: All errors are caught and logged. Notification failure never affects the
  transition (already enforced by OrderService hook pattern).

Step 4 — Wire into notification hook in server/app.js

Current (line 28-30):
OrderService.registerNotificationHook((status, order) => {
return NotificationService.notify(status, order);
});

New:
const SmsService = require('./services/SmsService');

OrderService.registerNotificationHook((status, order) => {
const waPayload = NotificationService.notify(status, order);
// Fire SMS in background — do not await, do not block, do not throw
SmsService.sendNotification(status, order).catch(() => {});
return waPayload; // WhatsApp payload to frontend (unchanged)
});

- SMS is fire-and-forget (not awaited)
- WhatsApp payload return is unchanged — zero breaking change to API responses
- .catch(() => {}) prevents unhandled rejection

Step 5 — Add tests (server/tests/sms.test.js, ~80-120 lines)

┌─────────────────────────────────┬───────────────────────────────────────────────────┐
│ Test │ What it verifies │
├─────────────────────────────────┼───────────────────────────────────────────────────┤
│ SMS sent for waiting_approval │ Correct phone format (+966...), correct message │
│ │ content │
├─────────────────────────────────┼───────────────────────────────────────────────────┤
│ SMS sent for returned_to_shop │ Correct message template │
├─────────────────────────────────┼───────────────────────────────────────────────────┤
│ No SMS when SMS_ENABLED=false │ Feature flag works │
├─────────────────────────────────┼───────────────────────────────────────────────────┤
│ No SMS when NODE_ENV=test │ Test environment guard │
├─────────────────────────────────┼───────────────────────────────────────────────────┤
│ SMS failure doesn't throw │ Graceful error handling │
├─────────────────────────────────┼───────────────────────────────────────────────────┤
│ No SMS when phone missing │ Null guard │
├─────────────────────────────────┼───────────────────────────────────────────────────┤
│ No SMS for non-configured │ Only configured transitions trigger │
│ statuses │ │
├─────────────────────────────────┼───────────────────────────────────────────────────┤
│ Phone format: 966... → +966... │ E.164 conversion │
└─────────────────────────────────┴───────────────────────────────────────────────────┘

Mock @aws-sdk/client-sns SNSClient.send() — no real AWS calls in tests.

Step 6 — Environment variables

┌───────────────────┬──────────┬───────────────────────────────────┬──────────────────┐
│ Variable │ Required │ Default │ Purpose │
├───────────────────┼──────────┼───────────────────────────────────┼──────────────────┤
│ │ │ │ Feature flag — │
│ SMS_ENABLED │ No │ false │ set to true to │
│ │ │ │ enable │
├───────────────────┼──────────┼───────────────────────────────────┼──────────────────┤
│ AWS_REGION │ If SMS │ me-south-1 │ SNS region │
│ │ enabled │ │ │
├───────────────────┼──────────┼───────────────────────────────────┼──────────────────┤
│ │ │ │ Registered CITC │
│ AWS_SNS_SENDER_ID │ No │ (none) │ sender ID (e.g., │
│ │ │ │ "MUDHIYAN") │
├───────────────────┼──────────┼───────────────────────────────────┼──────────────────┤
│ SMS_TRANSITIONS │ No │ waiting_approval,returned_to_shop │ Which statuses │
│ │ │ │ trigger SMS │
└───────────────────┴──────────┴───────────────────────────────────┴──────────────────┘

If using IAM instance role (recommended): no AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY
needed.

Step 7 — Documentation

┌───────────────────────────┬──────────────────────────────────────────────────────────┐
│ Document │ Update │
├───────────────────────────┼──────────────────────────────────────────────────────────┤
│ ARCHITECTURE_DECISIONS.md │ New ADR-015 — SMS via AWS SNS (partially supersedes │
│ │ ADR-011: WhatsApp stays, SMS added alongside) │
├───────────────────────────┼──────────────────────────────────────────────────────────┤
│ CLAUDE_PLAYBOOK.md │ Change history entry, new env vars in deployment │
│ │ section, SmsService in architecture section │
├───────────────────────────┼──────────────────────────────────────────────────────────┤
│ PROJECT_GUARDRAILS.md │ Add SmsService to "allowed modifications" table │
├───────────────────────────┼──────────────────────────────────────────────────────────┤
│ Deployment docs │ IAM role setup, env vars, SNS production access steps, │
│ │ CITC sender ID │
└───────────────────────────┴──────────────────────────────────────────────────────────┘

---

Complexity Assessment

┌────────────────────┬────────────────────────────────────────────────────────────────┐
│ Dimension │ Rating │
├────────────────────┼────────────────────────────────────────────────────────────────┤
│ Code volume │ ~230-310 lines (new SmsService + tests + doc updates) │
├────────────────────┼────────────────────────────────────────────────────────────────┤
│ Files changed │ 4 modified + 2 new (SmsService.js, sms.test.js) │
├────────────────────┼────────────────────────────────────────────────────────────────┤
│ Risk to existing │ Very Low — no schema changes, no state machine changes, │
│ system │ feature-flagged, fire-and-forget │
├────────────────────┼────────────────────────────────────────────────────────────────┤
│ Testing effort │ Low — mock-based unit tests, manual sandbox verification │
├────────────────────┼────────────────────────────────────────────────────────────────┤
│ Rollback │ Instant — set SMS_ENABLED=false and restart PM2 │
├────────────────────┼────────────────────────────────────────────────────────────────┤
│ External │ 1 new package (@aws-sdk/client-sns) │
│ dependencies │ │
├────────────────────┼────────────────────────────────────────────────────────────────┤
│ Database changes │ None │
├────────────────────┼────────────────────────────────────────────────────────────────┤
│ Breaking API │ None │
│ changes │ │
└────────────────────┴────────────────────────────────────────────────────────────────┘

Risk Matrix

┌───────────────────┬───────────────┬───────────────┬───────────────────────────────┐
│ Risk │ Impact │ Likelihood │ Mitigation │
├───────────────────┼───────────────┼───────────────┼───────────────────────────────┤
│ CITC sender ID │ Blocks │ │ Start registration │
│ takes 6+ weeks │ production │ Medium │ immediately, before any code │
│ │ SMS │ │ work │
├───────────────────┼───────────────┼───────────────┼───────────────────────────────┤
│ SNS sandbox │ Blocks launch │ High if not │ Request production access │
│ blocks production │ │ addressed │ early (1-3 days) │
├───────────────────┼───────────────┼───────────────┼───────────────────────────────┤
│ SMS costs exceed │ Financial │ Medium │ Set MonthlySpendLimit, │
│ budget │ │ │ CloudWatch alarm │
├───────────────────┼───────────────┼───────────────┼───────────────────────────────┤
│ SMS silently │ Customer not │ │ Registered sender ID + │
│ dropped by │ notified │ Low-Medium │ Transactional type │
│ carrier │ │ │ │
├───────────────────┼───────────────┼───────────────┼───────────────────────────────┤
│ AWS credentials │ SMS fails at │ Low │ IAM role + startup health │
│ not on EC2 │ runtime │ │ check log │
└───────────────────┴───────────────┴───────────────┴───────────────────────────────┘

---

Verification Plan

1.  Unit tests pass: npm test --prefix server — all existing 135 tests + new SMS tests pass
2.  Build succeeds: npm run build --prefix client — no frontend changes, but confirm
3.  Sandbox test: In sandbox mode with verified phone numbers, trigger waiting_approval →
    confirm SMS received
4.  Feature flag off: Deploy with SMS_ENABLED=false → confirm zero SMS sent, zero errors in
    logs
5.  Feature flag on: Set SMS_ENABLED=true → trigger one real transition → confirm SMS
    delivered
6.  CloudWatch: Verify SMSMonthToDateSpentUSD metric increments
7.  Rollback test: Set SMS_ENABLED=false → confirm SMS stops immediately
8.  Full regression: All 135 server tests pass, client build clean

---

Dual System: WhatsApp + SMS

After implementation, both channels coexist:

┌───────────────────┬───────────────────────┬────────────────────────┬────────────────┐
│ Channel │ Trigger │ Reliability │ Cost │
├───────────────────┼───────────────────────┼────────────────────────┼────────────────┤
│ SMS (new) │ Automatic on │ High │ ~$0.09/message │
│ │ transition │ (system-initiated) │ │
├───────────────────┼───────────────────────┼────────────────────────┼────────────────┤
│ WhatsApp │ Employee clicks │ Low (human-dependent) │ Free │
│ (existing) │ button │ │ │
└───────────────────┴───────────────────────┴────────────────────────┴────────────────┘

WhatsApp remains the manual fallback. SMS ensures the customer is always notified even if
the employee forgets. No changes to the frontend WhatsApp flow.
