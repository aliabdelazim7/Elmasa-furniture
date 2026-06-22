/**
 * Reports Engine & Danger Zone Module - Elmasa Curtain Workshop
 * Compiles P&L summaries, rankings, technician KPIs, exports CSVs, and executes database purges.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Bind report selector tab buttons
  const tabs = ["sales", "profit", "customer", "inventory"];
  tabs.forEach(tab => {
    document.getElementById(`report-tab-${tab}`)?.addEventListener("click", () => {
      selectReportTab(tab);
    });
  });

  // Bind CSV export buttons
  document.getElementById("report-sales-csv")?.addEventListener("click", exportSalesReportCSV);
  document.getElementById("report-profit-csv")?.addEventListener("click", exportProfitReportCSV);
  document.getElementById("report-customer-csv")?.addEventListener("click", exportCustomerReportCSV);
  document.getElementById("report-inventory-csv")?.addEventListener("click", exportInventoryReportCSV);
  document.getElementById("report-technician-csv")?.addEventListener("click", exportTechnicianReportCSV);

  // Danger zone purge submit
  document.getElementById("danger-purge-form")?.addEventListener("submit", handleDangerPurge);
});

function selectReportTab(activeTab) {
  const tabs = ["sales", "profit", "customer", "inventory"];
  tabs.forEach(tab => {
    const btn = document.getElementById(`report-tab-${tab}`);
    const section = document.getElementById(`report-sec-${tab}`);
    if (tab === activeTab) {
      btn?.classList.add("bg-indigo-600", "text-white");
      btn?.classList.remove("bg-white", "dark:bg-slate-800", "text-slate-700", "dark:text-slate-300");
      section?.classList.remove("hidden");
    } else {
      btn?.classList.remove("bg-indigo-600", "text-white");
      btn?.classList.add("bg-white", "dark:bg-slate-800", "text-slate-700", "dark:text-slate-300");
      section?.classList.add("hidden");
    }
  });

  renderReportData(activeTab);
}

window.renderReports = function() {
  // Default to active report tab
  const activeTab = document.querySelector('[id^="report-tab-"].bg-indigo-600')?.id.replace("report-tab-", "") || "sales";
  selectReportTab(activeTab);
};

function renderReportData(tab) {
  const db = window.appState.db;
  
  if (tab === "sales") {
    // Sales Report: lists orders
    const orders = (db.Orders || []).filter(o => o["Order Status"] !== "Quotation");
    const tbody = document.getElementById("rep-sales-tbody");
    if (!tbody) return;

    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-slate-400">لا توجد مبيعات مسجلة</td></tr>`;
      return;
    }

    let totalCostSum = 0;
    let totalPaidSum = 0;
    let totalRemSum = 0;

    tbody.innerHTML = orders.map(o => {
      const cust = db.Customers.find(c => c["Customer ID"] === o["Customer ID"]);
      const name = cust ? cust["Full Name"] : "مجهول";
      const total = parseFloat(o["Total Cost"]) || 0;
      const paid = parseFloat(o["Paid Amount"]) || 0;
      const rem = parseFloat(o["Remaining Amount"]) || 0;

      totalCostSum += total;
      totalPaidSum += paid;
      totalRemSum += rem;

      return `
        <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
          <td class="py-2 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">${escapeHtml(o["Order ID"])}</td>
          <td class="py-2 px-4 font-mono">${o["Order Date"]}</td>
          <td class="py-2 px-4 font-bold text-slate-800 dark:text-slate-200">${escapeHtml(name)}</td>
          <td class="py-2 px-4 font-mono text-left">${formatCurrency(total)}</td>
          <td class="py-2 px-4 font-mono text-left text-emerald-600">${formatCurrency(paid)}</td>
          <td class="py-2 px-4 font-mono text-left text-rose-500 font-semibold">${formatCurrency(rem)}</td>
        </tr>
      `;
    }).join("");

    // Update report totals UI
    document.getElementById("rep-sales-total-cost").textContent = formatCurrency(totalCostSum);
    document.getElementById("rep-sales-total-paid").textContent = formatCurrency(totalPaidSum);
    document.getElementById("rep-sales-total-rem").textContent = formatCurrency(totalRemSum);

  } else if (tab === "profit") {
    // Profit Report: Revenue minus Material Cost minus Expenses equals Net Profit
    const orders = (db.Orders || []).filter(o => o["Order Status"] !== "Quotation");
    const orderMats = db.OrderMaterials || [];
    const items = db.InventoryItems || [];
    const expenses = db.Expenses || [];
    const payments = db.Payments || [];

    const totalSalesVolume = orders.reduce((sum, o) => sum + (parseFloat(o["Total Cost"]) || 0), 0);
    const totalCashCollected = payments.reduce((sum, p) => {
      const order = orders.find(o => o["Order ID"] === p["Order ID"]);
      if (!order) return sum; // Skip payments for Quotation orders
      return sum + (parseFloat(p["Amount"]) || 0);
    }, 0);

    // Calculate total materials cost (COGS) based on purchase price
    let totalCOGS = 0;
    orderMats.forEach(m => {
      const order = orders.find(o => o["Order ID"] === m["Order ID"]);
      if (!order) return; // Skip materials for Quotation orders
      const prod = items.find(i => i["Item ID"] === m["Item ID"]);
      const buyPrice = prod ? parseFloat(prod["Purchase Price"]) || 0 : 0;
      totalCOGS += buyPrice * (parseFloat(m["Quantity Used"]) || 0);
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e["Amount"]) || 0), 0);
    const netProfit = totalSalesVolume - totalCOGS - totalExpenses;

    document.getElementById("rep-prof-revenue").textContent = formatCurrency(totalSalesVolume);
    document.getElementById("rep-prof-cash").textContent = formatCurrency(totalCashCollected);
    document.getElementById("rep-prof-cogs").textContent = formatCurrency(totalCOGS);
    document.getElementById("rep-prof-expenses").textContent = formatCurrency(totalExpenses);
    
    const profitEl = document.getElementById("rep-prof-net");
    if (profitEl) {
      profitEl.textContent = formatCurrency(netProfit);
      profitEl.className = `text-2xl font-bold font-mono ${netProfit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500'}`;
    }

  } else if (tab === "customer") {
    // Customer Report: Best customers & outstanding balances list
    const customers = db.Customers || [];
    const orders = (db.Orders || []).filter(o => o["Order Status"] !== "Quotation");

    const rankList = customers.map(c => {
      const custOrders = orders.filter(o => o["Customer ID"] === c["Customer ID"]);
      const purchased = custOrders.reduce((sum, o) => sum + (parseFloat(o["Total Cost"]) || 0), 0);
      const remaining = custOrders.reduce((sum, o) => sum + (parseFloat(o["Remaining Amount"]) || 0), 0);
      return {
        id: c["Customer ID"],
        name: c["Full Name"],
        phone: c["Phone Number"],
        purchased,
        remaining
      };
    });

    // Best Customers (rank by total purchased desc)
    const bestTbody = document.getElementById("rep-cust-best-tbody");
    if (bestTbody) {
      const best = [...rankList].sort((a, b) => b.purchased - a.purchased).slice(0, 10);
      if (best.length === 0) {
        bestTbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400">لا يوجد عملاء مسجلين</td></tr>`;
      } else {
        bestTbody.innerHTML = best.map((c, idx) => `
          <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
            <td class="py-2 px-4 text-center font-bold text-indigo-600 font-mono">${idx + 1}</td>
            <td class="py-2 px-4 font-bold text-slate-800 dark:text-slate-200">${escapeHtml(c.name)}</td>
            <td class="py-2 px-4 font-mono">${escapeHtml(c.phone)}</td>
            <td class="py-2 px-4 font-mono text-left">${formatCurrency(c.purchased)}</td>
          </tr>
        `).join("");
      }
    }

    // Debtors list (sorted by outstanding balances desc)
    const debtTbody = document.getElementById("rep-cust-debt-tbody");
    if (debtTbody) {
      const debtors = [...rankList].filter(c => c.remaining > 0).sort((a, b) => b.remaining - a.remaining);
      if (debtors.length === 0) {
        debtTbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-emerald-600 font-bold">لا يوجد مديونيات معلقة حالياً، عمل رائع!</td></tr>`;
      } else {
        debtTbody.innerHTML = debtors.map(c => `
          <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
            <td class="py-2 px-4 font-mono font-bold text-slate-600 dark:text-slate-400">${escapeHtml(c.id)}</td>
            <td class="py-2 px-4 font-bold text-slate-800 dark:text-slate-200">${escapeHtml(c.name)}</td>
            <td class="py-2 px-4 font-mono">${escapeHtml(c.phone)}</td>
            <td class="py-2 px-4 font-mono text-left text-rose-500 font-bold">${formatCurrency(c.remaining)}</td>
          </tr>
        `).join("");
      }
    }

  } else if (tab === "inventory") {
    // Inventory Reports
    const items = db.InventoryItems || [];
    const orderMats = db.OrderMaterials || [];

    const lowStock = items.filter(item => {
      const qty = parseFloat(item["Quantity Available"]) || 0;
      const min = parseFloat(item["Minimum Quantity Alert"]) || 0;
      return item["Item Category"] !== "Services" && qty <= min;
    });

    const lowTbody = document.getElementById("rep-inv-low-tbody");
    if (lowTbody) {
      if (lowStock.length === 0) {
        lowTbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-emerald-600 font-semibold">المخزون أمن بالكامل</td></tr>`;
      } else {
        lowTbody.innerHTML = lowStock.map(p => `
          <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
            <td class="py-2 px-4 font-mono font-bold text-slate-600 dark:text-slate-400">${escapeHtml(p["Item ID"])}</td>
            <td class="py-2 px-4 font-bold text-slate-800 dark:text-slate-200">${escapeHtml(p["Item Name"])}</td>
            <td class="py-2 px-4 font-mono text-center font-bold text-rose-500">${p["Quantity Available"]} ${translateUnit(escapeHtml(p["Unit"]))}</td>
            <td class="py-2 px-4 font-mono text-center text-slate-500 dark:text-slate-400">${p["Minimum Quantity Alert"]} ${translateUnit(escapeHtml(p["Unit"]))}</td>
          </tr>
        `).join("");
      }
    }

    // Most Consumed Materials list
    const matCounts = {};
    orderMats.forEach(om => {
      const order = (db.Orders || []).find(o => o["Order ID"] === om["Order ID"]);
      if (!order || order["Order Status"] === "Quotation") return; // Skip Quotations
      matCounts[om["Item ID"]] = (matCounts[om["Item ID"]] || 0) + (parseFloat(om["Quantity Used"]) || 0);
    });

    const sortedMats = Object.entries(matCounts).map(([itemId, qty]) => {
      const prod = items.find(i => i["Item ID"] === itemId);
      const name = prod ? prod["Item Name"] : itemId;
      const unit = prod ? prod["Unit"] : "";
      const cat = prod ? prod["Item Category"] : "";
      return { id: itemId, name, qty, unit, cat };
    }).sort((a, b) => b.qty - a.qty);

    const conTbody = document.getElementById("rep-inv-con-tbody");
    if (conTbody) {
      if (sortedMats.length === 0) {
        conTbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400">لا توجد حركة سحب خامات بعد</td></tr>`;
      } else {
        conTbody.innerHTML = sortedMats.map(m => `
          <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
            <td class="py-2 px-4 font-mono font-bold text-slate-600 dark:text-slate-400">${escapeHtml(m.id)}</td>
            <td class="py-2 px-4 font-bold text-slate-800 dark:text-slate-200">${escapeHtml(m.name)}</td>
            <td class="py-2 px-4 text-right text-slate-500 dark:text-slate-400">${translateCategory(m.cat)}</td>
            <td class="py-2 px-4 font-mono text-center font-bold text-indigo-600">${m.qty.toFixed(1)} ${translateUnit(escapeHtml(m.unit))}</td>
          </tr>
        `).join("");
      }
    }

  } else if (tab === "technician") {
    // Technician Performance Report
    const techs = db.Technicians || [];
    const orders = (db.Orders || []).filter(o => o["Order Status"] !== "Quotation");
    const tbody = document.getElementById("rep-tech-tbody");
    
    if (!tbody) return;

    if (techs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400">لم يتم إضافة فنيين في النظام بعد.</td></tr>`;
      return;
    }

    tbody.innerHTML = techs.map(t => {
      const techName = t["Technician Name"];
      const techOrders = orders.filter(o => o["Assigned Technician"] === techName);
      
      const completedCount = techOrders.filter(o => o["Order Status"] === "Installed" || o["Order Status"] === "Delivered" || o["Order Status"] === "Closed").length;
      const pendingCount = techOrders.length - completedCount;
      const associatedRevenue = techOrders.reduce((sum, o) => sum + (parseFloat(o["Total Cost"]) || 0), 0);

      return `
        <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
          <td class="py-2 px-4 font-bold text-slate-800 dark:text-slate-200">${escapeHtml(techName)}</td>
          <td class="py-2 px-4 text-center font-mono font-bold text-emerald-600">${completedCount} تركيبات</td>
          <td class="py-2 px-4 text-center font-mono font-bold text-amber-500">${pendingCount} تركيبات</td>
          <td class="py-2 px-4 font-mono text-left font-semibold text-slate-900 dark:text-slate-100">${formatCurrency(associatedRevenue)}</td>
        </tr>
      `;
    }).join("");
  }
}

/**
 * Danger Zone DB Purge
 */
