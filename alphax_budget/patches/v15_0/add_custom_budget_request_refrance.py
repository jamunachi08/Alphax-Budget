# Patch file e.g. budget/patches/add_budget_request_link.py
import frappe

def execute():
    if not frappe.db.has_column("Budget", "custom_budget_request_refrance"):
        frappe.get_doc({
            "doctype": "Custom Field",
            "dt": "Budget",
            "fieldname": "custom_budget_request_refrance",
            "fieldtype": "Link",
            "label": "Budget Request",
            "options": "Budget Request",
            "insert_after": "name"  # حط الفيلد اللي تحب يجي بعده
        }).insert(ignore_permissions=True)
        frappe.db.commit()
