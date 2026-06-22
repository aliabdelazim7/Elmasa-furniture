/**
 * Customers CRM Module - Elmasa Curtain Workshop
 * Coordinates Customer CRUD, filtering, and the detailed Customer Profile page.
 */

let custCurrentPage = 1;
const custPageSize = 10;
let activeProfileCustomerId = null;

document.addEventListener("DOMContentLoaded", () => {
  // Bind events
  document.getElementById("cust-add-btn")?.addEventListener("click", () => openCustomerModal());
  document.getElementById("cust-modal-close")?.addEventListener("click", closeCustomerModal);
  document.getElementById("cust-cancel-btn")?.addEventListener("click", closeCustomerModal);
  
  document.getElementById("cust-form")?.addEventListener("submit", handleCustomerSubmit);

  document.getElementById("cust-search-input")?.addEventListener("input", () => {
    custCurrentPage = 1;
    renderCustomers();
  });

  // Profile Drawer control
  document.getElementById("profile-drawer-close")?.addEventListener("click", () => {
    document.getElementById("profile-drawer").classList.add("translate-x-full");
    activeProfileCustomerId = null;
  });

  document.getElementById("cust-prev-btn")?.addEventListener("click", () => {
    if (custCurrentPage > 1) {
      custCurrentPage--;
      renderCustomers();
    }
  });

  document.getElementById("cust-next-btn")?.addEventListener("click", () => {
    custCurrentPage++;
    renderCustomers();
  });
});

/**
 * Main Customer CRM Renderer
 */