async function handleDangerPurge(e) {
  e.preventDefault();

  const phrase = document.getElementById("danger-confirm-phrase").value.trim();
  if (phrase !== "مسح البيانات") {
    showToast("خطأ: يرجى كتابة العبارة التأكيدية بدقة لمسح قاعدة البيانات", "error");
    return;
  }

  const confirmSec = confirm("تحذير حرج: هل أنت متأكد بنسبة 100% أنك تريد مسح كافة العملاء، الفواتير، المقاسات، الخامات، المصروفات، وإعدادات النظام بالكامل وتصفير البرنامج؟ لا يمكن التراجع عن هذا الإجراء.");
  if (!confirmSec) return;

  showLoader("جاري مسح وتطهير قواعد البيانات بالكامل...");

  try {
    await api.clearDatabase("مسح البيانات");
    showToast("تم تطهير وتصفير قاعدة البيانات بنجاح", "success");
    setTimeout(() => {
      localStorage.removeItem("elmasa_session_active");
      location.reload();
    }, 2000);
  } catch (err) {
    showToast(`فشلت عملية التطهير: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

/**
 * CSV Exports Engines
 */
function downloadCSV(filename, csvData) {
  const blob = new Blob(["\ufeff" + csvData], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

function exportSalesReportCSV() {
  const db = window.appState.db;
  const orders = (db.Orders || []).filter(o => o["Order Status"] !== "Quotation");
  
  let csv = "رقم الطلب,تاريخ الطلب,العميل,التكلفة الاجمالية,المسدد,المتبقي للتحصيل,الفني المكلف,الحالة\n";
  orders.forEach(o => {
    const cust = db.Customers.find(c => c["Customer ID"] === o["Customer ID"]);
    const name = cust ? cust["Full Name"] : "مجهول";
    csv += `"${o["Order ID"]}","${o["Order Date"]}","${name}",${o["Total Cost"]},${o["Paid Amount"]},${o["Remaining Amount"]},"${o["Assigned Technician"] || ""}","${o["Order Status"]}"\n`;
  });

  downloadCSV(`تقرير_مبيعات_الماسة_${getLocalDateString()}.csv`, csv);
}

function exportProfitReportCSV() {
  const db = window.appState.db;
  const orders = (db.Orders || []).filter(o => o["Order Status"] !== "Quotation");
  const orderMats = db.OrderMaterials || [];
  const items = db.InventoryItems || [];
  const expenses = db.Expenses || [];

  const totalSales = orders.reduce((sum, o) => sum + (parseFloat(o["Total Cost"]) || 0), 0);
  let totalCOGS = 0;
  orderMats.forEach(m => {
    const order = orders.find(o => o["Order ID"] === m["Order ID"]);
    if (!order) return; // Skip
    const prod = items.find(i => i["Item ID"] === m["Item ID"]);
    const buyPrice = prod ? parseFloat(prod["Purchase Price"]) || 0 : 0;
    totalCOGS += buyPrice * (parseFloat(m["Quantity Used"]) || 0);
  });
  const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e["Amount"]) || 0), 0);
  const profit = totalSales - totalCOGS - totalExpenses;

  let csv = "البند التشغيلي,القيمة المباشرة (EGP)\n";
  csv += `"إجمالي المبيعات والفواتير",${totalSales}\n`;
  csv += `"تكلفة شراء الخامات المستهلكة (COGS)",${totalCOGS}\n`;
  csv += `"إجمالي المصاريف والتشغيل",${totalExpenses}\n`;
  csv += `"صافي الأرباح الكلية (Net Profit)",${profit}\n`;

  downloadCSV(`تقرير_الارباح_والخسائر_${getLocalDateString()}.csv`, csv);
}

function exportCustomerReportCSV() {
  const db = window.appState.db;
  const customers = db.Customers || [];
  const orders = (db.Orders || []).filter(o => o["Order Status"] !== "Quotation");

  let csv = "معرف العميل,اسم العميل,رقم الهاتف,اجمالي المشتريات,الديون المتبقية للتحصيل\n";
  customers.forEach(c => {
    const custOrders = orders.filter(o => o["Customer ID"] === c["Customer ID"]);
    const purchased = custOrders.reduce((sum, o) => sum + (parseFloat(o["Total Cost"]) || 0), 0);
    const remaining = custOrders.reduce((sum, o) => sum + (parseFloat(o["Remaining Amount"]) || 0), 0);
    csv += `"${c["Customer ID"]}","${c["Full Name"]}","${c["Phone Number"]}",${purchased},${remaining}\n`;
  });

  downloadCSV(`تقرير_العملاء_والديون_${getLocalDateString()}.csv`, csv);
}

function exportInventoryReportCSV() {
  const db = window.appState.db;
  const items = db.InventoryItems || [];

  let csv = "معرف المنتج,اسم المنتج,القسم,الوحدة,سعر الشراء,سعر البيع,المخزون المتوفر,حد الامان,المورد\n";
  items.forEach(p => {
    csv += `"${p["Item ID"]}","${p["Item Name"]}","${p["Item Category"]}","${p["Unit"]}",${p["Purchase Price"]},${p["Selling Price"]},${p["Quantity Available"]},${p["Minimum Quantity Alert"]},"${p["Supplier"] || ""}"\n`;
  });

  downloadCSV(`تقرير_جرد_المخازن_${getLocalDateString()}.csv`, csv);
}

function exportTechnicianReportCSV() {
  const db = window.appState.db;
  const techs = db.Technicians || [];
  const orders = (db.Orders || []).filter(o => o["Order Status"] !== "Quotation");

  let csv = "اسم الفني,التركيبات المكتملة,التركيبات المعلقة,حجم الاعمال المسند بالجنيه\n";
  techs.forEach(t => {
    const techName = t["Technician Name"];
    const techOrders = orders.filter(o => o["Assigned Technician"] === techName);
    const completed = techOrders.filter(o => o["Order Status"] === "Installed" || o["Order Status"] === "Delivered" || o["Order Status"] === "Closed").length;
    const pending = techOrders.length - completed;
    const revenue = techOrders.reduce((sum, o) => sum + (parseFloat(o["Total Cost"]) || 0), 0);

    csv += `"${techName}",${completed},${pending},${revenue}\n`;
  });

  downloadCSV(`تقرير_انتاجية_الفنيين_${getLocalDateString()}.csv`, csv);
}

function translateCategory(cat) {
  const map = { "Fabric": "أقمشة وثياب", "Accessories": "إكسسوارات خياطة", "Hardware": "مسامير وأدوات مواسير", "Services": "خدمات وأجور" };
  return map[cat] || cat;
}

function translateUnit(unit) {
  const map = { "Meter": "متر", "Piece": "حبة", "Box": "علبة", "Room": "غرفة", "Trip": "زيارة" };
  return map[unit] || unit;
}
