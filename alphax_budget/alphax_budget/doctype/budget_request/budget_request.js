// // Copyright (c) 2025, ahmed and contributors
// // For license information, please see license.txt
// frappe.ui.form.on("Budget Request", {


//   async before_save(frm) {
//          await validateBudgetRequest(frm);
//     },
//     async on_submit(frm) {
//         if (frm.doc.budget_created || frm._budget_creation_in_progress) {
//             frappe.msgprint(__("Budget creation is already completed or in progress."));
//             frappe.validated = false; // منع الـ submit
//             return;
//         }

//          await createBudgetWithDistributions(frm);
//     }
// });

// /**
//  * Validates the Budget Request form before submission
//  * @param {Object} frm - The form object
//  * @returns {boolean} - Returns false if validation fails
//  */
// async function validateBudgetRequest(frm) {
//     console.log("Validating Budget Request form on submit.");

//     try {
//         // Validate Cost Center
//         if (!validateCostCenter(frm)) return false;
        
//         // Validate Budget Items
//         if (!validateBudgetItems(frm)) return false;
        
//         // Check if budget already exists for this request
//         if (frm.doc.budget_created) {
//             console.log("Budget already created for this request");
//             frappe.show_alert({
//                 message: __("Budget already exists for this request"),
//                 indicator: 'orange'
//             });
//             return true;
//         }
        
//         // Check for existing budgets before creating new one
//         const duplicateFound = await checkForDuplicateBudgets(frm);
//         if (duplicateFound) {
//             frappe.throw("⚠️ يوجد بالفعل ميزانية لنفس مركز التكلفة والحساب.");
//         }
        
//         return true;


//     } catch (error) {
//         console.error("Validation error:", error);
//         frm._budget_creation_in_progress = false;
        
//         // Check if it's a duplicate budget error
//         if (error.message && error.message.includes("already exists")) {
//             frappe.show_alert({
//                 message: error.message,
//                 indicator: 'red'
//             });
//         } else {
//             frappe.throw("An error occurred during validation. Please try again.");
//         }
//         return false;
//     }
// }

// /**
//  * Checks for duplicate budgets before creating new ones
//  * @param {Object} frm - The form object
//  * @returns {boolean} - Returns true if duplicate found
//  */
// async function checkForDuplicateBudgets(frm) {
//     try {
//         const acceptedItems = frm.doc.budget_items_details.filter(item => item.status === "Accepted");
//         const fiscalYear = frm.doc.fiscal_year;
//         const costCenter = frm.doc.cost_center;
        
//         // Check each accepted item's account for duplicate budgets
//         for (let item of acceptedItems) {
//             const existingBudget = await frappe.call({
//                 method: "alphax_budget.alphax_budget.api.budget.check_budget_account_exists",
//                 args: {
//                     cost_center: costCenter,
//                     fiscal_year: fiscalYear,
//                     account: item.expense_account
//                 }
//             });

//             if (existingBudget && existingBudget.message) {
//                 const message = __("Budget already exists: '{0}' for Cost Center '{1}', Account '{2}' in Fiscal Year {3}. Cannot create duplicate budget.", 
//                     [existingBudget.message, costCenter, item.expense_account, fiscalYear]);
                
//                 // إعادة تعيين حالة الـ workflow
//                 frm.set_value("workflow_state", "save");
                
//                 // عرض رسالة مفصلة
//                 frappe.msgprint({
//                     title: __("Duplicate Budget Found"),
//                     message: message,
//                     indicator: 'red'
//                 });
                
//                 frappe.show_alert({
//                     message: __("Duplicate budget detected - operation cancelled"),
//                     indicator: 'red'
//                 });
                
//                 return true;
//             }
//         }
        
//         return false; // No duplicates found
//     } catch (error) {
//         console.error("Error checking for duplicate budgets:", error);
        
//         // إعادة تعيين حالة الـ workflow عند الخطأ
//         frm.set_value("workflow_state", "save");
        
//         frappe.msgprint({
//             title: __("Error Checking Budgets"),
//             message: __("An error occurred while checking for duplicate budgets: {0}", [error.message || error]),
//             indicator: 'red'
//         });
        
//         throw error;
//     }
// }

// /*** Validates that Cost Center is selected*/
// function validateCostCenter(frm) {
//     if (!frm.doc.cost_center) {
//         frappe.throw(__("Please select a Cost Center before submitting the form."));
//         return false;
//     }
//     return true;
// }
// /*** Validates budget items for required fields and accepted items */
// function validateBudgetItems(frm) {
//     if (!frm.doc.budget_items_details || frm.doc.budget_items_details.length === 0) {
//         frappe.throw(__("Please add at least one budget item."));
//         return false;
//     }

