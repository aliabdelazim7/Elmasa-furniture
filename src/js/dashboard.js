/**
 * Dashboard & Analytics Module - Elmasa Curtain Workshop
 * Compiles real-time metrics, counts low stock items, and draws Chart.js visualizations.
 */

let dailyChart = null;
let monthlyChart = null;
let materialChart = null;
let paymentChart = null;

window.renderDashboard = function() {
  const db = window.appState.db;
  const orders = db.Orders || [];
  const customers = db.Customers || [];
  const payments = db.Payments || [];
  const expenses = db.Expenses || [];
  const items = db.InventoryItems || [];
  const orderMats = db.OrderMaterials || [];

  const today = getLocalDateString();
  const currentMonthStr = today.substring(0, 7); // YYYY-MM

  // --- 1. Financial Metrics ---

  // Today's Revenue (cash collected today)
  const todayRevenue = payments
    .filter(p => p["Date"] === today)
    .reduce((sum, p) => sum + (parseFloat(p["Amount"]) || 0), 0);

  // Monthly Revenue (cash collected this month)
  const monthlyRevenue = payments
    .filter(p => p["Date"] && p["Date"].substring(0, 7) === currentMonthStr)
    .reduce((sum, p) => sum + (parseFloat(p["Amount"]) || 0), 0);

  // Monthly Profit calculation: Total Cost of Orders created this month - Cost of Materials - Expenses this month
  const monthlyOrders = orders.filter(o => o["Order Date"] && o["Order Date"].substring(0, 7) === currentMonthStr && o["Order Status"] !== "Quotation");
  const monthlyOrdersTotalValue = monthlyOrders.reduce((sum, o) => sum + (parseFloat(o["Total Cost"]) || 0), 0);
  
  // Material cost of those monthly orders
  const monthlyOrderIds = monthlyOrders.map(o => o["Order ID"]);
  const monthlyMatsUsed = orderMats.filter(m => monthlyOrderIds.includes(m["Order ID"]));
  let monthlyCOGS = 0;
  monthlyMatsUsed.forEach(m => {
    const prod = items.find(p => p["Item ID"] === m["Item ID"]);
    const buyPrice = prod ? parseFloat(prod["Purchase Price"]) || 0 : 0;
    monthlyCOGS += buyPrice * (parseFloat(m["Quantity Used"]) || 0);
  });

  const monthlyExpensesTotal = expenses
    .filter(e => e["Date"] && e["Date"].substring(0, 7) === currentMonthStr)
    .reduce((sum, e) => sum + (parseFloat(e["Amount"]) || 0), 0);

  const monthlyProfit = monthlyOrdersTotalValue - monthlyCOGS - monthlyExpensesTotal;

  // Outstanding Customer Balances (uncollected cash on active orders)
  const totalDebts = orders.filter(o => o["Order Status"] !== "Quotation").reduce((sum, o) => sum + (parseFloat(o["Remaining Amount"]) || 0), 0);

  // Set values to KPI cards
  const todayRevEl = document.getElementById("dash-today-rev");
  const monthRevEl = document.getElementById("dash-month-rev");
  const monthProfEl = document.getElementById("dash-month-profit");
  const debtsEl = document.getElementById("dash-total-debts");

  if (todayRevEl) todayRevEl.textContent = formatCurrency(todayRevenue);
  if (monthRevEl) monthRevEl.textContent = formatCurrency(monthlyRevenue);
  if (monthProfEl) {
    monthProfEl.textContent = formatCurrency(monthlyProfit);
    monthProfEl.className = `text-xl font-bold font-display ${monthlyProfit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500'}`;
  }
  if (debtsEl) debtsEl.textContent = formatCurrency(totalDebts);

  // --- 2. Order Metrics ---
  const activeOrders = orders.filter(o => o["Order Status"] !== "Delivered" && o["Order Status"] !== "Closed" && o["Order Status"] !== "Quotation");
  
  const delayedOrders = orders.filter(o => {
    if (o["Order Status"] === "Delivered" || o["Order Status"] === "Closed" || o["Order Status"] === "Quotation") return false;
    if (!o["Delivery Date"]) return false;
    return new Date(o["Delivery Date"]) < new Date(today);
  });

  const todayInstallations = orders.filter(o => 
    o["Installation Date"] === today && o["Order Status"] !== "Closed" && o["Order Status"] !== "Quotation"
  );

  document.getElementById("dash-active-orders").textContent = activeOrders.length;
  document.getElementById("dash-delayed-orders").textContent = delayedOrders.length;
  document.getElementById("dash-today-install").textContent = todayInstallations.length;

  // --- 3. Inventory & Materials alerts ---
  const lowStock = items.filter(item => {
    const qty = parseFloat(item["Quantity Available"]) || 0;
    const minAlert = parseFloat(item["Minimum Quantity Alert"]) || 0;
    return item["Item Category"] !== "Services" && qty <= minAlert;
  });

  // Most used materials
  const matCounts = {};
  orderMats.forEach(om => {
    matCounts[om["Item ID"]] = (matCounts[om["Item ID"]] || 0) + (parseFloat(om["Quantity Used"]) || 0);
  });
  
  const sortedMats = Object.entries(matCounts)
    .map(([itemId, qty]) => {
      const prod = items.find(i => i["Item ID"] === itemId);
      const name = prod ? prod["Item Name"] : itemId;
      const unit = prod ? prod["Unit"] : "";
      return { name, qty, unit };
    })
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 3);

  document.getElementById("dash-low-stock-count").textContent = lowStock.length;
  
  const mostUsedDiv = document.getElementById("dash-most-used-list");
  if (mostUsedDiv) {
    if (sortedMats.length === 0) {
      mostUsedDiv.innerHTML = `<p class="text-slate-400 py-1">لا توجد خامات مستهلكة مسجلة</p>`;
    } else {
      mostUsedDiv.innerHTML = sortedMats.map(s => `
        <div class="flex justify-between items-center text-xs py-1 border-b border-slate-100 dark:border-slate-800">
          <span class="font-bold text-slate-800 dark:text-slate-200">${s.name}</span>
          <span class="font-mono text-indigo-600 font-semibold">${s.qty.toFixed(1)} ${translateUnit(s.unit)}</span>
        </div>
      `).join("");
    }
  }

  // --- 4. Charts Generation ---
  initDashboardCharts(payments, orders, sortedMats);
};

