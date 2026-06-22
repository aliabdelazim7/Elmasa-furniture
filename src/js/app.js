/**
 * Main Application Coordinator & Router - Elmasa Curtain Workshop
 * Handles session auth, light/dark mode theme toggling, hash routing, toasts, and global search.
 */

// Global State
window.appState = {
  db: {
    Customers: [],
    Orders: [],
    Rooms: [],
    InventoryItems: [],
    OrderMaterials: [],
    Payments: [],
    Expenses: [],
    Technicians: [],
    StockMovements: [],
    Settings: []
  },
  currentRoute: "dashboard",
  settings: {
    businessName: "الماسة للستائر والديكور",
    currency: "EGP",
    address: "الدقهليه - المنصوره - مركز تمي الامديد - ظفر",
    phone: "+20 10 07036248"
  }
};

window.settingsUnlocked = false;
let autoLogoutTimer;

document.addEventListener("DOMContentLoaded", async () => {
  // Theme initialization
  initTheme();

  // Authentication check
  initAuth();

  // Route router bind
  initRouter();

  // Global event bindings
  initGlobalEvents();

  // Load Lucide icons
  lucide.createIcons();

  // Load configuration details
  loadSettingsFromConfig();

  // Sync DB immediately
  await syncDatabase(true);

  // Start activity tracker for auto logout (15 mins)
  startActivityTracker();
});

/**
 * Handles Light/Dark Theme Switching
 */
function initTheme() {
  const savedTheme = localStorage.getItem("elmasa_theme") || "light";
  if (savedTheme === "dark") {
    document.documentElement.classList.add("dark");
    const toggle = document.getElementById("theme-toggle-checkbox");
    if (toggle) toggle.checked = true;
  } else {
    document.documentElement.classList.remove("dark");
  }
}

window.toggleTheme = function() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("elmasa_theme", isDark ? "dark" : "light");
  showToast(isDark ? "تم تفعيل الوضع الداكن" : "تم تفعيل الوضع المضيء", "info");
};

/**
 * Router Implementation
 */
function initRouter() {
  const routes = ["dashboard", "orders", "customers", "inventory", "expenses", "reports", "settings"];
  
  const handleRoute = () => {
    let hash = window.location.hash.replace("#", "");
    if (!routes.includes(hash)) {
      hash = "dashboard";
    }
    
    // Lock settings page with a different secure password in both Admin & Demo sessions
    if (hash === "settings" && !window.settingsUnlocked) {
      // Revert hash for a moment
      const prevRoute = window.appState.currentRoute && window.appState.currentRoute !== "settings" ? window.appState.currentRoute : "dashboard";
      window.location.hash = "#" + prevRoute;
      
      // Open settings password modal
      const modal = document.getElementById("settings-password-modal");
      if (modal) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
        const input = document.getElementById("settings-pass-input");
        if (input) {
          input.value = "";
          input.focus();
        }
      }
      return;
    }
    
    window.appState.currentRoute = hash;
    
    routes.forEach(route => {
      const pageEl = document.getElementById(`${route}-page`);
      const navLink = document.getElementById(`nav-${route}`);
      
      if (route === hash) {
        if (pageEl) pageEl.classList.remove("hidden");
        if (navLink) {
          navLink.classList.remove("sidebar-link-inactive");
          navLink.classList.add("sidebar-link-active");
        }
        renderRoutePage(route);
      } else {
        if (pageEl) pageEl.classList.add("hidden");
        if (navLink) {
          navLink.classList.remove("sidebar-link-active");
          navLink.classList.add("sidebar-link-inactive");
        }
      }
    });

    // Close mobile side menu
    const sidebar = document.querySelector("aside");
    if (sidebar) sidebar.classList.add("hidden");
  };

  window.addEventListener("hashchange", handleRoute);
  
  if (!window.location.hash) {
    window.location.hash = "#dashboard";
  } else {
    handleRoute();
  }
}

