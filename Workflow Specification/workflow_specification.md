# Jewelry Repair Workshop System – Workflow Specification

## 1. System Purpose

This system manages jewelry repair orders between **branches** and the **central workshop**.
It tracks jewelry items from the moment the customer submits them until the item is returned.

The system must:

- Track repair orders
- Track individual jewelry items
- Manage repair workflow statuses
- Handle customer approvals for paid repairs
- Notify customers of status changes
- Provide QR code tracking for customers

---

# 2. User Roles

## Workshop Admin

Has full control over the workshop system.

Permissions:

- View all orders
- Update orders
- Assign technicians
- Update order status
- Manage technicians
- Manage inventory
- Manage customers
- Manage invoices
- Manage services and repair parts
- View reports
- Configure system settings

---

## Branch Admin

Permissions:

- Create new orders
- Update orders before delivery
- Assign branch staff to orders
- View branch reports
- Print order labels
- Deliver items to customers

Branch admins **cannot delete completed orders**.

---

## Technician

Permissions:

- View assigned orders
- Diagnose items
- Add repair details
- Update order status
- Mark repair completed
- Perform quality check

Technicians **cannot delete orders**.

---

# 3. Order Identification

Each order must have a unique tracking number.

Format:

BR{branch_id}-YYYYMMDD-XXXX

Example:

BR1-20260415-0003

Meaning:

- BR1 → Branch 1
- 20260415 → Order date
- 0003 → Daily sequence number

Sequence resets **per branch per day**.

---

# 4. Order Creation (Branch)

When a customer brings jewelry for repair:

The employee creates a new order with the following information:

Customer Information

- name
- phone number

Order Information

- branch
- order date
- tracking number

Items

Each order can contain **one or more items**.

Each item includes:

- item type (ring, necklace, bracelet, earrings, set, other)
- description
- quantity
- repair request
- optional notes

Photos of the item should be taken when received.

After order creation:

The system must print **two QR labels**:

Customer QR
Used for tracking order status.

Workshop QR
Used internally by technicians.

Initial order status:

RECEIVED

---

# 5. Diagnosis Phase (Workshop)

When the item reaches the workshop:

Technician changes status to:

DIAGNOSING

Technician must add:

- repair description
- estimated repair cost
- estimated completion time

---

# 6. Cost Evaluation Logic

After diagnosis, the system evaluates the repair cost.

### Case 1: Repair cost > 0

Status becomes:

WAITING_APPROVAL

The customer must approve or reject the repair.

Customer approval is done using the **QR tracking page**.

Customer options:

- APPROVE
- REJECT

---

### Case 2: Repair cost = 0

Customer approval is **not required**.

The workflow skips the approval stage.

Status automatically moves to:

IN_REPAIR

---

### Case 3: No repair required

If the technician determines no repair is needed:

Status becomes:

READY_FOR_PICKUP

---

# 7. Repair Phase

If repair is approved or no approval is required:

Status becomes:

IN_REPAIR

Technician performs the repair.

After repair is completed:

Status becomes:

QUALITY_CHECK

Quality check confirms:

- repair completed correctly
- item condition is acceptable

---

# 8. Completion Phase

After quality check:

Status becomes:

READY_FOR_PICKUP

Customer is notified that the item is ready.

Notification can be sent via:

- SMS
- WhatsApp
- QR tracking page

---

# 9. Customer Pickup

When the customer collects the jewelry:

Staff confirms delivery.

Status becomes:

DELIVERED

---

# 10. Order Closure

After delivery is confirmed:

Status becomes:

CLOSED

Closed orders cannot be edited.

---

# 11. Repair Rejection Flow

If the customer rejects the repair:

Status becomes:

REJECTED

No repair work is performed.

Order status then moves to:

READY_FOR_PICKUP

Customer collects the item.

Then:

DELIVERED → CLOSED

---

# 12. Customer QR Tracking Page

Each order must have a **public tracking page** accessible via QR code.

Example URL:

/track/{tracking_token}

The page shows:

- order number
- item list
- current status
- repair description
- estimated cost (if applicable)

If the order is in WAITING_APPROVAL status:

The page must show two buttons:

APPROVE
REJECT

---

# 13. Status History

Every status change must be recorded.

Store:

- order id
- status
- timestamp
- user who made the change
- optional notes

This ensures full audit history.

---

# 14. Item Location Tracking

Each item must have a location state inside the workshop.

Possible locations:

- BRANCH_SAFE
- TRANSIT_TO_WORKSHOP
- WORKSHOP_RECEIVED
- TECHNICIAN_BENCH
- QUALITY_CHECK
- READY_SHELF

Location updates must be recorded with timestamp.

---

# 15. Important System Rules

- Orders cannot be deleted once work has started.
- Technicians cannot delete orders.
- Every status change must be logged.
- Each order item must be traceable at all times.
- QR tracking must not expose internal database IDs.

---

# 16. Final Status Flow

RECEIVED
DIAGNOSING
WAITING_APPROVAL (only if cost > 0)
APPROVED
IN_REPAIR
QUALITY_CHECK
READY_FOR_PICKUP
DELIVERED
CLOSED
REJECTED
CANCELLED
