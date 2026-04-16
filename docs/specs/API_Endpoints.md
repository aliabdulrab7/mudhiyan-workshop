Below is a **clean, production-style REST API design** for your Jewelry Repair Workshop system. This is structured so Claude (or any backend agent) can implement it directly without confusion.

---

# Jewelry Repair Workshop System – API Endpoints

Base URL:

```
/api/v1
```

---

# 1. AUTH

## Login

```
POST /auth/login
```

Request:

```json
{
  "email": "admin@shop.com",
  "password": "123456"
}
```

Response:

```json
{
  "token": "JWT_TOKEN",
  "user": {
    "id": 1,
    "role": "branch_admin"
  }
}
```

---

## Get Current User

```
GET /auth/me
```

---

# 2. BRANCHES

## Create Branch

```
POST /branches
```

## Get All Branches

```
GET /branches
```

## Get Branch

```
GET /branches/:id
```

## Update Branch

```
PUT /branches/:id
```

## Delete Branch

```
DELETE /branches/:id
```

---

# 3. CUSTOMERS

## Create Customer

```
POST /customers
```

## Get Customers

```
GET /customers
```

## Get Customer

```
GET /customers/:id
```

## Update Customer

```
PUT /customers/:id
```

---

# 4. ORDERS (CORE MODULE)

## Create Order (Branch intake)

```
POST /orders
```

Request:

```json
{
  "customer_id": 1,
  "branch_id": 1,
  "items": [
    {
      "item_type": "ring",
      "description": "Gold ring with stone",
      "quantity": 1
    }
  ]
}
```

---

## Get Orders

```
GET /orders?status=&branch_id=
```

---

## Get Single Order

```
GET /orders/:id
```

---

## Update Order

```
PUT /orders/:id
```

---

## Delete Order (restricted)

```
DELETE /orders/:id
```

---

## Assign Technician to Item

```
POST /orders/:orderId/items/:itemId/assign-technician
```

```json
{
  "technician_id": 5
}
```

---

## Update Order Status (main workflow engine)

```
POST /orders/:id/status
```

```json
{
  "status": "DIAGNOSING",
  "notes": "Initial inspection completed"
}
```

---

# 5. CUSTOMER QR TRACKING

## Public Tracking Page (NO AUTH)

```
GET /track/:token
```

Response:

```json
{
  "order_number": "BR1-20260415-0003",
  "status": "WAITING_APPROVAL",
  "items": [...],
  "estimated_cost": 120
}
```

---

## Customer Approve Repair

```
POST /track/:token/approve
```

---

## Customer Reject Repair

```
POST /track/:token/reject
```

---

# 6. ORDER ITEMS

## Update Item

```
PUT /order-items/:id
```

---

## Add Repair Details

```
POST /order-items/:id/diagnosis
```

```json
{
  "repair_description": "Resize ring",
  "estimated_cost": 100
}
```

---

## Upload Item Photo

```
POST /order-items/:id/photos
```

---

## Get Item Photos

```
GET /order-items/:id/photos
```

---

# 7. SERVICES

## Create Service

```
POST /services
```

## Get Services

```
GET /services
```

## Update Service

```
PUT /services/:id
```

---

## Assign Service to Item

```
POST /order-items/:id/services
```

```json
{
  "service_id": 2,
  "price": 50
}
```

---

# 8. TECHNICIANS

## Create Technician

```
POST /technicians
```

## Get Technicians

```
GET /technicians
```

## Assign Technician to Order Item

```
POST /order-items/:id/technicians
```

---

# 9. INVENTORY

## Create Inventory Item

```
POST /inventory
```

## Get Inventory

```
GET /inventory
```

## Update Stock

```
PATCH /inventory/:id/stock
```

```json
{
  "quantity_change": -2
}
```

---

## Record Parts Used in Repair

```
POST /order-items/:id/parts
```

```json
{
  "inventory_item_id": 3,
  "quantity": 2
}
```

---

# 10. INVOICES

## Create Invoice

```
POST /invoices
```

## Get Invoices

```
GET /invoices
```

## Get Invoice

```
GET /invoices/:id
```

## Mark Invoice Paid

```
POST /invoices/:id/pay
```

```json
{
  "amount": 200,
  "method": "cash"
}
```

---

# 11. PAYMENTS

## List Payments

```
GET /payments
```

## Create Payment

```
POST /payments
```

---

# 12. REPORTS

## Dashboard Summary

```
GET /reports/dashboard
```

Returns:

```json
{
  "total_orders": 120,
  "active_orders": 30,
  "revenue": 50000,
  "pending_approvals": 10
}
```

---

## Branch Report

```
GET /reports/branches/:id
```

---

## Technician Performance

```
GET /reports/technicians/:id
```

---

# 13. NOTIFICATIONS (IMPORTANT)

## Send Manual Notification

```
POST /notifications/send
```

## Auto Events (system triggers)

- WAITING_APPROVAL → send SMS/WhatsApp
- READY_FOR_PICKUP → notify customer
- DELIVERED → confirmation message

---

# 14. CORE WORKFLOW RULE (VERY IMPORTANT)

Backend MUST enforce this logic:

```id="wf1"
IF estimated_cost > 0
    status = WAITING_APPROVAL
ELSE
    status = IN_REPAIR
```

Customer approval endpoints only work when:

```id="wf2"
status == WAITING_APPROVAL
```

---

# 15. SECURITY RULES

- `/track/:token` is public but read-only
- only authenticated users can modify orders
- technicians cannot delete anything
- only workshop admin can override status
- all status changes must be logged

---

# FINAL NOTE

This API design gives you:

- full ERP workflow control
- QR-based customer interaction
- technician workflow
- inventory tracking
- invoice system
- audit system

---