function renderRoutePage(route) {
  try {
    switch (route) {
      case "dashboard":
        if (window.renderDashboard) window.renderDashboard();
        break;
      case "orders":
        if (window.renderOrders) window.renderOrders();
        break;
      case "customers":
        if (window.renderCustomers) window.renderCustomers();
        break;
      case "inventory":
        if (window.renderInventory) window.renderInventory();
        break;
      case "expenses":
        if (window.renderExpenses) window.renderExpenses();
        break;
      case "reports":
        if (window.renderReports) window.renderReports();
        break;
      case "settings":
        if (window.renderSettings) window.renderSettings();
        break;
    }
  } catch (error) {
    console.error(`Page render failed [${route}]:`, error);
    showToast(`فشل رندر الصفحة: ${error.message}`, "error");
  }
}

/**
 * Global UI Event handlers
 */
function initGlobalEvents() {
  // Mobile sidebar toggle
  document.getElementById("mobile-menu-btn")?.addEventListener("click", () => {
    document.querySelector("aside")?.classList.toggle("hidden");
  });

  // Sync button hook
  document.getElementById("sidebar-sync-btn")?.addEventListener("click", async () => {
    await syncDatabase();
  });

  // Global settings form submit
  document.getElementById("settings-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const newUrl = document.getElementById("settings-api-url").value.trim();
    const newBizName = document.getElementById("settings-business-name").value.trim();
    const newAddress = document.getElementById("settings-address").value.trim();
    const newPhone = document.getElementById("settings-phone").value.trim();
    const newEmail = document.getElementById("settings-admin-email").value.trim();
    const newPass = document.getElementById("settings-admin-password").value.trim();

    showLoader("جاري حفظ الإعدادات وتحديث الاتصال...");

    try {
      // Hash the password if it's new (not already hashed)
      let passToSave = newPass;
      const isAlreadyHashed = /^[a-f0-9]{64}$/i.test(newPass);
      if (!isAlreadyHashed && newPass !== "") {
        passToSave = await sha256(newPass);
      }

      api.saveConfig({
        webAppUrl: newUrl,
        businessName: newBizName,
        address: newAddress,
        phone: newPhone,
        adminEmail: newEmail,
        adminPassword: passToSave
      });

      await api.updateSettings([
        { Key: "Business Name", Value: newBizName },
        { Key: "Address", Value: newAddress },
        { Key: "Phone Number", Value: newPhone },
        { Key: "Admin Email", Value: newEmail },
        { Key: "Admin Password", Value: passToSave }
      ]);
      
      loadSettingsFromConfig();
      showToast("تم حفظ الإعدادات بنجاح ومزامنتها", "success");
      await syncDatabase(true);
    } catch (err) {
      showToast(`فشلت مزامنة الإعدادات مع السحابة: ${err.message}`, "error");
    } finally {
      hideLoader();
    }
  });

  // Login form submit
  document.getElementById("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const pass = document.getElementById("login-password").value.trim();

    // 1. Handle Demo Mode login bypass
    if (email === "demo@elmasa.com" && pass === "elmasa_demo") {
      localStorage.setItem("elmasa_session_active", "true");
      localStorage.setItem("elmasa_demo_session", "true");
      api.isMockMode = true; // force mock mode immediately
      api.resetToDemoDatabase(); // Reset to rich Arabic sample database for demo mode
      showToast("تم الدخول في وضع التجربة بنجاح (قاعدة بيانات محلية آمنة)", "success");
      initAuth();
      startActivityTracker();
      await syncDatabase(true);
      return;
    }

    // 2. Handle Admin Mode login
    const config = api.loadConfig();
    const correctEmail = config.adminEmail || "elmasa_admin_secure@elmasa.com";
    const correctPass = config.adminPassword || "ElmasaAdminSecure2026!#";

    let hashedPass = pass;
    const isHashed = /^[a-f0-9]{64}$/i.test(correctPass);
    if (isHashed) {
      hashedPass = await sha256(pass);
    }

    if (email === correctEmail && (hashedPass === correctPass || pass === correctPass)) {
      localStorage.setItem("elmasa_session_active", "true");
      localStorage.removeItem("elmasa_demo_session");
      api.isMockMode = !api.settings.webAppUrl; // restore mock state based on API URL
      showToast("تم تسجيل دخول المسؤول بنجاح (ربط سحابي حقيقي)", "success");
      initAuth();
      startActivityTracker();
      await syncDatabase(false);
    } else {
      showToast("خطأ في البريد الإلكتروني أو كلمة المرور!", "error");
    }
  });

  window.fillLoginCreds = function(mode) {
    const emailInput = document.getElementById("login-email");
    const passInput = document.getElementById("login-password");
    if (emailInput && passInput) {
      if (mode === "demo") {
        emailInput.value = "demo@elmasa.com";
        passInput.value = "elmasa_demo";
      }
    }
  };

  // Logout trigger
  document.getElementById("sidebar-logout-btn")?.addEventListener("click", () => {
    if (confirm("هل تريد بالفعل تسجيل الخروج؟")) {
      logout();
    }
  });

  // Theme switcher trigger
  document.getElementById("theme-toggle-checkbox")?.addEventListener("change", () => {
    window.toggleTheme();
  });

  // Global Search Box Listener
  const globalSearch = document.getElementById("global-search-input");
  const globalResults = document.getElementById("global-search-results");

  if (globalSearch && globalResults) {
    globalSearch.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase().trim();
      
      // Sync query with sub pages search bars if active
      const activeRoute = window.appState.currentRoute;
      if (activeRoute === "customers") {
        const cSearch = document.getElementById("cust-search-input");
        if (cSearch) { cSearch.value = query; cSearch.dispatchEvent(new Event("input")); }
      } else if (activeRoute === "orders") {
        const oSearch = document.getElementById("order-search-input");
        if (oSearch) { oSearch.value = query; oSearch.dispatchEvent(new Event("input")); }
      } else if (activeRoute === "inventory") {
        const iSearch = document.getElementById("inv-search-input");
        if (iSearch) { iSearch.value = query; iSearch.dispatchEvent(new Event("input")); }
      }

      if (query.length < 2) {
        globalResults.innerHTML = "";
        globalResults.classList.add("hidden");
        return;
      }

      renderGlobalSearchResults(query);
    });

    // Close popup on click outside
    document.addEventListener("click", (e) => {
      if (!globalSearch.contains(e.target) && !globalResults.contains(e.target)) {
        globalResults.classList.add("hidden");
      }
    });
  }

  // Settings Password Modal Events
  const settingsModal = document.getElementById("settings-password-modal");
  const settingsForm = document.getElementById("settings-password-form");
  const settingsClose = document.getElementById("settings-pass-close");
  const settingsCancel = document.getElementById("settings-pass-cancel-btn");

  const closeSettingsModal = () => {
    if (settingsModal) {
      settingsModal.classList.add("hidden");
      settingsModal.classList.remove("flex");
    }
  };

  if (settingsForm) {
    settingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("settings-pass-input");
      const password = input ? input.value : "";
      const correctSettingsPass = "ElmasaSettingsSecure2026!!";
      
      if (password === correctSettingsPass) {
        window.settingsUnlocked = true;
        closeSettingsModal();
        showToast("تم التحقق من كلمة مرور الإعدادات بنجاح", "success");
        window.location.hash = "#settings";
      } else {
        showToast("كلمة مرور الإعدادات خاطئة! غير مسموح بالدخول.", "error");
      }
    });
  }

  settingsClose?.addEventListener("click", closeSettingsModal);
  settingsCancel?.addEventListener("click", closeSettingsModal);

  // Register Sync UI updater
  api.registerSyncListener((freshDb) => {
    window.appState.db = freshDb;
    window.updateSyncUI();
    renderRoutePage(window.appState.currentRoute);
  });
}

