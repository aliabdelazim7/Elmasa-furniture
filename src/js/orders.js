/**
 * Orders Management & Installations Module - Elmasa Curtain Workshop
 * Coordinates Order CRUD, multi-room measurements, materials calculators, labor logs, 
 * installation timelines, and payments logs.
 */

let orderCurrentPage = 1;
const orderPageSize = 10;

// Temporary states for Order Modal builder
let builderRooms = [];
let builderMaterials = [];
let originalPaidAmount = 0; // tracking for new payments

document.addEventListener("DOMContentLoaded", () => {
  // Bind order UI events
  document.getElementById("order-add-btn")?.addEventListener("click", () => openOrderModal());
  document.getElementById("order-modal-close")?.addEventListener("click", closeOrderModal);
  document.getElementById("order-cancel-btn")?.addEventListener("click", closeOrderModal);
  
  document.getElementById("order-form")?.addEventListener("submit", handleOrderSubmit);

  // Search and Filter listeners
  document.getElementById("order-search-input")?.addEventListener("input", () => {
    orderCurrentPage = 1;
    renderOrders();
  });
  document.getElementById("order-filter-status")?.addEventListener("change", () => {
    orderCurrentPage = 1;
    renderOrders();
  });

  // Pagination buttons
  document.getElementById("order-prev-btn")?.addEventListener("click", () => {
    if (orderCurrentPage > 1) {
      orderCurrentPage--;
      renderOrders();
    }
  });
  document.getElementById("order-next-btn")?.addEventListener("click", () => {
    orderCurrentPage++;
    renderOrders();
  });

  // Builder row add hooks
  document.getElementById("builder-add-room-btn")?.addEventListener("click", addBuilderRoomRow);
  document.getElementById("builder-add-material-btn")?.addEventListener("click", addBuilderMaterialRow);

  // Auto calculate cost listeners
  document.getElementById("order-sewing-cost")?.addEventListener("input", calculateOrderTotals);
  document.getElementById("order-install-cost")?.addEventListener("input", calculateOrderTotals);
  document.getElementById("order-extra-cost")?.addEventListener("input", calculateOrderTotals);
  document.getElementById("order-paid-amount")?.addEventListener("input", calculateOrderTotals);

  // Payment modal submission
  document.getElementById("payment-form")?.addEventListener("submit", handlePaymentSubmit);
  document.getElementById("payment-modal-close")?.addEventListener("click", () => {
    document.getElementById("payment-modal").classList.add("hidden");
  });
  document.getElementById("payment-cancel-btn")?.addEventListener("click", () => {
    document.getElementById("payment-modal").classList.add("hidden");
  });

  // Quick add customer button event
  document.getElementById("order-quick-add-cust-btn")?.addEventListener("click", () => {
    if (typeof window.openCustomerModal === "function") {
      window.openCustomerModal();
    }
  });

  // Layer checkboxes change listeners
  document.getElementById("room-layer-sheer")?.addEventListener("change", (e) => {
    const container = document.getElementById("est-sheer-container");
    if (container) {
      if (e.target.checked) container.classList.remove("hidden");
      else container.classList.add("hidden");
    }
  });

  document.getElementById("room-layer-blackout")?.addEventListener("change", (e) => {
    const container = document.getElementById("est-blackout-container");
    if (container) {
      if (e.target.checked) container.classList.remove("hidden");
      else container.classList.add("hidden");
    }
  });
});

/**
 * Main Order Grid Renderer
 */
