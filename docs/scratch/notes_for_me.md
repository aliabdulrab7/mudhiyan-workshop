READ FIRST:

PROJECT_GUARDRAILS.md
CLAUDE_PROTOCOL.md
CLAUDE_PHASE_PLAN.md
ARCHITECTURE_DECISIONS.md
SYSTEM_INVARIANTS.md
CLAUDE_PLAYBOOK.md

# Github commit

git add .
git commit -m "UI refinements"
git push

./ship.sh

# 2. Go to the app directory

cd /var/www/mudhiyan

# 3. Pull latest code

git pull origin master

# 4. Install any new dependencies

npm install --prefix client --production=false
npm install --prefix server

# 5. Build the React frontend

npm run build --prefix client

# 6. Restart the server

pm2 restart mudhiyan

# 7. Confirm it's running

pm2 status

#

READ FIRST:

PROJECT_GUARDRAILS.md
CLAUDE_PROTOCOL.md
CLAUDE_PHASE_PLAN.md
ARCHITECTURE_DECISIONS.md
SYSTEM_INVARIANTS.md
CLAUDE_PLAYBOOK.md

You are an engineering agent working on the **Mudhiyan Workshop System**.

You must implement the following features **in controlled phases**.
Do NOT implement everything at once.

Follow these rules strictly:

SYSTEM RULES

1. Never break existing system invariants.
2. Follow the existing order state machine.
3. Do not introduce temporary hacks.
4. All changes must be production-ready.
5. Prefer small commits per phase.
6. After each phase, provide:
   - summary
   - modified files
   - reasoning
   - migration steps if required.

---

PROJECT CONTEXT

The system workflow is:

Shop → Workshop → Inspection → Repair → Shop → Customer

Order states include:

CREATED
RECEIVED
WAITING_APPROVAL
APPROVED
REPAIRING
READY_FOR_PICKUP
DELIVERED

Important invariant:

DELIVERED can ONLY be assigned by the shop.

The workshop cannot deliver items to customers.

---

IMPLEMENTATION PHASES

---

PHASE 1 — Repair Cost & Notes (Workshop)

Goal:
Allow workshop to submit repair cost after inspection.

Requirements:

1. When order status = RECEIVED
   show repair input UI.

Fields required:

- repair_cost (number, >=0)
- repair_notes (text)

UI rules:

Repair cost section must be hidden unless:

status == RECEIVED

When user clicks SAVE:

system must:

update order:
status → WAITING_APPROVAL
repair_cost → stored
repair_notes → stored

Customer tracking page must display:

Repair Cost
Repair Notes

for transparency.

Deliverables:

- backend schema update if needed
- API endpoint
- workshop UI logic
- customer tracking page update

---

PHASE 2 — Tracking Link Improvements

Goal:
Make tracking links easily accessible for staff.

Requirements:

Both shop and workshop dashboards must show:

Tracking Link

When user clicks:

Copy link to clipboard automatically.

Also show:

"Link copied" toast notification.

Optional buttons:

- Copy link
- Open tracking page

Ensure link format remains stable.

---

PHASE 3 — High Speed Barcode Scanning

Goal:
Allow workshop workers to update order status via scanner.

Constraints:

Barcode scanners must be treated as **keyboard input devices**.

Implementation:

Create scanning page:

/scan

Input field must:

- auto focus
- capture scanner input
- detect ENTER

Flow:

SCAN → FIND ORDER → UPDATE STATUS

Scanning modes must exist:

Mode 1:
RECEIVE_ITEMS

scan → status = RECEIVED

Mode 2:
REPAIR_COMPLETE

scan → status = READY_FOR_PICKUP

Mode 3:
CUSTOMER_PICKUP

scan → status = DELIVERED (shop only)

The scanning UI must support continuous scanning without page reload.

Provide instant feedback:

✔ Order updated

or

❌ Order not found

Optional:

sound feedback (beep)

---

PHASE 4 — Bulk Scanning Optimization

Goal:
Support high volume workshop environments.

Requirements:

Worker should be able to scan continuously:

scan #1 → update
scan #2 → update
scan #3 → update

No manual confirmation required.

Implementation guidelines:

- clear input after scan
- instant server response
- no page reload
- optimistic UI updates if safe

---

PHASE 5 — Hardware Agnostic Label Printing

Goal:
Support any label printer or label size.

Do NOT assume a specific printer.

Architecture:

Create label template system.

Example:

LABEL_TEMPLATE

name
width_mm
height_mm
layout_config

Example templates:

WORKSHOP_LABEL
CUSTOMER_TRACKING_LABEL

Printing flow:

Order created → auto generate labels.

Labels must contain:

QR code
order id
optional metadata

QR codes must encode either:

tracking URL
or order identifier.

Labels must render as:

PDF or printable HTML.

Browser print must handle the final printer.

---

PHASE 6 — Printer Profiles

Goal:
Support multiple printers with different label sizes.

Example configuration:

SHOP_PRINTER

label_size: 60x40
template: CUSTOMER_TRACKING_LABEL

WORKSHOP_PRINTER

label_size: 40x30
template: WORKSHOP_LABEL

Printing must select the correct template automatically.

---

PHASE 7 — System Safety Checks

Ensure:

- workshop cannot assign DELIVERED
- shop must confirm pickup
- scan mode respects permissions

Add validation safeguards.

---

IMPLEMENTATION STRATEGY

Before coding each phase:

1. Analyze current codebase.
2. Identify impacted modules.
3. Produce implementation plan.
4. Then implement.

Do NOT proceed to the next phase until the current phase is complete.

---

EXPECTED OUTPUT FORMAT

For each phase provide:

Phase Summary
Design Decisions
Files Modified
Code Implementation
Testing Steps

Then wait for approval before continuing to the next phase.