/**
 * Perform Sync with DB
 */
async function syncDatabase(silent = false) {
  if (!silent) showLoader("جاري سحب وتحديث البيانات...");
  
  const icon = document.getElementById("sync-icon");
  if (icon) icon.classList.add("animate-spin");

  try {
    const data = await api.syncData();
    window.appState.db = data;
    window.updateSyncUI();
    renderRoutePage(window.appState.currentRoute);
    if (!silent) showToast("تم تحديث البيانات بنجاح", "success");
  } catch (error) {
    console.warn("Direct sync failed. Using local database cache.");
    window.appState.db = api.loadLocalDb();
    window.updateSyncUI();
    renderRoutePage(window.appState.currentRoute);
    if (!silent) showToast("فشلت المزامنة المباشرة. تعمل على النسخة المحلية مؤقتاً.", "warning");
  } finally {
    if (icon) icon.classList.remove("animate-spin");
    if (!silent) hideLoader();
  }
}

/**
 * Update UI Sync Badges & Queue status
 */
window.updateSyncUI = function() {
  const badge = document.getElementById("sync-status-badge");
  const queueCount = api.syncQueue.length;
  
  if (!badge) return;

  if (api.isMockMode) {
    badge.textContent = "وضع التجربة";
    badge.className = "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  } else {
    if (queueCount > 0) {
      badge.textContent = `معلق للمزامنة (${queueCount})`;
      badge.className = "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 animate-pulse";
    } else {
      badge.textContent = "متصل بجوجل شيت";
      badge.className = "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    }
  }

  // Stock alert checking
  checkStockAlertNotifications();
};

/**
 * Compile Inventory stock warnings
 */
function checkStockAlertNotifications() {
  const items = window.appState.db.InventoryItems || [];
  const lowStock = items.filter(item => {
    const qty = parseFloat(item["Quantity Available"]) || 0;
    const minAlert = parseFloat(item["Minimum Quantity Alert"]) || 0;
    return item["Item Category"] !== "Services" && qty <= minAlert;
  });

  const countBadge = document.getElementById("notification-count-badge");
  const alertDot = document.getElementById("low-stock-alert-dot");
  const list = document.getElementById("notification-list");
  
  if (countBadge) {
    if (lowStock.length > 0) {
      countBadge.textContent = lowStock.length;
      countBadge.classList.remove("hidden");
      if (alertDot) alertDot.classList.remove("hidden");
    } else {
      countBadge.classList.add("hidden");
      if (alertDot) alertDot.classList.add("hidden");
    }
  }

  if (list) {
    if (lowStock.length === 0) {
      list.innerHTML = `<div class="py-4 text-center text-slate-400">لا توجد مواد منخفضة المخزون حالياً.</div>`;
    } else {
      list.innerHTML = lowStock.map(p => `
        <div class="p-2 border-b border-slate-100 dark:border-slate-800 text-right cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800" onclick="clickNotificationProduct('${p["Item ID"]}')">
          <p class="font-bold text-slate-800 dark:text-slate-200 text-[11px]">${escapeHtml(p["Item Name"])}</p>
          <p class="text-[9px] text-rose-500 font-semibold">المخزون الحالي: ${p["Quantity Available"]} ${escapeHtml(p["Unit"])} (حد الأمان: ${p["Minimum Quantity Alert"]})</p>
        </div>
      `).join("");
    }
  }
}

window.clickNotificationProduct = function(itemId) {
  document.getElementById("notification-popover")?.classList.add("hidden");
  window.location.hash = "#inventory";
  setTimeout(() => {
    if (typeof window.openItemModal === "function") {
      window.openItemModal(itemId);
    }
  }, 150);
};

// Global Notifications toggle
document.getElementById("header-alert-btn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("notification-popover")?.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  if (!document.getElementById("header-alert-btn")?.contains(e.target)) {
    document.getElementById("notification-popover")?.classList.add("hidden");
  }
});

