/**
 * Expenses Ledger Module - Elmasa Curtain Workshop
 * Coordinates expense registrations, category totals, and history logs.
 */

let expCurrentPage = 1;
const expPageSize = 10;

document.addEventListener("DOMContentLoaded", () => {
  // Bind form submission
  document.getElementById("expense-form")?.addEventListener("submit", handleExpenseSubmit);
  
  // Search and filter listeners
  document.getElementById("exp-search-input")?.addEventListener("input", () => {
    expCurrentPage = 1;
    renderExpenses();
  });
  document.getElementById("exp-filter-category")?.addEventListener("change", () => {
    expCurrentPage = 1;
    renderExpenses();
  });

  // Pagination buttons
  document.getElementById("exp-prev-btn")?.addEventListener("click", () => {
    if (expCurrentPage > 1) {
      expCurrentPage--;
      renderExpenses();
    }
  });

  document.getElementById("exp-next-btn")?.addEventListener("click", () => {
    expCurrentPage++;
    renderExpenses();
  });
});

/**
 * Main Expenses Ledger Renderer
 */
window.renderExpenses = function() {
  const db = window.appState.db;
  const expenses = db.Expenses || [];
  
  const query = document.getElementById("exp-search-input")?.value.toLowerCase().trim() || "";
  const filterCat = document.getElementById("exp-filter-category")?.value || "All";

  // 1. Calculate category aggregations
  const categoryTotals = {
    Rent: 0,
    Salaries: 0,
    Electricity: 0,
    Transportation: 0,
    Other: 0
  };

  let totalExpensesSum = 0;

  expenses.forEach(e => {
    const amount = parseFloat(e["Amount"]) || 0;
    const cat = e["Category"] || "Other";
    totalExpensesSum += amount;

    if (categoryTotals.hasOwnProperty(cat)) {
      categoryTotals[cat] += amount;
    } else {
      categoryTotals.Other += amount;
    }
  });

  // Update category cards text
  const rentEl = document.getElementById("exp-card-rent");
  const salEl = document.getElementById("exp-card-salaries");
  const elecEl = document.getElementById("exp-card-electricity");
  const transEl = document.getElementById("exp-card-transport");
  const totalEl = document.getElementById("exp-card-total");

  if (rentEl) rentEl.textContent = formatCurrency(categoryTotals.Rent);
  if (salEl) salEl.textContent = formatCurrency(categoryTotals.Salaries);
  if (elecEl) elecEl.textContent = formatCurrency(categoryTotals.Electricity);
  if (transEl) transEl.textContent = formatCurrency(categoryTotals.Transportation);
  if (totalEl) totalEl.textContent = formatCurrency(totalExpensesSum);

  // 2. Filter Table list
  let filtered = expenses.filter(e => {
    const matchesSearch = 
      e["Expense Name"].toLowerCase().includes(query) ||
      e["Expense ID"].toLowerCase().includes(query) ||
      (e["Notes"] && e["Notes"].toLowerCase().includes(query));

    const matchesCat = filterCat === "All" || e["Category"] === filterCat;

    return matchesSearch && matchesCat;
  });

  // Sort by date descending
  filtered.sort((a, b) => new Date(b["Date"]) - new Date(a["Date"]));

  const total = filtered.length;
  const totalPages = Math.ceil(total / expPageSize) || 1;
  if (expCurrentPage > totalPages) expCurrentPage = totalPages;

  const start = (expCurrentPage - 1) * expPageSize;
  const end = Math.min(start + expPageSize, total);
  const paginated = filtered.slice(start, end);

  const prevBtn = document.getElementById("exp-prev-btn");
  const nextBtn = document.getElementById("exp-next-btn");
  const infoText = document.getElementById("exp-pagination-info");

  if (prevBtn) prevBtn.disabled = expCurrentPage === 1;
  if (nextBtn) nextBtn.disabled = expCurrentPage === totalPages;
  if (infoText) {
    infoText.textContent = total > 0 
      ? `عرض ${start + 1} - ${end} من إجمالي ${total} بند مصروفات`
      : "لا توجد مصروفات";
  }

  const tbody = document.getElementById("expenses-table-body");
  if (!tbody) return;

  if (paginated.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
          لم يتم العثور على مصروفات مطابقة للبحث.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = paginated.map(e => `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs">
      <td class="py-3 px-6 font-mono font-bold text-slate-600 dark:text-slate-400">${e["Expense ID"]}</td>
      <td class="py-3 px-6 text-right font-bold text-slate-900 dark:text-slate-100">${e["Expense Name"]}</td>
      <td class="py-3 px-6 text-right text-slate-500 dark:text-slate-400">${translateExpenseCategory(e["Category"])}</td>
      <td class="py-3 px-6 text-left font-mono font-bold text-slate-900 dark:text-slate-100">${formatCurrency(e["Amount"])}</td>
      <td class="py-3 px-6 text-center font-mono">${e["Date"]}</td>
    </tr>
  `).join("");
};

/**
 * Handle Expense Submit Form
 */
async function handleExpenseSubmit(e) {
  e.preventDefault();

  const name = document.getElementById("exp-name").value.trim();
  const category = document.getElementById("exp-category").value;
  const amount = parseFloat(document.getElementById("exp-amount").value);
  const date = document.getElementById("exp-date").value || getLocalDateString();
  const notes = document.getElementById("exp-notes").value.trim();

  if (!name || isNaN(amount) || amount <= 0) {
    showToast("يرجى إدخال اسم المصروف وقيمة صالحة أكبر من صفر", "warning");
    return;
  }

  showLoader("جاري تسجيل بند المصروفات...");

  try {
    const expense = {
      "Expense ID": generateId("EXP"),
      "Expense Name": name,
      "Category": category,
      "Amount": amount,
      "Date": date,
      "Notes": notes
    };

    await api.saveExpense(expense);
    
    // Reset form
    document.getElementById("expense-form").reset();
    document.getElementById("exp-date").value = getLocalDateString();

    showToast("تم تسجيل بند المصروف بنجاح", "success");
    await syncDatabase(true);
  } catch (err) {
    showToast(`فشل في حفظ المصروف: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

function translateExpenseCategory(cat) {
  const map = {
    "Rent": "إيجارات ومقرات",
    "Salaries": "أجور ورواتب الموظفين",
    "Electricity": "فواتير كهرباء ومرافق",
    "Transportation": "مصاريف نقل شحن وانتقال",
    "Other": "مصروفات نثرية أخرى"
  };
  return map[cat] || cat;
}
