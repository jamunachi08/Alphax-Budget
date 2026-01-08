# alphax_budget/alphax_budget/api/budget_request.py

import frappe
from frappe import _
import json

@frappe.whitelist()
def check_and_create_budget(budget_request_name):
    """
    Server-side method to check and create budget with proper locking mechanism
    """
    try:
        # إنشاء database lock لمنع التكرار
        frappe.db.sql("SELECT GET_LOCK(%s, 10)", (f"budget_creation_{budget_request_name}",))
        
        try:
            # جلب الـ Budget Request
            budget_request = frappe.get_doc("Budget Request", budget_request_name)
            
            # فحص إذا كان البادجيت اتعمل خلاص
            if budget_request.budget_created:
                return {
                    "success": False,
                    "error": _("Budget already created for this request.")
                }
            
            # فحص للـ duplicate budgets
            duplicate_check = check_for_duplicate_budgets_server(budget_request)
            if duplicate_check["has_duplicate"]:
                return {
                    "success": False,
                    "error": duplicate_check["message"]
                }
            
            # إنشاء البادجيت
            budget_name = create_budget_with_distributions_server(budget_request)
            
            # تحديث الـ Budget Request
            frappe.db.set_value("Budget Request", budget_request_name, "budget_created", 1)
            frappe.db.commit()
            
            return {
                "success": True,
                "budget_name": budget_name
            }
            
        finally:
            # تحرير الـ lock
            frappe.db.sql("SELECT RELEASE_LOCK(%s)", (f"budget_creation_{budget_request_name}",))
            
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Error in budget creation: {str(e)}", "Budget Creation Error")
        return {
            "success": False,
            "error": str(e)
        }

def check_for_duplicate_budgets_server(budget_request):
    """
    Server-side duplicate budget check
    """
    try:
        accepted_items = [item for item in budget_request.budget_items_details if item.status == "Accepted"]
        fiscal_year = budget_request.fiscal_year
        cost_center = budget_request.cost_center
        
        for item in accepted_items:
            # فحص وجود بادجيت مماثل
            existing_budget = frappe.db.sql("""
                SELECT b.name as budget_name
                FROM `tabBudget` b
                JOIN `tabBudget Account` ba ON ba.parent = b.name
                WHERE b.cost_center = %s 
                AND b.fiscal_year = %s 
                AND ba.account = %s
                AND b.docstatus != 2
            """, (cost_center, fiscal_year, item.expense_account), as_dict=True)
            
            if existing_budget:
                message = _("Budget already exists: '{0}' for Cost Center '{1}', Account '{2}' in Fiscal Year {3}").format(
                    existing_budget[0].budget_name, 
                    cost_center, 
                    item.expense_account, 
                    fiscal_year
                )
                return {
                    "has_duplicate": True,
                    "message": message
                }
        
        return {"has_duplicate": False}
        
    except Exception as e:
        frappe.log_error(f"Error checking duplicates: {str(e)}", "Duplicate Check Error")
        raise

def create_budget_with_distributions_server(budget_request):
    """
    Server-side budget creation with distributions
    """
    try:
        accepted_items = [item for item in budget_request.budget_items_details if item.status == "Accepted"]
        
        if not accepted_items:
            frappe.throw(_("No accepted budget items found to create budgets."))
        
        accounts_table = []
        
        # إنشاء Monthly Distribution لكل صف
        for item in accepted_items:
            # إنشاء Monthly Distribution
            monthly_dist = create_monthly_distribution_server(budget_request, item)
            
            # إعداد الـ account budget
            account_budget = {
                "account": item.expense_account,
                "budget_amount": float(item.total or 0),
                "custom_monthly_distribution": monthly_dist.name
            }
            accounts_table.append(account_budget)
        
        # إنشاء البادجيت
        budget = create_budget_document_server(budget_request, accounts_table)
        
        # ربط الـ distributions بالبادجيت
        for row in accounts_table:
            frappe.db.set_value(
                'Monthly Distribution', 
                row['custom_monthly_distribution'], 
                'budget', 
                budget.name
            )
        
        return budget.name
        
    except Exception as e:
        frappe.log_error(f"Error creating budget: {str(e)}", "Budget Creation Error")
        raise

def create_monthly_distribution_server(budget_request, item):
    """
    إنشاء Monthly Distribution في الـ server
    """
    monthly_dist = frappe.new_doc("Monthly Distribution")
    monthly_dist.distribution_id = f"{budget_request.name}-{item.name}"
    monthly_dist.fiscal_year = budget_request.fiscal_year
    
    # حساب النسب الشهرية
    monthly_dist.percentages = calculate_monthly_percentages_server([item])
    
    monthly_dist.insert()
    return monthly_dist

def create_budget_document_server(budget_request, accounts_table):
    """
    إنشاء البادجيت في الـ server
    """
    budget = frappe.new_doc("Budget")
    alphax_budget.alphax_budgett_against = "Cost Center"
    budget.cost_center = budget_request.cost_center
    budget.fiscal_year = budget_request.fiscal_year
    budget.custom_budget_request_reference = budget_request.name
    
    # إضافة الـ accounts
    for account_data in accounts_table:
        budget.append("accounts", account_data)
    
    budget.insert()
    budget.submit()
    return budget

def calculate_monthly_percentages_server(items):
    """
    حساب النسب الشهرية في الـ server
    """
    month_list = ["january", "february", "march", "april", "may", "june", 
                  "july", "august", "september", "october", "november", "december"]
    month_names = ["January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"]
    
    total = 0
    monthly_values = {}
    
    # جمع القيم لكل شهر
    for item in items:
        for month in month_list:
            qty = float(getattr(item, month, 0) or 0)
            value = qty * float(item.expected_price or 0)
            monthly_values[month] = monthly_values.get(month, 0) + value
            total += value
    
    # إنشاء array النسب
    percentages = []
    for idx, name in enumerate(month_names):
        month_key = month_list[idx]
        perc = (monthly_values.get(month_key, 0) / total * 100) if total > 0 else (100 / 12)
        percentages.append({
            "month": name,
            "percentage_allocation": round(perc, 4)
        })
    
    return percentages