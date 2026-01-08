import frappe

def create_Head_role_for_department(doc, method):
    """
    بعد إنشاء قسم جديد، ينشئ Role بنفس اسمه.
    """
    role_name = f"{doc.department_name} Head"  # أو تقدر تشيل كلمة Role لو مش محتاجها

    if not frappe.db.exists("Role", role_name):
        frappe.get_doc({
            "doctype": "Role",
            "role_name": role_name
        }).insert(ignore_permissions=True)
        frappe.msgprint(f"✅ Created role: {role_name}")    
    else:
        frappe.msgprint(f"ℹ Role already exists: {role_name}")
    