//     // Check for accepted items
//     const acceptedItems = frm.doc.budget_items_details.filter(item => item.status === "Accepted");
//     if (acceptedItems.length === 0) {
//         frappe.throw(__("Please accept at least one item before submitting the form."));
//         return false;
//     }

//     // Validate each row has required fields
//     const invalidRows = frm.doc.budget_items_details.filter(item => 
//         !item.expense_account || !item.expected_price || item.expected_price <= 0
//     );

//     if (invalidRows.length > 0) {
//         frappe.throw(__("Please ensure each row has a valid expense account and expected price greater than 0."));
//         return false;
//     }

//     return true;
// }

// async function createBudgetWithDistributions(frm) {
//     try {

//         if (frm.doc.budget_created) {
//             frappe.msgprint(__("Budget already created for this request."));
//             return;
//         }
//         if (frm._budget_creation_in_progress) {
//             console.log("⚠️ Budget creation already in progress");
//             return;
//         }
//         frm._budget_creation_in_progress = true;

//         const acceptedItems = frm.doc.budget_items_details.filter(item => item.status === "Accepted");

//         if (!acceptedItems.length) {
//             frappe.throw(__("No accepted budget items found to create budgets."));
//             return;
//         }

//         // frappe.show_progress(__("Creating Budgets"), 0, acceptedItems.length, __("Starting..."));
//         let totalSteps = acceptedItems.length + 2;
//          let currentStep = 0;
//         let accountsTable = [];
//         frappe.show_progress(__("Creating Budgets"), currentStep, totalSteps, __("Starting..."));
//         for (let i = 0; i < acceptedItems.length; i++) {
//             let item = acceptedItems[i];

//             // 1️⃣ Create monthly distribution for this row
//             const monthlyDistribution = await createMonthlyDistributionForRow(frm, item);

//             // 2️⃣ Prepare account budgets (بس للصف الواحد)
//             const accountBudget = {
//                 account: item.expense_account,
//                 budget_amount: parseFloat(item.total),
//                 custom_monthly_distribution: monthlyDistribution.name
//             };
//             accountsTable.push(accountBudget)
//             currentStep++;

//            frappe.show_progress(
//                 __("Creating Budgets"),
//                 currentStep,
//                 totalSteps,
//                 __("Prepared account {0}", [item.expense_account])
//             );
//         }


//         // 3️⃣ Create budget document 
//         const budget = await createBudgetDocument(frm, accountsTable);
//         currentStep++;
//         frappe.show_progress(
//             __("Creating Budgets"),
//             currentStep,
//             totalSteps,
//             __("Budget {0} created", [budget.name])
//         );

//         // 4️⃣ Link distribution → budget
//         for (let row of accountsTable) {
//             await frappe.db.set_value('Monthly Distribution', row.custom_monthly_distribution, 'budget', budget.name);
//         }
//         currentStep++;
//          frappe.show_progress(
//             __("Creating Budgets"),
//             currentStep,
//             totalSteps,
//             __("Distributions linked to budget")
//         );

//         // 5️⃣ Save progress
//         frm._budget_creation_in_progress = true;
//         await frappe.db.set_value('Budget Request', frm.doc.name, 'budget_created', 1);
        
//         frappe.hide_progress();
//         frm._budget_creation_in_progress = false;

//         frappe.show_alert({
//             message: __("Budget created successfully: {0}", [budget.name]),
//             indicator: 'green'
//         });

//         // Mark parent doc as done
//        console.log("✅ Budget created:", budget.name, "with accounts:", accountsTable);

//     } catch (error) {
//         frappe.hide_progress();
//         frm._budget_creation_in_progress = false;
//         console.error("Error creating budgets:", error);
//         frm.set_value("workflow_state", "save");
//         frappe.throw(__("Failed to create budgets: {0}", [error.message || error]));
//     }
// }

// async function createMonthlyDistributionForRow(frm, item) {
//     const monthlyDistribution = frappe.model.get_new_doc("Monthly Distribution");
//     monthlyDistribution.distribution_id = frm.doc.name + "-" + item.name;
//     monthlyDistribution.fiscal_year = frm.doc.fiscal_year;

//     // هنا بمرر الصف كـ Array علشان الدالة تقبله
//     monthlyDistribution.percentages = calculateMonthlyPercentages([item]);

//     return await frappe.db.insert(monthlyDistribution);
// }

