# Patch file e.g. budget/patches/add_budget_request_link.py
import frappe

def execute():
    if not frappe.db.has_column("Budget Control", "budget_request"):
        frappe.get_doc({
            "doctype": "Custom Field",
            "dt": "Budget Control",
            "fieldname": "budget_request",
            "fieldtype": "Link",
            "label": "Budget Request",
            "options": "Budget Request",
            "insert_after": "some_field"  # حط الفيلد اللي تحب يجي بعده
        }).insert(ignore_permissions=True)
        frappe.db.commit()