/**
 * Global Search Results Population
 */
function renderGlobalSearchResults(query) {
  const dropdown = document.getElementById("global-search-results");
  if (!dropdown) return;

  const db = window.appState.db;
  const q = query.toLowerCase();

  const customers = (db.Customers || []).filter(c => 
    c["Full Name"].toLowerCase().includes(q) || c["Phone Number"].includes(q)
  ).slice(0, 3);

  const orders = (db.Orders || []).filter(o => 
    o["Order ID"].toLowerCase().includes(q)
  ).slice(0, 3);

  const products = (db.InventoryItems || []).filter(p => 
    p["Item Name"].toLowerCase().includes(q) || (p["Barcode"] && p["Barcode"].includes(q))
  ).slice(0, 3);

  const total = customers.length + orders.length + products.length;
  if (total === 0) {
    dropdown.innerHTML = `<div class="p-3 text-center text-slate-400">لا توجد نتائج مطابقة</div>`;
    dropdown.classList.remove("hidden");
    return;
  }

  let html = "";
  if (customers.length > 0) {
    html += `<div class="font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1 mb-1 text-right">العملاء</div>`;
    html += customers.map(c => `
      <div onclick="clickGlobalSearchCustomer('${c["Customer ID"]}')" class="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer flex justify-between items-center transition-all">
        <span class="font-bold text-slate-800 dark:text-slate-200 text-[11px]">${escapeHtml(c["Full Name"])}</span>
        <span class="text-slate-500 font-mono text-[10px]">${escapeHtml(c["Phone Number"])}</span>
      </div>
    `).join("");
  }

  if (orders.length > 0) {
    html += `<div class="font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1 mt-2 mb-1 text-right">الطلبات</div>`;
    html += orders.map(o => `
      <div onclick="clickGlobalSearchOrder('${o["Order ID"]}')" class="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer flex justify-between items-center transition-all">
        <span class="font-bold text-indigo-600 font-mono text-[11px]">${escapeHtml(o["Order ID"])}</span>
        <span class="text-slate-500 text-[10px]">${formatCurrency(o["Total Cost"])}</span>
      </div>
    `).join("");
  }

  if (products.length > 0) {
    html += `<div class="font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1 mt-2 mb-1 text-right">المخزن</div>`;
    html += products.map(p => `
      <div onclick="clickGlobalSearchProduct('${p["Item ID"]}')" class="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer flex justify-between items-center transition-all">
        <span class="font-bold text-slate-800 dark:text-slate-200 text-[11px]">${escapeHtml(p["Item Name"])}</span>
        <span class="text-emerald-600 font-mono text-[10px]">${formatCurrency(p["Selling Price"])}</span>
      </div>
    `).join("");
  }

  dropdown.innerHTML = html;
  dropdown.classList.remove("hidden");
}

