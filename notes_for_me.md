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

{
"project": "Mudhiyan Workshop Management System",
"objective": "Build a structured workshop management system that controls the full lifecycle of repair jobs from receiving items to delivering them back to customers with clear workflow enforcement and traceable operations.",

"core_concept": {
"system_center": "Job Order",
"description": "All operations revolve around a job order that tracks the lifecycle of a received item until delivery."
},

"workflow_lifecycle": {
"stages": [
"RECEIVED",
"DIAGNOSING",
"WAITING_APPROVAL",
"IN_REPAIR",
"QUALITY_CHECK",
"READY_FOR_PICKUP",
"INVOICED",
"DELIVERED",
"CLOSED"
],
"rules": {
"enforce_sequential_progression": true,
"prevent_status_skipping": true,
"track_status_history": true
}
},

"entities": {
"customer": {
"fields": [
"id",
"name",
"phone",
"email",
"address",
"created_at"
]
},

    "item": {
      "fields": [
        "id",
        "customer_id",
        "item_type",
        "brand",
        "model",
        "serial_number",
        "notes",
        "created_at"
      ]
    },

    "job": {
      "fields": [
        "id",
        "job_number",
        "customer_id",
        "item_id",
        "status",
        "technician_id",
        "diagnosis_notes",
        "repair_notes",
        "received_at",
        "ready_at",
        "delivered_at"
      ]
    },

    "job_services": {
      "fields": [
        "id",
        "job_id",
        "service_name",
        "description",
        "price"
      ]
    },

    "job_parts": {
      "fields": [
        "id",
        "job_id",
        "part_id",
        "quantity",
        "price"
      ]
    },

    "inventory_parts": {
      "fields": [
        "id",
        "name",
        "sku",
        "stock_quantity",
        "cost",
        "supplier"
      ]
    },

    "technician": {
      "fields": [
        "id",
        "name",
        "phone",
        "skills",
        "active"
      ]
    },

    "invoice": {
      "fields": [
        "id",
        "job_id",
        "total_amount",
        "status",
        "issued_at",
        "paid_at"
      ]
    },

    "status_history": {
      "fields": [
        "id",
        "job_id",
        "old_status",
        "new_status",
        "changed_by",
        "changed_at"
      ]
    }

},

"item_location_tracking": {
"locations": [
"FRONT_DESK",
"TECHNICIAN",
"REPAIR_AREA",
"STORAGE",
"READY_FOR_PICKUP",
"DELIVERED"
],
"rules": {
"location_updates_on_status_change": true,
"track_last_location": true
}
},

"business_logic": {
"job_creation": {
"steps": [
"register_customer",
"register_item",
"create_job",
"assign_job_number",
"print_job_label"
]
},

    "diagnosis_process": {
      "steps": [
        "assign_technician",
        "record_diagnosis_notes",
        "estimate_repair_cost",
        "request_customer_approval"
      ]
    },

    "repair_process": {
      "steps": [
        "add_services",
        "add_parts_used",
        "update_repair_notes",
        "mark_repair_completed"
      ]
    },

    "delivery_process": {
      "conditions": [
        "job_status == READY_FOR_PICKUP",
        "invoice_generated == true"
      ],
      "steps": [
        "generate_invoice",
        "collect_payment",
        "confirm_delivery",
        "update_job_status_to_delivered"
      ]
    }

},

"user_roles": {
"role_based_access": true,
"roles": [
{
"name": "Admin",
"access": "full"
},
{
"name": "Reception",
"permissions": [
"create_jobs",
"register_customers",
"deliver_items",
"create_invoices"
]
},
{
"name": "Technician",
"permissions": [
"view_assigned_jobs",
"update_diagnosis",
"update_repair_status",
"add_parts"
]
},
{
"name": "Manager",
"permissions": [
"view_reports",
"manage_jobs",
"monitor_technicians"
]
}
]
},

"ui_structure": {
"navigation": {
"type": "sidebar",
"items": [
"Dashboard",
"Jobs",
"Customers",
"Inventory",
"Technicians",
"Invoices",
"Reports",
"Settings"
]
},

    "dashboard": {
      "widgets": [
        "active_jobs",
        "jobs_ready_for_pickup",
        "technician_workload",
        "inventory_alerts",
        "daily_revenue"
      ]
    },

    "job_interface": {
      "sections": [
        "job_summary",
        "customer_information",
        "item_details",
        "diagnosis_notes",
        "repair_notes",
        "services",
        "parts_used",
        "status_history"
      ]
    }

},

"productivity_features": {
"quick_job_creation": true,
"barcode_job_tags": true,
"search_by_phone_or_job_number": true,
"job_status_filters": true,
"bulk_inventory_update": true
},

"reporting": {
"reports": [
"daily_jobs",
"technician_performance",
"inventory_usage",
"revenue_summary",
"customer_history"
]
},

"constraints": {
"jobs_must_follow_workflow": true,
"items_cannot_be_delivered_without_job": true,
"jobs_cannot_be_closed_without_delivery": true,
"inventory_deducted_when_parts_used": true
}
}
