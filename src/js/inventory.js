/**
 * Inventory Management Module - Elmasa Curtain Workshop
 * Coordinates Inventory lists, Stock Movements ledgers, and catalog forms.
 */

let invCurrentPage = 1;
const invPageSize = 10;

document.addEventListener("DOMContentLoaded", () => {
  // Bind UI elements
  document.getElementById("inv-add-btn")?.addEventListener("click", () => openItemModal());
  document.getElementById("inv-modal-close")?.addEventListener("click", closeItemModal);
  document.getElementById("inv-cancel-btn")?.addEventListener("click", closeItemModal);
  
  document.getElementById("inv-form")?.addEventListener("submit", handleItemSubmit);

  // Stock movement adjustment trigger
  document.getElementById("inv-adjust-btn")?.addEventListener("click", () => openAdjustModal());
  document.getElementById("adjust-modal-close")?.addEventListener("click", () => document.getElementById("adjust-modal").classList.add("hidden"));
  document.getElementById("adjust-cancel-btn")?.addEventListener("click", () => document.getElementById("adjust-modal").classList.add("hidden"));
  document.getElementById("adjust-form")?.addEventListener("submit", handleAdjustSubmit);

  // Search and filters
  document.getElementById("inv-search-input")?.addEventListener("input", () => {
    invCurrentPage = 1;
    renderInventory();
  });
  document.getElementById("inv-filter-category")?.addEventListener("change", () => {
    invCurrentPage = 1;
    renderInventory();
  });
  document.getElementById("inv-filter-status")?.addEventListener("change", () => {
    invCurrentPage = 1;
    renderInventory();
  });

  // Pagination buttons
  document.getElementById("inv-prev-btn")?.addEventListener("click", () => {
    if (invCurrentPage > 1) {
      invCurrentPage--;
      renderInventory();
    }
  });
  document.getElementById("inv-next-btn")?.addEventListener("click", () => {
    invCurrentPage++;
    renderInventory();
  });
});

/**
 * Main Inventory Dashboard & Table Renderer
 */