window.renderOrders = function() {
  const db = window.appState.db;
  const orders = db.Orders || [];
  const query = document.getElementById("order-search-input")?.value.toLowerCase().trim() || "";
  const filterStatus = document.getElementById("order-filter-status")?.value || "All";

  // Filter orders
  let filtered = orders.filter(o => {
    const cust = db.Customers.find(c => c["Customer ID"] === o["Customer ID"]);
    const custName = cust ? cust["Full Name"].toLowerCase() : "";
    const matchesSearch = o["Order ID"].toLowerCase().includes(query) || custName.includes(query);
    const matchesStatus = filterStatus === "All" || o["Order Status"] === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Sort by date descending
  filtered.sort((a, b) => new Date(b["Order Date"]) - new Date(a["Order Date"]));

  const total = filtered.length;
  const totalPages = Math.ceil(total / orderPageSize) || 1;
  if (orderCurrentPage > totalPages) orderCurrentPage = totalPages;

  const start = (orderCurrentPage - 1) * orderPageSize;
  const end = Math.min(start + orderPageSize, total);
  const paginated = filtered.slice(start, end);

  const prevBtn = document.getElementById("order-prev-btn");
  const nextBtn = document.getElementById("order-next-btn");
  const infoText = document.getElementById("order-pagination-info");

  if (prevBtn) prevBtn.disabled = orderCurrentPage === 1;
  if (nextBtn) nextBtn.disabled = orderCurrentPage === totalPages;
  if (infoText) {
    infoText.textContent = total > 0 
      ? `عرض ${start + 1} - ${end} من إجمالي ${total} طلب`
      : "لا توجد طلبات";
  }

  const tbody = document.getElementById("orders-table-body");
  if (!tbody) return;

  if (paginated.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
          لم يتم العثور على طلبات مطابقة.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = paginated.map(o => {
    const cust = db.Customers.find(c => c["Customer ID"] === o["Customer ID"]);
    const custName = cust ? cust["Full Name"] : "عميل غير معروف";
    
    let badgeClass = "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
    if (o["Order Status"] === "Delivered" || o["Order Status"] === "Closed") {
      badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950 dark:text-emerald-300";
    } else if (o["Order Status"] === "Sewing In Progress" || o["Order Status"] === "Ready For Installation") {
      badgeClass = "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 animate-pulse";
    } else if (o["Order Status"] === "Measurements Taken") {
      badgeClass = "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950 dark:text-amber-300";
    }

    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs">
        <td class="py-3 px-6 font-mono font-bold text-slate-600 dark:text-slate-400">${escapeHtml(o["Order ID"])}</td>
        <td class="py-3 px-6 text-right">
          <div class="font-bold text-slate-900 dark:text-slate-100">${escapeHtml(custName)}</div>
          <div class="text-[10px] text-slate-400 font-mono">${o["Order Date"]}</div>
        </td>
        <td class="py-3 px-6 text-right text-slate-500 dark:text-slate-400 font-mono">${o["Installation Date"] || "-"}</td>
        <td class="py-3 px-6 text-right font-medium text-slate-700 dark:text-slate-300">${escapeHtml(o["Assigned Technician"] || "-")}</td>
        <td class="py-3 px-6 text-center">
          <span class="inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${badgeClass}">
            ${translateStatus(o["Order Status"])}
          </span>
        </td>
        <td class="py-3 px-6 text-left font-mono">
          <div class="font-semibold text-slate-900 dark:text-slate-100">${formatCurrency(o["Total Cost"])}</div>
          ${parseFloat(o["Remaining Amount"]) > 0 
            ? `<div class="text-[10px] text-rose-500 font-bold">المتبقي: ${formatCurrency(o["Remaining Amount"])}</div>` 
            : `<div class="text-[10px] text-emerald-600 font-bold">خالص بالكامل</div>`}
        </td>
        <td class="py-3 px-6 text-center">
          <div class="flex items-center justify-center space-x-reverse space-x-1">
            <button onclick="openOrderModal('${escapeHtml(o["Order ID"])}')" class="p-1 border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="تعديل تفاصيل الطلب">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="openPaymentModal('${escapeHtml(o["Order ID"])}')" class="p-1 border border-slate-200 dark:border-slate-700 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" title="تسجيل دفعة سداد">
              <i data-lucide="dollar-sign" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="printOrderInvoice('${escapeHtml(o["Order ID"])}')" class="p-1 border border-slate-200 dark:border-slate-700 rounded text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30" title="طباعة الفاتورة">
              <i data-lucide="printer" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  lucide.createIcons();

  // Render installations schedule page content too
  renderInstallationSchedule();
};

/**
 * Render Installation Schedule Timeline
 */
function renderInstallationSchedule() {
  const db = window.appState.db;
  const orders = db.Orders || [];
  const scheduleDiv = document.getElementById("installation-schedule-list");
  
  if (!scheduleDiv) return;

  // Filter orders with installation dates, sorted by date ascending
  const installations = orders.filter(o => 
    o["Installation Date"] && o["Order Status"] !== "Closed"
  ).sort((a, b) => new Date(a["Installation Date"]) - new Date(b["Installation Date"]));

  if (installations.length === 0) {
    scheduleDiv.innerHTML = `
      <div class="py-8 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
        لا توجد أي تركيبات مجدولة حالياً.
      </div>
    `;
    return;
  }

  scheduleDiv.innerHTML = installations.map(o => {
    const cust = db.Customers.find(c => c["Customer ID"] === o["Customer ID"]);
    const custName = cust ? cust["Full Name"] : "عميل غير معروف";
    const custPhone = cust ? cust["Phone Number"] : "-";

    // Map order status to installation schedule statuses
    let statusLabel = "مجدول";
    let badgeColor = "bg-blue-50 text-blue-700 border-blue-100";
    
    if (o["Order Status"] === "Installed") {
      statusLabel = "تم التركيب";
      badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
    } else if (o["Order Status"] === "Ready For Installation") {
      statusLabel = "جاهز للتركيب";
      badgeColor = "bg-indigo-50 text-indigo-700 border-indigo-100 animate-pulse";
    } else if (o["Order Status"] === "Sewing In Progress") {
      statusLabel = "قيد التشغيل بالورشة";
      badgeColor = "bg-amber-50 text-amber-700 border-amber-100";
    }

    return `
      <div class="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center space-y-3 md:space-y-0">
        <div class="flex items-center space-x-reverse space-x-4">
          <div class="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 p-3 rounded-xl">
            <i data-lucide="calendar" class="w-6 h-6"></i>
          </div>
          <div>
            <h4 class="text-sm font-bold text-slate-900 dark:text-slate-100">${escapeHtml(custName)}</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-mono">${o["Installation Date"]} | الفني: ${escapeHtml(o["Assigned Technician"] || "غير محدد")}</p>
          </div>
        </div>
        
        <div class="flex items-center space-x-reverse space-x-3 text-xs w-full md:w-auto justify-between md:justify-end">
          <span class="px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${badgeColor}">
            ${statusLabel}
          </span>
          <div class="flex items-center space-x-reverse space-x-1">
            <a href="tel:${escapeHtml(custPhone)}" class="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800" title="اتصال بالعميل">
              <i data-lucide="phone" class="w-4 h-4"></i>
            </a>
            <button onclick="openOrderModal('${escapeHtml(o["Order ID"])}')" class="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30" title="تحديث حالة التركيب">
              <i data-lucide="settings" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  lucide.createIcons();
}

/**
 * Open Payments Modal
 */
window.openPaymentModal = function(orderId) {
  const db = window.appState.db;
  const o = db.Orders.find(item => item["Order ID"] === orderId);
  if (!o) return;

  const cust = db.Customers.find(c => c["Customer ID"] === o["Customer ID"]);

  document.getElementById("payment-order-id").value = orderId;
  document.getElementById("payment-cust-name").value = cust ? cust["Full Name"] : "";
  document.getElementById("payment-total-cost").value = o["Total Cost"];
  document.getElementById("payment-remaining").value = o["Remaining Amount"];
  document.getElementById("payment-amount").value = "";
  document.getElementById("payment-amount").max = o["Remaining Amount"];
  document.getElementById("payment-method").value = "Cash";

  document.getElementById("payment-modal").classList.remove("hidden");
};

async function handlePaymentSubmit(e) {
  e.preventDefault();
  
  const orderId = document.getElementById("payment-order-id").value;
  const amount = parseFloat(document.getElementById("payment-amount").value);
  const method = document.getElementById("payment-method").value;

  if (isNaN(amount) || amount <= 0) {
    showToast("يرجى إدخال مبلغ دفع صحيح أكبر من صفر", "warning");
    return;
  }

  showLoader("جاري تسجيل دفعة السداد...");

  try {
    const payment = {
      "Payment ID": generateId("PAY"),
      "Order ID": orderId,
      "Amount": amount,
      "Payment Method": method,
      "Date": getLocalDateString()
    };

    await api.savePayment(payment);
    document.getElementById("payment-modal").classList.add("hidden");
    showToast("تم تسجيل الدفعة بنجاح", "success");
    await syncDatabase(true);
  } catch (err) {
    showToast(`فشل تسجيل الدفعة: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

window.populateOrderCustomersDropdown = function(selectedCustomerId = null) {
  const db = window.appState.db;
  const custSelect = document.getElementById("order-customer-select");
  if (custSelect) {
    custSelect.innerHTML = `<option value="">-- اختر العميل --</option>` +
      (db.Customers || []).map(c => `<option value="${escapeHtml(c["Customer ID"])}">${escapeHtml(c["Full Name"])} (${escapeHtml(c["Phone Number"])})</option>`).join("");
    if (selectedCustomerId) {
      custSelect.value = selectedCustomerId;
    }
  }
};

/**
 * Order Builder Modal Operations
 */
window.openOrderModal = function(orderId = null) {
  const db = window.appState.db;
  const modal = document.getElementById("order-modal");
  const title = document.getElementById("order-modal-title");
  
  document.getElementById("order-form").reset();
  document.getElementById("order-id").value = "";

  // Reset technical specs and auto-estimators
  const multiplierSelect = document.getElementById("room-multiplier-select");
  if (multiplierSelect) multiplierSelect.value = "2.5";
  const installTypeSelect = document.getElementById("room-install-type");
  if (installTypeSelect) installTypeSelect.value = "Wall";
  const pullSelect = document.getElementById("room-pull-direction");
  if (pullSelect) pullSelect.value = "Two Sides";
  const extInput = document.getElementById("room-side-ext");
  if (extInput) extInput.value = "20";
  const sheerCb = document.getElementById("room-layer-sheer");
  if (sheerCb) sheerCb.checked = false;
  const blackoutCb = document.getElementById("room-layer-blackout");
  if (blackoutCb) blackoutCb.checked = false;
  const autoEstCb = document.getElementById("room-auto-estimate");
  if (autoEstCb) autoEstCb.checked = true;

  document.getElementById("est-sheer-container")?.classList.add("hidden");
  document.getElementById("est-blackout-container")?.classList.add("hidden");
  
  // Populate Customers dropdown
  window.populateOrderCustomersDropdown();

  // Populate Technicians dropdown
  const techSelect = document.getElementById("order-technician-select");
  if (techSelect) {
    techSelect.innerHTML = `<option value="">-- اختر الفني --</option>` +
      (db.Technicians || []).map(t => `<option value="${escapeHtml(t["Technician Name"])}">${escapeHtml(t["Technician Name"])}</option>`).join("");
  }

  // Populate Auto Estimators dropdowns
  const fabrics = (db.InventoryItems || []).filter(p => p["Item Category"] === "Fabric");
  const accessories = (db.InventoryItems || []).filter(p => p["Item Category"] === "Accessories");
  const hardwares = (db.InventoryItems || []).filter(p => p["Item Category"] === "Hardware");

  const mainFabricSelect = document.getElementById("est-main-fabric");
  const sheerFabricSelect = document.getElementById("est-sheer-fabric");
  const blackoutFabricSelect = document.getElementById("est-blackout-fabric");
  const tapeSelect = document.getElementById("est-tape");
  const rodSelect = document.getElementById("est-rod");
  const ringsSelect = document.getElementById("est-rings");
  const bracketsSelect = document.getElementById("est-brackets");

  const fabricOptions = `<option value="">-- اختر القماش --</option>` + fabrics.map(f => `<option value="${escapeHtml(f["Item ID"])}">${escapeHtml(f["Item Name"])}</option>`).join("");
  if (mainFabricSelect) mainFabricSelect.innerHTML = fabricOptions;
  if (sheerFabricSelect) sheerFabricSelect.innerHTML = fabricOptions;
  if (blackoutFabricSelect) blackoutFabricSelect.innerHTML = fabricOptions;

  if (tapeSelect) {
    tapeSelect.innerHTML = `<option value="">-- اختر الشريط --</option>` + accessories.map(a => `<option value="${escapeHtml(a["Item ID"])}">${escapeHtml(a["Item Name"])}</option>`).join("");
  }
  if (rodSelect) {
    rodSelect.innerHTML = `<option value="">-- اختر الماسورة --</option>` + hardwares.map(h => `<option value="${escapeHtml(h["Item ID"])}">${escapeHtml(h["Item Name"])}</option>`).join("");
  }
  if (ringsSelect) {
    ringsSelect.innerHTML = `<option value="">-- اختر الحلقات --</option>` + [...accessories, ...hardwares].map(a => `<option value="${escapeHtml(a["Item ID"])}">${escapeHtml(a["Item Name"])}</option>`).join("");
  }
  if (bracketsSelect) {
    bracketsSelect.innerHTML = `<option value="">-- اختر الحوامل --</option>` + hardwares.map(h => `<option value="${escapeHtml(h["Item ID"])}">${escapeHtml(h["Item Name"])}</option>`).join("");
  }

  // Reset builders
  builderRooms = [];
  builderMaterials = [];
  originalPaidAmount = 0;
  
  document.getElementById("order-paid-amount").disabled = false;

  if (orderId) {
    title.textContent = "تعديل تفاصيل الطلب";
    const o = db.Orders.find(item => item["Order ID"] === orderId);
    if (o) {
      document.getElementById("order-id").value = o["Order ID"];
      document.getElementById("order-customer-select").value = o["Customer ID"];
      document.getElementById("order-date").value = o["Order Date"];
      document.getElementById("order-delivery-date").value = o["Delivery Date"] || "";
      document.getElementById("order-installation-date").value = o["Installation Date"] || "";
      document.getElementById("order-technician-select").value = o["Assigned Technician"] || "";
      document.getElementById("order-status-select").value = o["Order Status"];
      
      document.getElementById("order-sewing-cost").value = 0;
      document.getElementById("order-install-cost").value = 0;
      document.getElementById("order-extra-cost").value = 0;
      
      originalPaidAmount = parseFloat(o["Paid Amount"]) || 0;
      document.getElementById("order-paid-amount").value = originalPaidAmount;
      // Disable edit paid amount during editing (force user to use Dollar icon to add payment instead of overriding history)
      document.getElementById("order-paid-amount").disabled = true;

      document.getElementById("order-notes").value = o["Notes"] || "";

      // Load Rooms associated with order
      builderRooms = (db.Rooms || []).filter(r => r["Order ID"] === orderId).map(r => ({
        roomName: r["Room Name"],
        width: r["Width"],
        height: r["Height"],
        curtainType: r["Curtain Type"],
        fabricType: r["Fabric Type"],
        color: r["Color"],
        quantity: r["Quantity"],
        "Fold Multiplier": r["Fold Multiplier"] || 2.5,
        "Sheer Checked": r["Sheer Checked"] || "False",
        "Blackout Checked": r["Blackout Checked"] || "False",
        "Installation Type": r["Installation Type"] || "حائط (Wall)",
        "Pull Direction": r["Pull Direction"] || "يمين ويسار (اتجاهين)",
        "Side Extension": r["Side Extension"] || 20
      }));

      // Load Materials associated with order
      builderMaterials = (db.OrderMaterials || []).filter(m => m["Order ID"] === orderId).map(m => ({
        itemId: m["Item ID"],
        qty: m["Quantity Used"]
      }));
    }
  } else {
    title.textContent = "إنشاء طلب تفصيل جديد";
    document.getElementById("order-date").value = getLocalDateString();
    document.getElementById("order-sewing-cost").value = 0;
    document.getElementById("order-install-cost").value = 0;
    document.getElementById("order-extra-cost").value = 0;
    document.getElementById("order-paid-amount").value = 0;
  }

  // Draw builder lists
  renderBuilderRooms();
  renderBuilderMaterials();
  calculateOrderTotals();

  modal.classList.remove("hidden");
  modal.classList.add("flex");
};

window.closeOrderModal = function() {
  document.getElementById("order-modal").classList.add("hidden");
  document.getElementById("order-modal").classList.remove("flex");
};

// Builder Rooms table drawing
function renderBuilderRooms() {
  const container = document.getElementById("builder-rooms-container");
  if (!container) return;

  if (builderRooms.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 py-2 text-center">لا توجد غرف مضافة. اضغط إضافة غرفة لرفع المقاسات.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="w-full text-right text-xs">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-400">
          <th class="py-1">الغرفة</th>
          <th class="py-1">المقاسات (ع*ارت)</th>
          <th class="py-1">نوع الموديل / القماش</th>
          <th class="py-1">العدد</th>
          <th class="py-1 text-center">حذف</th>
        </tr>
      </thead>
      <tbody>
        ${builderRooms.map((r, index) => {
          const mult = r["Fold Multiplier"] || "2.5";
          const inst = r["Installation Type"] || "حائط";
          const pull = r["Pull Direction"] || "اتجاهين";
          const ext = r["Side Extension"] || "20";
          const layers = [];
          if (r["Sheer Checked"] === "True" || r["Sheer Checked"] === true) layers.push("شيفون");
          if (r["Blackout Checked"] === "True" || r["Blackout Checked"] === true) layers.push("بلاك أوت");
          const layerStr = layers.length > 0 ? ` + طبقات: ${layers.join("، ")}` : "";

          return `
            <tr class="border-b border-slate-100 dark:border-slate-800">
              <td class="py-2 font-bold text-slate-800 dark:text-slate-200">
                <div>${escapeHtml(r.roomName)}</div>
                <div class="text-[10px] text-indigo-500 font-normal">كشكشة: ${mult}x | تثبيت: ${inst} | سحب: ${pull} | زيادة: ${ext}سم${layerStr}</div>
              </td>
              <td class="py-2 font-mono">${r.width} م × ${r.height} م</td>
              <td class="py-2">${escapeHtml(r.curtainType)} / ${escapeHtml(r.fabricType)} (${escapeHtml(r.color)})</td>
              <td class="py-2 font-mono">${r.quantity}</td>
              <td class="py-2 text-center">
                <button type="button" class="text-rose-500 hover:text-rose-700" onclick="removeBuilderRoom(${index})">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
  lucide.createIcons();
}

function addBuilderRoomRow() {
  const roomName = document.getElementById("room-name-input").value.trim();
  const width = parseFloat(document.getElementById("room-width-input").value);
  const height = parseFloat(document.getElementById("room-height-input").value);
  const curtainType = document.getElementById("room-curtain-input").value.trim();
  const fabricType = document.getElementById("room-fabric-input").value.trim();
  const color = document.getElementById("room-color-input").value.trim();
  const quantity = parseInt(document.getElementById("room-qty-input").value) || 1;

  if (!roomName || isNaN(width) || isNaN(height)) {
    showToast("يرجى ملء اسم الغرفة ومقاسات العرض والارتفاع بشكل صحيح", "warning");
    return;
  }

  const foldMultiplier = parseFloat(document.getElementById("room-multiplier-select").value) || 2.5;
  const installType = document.getElementById("room-install-type").value;
  const pullDirection = document.getElementById("room-pull-direction").value;
  const sideExtension = parseFloat(document.getElementById("room-side-ext").value) || 20;
  const sheerChecked = document.getElementById("room-layer-sheer").checked;
  const blackoutChecked = document.getElementById("room-layer-blackout").checked;

  builderRooms.push({
    roomName,
    width,
    height,
    curtainType,
    fabricType,
    color,
    quantity,
    "Fold Multiplier": foldMultiplier,
    "Sheer Checked": sheerChecked ? "True" : "False",
    "Blackout Checked": blackoutChecked ? "True" : "False",
    "Installation Type": installType === "Wall" ? "حائط (Wall)" : "سقف (Ceiling)",
    "Pull Direction": pullDirection === "Two Sides" ? "يمين ويسار (اتجاهين)" : "اتجاه واحد",
    "Side Extension": sideExtension
  });
  
  // Automate material lines if auto-estimate checked
  const autoEstimate = document.getElementById("room-auto-estimate").checked;
  if (autoEstimate) {
    const mainFabricId = document.getElementById("est-main-fabric").value;
    const sheerFabricId = sheerChecked ? document.getElementById("est-sheer-fabric").value : null;
    const blackoutFabricId = blackoutChecked ? document.getElementById("est-blackout-fabric").value : null;
    const tapeId = document.getElementById("est-tape").value;
    const rodId = document.getElementById("est-rod").value;
    const ringsId = document.getElementById("est-rings").value;
    const bracketsId = document.getElementById("est-brackets").value;

    const addMaterialQty = (itemId, qty) => {
      if (!itemId || isNaN(qty) || qty <= 0) return;
      const existing = builderMaterials.find(m => m.itemId === itemId);
      if (existing) {
        existing.qty = parseFloat((existing.qty + qty).toFixed(2));
      } else {
        builderMaterials.push({ itemId, qty: parseFloat(qty.toFixed(2)) });
      }
    };

    // Main fabric
    const fabricQty = width * foldMultiplier * quantity;
    if (mainFabricId) addMaterialQty(mainFabricId, fabricQty);
    if (sheerFabricId) addMaterialQty(sheerFabricId, fabricQty);
    if (blackoutFabricId) addMaterialQty(blackoutFabricId, fabricQty);

    // Tape
    let tapeLayers = 1;
    if (sheerChecked && sheerFabricId) tapeLayers++;
    if (blackoutChecked && blackoutFabricId) tapeLayers++;
    const tapeQty = fabricQty * tapeLayers;
    if (tapeId) addMaterialQty(tapeId, tapeQty);

    // Rod
    const rodLength = width + 2 * (sideExtension / 100);
    let rodLayers = 1;
    if (sheerChecked) rodLayers++;
    if (blackoutChecked) rodLayers++;
    const totalRodQty = rodLength * rodLayers * quantity;
    if (rodId) addMaterialQty(rodId, totalRodQty);

    // Rings
    const ringsQty = Math.ceil(rodLength * 100 / 10) * rodLayers * quantity;
    if (ringsId) addMaterialQty(ringsId, ringsQty);

    // Brackets
    const bracketsPerWindow = rodLength < 2.5 ? 2 : 3;
    const totalBracketsQty = bracketsPerWindow * quantity;
    if (bracketsId) addMaterialQty(bracketsId, totalBracketsQty);

    renderBuilderMaterials();
    calculateOrderTotals();
  }

  // Clear inputs
  document.getElementById("room-name-input").value = "";
  document.getElementById("room-width-input").value = "";
  document.getElementById("room-height-input").value = "";
  document.getElementById("room-curtain-input").value = "";
  document.getElementById("room-fabric-input").value = "";
  document.getElementById("room-color-input").value = "";
  document.getElementById("room-qty-input").value = 1;

  // Reset checkboxes and container states for next room
  document.getElementById("room-layer-sheer").checked = false;
  document.getElementById("room-layer-blackout").checked = false;
  document.getElementById("est-sheer-container")?.classList.add("hidden");
  document.getElementById("est-blackout-container")?.classList.add("hidden");

  renderBuilderRooms();
}

window.removeBuilderRoom = function(index) {
  builderRooms.splice(index, 1);
  renderBuilderRooms();
};

// Builder Materials drawing
function renderBuilderMaterials() {
  const container = document.getElementById("builder-materials-container");
  const db = window.appState.db;
  if (!container) return;

  // Fill selecting material dropdown if empty
  const matSelect = document.getElementById("material-item-select");
  if (matSelect && matSelect.children.length <= 1) {
    matSelect.innerHTML = `<option value="">-- اختر خامة/خدمة --</option>` +
      (db.InventoryItems || []).map(p => `<option value="${escapeHtml(p["Item ID"])}">${escapeHtml(p["Item Name"])} (${p["Selling Price"]} ${window.appState.settings.currency} / ${escapeHtml(p["Unit"])})</option>`).join("");
  }

  if (builderMaterials.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 py-2 text-center">لا توجد خامات مستهلكة مضافة.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="w-full text-right text-xs">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-400">
          <th class="py-1">الخامة / المنتج</th>
          <th class="py-1">الكمية</th>
          <th class="py-1 text-left">سعر البيع</th>
          <th class="py-1 text-left">الإجمالي</th>
          <th class="py-1 text-center">حذف</th>
        </tr>
      </thead>
      <tbody>
        ${builderMaterials.map((m, index) => {
          const item = db.InventoryItems.find(p => p["Item ID"] === m.itemId);
          const name = item ? item["Item Name"] : m.itemId;
          const unit = item ? item["Unit"] : "";
          const price = item ? parseFloat(item["Selling Price"]) || 0 : 0;
          const total = price * m.qty;

          return `
            <tr class="border-b border-slate-100 dark:border-slate-800">
              <td class="py-2 font-bold text-slate-800 dark:text-slate-200">${escapeHtml(name)}</td>
              <td class="py-2 font-mono">${m.qty} ${escapeHtml(unit)}</td>
              <td class="py-2 font-mono text-left">${formatCurrency(price)}</td>
              <td class="py-2 font-mono text-left text-slate-900 dark:text-slate-100">${formatCurrency(total)}</td>
              <td class="py-2 text-center">
                <button type="button" class="text-rose-500 hover:text-rose-700" onclick="removeBuilderMaterial(${index})">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
  lucide.createIcons();
}

function addBuilderMaterialRow() {
  const itemId = document.getElementById("material-item-select").value;
  const qty = parseFloat(document.getElementById("material-qty-input").value);

  if (!itemId || isNaN(qty) || qty <= 0) {
    showToast("يرجى اختيار خامة وإدخال كمية صحيحة أكبر من صفر", "warning");
    return;
  }

  // Check if item is already added, if so accumulate qty
  const existingIdx = builderMaterials.findIndex(m => m.itemId === itemId);
  if (existingIdx !== -1) {
    builderMaterials[existingIdx].qty += qty;
  } else {
    builderMaterials.push({ itemId, qty });
  }

  document.getElementById("material-item-select").value = "";
  document.getElementById("material-qty-input").value = "";

  renderBuilderMaterials();
  calculateOrderTotals();
}

window.removeBuilderMaterial = function(index) {
  builderMaterials.splice(index, 1);
  renderBuilderMaterials();
  calculateOrderTotals();
};

/**
 * Real-time Cost Calculation Engine
 */
function calculateOrderTotals() {
  const db = window.appState.db;
  
  // Calculate materials sum
  let materialsCost = 0;
  builderMaterials.forEach(m => {
    const item = db.InventoryItems.find(p => p["Item ID"] === m.itemId);
    const price = item ? parseFloat(item["Selling Price"]) || 0 : 0;
    materialsCost += price * m.qty;
  });

  const sewing = parseFloat(document.getElementById("order-sewing-cost").value) || 0;
  const install = parseFloat(document.getElementById("order-install-cost").value) || 0;
  const extra = parseFloat(document.getElementById("order-extra-cost").value) || 0;
  const paid = parseFloat(document.getElementById("order-paid-amount").value) || 0;

  const total = materialsCost + sewing + install + extra;
  const rem = Math.max(0, total - paid);

  document.getElementById("total-materials-cost").textContent = formatCurrency(materialsCost);
  document.getElementById("total-order-calculated").textContent = formatCurrency(total);
  document.getElementById("remaining-order-calculated").textContent = formatCurrency(rem);
}

/**
 * Handle Order Form Submit
 */
async function handleOrderSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("order-id").value;
  const customerId = document.getElementById("order-customer-select").value;
  const orderDate = document.getElementById("order-date").value;
  const deliveryDate = document.getElementById("order-delivery-date").value;
  const installDate = document.getElementById("order-installation-date").value;
  const tech = document.getElementById("order-technician-select").value;
  const status = document.getElementById("order-status-select").value;
  const notes = document.getElementById("order-notes").value.trim();

  if (!customerId) {
    showToast("يرجى اختيار عميل أولاً للطلب", "warning");
    return;
  }

  if (builderRooms.length === 0) {
    showToast("يرجى إضافة مقاسات غرفة واحدة على الأقل للطلب", "warning");
    return;
  }

  // Calculate costs final check
  const db = window.appState.db;
  let materialsCost = 0;
  const materialsRows = builderMaterials.map(m => {
    const item = db.InventoryItems.find(p => p["Item ID"] === m.itemId);
    const price = item ? parseFloat(item["Selling Price"]) || 0 : 0;
    const buyPrice = item ? parseFloat(item["Purchase Price"]) || 0 : 0;
    const total = price * m.qty;
    materialsCost += total;
    return {
      "Material ID": "", // generated on backend
      "Order ID": id || "",
      "Item ID": m.itemId,
      "Quantity Used": m.qty,
      "Unit Price": price,
      "Total Price": total
    };
  });

  const sewing = parseFloat(document.getElementById("order-sewing-cost").value) || 0;
  const install = parseFloat(document.getElementById("order-install-cost").value) || 0;
  const extra = parseFloat(document.getElementById("order-extra-cost").value) || 0;
  const totalCost = materialsCost + sewing + install + extra;
  
  // Paid amount calculation: if editing, keep original paid. If new, use paid input
  let paidAmount = originalPaidAmount;
  if (!id) {
    paidAmount = parseFloat(document.getElementById("order-paid-amount").value) || 0;
  }
  const remainingAmount = Math.max(0, totalCost - paidAmount);

  showLoader("جاري حفظ الفاتورة وتحديث المخازن...");

  try {
    const orderObj = {
      "Order ID": id || generateId("ORD"),
      "Customer ID": customerId,
      "Order Date": orderDate,
      "Delivery Date": deliveryDate,
      "Installation Date": installDate,
      "Assigned Technician": tech,
      "Order Status": status,
      "Total Cost": totalCost,
      "Paid Amount": paidAmount,
      "Remaining Amount": remainingAmount,
      "Notes": notes
    };

    // Format rooms payload
    const roomsPayload = builderRooms.map(r => ({
      "Room ID": "", // generated
      "Order ID": orderObj["Order ID"],
      "Customer ID": customerId,
      "Room Name": r.roomName,
      "Width": r.width,
      "Height": r.height,
      "Curtain Type": r.curtainType,
      "Fabric Type": r.fabricType,
      "Color": r.color,
      "Quantity": r.quantity,
      "Fold Multiplier": r["Fold Multiplier"] || 2.5,
      "Sheer Checked": r["Sheer Checked"] || "False",
      "Blackout Checked": r["Blackout Checked"] || "False",
      "Installation Type": r["Installation Type"] || "حائط (Wall)",
      "Pull Direction": r["Pull Direction"] || "يمين ويسار (اتجاهين)",
      "Side Extension": r["Side Extension"] || 20
    }));

    await api.saveOrder(orderObj, roomsPayload, materialsRows);
    
    // Also if creating a new order and there is a paid amount, let's create a payment history record
    if (!id && paidAmount > 0) {
      await api.savePayment({
        "Payment ID": generateId("PAY"),
        "Order ID": orderObj["Order ID"],
        "Amount": paidAmount,
        "Payment Method": "Cash", // Default to Cash for initial order deposit
        "Date": orderDate
      });
    }

    closeOrderModal();
    showToast("تم حفظ الطلبية وتعديل المخزون بنجاح", "success");
    await syncDatabase(true);
  } catch (err) {
    showToast(`فشل حفظ الطلبية: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

/**
 * Print order invoice حرارياً أو A4
 */
window.printOrderInvoice = function(orderId) {
  const db = window.appState.db;
  const o = db.Orders.find(item => item["Order ID"] === orderId);
  if (!o) return;

  const cust = db.Customers.find(c => c["Customer ID"] === o["Customer ID"]);
  const custName = cust ? cust["Full Name"] : "";
  const custPhone = cust ? cust["Phone Number"] : "";
  const custAddr = cust ? cust["Address"] : "";

  const rooms = (db.Rooms || []).filter(r => r["Order ID"] === orderId);
  const materials = (db.OrderMaterials || []).filter(m => m["Order ID"] === orderId);
  const payments = (db.Payments || []).filter(p => p["Order ID"] === orderId);

  // Compile print container layout
  const printArea = document.getElementById("invoice-print-area");
  if (!printArea) return;

  printArea.innerHTML = `
    <div class="text-right text-slate-900 leading-relaxed font-sans" dir="rtl">
      <!-- Invoice Header -->
      <div class="flex justify-between items-start border-b border-slate-300 pb-4 mb-4">
        <div>
          <h2 class="text-xl font-bold font-display text-indigo-600">${escapeHtml(window.appState.settings.businessName)}</h2>
          <p class="text-xs text-slate-500">${escapeHtml(window.appState.settings.address)}</p>
          <p class="text-xs text-slate-500">تليفون: ${escapeHtml(window.appState.settings.phone)}</p>
        </div>
        <div class="text-left font-mono">
          <h3 class="text-lg font-bold">فاتورة طلبية</h3>
          <p class="text-xs text-slate-500">رقم الفاتورة: ${escapeHtml(o["Order ID"])}</p>
          <p class="text-xs text-slate-500">التاريخ: ${o["Order Date"]}</p>
        </div>
      </div>

      <!-- Customer Details -->
      <div class="grid grid-cols-2 gap-4 border border-slate-200 rounded-lg p-3 bg-slate-50/50 mb-4 text-xs">
        <div><strong>العميل:</strong> ${escapeHtml(custName)}</div>
        <div><strong>الهاتف:</strong> ${escapeHtml(custPhone)}</div>
        <div class="col-span-2"><strong>العنوان:</strong> ${escapeHtml(custAddr)}</div>
      </div>

      <!-- Rooms Measurements Details -->
      <h4 class="text-xs font-bold text-slate-500 mb-2">1. قياسات ومواصفات الغرف</h4>
      <table class="w-full border-collapse border border-slate-200 text-xs mb-4 text-center">
        <thead>
          <tr class="bg-slate-100">
            <th class="border border-slate-200 py-1">الغرفة</th>
            <th class="border border-slate-200 py-1">المقاسات (ع*ارت)</th>
            <th class="border border-slate-200 py-1">نوع الموديل</th>
            <th class="border border-slate-200 py-1">خامة القماش واللون</th>
            <th class="border border-slate-200 py-1">العدد</th>
          </tr>
        </thead>
        <tbody>
          ${rooms.map(r => `
            <tr>
              <td class="border border-slate-200 py-1.5 font-bold">${escapeHtml(r["Room Name"])}</td>
              <td class="border border-slate-200 py-1.5 font-mono">${r["Width"]} م × ${r["Height"]} م</td>
              <td class="border border-slate-200 py-1.5">${escapeHtml(r["Curtain Type"])}</td>
              <td class="border border-slate-200 py-1.5">${escapeHtml(r["Fabric Type"])} (${escapeHtml(r["Color"])})</td>
              <td class="border border-slate-200 py-1.5 font-mono">${r["Quantity"]}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <!-- Materials List details -->
      <h4 class="text-xs font-bold text-slate-500 mb-2">2. الخامات المستهلكة والأجور</h4>
      <table class="w-full border-collapse border border-slate-200 text-xs mb-4 text-right">
        <thead>
          <tr class="bg-slate-100 text-center">
            <th class="border border-slate-200 py-1 pr-2 text-right">الخامة / الخدمة</th>
            <th class="border border-slate-200 py-1">الكمية</th>
            <th class="border border-slate-200 py-1 text-left pl-2">السعر</th>
            <th class="border border-slate-200 py-1 text-left pl-2">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${materials.map(m => {
            const item = db.InventoryItems.find(p => p["Item ID"] === m["Item ID"]);
            const name = item ? item["Item Name"] : m["Item ID"];
            const unit = item ? item["Unit"] : "";
            return `
              <tr>
                <td class="border border-slate-200 py-1.5 pr-2 font-bold">${escapeHtml(name)}</td>
                <td class="border border-slate-200 py-1.5 text-center font-mono">${m["Quantity Used"]} ${escapeHtml(unit)}</td>
                <td class="border border-slate-200 py-1.5 text-left font-mono pl-2">${formatCurrency(m["Unit Price"])}</td>
                <td class="border border-slate-200 py-1.5 text-left font-mono pl-2">${formatCurrency(m["Total Price"])}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>

      <!-- Financial Statistics summary -->
      <div class="flex justify-between items-start text-xs">
        <!-- Payments History log -->
        <div class="w-1/2 border border-slate-200 rounded-lg p-2.5">
          <h5 class="font-bold border-b border-slate-200 pb-1 mb-1">تاريخ المدفوعات:</h5>
          ${payments.length === 0 ? `<p class="text-[10px] text-slate-400">لا توجد دفعات مسجلة.</p>` : `
            <table class="w-full text-right text-[10px]">
              <tbody>
                ${payments.map(p => `
                  <tr>
                    <td class="py-1 font-mono">${p["Date"]}</td>
                    <td class="py-1 font-bold">${translatePaymentMethod(p["Payment Method"])}</td>
                    <td class="py-1 font-mono text-left text-emerald-600">${formatCurrency(p["Amount"])}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `}
        </div>

        <!-- Order Balances calculations -->
        <div class="w-2/5 font-mono text-left space-y-1 text-xs">
          <div class="flex justify-between">
            <span class="font-sans">إجمالي التكلفة الكلية:</span>
            <span class="font-bold">${formatCurrency(o["Total Cost"])}</span>
          </div>
          <div class="flex justify-between text-emerald-600">
            <span class="font-sans">إجمالي المبلغ المسدد:</span>
            <span class="font-bold">${formatCurrency(o["Paid Amount"])}</span>
          </div>
          <div class="flex justify-between border-t border-slate-300 pt-1 text-rose-600 font-bold">
            <span class="font-sans">المبلغ المتبقي للتحصيل:</span>
            <span>${formatCurrency(o["Remaining Amount"])}</span>
          </div>
        </div>
      </div>

      <!-- Printing signature footer -->
      <div class="mt-8 border-t border-slate-200 pt-4 flex justify-between text-center text-[10px] text-slate-500 font-sans">
        <div>توقيع مستلم الفاتورة: ............................</div>
        <div>توقيع إدارة الماسة للستائر: ............................</div>
      </div>
    </div>
  `;

  // Trigger print dialog
  window.print();
};

function translatePaymentMethod(method) {
  const map = {
    "Cash": "نقدي (Cash)",
    "InstaPay": "إنستاباي (InstaPay)",
    "Vodafone Cash": "فودافون كاش",
    "Bank Transfer": "تحويل بنكي"
  };
  return map[method] || method;
}

