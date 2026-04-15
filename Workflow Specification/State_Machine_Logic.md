Below is the **exact state machine logic** for your workshop system, written in a way that Claude (or any backend) can implement without ambiguity.

This is the **core engine of your ERP** — everything (API, UI, QR, notifications) should follow this.

---

# Jewelry Repair Workflow – State Machine Logic

## 1. Core Principle

Each order has a **single state field**:

```id="sm0"
orders.status
```

All transitions MUST go through a controlled state machine (no direct random updates).

---

# 2. Valid States

```id="sm1"
RECEIVED
DIAGNOSING
WAITING_APPROVAL
APPROVED
REJECTED
IN_REPAIR
QUALITY_CHECK
READY_FOR_PICKUP
DELIVERED
CLOSED
CANCELLED
```

---

# 3. State Machine Rules (Transitions)

## 3.1 RECEIVED → DIAGNOSING

```id="sm2"
RECEIVED → DIAGNOSING
```

Allowed when:

- order is created
- item arrives at workshop

---

## 3.2 DIAGNOSING → WAITING_APPROVAL OR IN_REPAIR

This is the **MOST IMPORTANT DECISION POINT**

```id="sm3"
IF estimated_cost > 0
    DIAGNOSING → WAITING_APPROVAL
ELSE
    DIAGNOSING → IN_REPAIR
```

---

## 3.3 WAITING_APPROVAL → APPROVED OR REJECTED

```id="sm4"
WAITING_APPROVAL → APPROVED
WAITING_APPROVAL → REJECTED
```

Rules:

- only customer can trigger this via QR
- cannot bypass

---

## 3.4 APPROVED → IN_REPAIR

```id="sm5"
APPROVED → IN_REPAIR
```

Triggered by workshop after approval.

---

## 3.5 REJECTED → READY_FOR_PICKUP

```id="sm6"
REJECTED → READY_FOR_PICKUP
```

No repair is done.

---

## 3.6 IN_REPAIR → QUALITY_CHECK

```id="sm7"
IN_REPAIR → QUALITY_CHECK
```

Triggered when technician finishes work.

---

## 3.7 QUALITY_CHECK → READY_FOR_PICKUP OR IN_REPAIR

```id="sm8"
IF QC failed:
    QUALITY_CHECK → IN_REPAIR

IF QC passed:
    QUALITY_CHECK → READY_FOR_PICKUP
```

---

## 3.8 READY_FOR_PICKUP → DELIVERED

```id="sm9"
READY_FOR_PICKUP → DELIVERED
```

Triggered when customer collects item.

---

## 3.9 DELIVERED → CLOSED

```id="sm10"
DELIVERED → CLOSED
```

Can be:

- automatic after time delay OR
- manual by staff

---

## 3.10 CANCELLED (GLOBAL EXIT STATE)

```id="sm11"
ANY_STATE → CANCELLED
```

Allowed only if:

- order not delivered yet
- workshop/admin override

---

# 4. Forbidden Transitions (VERY IMPORTANT)

These MUST be blocked:

```id="sm12"
RECEIVED → IN_REPAIR ❌
DIAGNOSING → READY_FOR_PICKUP ❌
WAITING_APPROVAL → CLOSED ❌
IN_REPAIR → RECEIVED ❌
DELIVERED → IN_REPAIR ❌
```

---

# 5. Approval Logic Rule (Business Core)

```id="sm13"
IF estimated_cost > 0:
    MUST go through WAITING_APPROVAL
ELSE:
    SKIP approval → IN_REPAIR
```

---

# 6. State Machine Controller (Backend Logic)

Every status change must pass through:

```id="sm14"
transitionOrderStatus(orderId, newStatus, user)
```

Inside function:

### Step 1: Validate transition

Check:

```id="sm15"
isValidTransition(currentStatus, newStatus)
```

---

### Step 2: Enforce business rules

Example:

```id="sm16"
IF newStatus == WAITING_APPROVAL AND estimated_cost == 0:
    REJECT ❌
```

---

### Step 3: Save history

```id="sm17"
order_status_history.insert({
  order_id,
  old_status,
  new_status,
  changed_by,
  timestamp
})
```

---

### Step 4: Update order

```id="sm18"
orders.status = newStatus
```

---

### Step 5: Trigger side effects

```id="sm19"
IF newStatus == WAITING_APPROVAL:
    sendWhatsApp(customer)

IF newStatus == READY_FOR_PICKUP:
    notifyCustomer()

IF newStatus == DELIVERED:
    triggerInvoiceFinalization()
```

---

# 7. State Transition Map (Visual Logic)

```id="sm20"
RECEIVED
   ↓
DIAGNOSING
   ↓
IF cost > 0 → WAITING_APPROVAL → APPROVED
                           ↓
                         REJECTED
                           ↓
IN_REPAIR
   ↓
QUALITY_CHECK
   ↓
READY_FOR_PICKUP
   ↓
DELIVERED
   ↓
CLOSED
```

---

# 8. Critical System Rules

## Rule 1: Single Source of Truth

Only `orders.status` defines state.

---

## Rule 2: No Direct Updates

Never allow:

```id="sm21"
UPDATE orders SET status = 'IN_REPAIR'
```

Without state machine validation.

---

## Rule 3: Every Change is Logged

Mandatory audit trail.

---

## Rule 4: QR is READ + ACTION Gateway

Customer QR can only:

- view status
- approve/reject (if WAITING_APPROVAL)

---

## Rule 5: Idempotency

Repeated same transition must not break system.

---

# 9. Optional (Advanced Upgrade)

If you want enterprise-level design:

Convert this into:

```id="sm22"
Finite State Machine (FSM) service
```

With config:

```json
{
  "RECEIVED": ["DIAGNOSING"],
  "DIAGNOSING": ["WAITING_APPROVAL", "IN_REPAIR"],
  "WAITING_APPROVAL": ["APPROVED", "REJECTED"],
  "APPROVED": ["IN_REPAIR"],
  "REJECTED": ["READY_FOR_PICKUP"],
  "IN_REPAIR": ["QUALITY_CHECK"],
  "QUALITY_CHECK": ["READY_FOR_PICKUP", "IN_REPAIR"],
  "READY_FOR_PICKUP": ["DELIVERED"],
  "DELIVERED": ["CLOSED"]
}
```

---

# Final Summary

This state machine guarantees:

- No broken workflows
- No illegal transitions
- Full audit control
- Safe QR customer interaction
- Clean ERP-grade logic

---