window.renderInventory = function() {
  const db = appState.db;
  const items = db.InventoryItems || [];
  
  const query = document.getElementById("inv-search-input")?.value.toLowerCase().trim() || "";
  const filterCat = document.getElementById("inv-filter-category")?.value || "All";
  const filterStatus = document.getElementById("inv-filter-status")?.value || "All";

  // 1. Calculate KPI Dashboard cards
  let totalAssetVal = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  items.forEach(p => {
    if (p["Item Category"] === "Services") return; // Skip services from inventory evaluations
    const qty = parseFloat(p["Quantity Available"]) || 0;
    const minAlert = parseFloat(p["Minimum Quantity Alert"]) || 0;
    const buyPrice = parseFloat(p["Purchase Price"]) || 0;

    totalAssetVal += qty * buyPrice;

    if (qty === 0) {
      outOfStockCount++;
    } else if (qty <= minAlert) {
      lowStockCount++;
    }
  });

  const assetValEl = document.getElementById("inv-kpi-total-val");
  const lowStockEl = document.getElementById("inv-kpi-low-stock");
  const outStockEl = document.getElementById("inv-kpi-out-stock");

  if (assetValEl) assetValEl.textContent = formatCurrency(totalAssetVal);
  if (lowStockEl) lowStockEl.textContent = lowStockCount;
  if (outStockEl) outStockEl.textContent = outOfStockCount;

  // 2. Filter Table catalog
  let filtered = items.filter(p => {
    const matchesSearch = 
      p["Item Name"].toLowerCase().includes(query) ||
      p["Item ID"].toLowerCase().includes(query) ||
      (p["Barcode"] && p["Barcode"].includes(query)) ||
      (p["Supplier"] && p["Supplier"].toLowerCase().includes(query));

    const matchesCat = filterCat === "All" || p["Item Category"] === filterCat;

    const qty = parseFloat(p["Quantity Available"]) || 0;
    const minAlert = parseFloat(p["Minimum Quantity Alert"]) || 0;
    let stockStatus = "Available";
    
    if (qty === 0) {
      stockStatus = "OutOfStock";
    } else if (qty <= minAlert) {
      stockStatus = "LowStock";
    }

    const matchesStatus = filterStatus === "All" ||
      (filterStatus === "Available" && stockStatus === "Available" && p["Item Category"] !== "Services") ||
      (filterStatus === "LowStock" && stockStatus === "LowStock" && p["Item Category"] !== "Services") ||
      (filterStatus === "OutOfStock" && stockStatus === "OutOfStock" && p["Item Category"] !== "Services");

    return matchesSearch && matchesCat && matchesStatus;
  });

  const total = filtered.length;
  const totalPages = Math.ceil(total / invPageSize) || 1;
  if (invCurrentPage > totalPages) invCurrentPage = totalPages;

  const start = (invCurrentPage - 1) * invPageSize;
  const end = Math.min(start + invPageSize, total);
  const paginated = filtered.slice(start, end);

  const prevBtn = document.getElementById("inv-prev-btn");
  const nextBtn = document.getElementById("inv-next-btn");
  const infoText = document.getElementById("inv-pagination-info");

  if (prevBtn) prevBtn.disabled = invCurrentPage === 1;
  if (nextBtn) nextBtn.disabled = invCurrentPage === totalPages;
  if (infoText) {
    infoText.textContent = total > 0 
      ? `عرض ${start + 1} - ${end} من إجمالي ${total} منتج`
      : "لا توجد منتجات";
  }

  const tbody = document.getElementById("inventory-table-body");
  if (!tbody) return;

  if (paginated.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="py-8 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
          لم يتم العثور على منتجات مطابقة في المخازن.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = paginated.map(p => {
    const qty = parseFloat(p["Quantity Available"]) || 0;
    const minAlert = parseFloat(p["Minimum Quantity Alert"]) || 0;
    
    let stockBadgeClass, stockStatusText;
    if (p["Item Category"] === "Services") {
      stockBadgeClass = "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
      stockStatusText = "خدمة غير مخزنية";
    } else if (qty === 0) {
      stockBadgeClass = "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900";
      stockStatusText = "نفد من المخزن";
    } else if (qty <= minAlert) {
      stockBadgeClass = "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900";
      stockStatusText = `حرِج: ${qty} ${translateUnit(p["Unit"])}`;
    } else {
      stockBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900";
      stockStatusText = `متوفر: ${qty} ${translateUnit(p["Unit"])}`;
    }

    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs">
        <td class="py-3 px-6 font-mono font-bold text-slate-600 dark:text-slate-400">${p["Item ID"]}</td>
        <td class="py-3 px-6 text-right">
          <div class="font-bold text-slate-900 dark:text-slate-100">${p["Item Name"]}</div>
          ${p["Barcode"] ? `<span class="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">${p["Barcode"]}</span>` : ''}
        </td>
        <td class="py-3 px-6 text-right text-slate-500 dark:text-slate-400">${translateCategory(p["Item Category"])}</td>
        <td class="py-3 px-6 text-left font-mono">${formatCurrency(p["Purchase Price"])}</td>
        <td class="py-3 px-6 text-left font-mono font-bold text-slate-900 dark:text-slate-100">${formatCurrency(p["Selling Price"])}</td>
        <td class="py-3 px-6 text-center">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${stockBadgeClass}">
            ${stockStatusText}
          </span>
        </td>
        <td class="py-3 px-6 text-right text-slate-500 dark:text-slate-400 max-w-xs truncate">${p["Supplier"] || "-"}</td>
        <td class="py-3 px-6 text-center">
          <div class="flex items-center justify-center space-x-reverse space-x-1">
            <button onclick="openItemModal('${p["Item ID"]}')" class="p-1 border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="تعديل تفاصيل المنتج">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  lucide.createIcons();

  // Render stock movements table as well
  renderStockMovements();
};

/**
 * Render Stock Movements logs
 */
function renderStockMovements() {
  const db = window.appState.db;
  const movements = db.StockMovements || [];
  const tbody = document.getElementById("movements-table-body");
  
  if (!tbody) return;

  if (movements.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-4 text-center text-xs text-slate-400 dark:text-slate-500">لا توجد حركات مخزنية مسجلة.</td>
      </tr>
    `;
    return;
  }

  // Sort movements by date/timestamp descending
  const sorted = [...movements].sort((a, b) => new Date(b["Date"]) - new Date(a["Date"])).slice(0, 15);

  tbody.innerHTML = sorted.map(m => {
    const item = db.InventoryItems.find(p => p["Item ID"] === m["Item ID"]);
    const itemName = item ? item["Item Name"] : m["Item ID"];
    const unit = item ? item["Unit"] : "";

    let badgeClass = "bg-slate-100 text-slate-800";
    let typeText = "تعديل يدوي";
    if (m["Type"] === "Incoming") {
      badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950 dark:text-emerald-300";
      typeText = "وارد (شراء)";
    } else if (m["Type"] === "Outgoing") {
      badgeClass = "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950 dark:text-rose-300";
      typeText = "صادر (طلب)";
    }

    return `
      <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
        <td class="py-2 px-4 font-mono">${m["Date"]}</td>
        <td class="py-2 px-4 font-bold text-slate-800 dark:text-slate-200">${itemName}</td>
        <td class="py-2 px-4 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">
            ${typeText}
          </span>
        </td>
        <td class="py-2 px-4 font-mono text-center font-bold text-slate-900 dark:text-slate-100">${m["Quantity"]} ${translateUnit(unit)}</td>
        <td class="py-2 px-4 text-right text-slate-500 dark:text-slate-400 truncate max-w-xs">${m["Reason"] || "-"}</td>
        <td class="py-2 px-4 text-center text-slate-400 dark:text-slate-500">${m["User"] || "مجهول"}</td>
      </tr>
    `;
  }).join("");
}

/**
 * Handle Item Form submit
 */
async function handleItemSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("inv-id").value;
  const name = document.getElementById("inv-name").value.trim();
  const category = document.getElementById("inv-category").value;
  const unit = document.getElementById("inv-unit").value;
  const buy = parseFloat(document.getElementById("inv-buy-price").value) || 0;
  const sell = parseFloat(document.getElementById("inv-sell-price").value) || 0;
  const qty = parseFloat(document.getElementById("inv-qty-available").value) || 0;
  const min = parseFloat(document.getElementById("inv-min-qty").value) || 0;
  const supplier = document.getElementById("inv-supplier").value.trim();
  const barcode = document.getElementById("inv-barcode").value.trim();

  if (!name || !category) {
    showToast("يرجى ملء الاسم والقسم بشكل صحيح", "warning");
    return;
  }

  showLoader("جاري حفظ بيانات المنتج...");

  try {
    const item = {
      "Item ID": id || generateId("ITEM"),
      "Item Name": name,
      "Item Category": category,
      "Unit": unit,
      "Purchase Price": buy,
      "Selling Price": sell,
      "Quantity Available": qty,
      "Minimum Quantity Alert": min,
      "Supplier": supplier,
      "Barcode": barcode
    };

    await api.saveInventoryItem(item);
    closeItemModal();
    showToast("تم حفظ المنتج بنجاح", "success");
    await syncDatabase(true);
  } catch (err) {
    showToast(`فشل حفظ المنتج: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

/**
 * Open Item add/edit modal
 */
window.openItemModal = function(itemId = null) {
  const modal = document.getElementById("inventory-modal");
  const title = document.getElementById("inv-modal-title");
  
  document.getElementById("inv-form").reset();
  document.getElementById("inv-id").value = "";

  if (itemId) {
    title.textContent = "تعديل تفاصيل المنتج";
    const p = appState.db.InventoryItems.find(item => item["Item ID"] === itemId);
    if (p) {
      document.getElementById("inv-id").value = p["Item ID"];
      document.getElementById("inv-name").value = p["Item Name"];
      document.getElementById("inv-category").value = p["Item Category"];
      document.getElementById("inv-unit").value = p["Unit"];
      document.getElementById("inv-buy-price").value = p["Purchase Price"];
      document.getElementById("inv-sell-price").value = p["Selling Price"];
      document.getElementById("inv-qty-available").value = p["Quantity Available"];
      document.getElementById("inv-min-qty").value = p["Minimum Quantity Alert"];
      document.getElementById("inv-supplier").value = p["Supplier"] || "";
      document.getElementById("inv-barcode").value = p["Barcode"] || "";
    }
  } else {
    title.textContent = "إضافة منتج/خدمة جديد للمخزن";
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
};

window.closeItemModal = function() {
  document.getElementById("inventory-modal").classList.add("hidden");
  document.getElementById("inventory-modal").classList.remove("flex");
};

/**
 * Open manual Stock Adjustment Dialog
 */
window.openAdjustModal = function() {
  const db = window.appState.db;
  const select = document.getElementById("adjust-item-select");
  if (select) {
    select.innerHTML = `<option value="">-- اختر المنتج من المخزن --</option>` +
      (db.InventoryItems || []).filter(p => p["Item Category"] !== "Services")
      .map(p => `<option value="${p["Item ID"]}">${p["Item Name"]} (المتوفر حالياً: ${p["Quantity Available"]} ${translateUnit(p["Unit"])})</option>`).join("");
  }
  document.getElementById("adjust-form").reset();
  document.getElementById("adjust-modal").classList.remove("hidden");
};

async function handleAdjustSubmit(e) {
  e.preventDefault();

  const itemId = document.getElementById("adjust-item-select").value;
  const qty = parseFloat(document.getElementById("adjust-qty").value);
  const type = document.getElementById("adjust-type").value; // "Incoming" or "Outgoing"
  const reason = document.getElementById("adjust-reason").value.trim();

  if (!itemId || isNaN(qty) || qty <= 0) {
    showToast("يرجى ملء الحقول واختيار كمية صحيحة موجبة", "warning");
    return;
  }

  showLoader("جاري تسجيل الحركة وتعديل المخزون...");

  try {
    const movement = {
      "Movement ID": generateId("MOV"),
      "Item ID": itemId,
      "Date": getLocalDateString(),
      "Quantity": qty,
      "Type": type,
      "Reason": reason || (type === "Incoming" ? "تسوية زيادة يدوية" : "تسوية هالك/صادر يدوي"),
      "User": "أدمن"
    };

    await api.saveStockMovement(movement);
    document.getElementById("adjust-modal").classList.add("hidden");
    showToast("تم تعديل المخزون بنجاح وتسجيل الحركة", "success");
    await syncDatabase(true);
  } catch (err) {
    showToast(`فشل في تعديل المخزون: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

// Translate Category values to Arabic display
function translateCategory(cat) {
  const map = {
    "Fabric": "أقمشة وثياب",
    "Accessories": "إكسسوارات خياطة",
    "Hardware": "مسامير وأدوات مواسير",
    "Services": "خدمات وأجور"
  };
  return map[cat] || cat;
}

function translateUnit(unit) {
  const map = {
    "Meter": "متر",
    "Piece": "حبة",
    "Box": "علبة",
    "Room": "غرفة",
    "Trip": "زيارة/فني"
  };
  return map[unit] || unit;
}