window.clickGlobalSearchCustomer = function(customerId) {
  document.getElementById("global-search-results").classList.add("hidden");
  document.getElementById("global-search-input").value = "";
  window.location.hash = "#customers";
  setTimeout(() => {
    if (typeof window.openCustomerProfile === "function") {
      window.openCustomerProfile(customerId);
    }
  }, 150);
};

window.clickGlobalSearchOrder = function(orderId) {
  document.getElementById("global-search-results").classList.add("hidden");
  document.getElementById("global-search-input").value = "";
  window.location.hash = "#orders";
  setTimeout(() => {
    if (typeof window.openOrderModal === "function") {
      window.openOrderModal(orderId);
    }
  }, 150);
};

window.clickGlobalSearchProduct = function(itemId) {
  document.getElementById("global-search-results").classList.add("hidden");
  document.getElementById("global-search-input").value = "";
  window.location.hash = "#inventory";
  setTimeout(() => {
    if (typeof window.openItemModal === "function") {
      window.openItemModal(itemId);
    }
  }, 150);
};

/**
 * Load System parameters from Configuration settings
 */
function loadSettingsFromConfig() {
  const config = api.loadConfig();
  window.appState.settings = {
    businessName: config.businessName || "الماسة للستائر والديكور",
    currency: config.currency || "EGP",
    address: config.address || "الدقهليه - المنصوره - مركز تمي الامديد - ظفر",
    phone: config.phone || "+20 10 07036248"
  };
  
  const titles = [
    document.getElementById("nav-business-title"),
    document.getElementById("header-business-name"),
    document.getElementById("login-business-title")
  ];
  titles.forEach(t => { if (t) t.textContent = window.appState.settings.businessName; });
  
  const headerCurrency = document.getElementById("header-currency-code");
  if (headerCurrency) headerCurrency.textContent = `العملة: ${window.appState.settings.currency}`;

  // Fill settings input forms
  const urlIn = document.getElementById("settings-api-url");
  const nameIn = document.getElementById("settings-business-name");
  const addrIn = document.getElementById("settings-address");
  const phoneIn = document.getElementById("settings-phone");
  const emailIn = document.getElementById("settings-admin-email");
  const passIn = document.getElementById("settings-admin-password");

  if (urlIn) urlIn.value = config.webAppUrl || "";
  if (nameIn) nameIn.value = window.appState.settings.businessName;
  if (addrIn) addrIn.value = window.appState.settings.address;
  if (phoneIn) phoneIn.value = window.appState.settings.phone;
  if (emailIn) emailIn.value = config.adminEmail || "elmasa_admin_secure@elmasa.com";
  if (passIn) passIn.value = config.adminPassword || "ElmasaAdminSecure2026!#";
}

