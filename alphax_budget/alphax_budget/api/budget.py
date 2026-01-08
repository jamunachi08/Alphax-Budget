import frappe

# In a Python file (like hooks.py or custom method)
@frappe.whitelist()
def check_budget_account_exists(cost_center, fiscal_year, account):
    existing = frappe.db.sql("""
        SELECT b.name 
        FROM `tabBudget` b
        INNER JOIN `tabBudget Account` ba ON ba.parent = b.name
        WHERE b.cost_center = %s 
        AND b.fiscal_year = %s 
        AND ba.account = %s 
        AND b.docstatus = 1
        LIMIT 1
    """, (cost_center, fiscal_year, account))
    return existing[0][0] if existing else None


# app/api/budget.py
@frappe.whitelist()
def get_budget_with_accounts(budget_name):
    budget_doc = frappe.get_doc("Budget", budget_name)
    return budget_doc
