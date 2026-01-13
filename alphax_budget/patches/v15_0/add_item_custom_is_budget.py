import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_field

def execute():
    # Add custom_is_budget to Item if missing
    if frappe.db.exists("Custom Field", {"dt": "Item", "fieldname": "custom_is_budget"}):
        return

    create_custom_field("Item", {
        "fieldname": "custom_is_budget",
        "label": "Is Budget Item",
        "fieldtype": "Check",
        "default": 0,
        "insert_after": "item_group",  # change if you want
        "description": "Used by AlphaX Budget to filter budget-controlled items."
    })