/**
 * Auth Session Control
 */
function initAuth() {
  const overlay = document.getElementById("login-overlay");
  if (!overlay) return;

  const session = localStorage.getItem("elmasa_session_active");
  if (session === "true") {
    overlay.classList.add("hidden");
  } else {
    overlay.classList.remove("hidden");
  }
}

function logout() {
  localStorage.removeItem("elmasa_session_active");
  location.reload();
}

/**
 * Security: Auto Logout Activity Tracker (15 mins idle time)
 */
function startActivityTracker() {
  if (localStorage.getItem("elmasa_session_active") !== "true") return;

  const resetTimer = () => {
    clearTimeout(autoLogoutTimer);
    autoLogoutTimer = setTimeout(() => {
      localStorage.removeItem("elmasa_session_active");
      showToast("تم تسجيل الخروج تلقائياً لعدم النشاط", "warning");
      setTimeout(() => location.reload(), 1500);
    }, 15 * 60 * 1000); // 15 minutes
  };

  const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
  events.forEach(e => document.addEventListener(e, resetTimer, true));
  resetTimer();
}

// --- Dynamic Alert and Loaders helpers ---

window.showLoader = function(text = "جاري التحميل...") {
  const overlay = document.getElementById("loader-overlay");
  const loaderText = document.getElementById("loader-text");
  if (overlay && loaderText) {
    loaderText.textContent = text;
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
  }
};

window.hideLoader = function() {
  const overlay = document.getElementById("loader-overlay");
  if (overlay) {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
  }
};

window.showToast = function(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "p-4 rounded-xl shadow-lg border flex items-start space-x-reverse space-x-3 pointer-events-auto toast-slide-in transition-all duration-300 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700";

  let bgClass, borderClass, iconColor, iconName;
  switch (type) {
    case "success":
      iconColor = "text-emerald-500";
      iconName = "check-circle";
      break;
    case "warning":
      iconColor = "text-amber-500";
      iconName = "alert-triangle";
      break;
    case "error":
      iconColor = "text-rose-500";
      iconName = "alert-circle";
      break;
    default:
      iconColor = "text-indigo-500";
      iconName = "info";
  }

  toast.innerHTML = `
    <div class="${iconColor}">
      <i data-lucide="${iconName}" class="w-5 h-5"></i>
    </div>
    <div class="flex-1 text-right">
      <p class="text-xs font-semibold text-slate-800 dark:text-slate-200">${message}</p>
    </div>
    <button class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors mr-2" onclick="this.parentElement.remove()">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;

  container.appendChild(toast);
  lucide.createIcons({ attrs: { class: 'w-4 h-4' } });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50px)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

window.formatCurrency = function(value) {
  const num = parseFloat(value) || 0;
  return `${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${window.appState.settings.currency}`;
};

window.generateId = function(prefix) {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${ts}${rand}`;
};

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);                    
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

window.escapeHtml = function(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};