function initDashboardCharts(payments, orders, topMats) {
  const isDark = document.documentElement.classList.contains("dark");
  const labelColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "rgba(148, 163, 184, 0.08)" : "rgba(100, 116, 139, 0.05)";

  const dailyCtx = document.getElementById("dailySalesChart")?.getContext("2d");
  const monthlyCtx = document.getElementById("monthlyRevenueChart")?.getContext("2d");
  const materialCtx = document.getElementById("materialConsumptionChart")?.getContext("2d");
  const paymentCtx = document.getElementById("paymentMethodsChart")?.getContext("2d");

  // A. Daily Sales Chart (Cash collections by day for last 7 days)
  if (dailyCtx) {
    if (dailyChart) dailyChart.destroy();
    
    const dates = [];
    const sales = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = getLocalDateString(d);
      dates.push(d.toLocaleDateString("ar-EG", { weekday: 'short', day: 'numeric', month: 'numeric' }));
      
      const dayPaid = payments
        .filter(p => p["Date"] === dateStr)
        .reduce((sum, p) => sum + (parseFloat(p["Amount"]) || 0), 0);
      sales.push(dayPaid);
    }

    dailyChart = new Chart(dailyCtx, {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [{
          label: 'المبيعات النقدية اليومية',
          data: sales,
          backgroundColor: '#6366f1',
          borderColor: '#4f46e5',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: labelColor }, grid: { color: gridColor } },
          y: { ticks: { color: labelColor }, grid: { color: gridColor } }
        }
      }
    });
  }

  // B. Monthly Revenue Chart (Cash collected monthly for last 6 months)
  if (monthlyCtx) {
    if (monthlyChart) monthlyChart.destroy();

    const months = [];
    const monthlySales = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const monthStr = `${year}-${month}`;
      
      months.push(d.toLocaleDateString("ar-EG", { month: 'short', year: '2-digit' }));
      
      const sum = payments
        .filter(p => p["Date"] && p["Date"].substring(0, 7) === monthStr)
        .reduce((sum, p) => sum + (parseFloat(p["Amount"]) || 0), 0);
      monthlySales.push(sum);
    }

    monthlyChart = new Chart(monthlyCtx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label: 'التحصيل الشهري',
          data: monthlySales,
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderColor: '#6366f1',
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: labelColor }, grid: { color: gridColor } },
          y: { ticks: { color: labelColor }, grid: { color: gridColor } }
        }
      }
    });
  }

  // C. Material Consumption Chart
  if (materialCtx) {
    if (materialChart) materialChart.destroy();

    const labels = topMats.map(m => m.name);
    const data = topMats.map(m => m.qty);

    materialChart = new Chart(materialCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: ['#a78bfa', '#60a5fa', '#34d399'],
          borderWidth: 0,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: labelColor }, grid: { color: gridColor } },
          y: { ticks: { color: labelColor }, grid: { color: gridColor } }
        }
      }
    });
  }

  // D. Payment Methods Distribution
  if (paymentCtx) {
    if (paymentChart) paymentChart.destroy();

    const methods = ["Cash", "InstaPay", "Vodafone Cash", "Bank Transfer"];
    const arabicLabels = ["نقدي", "إنستاباي", "فودافون كاش", "تحويل بنكي"];
    const values = methods.map(m => 
      payments.filter(p => p["Payment Method"] === m).reduce((sum, p) => sum + (parseFloat(p["Amount"]) || 0), 0)
    );

    paymentChart = new Chart(paymentCtx, {
      type: 'doughnut',
      data: {
        labels: arabicLabels,
        datasets: [{
          data: values,
          backgroundColor: ['#6366f1', '#60a5fa', '#f59e0b', '#10b981'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: labelColor, boxWidth: 12, font: { family: 'Cairo' } }
          }
        }
      }
    });
  }
}

function translateUnit(unit) {
  const map = { "Meter": "متر", "Piece": "حبة", "Box": "علبة", "Room": "غرفة", "Trip": "زيارة" };
  return map[unit] || unit;
}
