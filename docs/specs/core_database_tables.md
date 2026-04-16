Below is a **clean relational database schema** for your jewelry repair workshop system based on the workflow you described.
It is designed for **PostgreSQL / MySQL**, normalized enough for scalability but still simple for an MVP.

---

# Core Database Tables

## 1. branches

Stores all company branches.

```
branches
---------
id (PK)
name
code            -- example: BR1
address
phone
created_at
updated_at
```

Example:

```
1 | Riyadh Main | BR1
2 | Jeddah Mall | BR2
```

---

# 2. users

System users (admins, staff, technicians).

```
users
---------
id (PK)
name
email
phone
password_hash
role            -- workshop_admin | branch_admin | technician
branch_id (FK -> branches.id)
is_active
created_at
updated_at
```

---

# 3. customers

Customer information.

```
customers
---------
id (PK)
name
phone
email
created_at
updated_at
```

---

# 4. orders

Main repair order.

```
orders
---------
id (PK)
tracking_number         -- BR1-20260415-0003
tracking_token          -- secure public token for QR
customer_id (FK -> customers.id)
branch_id (FK -> branches.id)

status
created_by (FK -> users.id)

order_date
delivered_at
closed_at

notes
created_at
updated_at
```

Status values:

```
RECEIVED
DIAGNOSING
WAITING_APPROVAL
APPROVED
IN_REPAIR
QUALITY_CHECK
READY_FOR_PICKUP
DELIVERED
CLOSED
REJECTED
CANCELLED
```

---

# 5. order_items

Each jewelry piece inside the order.

```
order_items
---------
id (PK)
order_id (FK -> orders.id)

item_number             -- 01,02,03
item_type               -- ring, necklace, bracelet, earrings, set, other

description
quantity

ring_size_before
ring_size_after

bracelet_adjustment
necklace_adjustment

estimated_cost
final_cost

repair_description

approval_required
approval_status        -- pending | approved | rejected | skipped

created_at
updated_at
```

---

# 6. technicians

Technician profiles.

```
technicians
---------
id (PK)
user_id (FK -> users.id)
specialization
created_at
```

---

# 7. order_item_technicians

Technicians assigned to items.

```
order_item_technicians
---------
id (PK)
order_item_id (FK -> order_items.id)
technician_id (FK -> technicians.id)

assigned_at
completed_at
```

---

# 8. order_status_history

Audit log for every status change.

```
order_status_history
---------
id (PK)
order_id (FK -> orders.id)

old_status
new_status

changed_by (FK -> users.id)

notes
created_at
```

---

# 9. item_locations

Tracks where each item currently is.

```
item_locations
---------
id (PK)
order_item_id (FK -> order_items.id)

location

updated_by (FK -> users.id)
created_at
```

Location values:

```
BRANCH_SAFE
TRANSIT_TO_WORKSHOP
WORKSHOP_RECEIVED
TECHNICIAN_BENCH
QUALITY_CHECK
READY_SHELF
DELIVERED
```

---

# 10. item_photos

Stores photos of jewelry.

```
item_photos
---------
id (PK)
order_item_id (FK -> order_items.id)

photo_url
photo_type         -- before_repair | after_repair | damage | delivery

uploaded_by (FK -> users.id)

created_at
```

---

# 11. services

Repair service types.

```
services
---------
id (PK)
name
description
default_price
created_at
```

Example:

```
Ring resizing
Polishing
Stone replacement
Chain repair
Rhodium plating
```

---

# 12. order_item_services

Services performed for an item.

```
order_item_services
---------
id (PK)
order_item_id (FK -> order_items.id)
service_id (FK -> services.id)

price
notes
created_at
```

---

# 13. inventory_items

Repair materials and parts.

```
inventory_items
---------
id (PK)
name
category
stock_qty
unit
cost_per_unit
created_at
updated_at
```

Examples:

```
Diamond 2mm
Jump Ring 14k
Gold Chain Link
Clasp
```

---

# 14. repair_parts_used

Parts used during repair.

```
repair_parts_used
---------
id (PK)
order_item_id (FK -> order_items.id)
inventory_item_id (FK -> inventory_items.id)

quantity
created_at
```

---

# 15. invoices

Repair invoices.

```
invoices
---------
id (PK)
order_id (FK -> orders.id)

invoice_number
subtotal
vat_amount
total_amount

status      -- unpaid | paid

created_at
paid_at
```

---

# 16. payments

Payment records.

```
payments
---------
id (PK)
invoice_id (FK -> invoices.id)

amount
payment_method     -- cash | card | transfer
paid_by

created_at
```

---

# QR Tracking Fields

Orders must include:

```
tracking_number
tracking_token
```

Example:

```
tracking_number: BR1-20260415-0003
tracking_token: 8sd92KDs82
```

Public page:

```
/track/8sd92KDs82
```

---

# Key Relationships

```
customers
    ↓
orders
    ↓
order_items
    ↓
services / technicians / parts
```

```
orders
    ↓
status_history
```

```
order_items
    ↓
photos
locations
```

---

# Final Table Count

Core system uses **16 tables**:

```
branches
users
customers
orders
order_items
technicians
order_item_technicians
order_status_history
item_locations
item_photos
services
order_item_services
inventory_items
repair_parts_used
invoices
payments
```

This schema supports:

- multi-branch workshops
- technician assignments
- repair services
- inventory usage
- customer approval
- QR tracking
- full audit history

---