window.renderCustomers = function() {
  const customers = window.appState.db.Customers || [];
  const query = document.getElementById("cust-search-input")?.value.toLowerCase().trim() || "";

  let filtered = customers.filter(c => 
    c["Full Name"].toLowerCase().includes(query) ||
    c["Phone Number"].includes(query) ||
    (c["Secondary Phone"] && c["Secondary Phone"].includes(query)) ||
    (c["Address"] && c["Address"].toLowerCase().includes(query))
  );

  // Sort by created date descending
  filtered.sort((a, b) => new Date(b["Created Date"]) - new Date(a["Created Date"]));

  const total = filtered.length;
  const totalPages = Math.ceil(total / custPageSize) || 1;
  if (custCurrentPage > totalPages) custCurrentPage = totalPages;

  const start = (custCurrentPage - 1) * custPageSize;
  const end = Math.min(start + custPageSize, total);
  const paginated = filtered.slice(start, end);

  // Pagination controls
  const prevBtn = document.getElementById("cust-prev-btn");
  const nextBtn = document.getElementById("cust-next-btn");
  const infoText = document.getElementById("cust-pagination-info");

  if (prevBtn) prevBtn.disabled = custCurrentPage === 1;
  if (nextBtn) nextBtn.disabled = custCurrentPage === totalPages;
  if (infoText) {
    infoText.textContent = total > 0 
      ? `عرض ${start + 1} - ${end} من إجمالي ${total} عميل`
      : "لا يوجد عملاء";
  }

  const tbody = document.getElementById("customers-table-body");
  if (!tbody) return;

  if (paginated.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
          لم يتم العثور على عملاء مطابقين للبحث.
        </td>
      </tr>
    `;
    return;
  }

  const orders = window.appState.db.Orders || [];

  tbody.innerHTML = paginated.map(c => {
    // Calculate customer balances
    const customerOrders = orders.filter(o => o["Customer ID"] === c["Customer ID"] && o["Order Status"] !== "Quotation");
    const totalPurchased = customerOrders.reduce((sum, o) => sum + (parseFloat(o["Total Cost"]) || 0), 0);
    const totalRemaining = customerOrders.reduce((sum, o) => sum + (parseFloat(o["Remaining Amount"]) || 0), 0);

    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs">
        <td class="py-3 px-6 font-mono font-bold text-slate-600 dark:text-slate-400">${c["Customer ID"]}</td>
        <td class="py-3 px-6 text-right">
          <div class="font-bold text-slate-900 dark:text-slate-100 cursor-pointer hover:text-indigo-600" onclick="openCustomerProfile('${c["Customer ID"]}')">
            ${c["Full Name"]}
          </div>
        </td>
        <td class="py-3 px-6 text-right font-mono">${c["Phone Number"]} ${c["Secondary Phone"] ? `/ ${c["Secondary Phone"]}` : ''}</td>
        <td class="py-3 px-6 text-right text-slate-500 dark:text-slate-400 max-w-xs truncate">${c["Address"] || "-"}</td>
        <td class="py-3 px-6 text-left font-mono">
          <div class="font-semibold text-slate-800 dark:text-slate-200">${formatCurrency(totalPurchased)}</div>
          ${totalRemaining > 0 ? `<div class="text-[10px] text-rose-500 font-bold">المتبقي: ${formatCurrency(totalRemaining)}</div>` : `<div class="text-[10px] text-emerald-600 font-bold">خالص الحساب</div>`}
        </td>
        <td class="py-3 px-6 text-center">
          <div class="flex items-center justify-center space-x-reverse space-x-1">
            <button onclick="openCustomerProfile('${c["Customer ID"]}')" class="p-1 border border-slate-200 dark:border-slate-700 rounded text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30" title="عرض ملف العميل">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="openCustomerModal('${c["Customer ID"]}')" class="p-1 border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="تعديل بيانات العميل">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  lucide.createIcons();
};

/**
 * Handle form submit
 */
async function handleCustomerSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById("cust-id").value;
  const name = document.getElementById("cust-name").value.trim();
  const phone = document.getElementById("cust-phone").value.trim();
  const secondary = document.getElementById("cust-secondary-phone").value.trim();
  const address = document.getElementById("cust-address").value.trim();
  const notes = document.getElementById("cust-notes").value.trim();

  if (!name || !phone) {
    showToast("يرجى إدخال الاسم ورقم الهاتف على الأقل", "warning");
    return;
  }

  showLoader("جاري حفظ بيانات العميل...");

  try {
    const customer = {
      "Customer ID": id || generateId("CUST"),
      "Full Name": name,
      "Phone Number": phone,
      "Secondary Phone": secondary,
      "Address": address,
      "Notes": notes,
      "Created Date": id ? (window.appState.db.Customers.find(c => c["Customer ID"] === id)?.[ "Created Date" ] || getLocalDateString()) : getLocalDateString()
    };

    await api.saveCustomer(customer);
    closeCustomerModal();
    showToast("تم حفظ بيانات العميل بنجاح", "success");
    
    // If order modal is open, reload customer select dropdown and select the new customer
    const orderModal = document.getElementById("order-modal");
    if (orderModal && !orderModal.classList.contains("hidden")) {
      if (typeof window.populateOrderCustomersDropdown === "function") {
        window.populateOrderCustomersDropdown(customer["Customer ID"]);
      }
    }

    // Re-render
    renderCustomers();
  } catch (err) {
    showToast(`فشل في حفظ بيانات العميل: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

/**
 * Customer Modal opens
 */
window.openCustomerModal = function(customerId = null) {
  const modal = document.getElementById("customer-modal");
  const title = document.getElementById("cust-modal-title");
  
  document.getElementById("cust-form").reset();
  document.getElementById("cust-id").value = "";

  if (customerId) {
    title.textContent = "تعديل بيانات العميل";
    const c = window.appState.db.Customers.find(item => item["Customer ID"] === customerId);
    if (c) {
      document.getElementById("cust-id").value = c["Customer ID"];
      document.getElementById("cust-name").value = c["Full Name"];
      document.getElementById("cust-phone").value = c["Phone Number"];
      document.getElementById("cust-secondary-phone").value = c["Secondary Phone"] || "";
      document.getElementById("cust-address").value = c["Address"] || "";
      document.getElementById("cust-notes").value = c["Notes"] || "";
    }
  } else {
    title.textContent = "إضافة عميل جديد";
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
};

window.closeCustomerModal = function() {
  const modal = document.getElementById("customer-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
};

/**
 * Rich Customer Profile Drawer Renderer
 */
window.openCustomerProfile = function(customerId) {
  activeProfileCustomerId = customerId;
  const db = window.appState.db;
  const c = db.Customers.find(item => item["Customer ID"] === customerId);
  if (!c) return;

  // Set Profile Information
  document.getElementById("profile-name").textContent = c["Full Name"];
  document.getElementById("profile-id").textContent = c["Customer ID"];
  document.getElementById("profile-phone").textContent = c["Phone Number"];
  document.getElementById("profile-secondary").textContent = c["Secondary Phone"] || "لا يوجد هاتف إضافي";
  document.getElementById("profile-address").textContent = c["Address"] || "لا يوجد عنوان مسجل";
  document.getElementById("profile-notes").textContent = c["Notes"] || "لا توجد ملاحظات خاصة بالعميل";

  // Financial statistics
  const customerOrders = (db.Orders || []).filter(o => o["Customer ID"] === customerId);
  const activeOrders = customerOrders.filter(o => o["Order Status"] !== "Quotation");
  const totalCost = activeOrders.reduce((sum, o) => sum + (parseFloat(o["Total Cost"]) || 0), 0);
  const totalPaid = activeOrders.reduce((sum, o) => sum + (parseFloat(o["Paid Amount"]) || 0), 0);
  const totalRem = activeOrders.reduce((sum, o) => sum + (parseFloat(o["Remaining Amount"]) || 0), 0);

  document.getElementById("profile-stat-orders").textContent = customerOrders.length;
  document.getElementById("profile-stat-total").textContent = formatCurrency(totalCost);
  document.getElementById("profile-stat-paid").textContent = formatCurrency(totalPaid);
  document.getElementById("profile-stat-remaining").textContent = formatCurrency(totalRem);

  // Render Rooms & Measurements
  const customerRooms = (db.Rooms || []).filter(r => r["Customer ID"] === customerId);
  const roomsDiv = document.getElementById("profile-rooms-container");
  
  if (customerRooms.length === 0) {
    roomsDiv.innerHTML = `<p class="text-xs text-slate-400 py-3 text-center">لا توجد قياسات مسجلة للغرف بعد.</p>`;
  } else {
    roomsDiv.innerHTML = customerRooms.map(r => `
      <div class="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-between space-y-2 text-xs">
        <div class="flex justify-between items-center font-bold text-slate-900 dark:text-slate-100">
          <span>${r["Room Name"]}</span>
          <span class="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">${r["Curtain Type"]}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400 mt-1">
          <div>العرض: <span class="font-mono font-bold text-slate-900 dark:text-slate-100">${r["Width"]} م</span></div>
          <div>الارتفاع: <span class="font-mono font-bold text-slate-900 dark:text-slate-100">${r["Height"]} م</span></div>
          <div>نوع القماش: <span class="font-bold text-slate-800 dark:text-slate-200">${r["Fabric Type"] || "-"}</span></div>
          <div>اللون: <span class="font-bold text-slate-800 dark:text-slate-200">${r["Color"] || "-"}</span></div>
          <div>الكمية: <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${r["Quantity"]} حبات</span></div>
        </div>
      </div>
    `).join("");
  }

  // Render previous orders list
  const ordersDiv = document.getElementById("profile-orders-list");
  if (customerOrders.length === 0) {
    ordersDiv.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-xs text-slate-400">لا يوجد تاريخ طلبيات لهذا العميل</td></tr>`;
  } else {
    ordersDiv.innerHTML = customerOrders.map(o => {
      let badgeClass = "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
      if (o["Order Status"] === "Delivered" || o["Order Status"] === "Closed") {
        badgeClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
      } else if (o["Order Status"] === "Sewing In Progress" || o["Order Status"] === "Ready For Installation") {
        badgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
      } else if (o["Order Status"] === "Measurements Taken") {
        badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
      }

      return `
        <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 text-xs">
          <td class="py-2 px-4 font-mono font-bold text-indigo-600">${o["Order ID"]}</td>
          <td class="py-2 px-4 font-mono">${o["Order Date"]}</td>
          <td class="py-2 px-4 text-center">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeClass}">
              ${translateStatus(o["Order Status"])}
            </span>
          </td>
          <td class="py-2 px-4 font-mono text-left">${formatCurrency(o["Total Cost"])}</td>
          <td class="py-2 px-4 font-mono text-left text-rose-500 font-semibold">${formatCurrency(o["Remaining Amount"])}</td>
        </tr>
      `;
    }).join("");
  }

  // Render materials consumed by this customer's orders
  const matsDiv = document.getElementById("profile-materials-container");
  const orderIds = customerOrders.map(o => o["Order ID"]);
  const customerMats = (db.OrderMaterials || []).filter(m => orderIds.includes(m["Order ID"]));
  const items = db.InventoryItems || [];

  if (customerMats.length === 0) {
    matsDiv.innerHTML = `<p class="text-xs text-slate-400 py-3 text-center">لا توجد مواد مستهلكة مسجلة بعد.</p>`;
  } else {
    // Group similar products to aggregate total quantities used
    const grouped = {};
    customerMats.forEach(m => {
      const prod = items.find(i => i["Item ID"] === m["Item ID"]);
      const name = prod ? prod["Item Name"] : m["Item ID"];
      const unit = prod ? prod["Unit"] : "وحدة";
      
      if (!grouped[m["Item ID"]]) {
        grouped[m["Item ID"]] = { name, unit, qty: 0, cost: 0 };
      }
      grouped[m["Item ID"]].qty += (parseFloat(m["Quantity Used"]) || 0);
      grouped[m["Item ID"]].cost += (parseFloat(m["Total Price"]) || 0);
    });

    matsDiv.innerHTML = Object.values(grouped).map(g => `
      <div class="flex justify-between items-center p-2 border-b border-slate-50 dark:border-slate-800 text-xs">
        <div>
          <span class="font-bold text-slate-800 dark:text-slate-200">${g.name}</span>
          <span class="text-[10px] text-slate-400 font-mono">(${g.qty.toFixed(1)} ${g.unit})</span>
        </div>
        <span class="font-mono text-slate-500 font-semibold">${formatCurrency(g.cost)}</span>
      </div>
    `).join("");
  }

  // Set Profile attachments - mock references in input form
  document.getElementById("profile-ref-links").value = c["Notes"] || "";

  // Open Drawer
  const drawer = document.getElementById("profile-drawer");
  drawer.classList.remove("translate-x-full");

  lucide.createIcons();
};

// Help helper for status translations
function translateStatus(status) {
  const map = {
    "New": "جديد",
    "Measurements Taken": "تم رفع القياسات",
    "Materials Prepared": "الخامات جاهزة",
    "Sewing In Progress": "جاري التفصيل والقص",
    "Ready For Installation": "جاهز للتركيب",
    "Installed": "تم التركيب",
    "Delivered": "تم التسليم",
    "Closed": "مغلق ومسلم"
  };
  return map[status] || status;
}

window.getLocalDateString = function() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