// async function createBudgetDocument(frm, accountsTable) {
//     const budget = frappe.model.get_new_doc("Budget");
//     alphax_budget.alphax_budgett_against = "Cost Center";
//     budget.cost_center = frm.doc.cost_center;
//     budget.fiscal_year = frm.doc.fiscal_year;
//     budget.custom_budget_request_reference = frm.doc.name;
//     budget.accounts = accountsTable;

//     return await frappe.db.insert(budget);
// }

// /**
//  * Calculates monthly percentage allocations from budget items
//  * @param {Object} frm - The form object
//  * @returns {Array} - Array of monthly percentages
//  */
// function calculateMonthlyPercentages(items) {
//     const monthList = ["january","february","march","april","may","june","july","august","september","october","november","december"];
//     const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

//     let total = 0;
//     let monthlyValues = {};

//     // نجمع القيم لكل شهر
//     items.forEach(item => {
//         monthList.forEach(m => {
//             const qty = parseFloat(item[m] || 0);
//             const value = qty * parseFloat(item.expected_price || 0);
//             monthlyValues[m] = (monthlyValues[m] || 0) + value;
//             total += value;
//         });
//     });

//     // نرجع array فيها الشهر + النسبة
//     return monthNames.map((name, idx) => {
//         let monthKey = monthList[idx];
//         let perc = total > 0 ? (monthlyValues[monthKey] / total) * 100 : (100 / 12);
//         return {
//             month: name,
//             percentage_allocation: parseFloat(perc.toFixed(4))
//         };
//     });
// }

// =========================================================================


// Copyright (c) 2025, ahmed and contributors
// For license information, please see license.txt
// frappe.ui.form.on("Budget Request", {
//     // async before_save(frm) {
//     //     await validateBudgetRequest(frm);
//     // },
    
//     async on_submit(frm) {
//         // تحويل كل العملية للـ server
//         try {
//             frappe.show_progress(__("Creating Budget"), 0, 100, __("Processing..."));
            
//             const result = await frappe.call({
//                 method: "alphax_budget.alphax_budget.api.budget_request.check_and_create_budget",
//                 args: {
//                     budget_request_name: frm.doc.name
//                 }
//             });

//             frappe.hide_progress();

//             if (result.message && result.message.success) {
//                 frappe.show_alert({
//                     message: __("Budget created successfully: {0}", [result.message.budget_name]),
//                     indicator: 'green'
//                 });
                
//                 // تحديث الـ form
//                 frm.reload_doc();
//             } else if (result.message && result.message.error) {
//                 frappe.msgprint({
//                     title: __("Error"),
//                     message: result.message.error,
//                     indicator: 'red'
//                 });
//             }
//         } catch (error) {
//             frappe.hide_progress();
//             console.error("Error in budget creation:", error);
//             frappe.msgprint({
//                 title: __("Error"),
//                 message: __("An error occurred while creating the budget: {0}", [error.message]),
//                 indicator: 'red'
//             });
//         }
//     }
// });

/**
 * Validates the Budget Request form before submission
 * @param {Object} frm - The form object
 * @returns {boolean} - Returns false if validation fails
 */
// async function validateBudgetRequest(frm) {
//     console.log("Validating Budget Request form on submit.");

//     try {
//         // Validate Cost Center
//         // if (!validateCostCenter(frm)) return false;
        
//         // Validate Budget Items
//         if (!validateBudgetItems(frm)) return false;
        
//         return true;

//     } catch (error) {
//         console.error("Validation error:", error);
//         frappe.throw("An error occurred during validation. Please try again.");
//         return false;
//     }
// }

/**
 * Validates that Cost Center is selected
 */
// function validateCostCenter(frm) {
//     if (!frm.doc.cost_center) {
//         frappe.throw(__("Please select a Cost Center before submitting the form."));
//         return false;
//     }
//     return true;
// }

/**
 * Validates budget items for required fields and accepted items
 */
// function validateBudgetItems(frm) {
//     if (!frm.doc.budget_items_details || frm.doc.budget_items_details.length === 0) {
//         frappe.throw(__("Please add at least one budget item."));
//         return false;
//     }

//     // Check for accepted items
//     const acceptedItems = frm.doc.budget_items_details.filter(item => item.status === "Accepted");
//     if (acceptedItems.length === 0) {
//         frappe.throw(__("Please accept at least one item before submitting the form."));
//         return false;
//     }

//     // Validate each row has required fields
//     const invalidRows = frm.doc.budget_items_details.filter(item => 
//         !item.expense_account || !item.expected_price || item.expected_price <= 0
//     );

//     if (invalidRows.length > 0) {
//         frappe.throw(__("Please ensure each row has a valid expense account and expected price greater than 0."));
//         return false;
//     }

//     return true;
// }
