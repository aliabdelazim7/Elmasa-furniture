/**
 * API & Synchronization Layer - Elmasa Curtain Workshop
 * Coordinates local storage caching, mock modes, and offline synchronization queues.
 */

const API_CONFIG_KEY = "elmasa_system_settings";
const LOCAL_DB_KEY = "elmasa_local_database";
const SYNC_QUEUE_KEY = "elmasa_pending_sync_queue";
const SECURE_TOKEN = "ELMASA_API_SECURE_TOKEN_2026_xYz987!";

// Default System Configuration
const defaultSettings = {
  webAppUrl: "https://script.google.com/macros/s/AKfycbx8274_a2d78fn7NhnnM1Q6EwarBKvvR_YD6zkpzoSPlKW4PUi5RtNXnDVondUnuuIg/exec",
  businessName: "الماسة للستائر والديكور",
  address: "القاهرة، مصر",
  phone: "+201018907086",
  currency: "EGP",
  adminEmail: "elmasa_admin_secure@elmasa.com",
  adminPassword: "ElmasaAdminSecure2026!#"
};

// Initial Realistic Curtain Workshop Demo Database (Arabic localized)
const demoDatabase = {
  Customers: [
    { "Customer ID": "CUST-1001", "Full Name": "أحمد رأفت الشافعي", "Phone Number": "01001234567", "Secondary Phone": "01122334455", "Address": "شقة 4، عمارة 12، شارع التسعين، التجمع الخامس", "Notes": "العميل يفضل تركيب الحلقات المخفية ويريد ألوان هادئة", "Created Date": "2026-06-10" },
    { "Customer ID": "CUST-1002", "Full Name": "أ. ميار محمود صبري", "Phone Number": "01234567890", "Secondary Phone": "", "Address": "فيلا 3، كمبوند الياسمين، الشيخ زايد", "Notes": "طلب أقمشة قطيفة عازلة للضوء (Blackout)", "Created Date": "2026-06-15" }
  ],
  Orders: [
    { "Order ID": "ORD-5001", "Customer ID": "CUST-1001", "Order Date": "2026-06-10", "Delivery Date": "2026-06-25", "Installation Date": "2026-06-26", "Assigned Technician": "الأسطى شريف عبد الله", "Order Status": "Sewing In Progress", "Total Cost": 4560, "Paid Amount": 2500, "Remaining Amount": 2060, "Notes": "تم استلام القماش وجاري التفصيل بالورشة" },
    { "Order ID": "ORD-5002", "Customer ID": "CUST-1002", "Order Date": "2026-06-15", "Delivery Date": "2026-06-28", "Installation Date": "2026-06-29", "Assigned Technician": "الأسطى محمد جابر", "Order Status": "Measurements Taken", "Total Cost": 12800, "Paid Amount": 6000, "Remaining Amount": 6800, "Notes": "تم رفع المقاسات وتأكيد الألوان مع العميل" }
  ],
  Rooms: [
    { "Room ID": "RM-201", "Order ID": "ORD-5001", "Customer ID": "CUST-1001", "Room Name": "غرفة المعيشة (Living Room)", "Width": 3.5, "Height": 2.8, "Curtain Type": "ستارة حلقات على مواسير", "Fabric Type": "كتان تركي بيج", "Color": "بيج فاتح", "Quantity": 2 },
    { "Room ID": "RM-202", "Order ID": "ORD-5001", "Customer ID": "CUST-1001", "Room Name": "غرفة النوم الرئيسية", "Width": 2.9, "Height": 2.7, "Curtain Type": "ستارة شيفون مخفي", "Fabric Type": "شيفون أبيض ناعم", "Color": "أوف وايت", "Quantity": 1 },
    { "Room ID": "RM-203", "Order ID": "ORD-5002", "Customer ID": "CUST-1002", "Room Name": "الريسيبشن الكبير", "Width": 5.2, "Height": 3.0, "Curtain Type": "ستارة بيلتكانة خشبية", "Fabric Type": "قطيفة كحلي وبلاك أوت", "Color": "كحلي * رمادي", "Quantity": 3 }
  ],
  InventoryItems: [
    { "Item ID": "ITEM-101", "Item Name": "قماش كتان تركي بيج", "Item Category": "Fabric", "Unit": "Meter", "Purchase Price": 120, "Selling Price": 180, "Quantity Available": 120, "Minimum Quantity Alert": 20, "Supplier": "الشركة المصرية للأقمشة", "Barcode": "6221109012345" },
    { "Item ID": "ITEM-102", "Item Name": "قماش قطيفة كحلي كوري عريض", "Item Category": "Fabric", "Unit": "Meter", "Purchase Price": 170, "Selling Price": 250, "Quantity Available": 15, "Minimum Quantity Alert": 15, "Supplier": "مورد أقمشة التوفيق", "Barcode": "6221109012369" },
    { "Item ID": "ITEM-103", "Item Name": "شيفون أبيض تركي ناعم", "Item Category": "Fabric", "Unit": "Meter", "Purchase Price": 50, "Selling Price": 80, "Quantity Available": 200, "Minimum Quantity Alert": 30, "Supplier": "مستورد أقمشة الأزهر", "Barcode": "6221109012383" },
    { "Item ID": "ITEM-201", "Item Name": "شريط ستائر 4 فتلة عريض", "Item Category": "Accessories", "Unit": "Meter", "Purchase Price": 8, "Selling Price": 15, "Quantity Available": 280, "Minimum Quantity Alert": 50, "Supplier": "مورد خردوات الموسكي", "Barcode": "20100050" },
    { "Item ID": "ITEM-202", "Item Name": "حلقات ستارة ذهبي بلاستيك", "Item Category": "Accessories", "Unit": "Piece", "Purchase Price": 1.5, "Selling Price": 3, "Quantity Available": 450, "Minimum Quantity Alert": 100, "Supplier": "مورد خردوات الموسكي", "Barcode": "20100067" },
    { "Item ID": "ITEM-301", "Item Name": "مواسير ستائر حديد ذهبي 2 متر", "Item Category": "Hardware", "Unit": "Piece", "Purchase Price": 70, "Selling Price": 120, "Quantity Available": 18, "Minimum Quantity Alert": 5, "Supplier": "مؤسسة الحديد والصلب للديكور", "Barcode": "30100099" },
    { "Item ID": "ITEM-302", "Item Name": "فيشر ومسامير علبة 100 حبة", "Item Category": "Hardware", "Unit": "Box", "Purchase Price": 25, "Selling Price": 45, "Quantity Available": 2, "Minimum Quantity Alert": 5, "Supplier": "أدوات السبتية", "Barcode": "30100112" },
    { "Item ID": "ITEM-401", "Item Name": "أجر تفصيل وخياطة عادي (متر طولي)", "Item Category": "Services", "Unit": "Meter", "Purchase Price": 0, "Selling Price": 30, "Quantity Available": 9999, "Minimum Quantity Alert": 0, "Supplier": "داخلي للورشة", "Barcode": "" },
    { "Item ID": "ITEM-402", "Item Name": "أجر تركيب وصيانة (شامل الانتقال)", "Item Category": "Services", "Unit": "Trip", "Purchase Price": 0, "Selling Price": 250, "Quantity Available": 9999, "Minimum Quantity Alert": 0, "Supplier": "داخلي للورشة", "Barcode": "" }
  ],
  OrderMaterials: [
    { "Material ID": "MAT-801", "Order ID": "ORD-5001", "Item ID": "ITEM-101", "Quantity Used": 15, "Unit Price": 180, "Total Price": 2700 },
    { "Material ID": "MAT-802", "Order ID": "ORD-5001", "Item ID": "ITEM-201", "Quantity Used": 15, "Unit Price": 15, "Total Price": 225 },
    { "Material ID": "MAT-803", "Order ID": "ORD-5001", "Item ID": "ITEM-202", "Quantity Used": 45, "Unit Price": 3, "Total Price": 135 },
    { "Material ID": "MAT-804", "Order ID": "ORD-5001", "Item ID": "ITEM-401", "Quantity Used": 15, "Unit Price": 30, "Total Price": 450 }
  ],
  Payments: [
    { "Payment ID": "PAY-901", "Order ID": "ORD-5001", "Amount": 2500, "Payment Method": "InstaPay", "Date": "2026-06-10" },
    { "Payment ID": "PAY-902", "Order ID": "ORD-5002", "Amount": 6000, "Payment Method": "Vodafone Cash", "Date": "2026-06-15" }
  ],
  Expenses: [
    { "Expense ID": "EXP-301", "Expense Name": "شراء بنزين لسيارة التوصيل", "Category": "Transportation", "Amount": 200, "Date": "2026-06-12" },
    { "Expense ID": "EXP-302", "Expense Name": "فاتورة كهرباء الورشة لشهر مايو", "Category": "Electricity", "Amount": 750, "Date": "2026-06-15" }
  ],
  Technicians: [
    { "Technician Name": "الأسطى شريف عبد الله", "Phone Number": "01009876543", "Notes": "متخصص في تركيب المواسير الحديثة والبيلتكانات" },
    { "Technician Name": "الأسطى محمد جابر", "Phone Number": "01223459876", "Notes": "متخصص في تفصيل البراقع والشيفونات المعقدة" }
  ],
  StockMovements: [
    { "Movement ID": "MOV-1001", "Item ID": "ITEM-101", "Date": "2026-06-10", "Quantity": 15, "Type": "Outgoing", "Reason": "صادر لطلب رقم ORD-5001", "User": "النظام" },
    { "Movement ID": "MOV-1002", "Item ID": "ITEM-201", "Date": "2026-06-10", "Quantity": 15, "Type": "Outgoing", "Reason": "صادر لطلب رقم ORD-5001", "User": "النظام" }
  ],
  Settings: [
    { "Key": "Business Name", "Value": "الماسة للستائر والديكور" },
    { "Key": "Address", "Value": "القاهرة، مصر" },
    { "Key": "Phone Number", "Value": "+201018907086" },
    { "Key": "Currency", "Value": "EGP" },
    { "Key": "Admin Email", "Value": "elmasa_admin_secure@elmasa.com" },
    { "Key": "Admin Password", "Value": "ElmasaAdminSecure2026!#" }
  ]
};

class ApiService {
  constructor() {
    this.settings = this.loadConfig();
    this.db = this.loadLocalDb();
    this.syncQueue = this.loadSyncQueue();
    this.isMockMode = (localStorage.getItem("elmasa_session_active") !== "true") || (localStorage.getItem("elmasa_demo_session") === "true") || !this.settings.webAppUrl;
    this.syncListeners = [];
    this.isSyncing = false;

    // Start auto sync interval every 20 seconds
    setInterval(() => this.flushSyncQueue(), 20000);
  }

  loadConfig() {
    const data = localStorage.getItem(API_CONFIG_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (!parsed.webAppUrl) {
          parsed.webAppUrl = defaultSettings.webAppUrl;
          localStorage.setItem(API_CONFIG_KEY, JSON.stringify(parsed));
        }
        return parsed;
      } catch (e) {
        return defaultSettings;
      }
    }
    localStorage.setItem(API_CONFIG_KEY, JSON.stringify(defaultSettings));
    return defaultSettings;
  }

  saveConfig(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem(API_CONFIG_KEY, JSON.stringify(this.settings));
    this.isMockMode = (localStorage.getItem("elmasa_session_active") !== "true") || (localStorage.getItem("elmasa_demo_session") === "true") || !this.settings.webAppUrl;
  }

  loadLocalDb() {
    const data = localStorage.getItem(LOCAL_DB_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        return demoDatabase;
      }
    }
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(demoDatabase));
    return demoDatabase;
  }

  saveLocalDb() {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(this.db));
  }

  loadSyncQueue() {
    const data = localStorage.getItem(SYNC_QUEUE_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  saveSyncQueue() {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
  }

  registerSyncListener(callback) {
    this.syncListeners.push(callback);
  }

  notifySyncListeners() {
    this.syncListeners.forEach(listener => listener(this.db));
  }

  /**
   * Sync data from Google Sheet if URL is active.
   * Otherwise returns cached local db immediately.
   */
  async syncData() {
    if (this.isMockMode) {
      console.log("API: Running in local Mock Mode.");
      return this.db;
    }

    try {
      const url = this.settings.webAppUrl + (this.settings.webAppUrl.includes("?") ? "&" : "?") + "token=" + SECURE_TOKEN;
      const response = await fetch(url, {
        method: "GET",
        mode: "cors"
      });

      if (!response.ok) throw new Error("HTTP connection error " + response.status);

      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        this.db = resJson.data;
        this.saveLocalDb();
        
        // Update local settings structure
        if (this.db.Settings) {
          const loadedSettings = {};
          this.db.Settings.forEach(s => {
            if (s.Key === "Business Name") loadedSettings.businessName = s.Value;
            if (s.Key === "Address") loadedSettings.address = s.Value;
            if (s.Key === "Phone Number") loadedSettings.phone = s.Value;
            if (s.Key === "Currency") loadedSettings.currency = s.Value;
            if (s.Key === "Admin Email") loadedSettings.adminEmail = s.Value;
            if (s.Key === "Admin Password") loadedSettings.adminPassword = s.Value;
          });
          this.saveConfig(loadedSettings);
        }
        
        this.notifySyncListeners();
        return this.db;
      } else {
        throw new Error(resJson.error || "Failed to load database from Sheet");
      }
    } catch (error) {
      console.error("API Sync Failed:", error);
      throw error;
    }
  }

  /**
   * Primary writer helper. Handles offline caching queueing when connection breaks.
   */
  async postAction(action, payload) {
    if (this.isMockMode) {
      return this.executeMockAction(action, payload);
    }

    // Try posting directly to backend
    try {
      const url = this.settings.webAppUrl + (this.settings.webAppUrl.includes("?") ? "&" : "?") + "token=" + SECURE_TOKEN;
      const response = await fetch(url, {
        method: "POST",
        mode: "cors",
        body: JSON.stringify({ action, payload, token: SECURE_TOKEN })
      });

      if (!response.ok) throw new Error("Write failed with code " + response.status);

      const resJson = await response.json();
      if (resJson.success) {
        if (resJson.data) {
          this.db = resJson.data;
          this.saveLocalDb();
          this.notifySyncListeners();
        }
        return resJson.result;
      } else {
        throw new Error(resJson.error || "Action failed on server");
      }
    } catch (error) {
      console.warn("Direct write failed. Queueing action for background sync:", action);
      
      // Save locally to local DB so user sees instant local update! (Conflict-safe)
      await this.executeMockAction(action, payload);
      
      // Push to background sync queue
      this.syncQueue.push({ action, payload, id: Date.now() });
      this.saveSyncQueue();
      
      // Trigger status bar update
      if (window.updateSyncUI) window.updateSyncUI();
      
      return { success: true, queued: true };
    }
  }

  /**
   * Flushes pending actions queue sequentially to Sheets API
   */
  async flushSyncQueue() {
    if (this.isMockMode || this.syncQueue.length === 0 || this.isSyncing) return;
    
    // Check if browser has internet
    if (!navigator.onLine) return;

    this.isSyncing = true;
    console.log(`Auto Sync: Flushing ${this.syncQueue.length} pending actions to Sheets...`);

    const queueCopy = [...this.syncQueue];
    
    for (const item of queueCopy) {
      try {
        const url = this.settings.webAppUrl + (this.settings.webAppUrl.includes("?") ? "&" : "?") + "token=" + SECURE_TOKEN;
        const response = await fetch(url, {
          method: "POST",
          mode: "cors",
          body: JSON.stringify({ action: item.action, payload: item.payload, token: SECURE_TOKEN })
        });
        
        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success) {
            // Remove from local queue
            this.syncQueue = this.syncQueue.filter(q => q.id !== item.id);
            this.saveSyncQueue();
            
            if (resJson.data) {
              this.db = resJson.data;
              this.saveLocalDb();
            }
          }
        }
      } catch (e) {
        console.error("Auto Sync: Failed to sync action, retrying in next round.", e);
        break; // Stop and retry later if network failed again
      }
    }
    
    this.isSyncing = false;
    this.notifySyncListeners();
    if (window.updateSyncUI) window.updateSyncUI();
  }

  // --- Target Actions ---

  async saveCustomer(customer) {
    return this.postAction("saveCustomer", customer);
  }

  async saveOrder(order, rooms, materials) {
    return this.postAction("saveOrder", { order, rooms, materials });
  }

  async saveInventoryItem(item) {
    return this.postAction("saveInventoryItem", item);
  }

  async savePayment(payment) {
    return this.postAction("savePayment", payment);
  }

  async saveExpense(expense) {
    return this.postAction("saveExpense", expense);
  }

  async saveTechnician(technician) {
    return this.postAction("saveTechnician", technician);
  }

  async saveStockMovement(movement) {
    return this.postAction("saveStockMovement", movement);
  }

  async updateSettings(settingsList) {
    return this.postAction("updateSettings", settingsList);
  }

  async clearDatabase(confirmationPhrase) {
    return this.postAction("clearDatabase", { confirmationPhrase });
  }

  // --- Mock Execution for offline/caching ---

  executeMockAction(action, payload) {
    return new Promise((resolve, reject) => {
      try {
        switch(action) {
          case "saveCustomer":
            this.mockSaveCustomer(payload);
            break;
          case "saveOrder":
            this.mockSaveOrder(payload);
            break;
          case "saveInventoryItem":
            this.mockSaveInventoryItem(payload);
            break;
          case "savePayment":
            this.mockSavePayment(payload);
            break;
          case "saveExpense":
            this.mockSaveExpense(payload);
            break;
          case "saveTechnician":
            this.mockSaveTechnician(payload);
            break;
          case "saveStockMovement":
            this.mockSaveStockMovement(payload);
            break;
          case "updateSettings":
            this.mockUpdateSettings(payload);
            break;
          case "clearDatabase":
            this.mockClearDatabase(payload);
            break;
          default:
            throw new Error("Unknown local action: " + action);
        }
        this.saveLocalDb();
        this.notifySyncListeners();
        resolve({ success: true, mock: true });
      } catch (e) {
        reject(e);
      }
    });
  }

  mockSaveCustomer(customer) {
    const id = customer["Customer ID"];
    const idx = this.db.Customers.findIndex(c => c["Customer ID"] === id);
    if (idx !== -1) {
      this.db.Customers[idx] = customer;
    } else {
      customer["Created Date"] = customer["Created Date"] || new Date().toISOString().split('T')[0];
      this.db.Customers.push(customer);
    }
  }

  mockSaveOrder({ order, rooms, materials }) {
    const orderId = order["Order ID"];
    const custId = order["Customer ID"];
    
    // 1. Remove old materials and restore inventory quantities
    const oldMats = this.db.OrderMaterials.filter(m => m["Order ID"] === orderId);
    oldMats.forEach(om => {
      const pIndex = this.db.InventoryItems.findIndex(p => p["Item ID"] === om["Item ID"]);
      if (pIndex !== -1) {
        const cur = parseFloat(this.db.InventoryItems[pIndex]["Quantity Available"]) || 0;
        this.db.InventoryItems[pIndex]["Quantity Available"] = cur + (parseFloat(om["Quantity Used"]) || 0);
      }
    });
    this.db.OrderMaterials = this.db.OrderMaterials.filter(m => m["Order ID"] !== orderId);
    
    // 2. Remove old rooms
    this.db.Rooms = this.db.Rooms.filter(r => r["Order ID"] !== orderId);

    // 3. Save / Update Order row
    const oIndex = this.db.Orders.findIndex(o => o["Order ID"] === orderId);
    order["Total Cost"] = parseFloat(order["Total Cost"]) || 0;
    order["Paid Amount"] = parseFloat(order["Paid Amount"]) || 0;
    order["Remaining Amount"] = parseFloat(order["Remaining Amount"]) || 0;
    
    if (oIndex !== -1) {
      this.db.Orders[oIndex] = order;
    } else {
      this.db.Orders.push(order);
    }

    // 4. Save Rooms
    rooms.forEach(r => {
      r["Room ID"] = r["Room ID"] || "ROOM-" + Math.floor(10000 + Math.random() * 90000);
      r["Order ID"] = orderId;
      r["Customer ID"] = custId;
      this.db.Rooms.push(r);
    });

    // 5. Save Materials, deduct quantities, and log movement only if NOT a quotation
    const isQuotation = (order["Order Status"] === "Quotation");

    materials.forEach(m => {
      m["Material ID"] = m["Material ID"] || "MAT-" + Math.floor(10000 + Math.random() * 90000);
      m["Order ID"] = orderId;
      this.db.OrderMaterials.push(m);

      if (!isQuotation) {
        const pIndex = this.db.InventoryItems.findIndex(p => p["Item ID"] === m["Item ID"]);
        if (pIndex !== -1) {
          const currentQty = parseFloat(this.db.InventoryItems[pIndex]["Quantity Available"]) || 0;
          const usedQty = parseFloat(m["Quantity Used"]) || 0;
          this.db.InventoryItems[pIndex]["Quantity Available"] = Math.max(0, currentQty - usedQty);

          // Add movement log
          this.db.StockMovements.push({
            "Movement ID": "MOV-" + Math.floor(100000 + Math.random() * 900000),
            "Item ID": m["Item ID"],
            "Date": order["Order Date"] || new Date().toISOString().split('T')[0],
            "Quantity": usedQty,
            "Type": "Outgoing",
            "Reason": "صادر لطلب رقم " + orderId,
            "User": "النظام"
          });
        }
      }
    });
  }

  mockSaveInventoryItem(item) {
    const id = item["Item ID"];
    item["Purchase Price"] = parseFloat(item["Purchase Price"]) || 0;
    item["Selling Price"] = parseFloat(item["Selling Price"]) || 0;
    item["Quantity Available"] = parseFloat(item["Quantity Available"]) || 0;
    item["Minimum Quantity Alert"] = parseFloat(item["Minimum Quantity Alert"]) || 0;

    const idx = this.db.InventoryItems.findIndex(i => i["Item ID"] === id);
    if (idx !== -1) {
      this.db.InventoryItems[idx] = item;
    } else {
      this.db.InventoryItems.push(item);
    }
  }

  mockSavePayment(payment) {
    const id = payment["Payment ID"] || "PAY-" + Math.floor(100000 + Math.random() * 900000);
    payment["Payment ID"] = id;
    payment["Amount"] = parseFloat(payment["Amount"]) || 0;
    payment["Date"] = payment["Date"] || new Date().toISOString().split('T')[0];
    
    this.db.Payments.push(payment);

    // Update order amounts
    const orderId = payment["Order ID"];
    const oIdx = this.db.Orders.findIndex(o => o["Order ID"] === orderId);
    if (oIdx !== -1) {
      const curPaid = parseFloat(this.db.Orders[oIdx]["Paid Amount"]) || 0;
      const total = parseFloat(this.db.Orders[oIdx]["Total Cost"]) || 0;
      const newPaid = curPaid + payment["Amount"];
      this.db.Orders[oIdx]["Paid Amount"] = newPaid;
      this.db.Orders[oIdx]["Remaining Amount"] = Math.max(0, total - newPaid);
    }
  }

  mockSaveExpense(expense) {
    expense["Expense ID"] = expense["Expense ID"] || "EXP-" + Math.floor(100000 + Math.random() * 900000);
    expense["Amount"] = parseFloat(expense["Amount"]) || 0;
    expense["Date"] = expense["Date"] || new Date().toISOString().split('T')[0];
    this.db.Expenses.unshift(expense);
  }

  mockSaveTechnician(technician) {
    const name = technician["Technician Name"];
    const idx = this.db.Technicians.findIndex(t => t["Technician Name"] === name);
    if (idx !== -1) {
      this.db.Technicians[idx] = technician;
    } else {
      this.db.Technicians.push(technician);
    }
  }

  mockSaveStockMovement(movement) {
    movement["Movement ID"] = movement["Movement ID"] || "MOV-" + Math.floor(100000 + Math.random() * 900000);
    movement["Date"] = movement["Date"] || new Date().toISOString().split('T')[0];
    movement["Quantity"] = parseFloat(movement["Quantity"]) || 0;
    this.db.StockMovements.unshift(movement);

    // Adjust product inventory qty
    const itemId = movement["Item ID"];
    const qty = movement["Quantity"];
    const type = movement["Type"];
    
    const pIdx = this.db.InventoryItems.findIndex(p => p["Item ID"] === itemId);
    if (pIdx !== -1) {
      const cur = parseFloat(this.db.InventoryItems[pIdx]["Quantity Available"]) || 0;
      if (type === "Incoming") {
        this.db.InventoryItems[pIdx]["Quantity Available"] = cur + qty;
      } else if (type === "Outgoing") {
        this.db.InventoryItems[pIdx]["Quantity Available"] = Math.max(0, cur - qty);
      } else {
        this.db.InventoryItems[pIdx]["Quantity Available"] = Math.max(0, cur + qty);
      }
    }
  }

  mockUpdateSettings(settingsList) {
    settingsList.forEach(s => {
      const idx = this.db.Settings.findIndex(sett => sett.Key === s.Key);
      if (idx !== -1) {
        this.db.Settings[idx].Value = s.Value;
      } else {
        this.db.Settings.push({ Key: s.Key, Value: s.Value });
      }

      if (s.Key === "Business Name") this.settings.businessName = s.Value;
      if (s.Key === "Address") this.settings.address = s.Value;
      if (s.Key === "Phone Number") this.settings.phone = s.Value;
      if (s.Key === "Currency") this.settings.currency = s.Value;
      if (s.Key === "Admin Email") this.settings.adminEmail = s.Value;
      if (s.Key === "Admin Password") this.settings.adminPassword = s.Value;
    });
    localStorage.setItem(API_CONFIG_KEY, JSON.stringify(this.settings));
  }

  mockClearDatabase({ confirmationPhrase }) {
    if (confirmationPhrase !== "مسح البيانات") throw new Error("عبارة التأكيد غير صحيحة");
    
    this.db.Customers = [];
    this.db.Orders = [];
    this.db.Rooms = [];
    this.db.OrderMaterials = [];
    this.db.Payments = [];
    this.db.Expenses = [];
    this.db.Technicians = [];
    this.db.StockMovements = [];
    this.db.Settings = [
      { Key: "Business Name", Value: "الماسة للستائر والديكور" },
      { Key: "Address", Value: "القاهرة، مصر" },
      { Key: "Phone Number", Value: "+201018907086" },
      { Key: "Currency", Value: "EGP" },
      { Key: "Admin Email", Value: "elmasa_admin_secure@elmasa.com" },
      { Key: "Admin Password", Value: "ElmasaAdminSecure2026!#" }
    ];
    this.settings = defaultSettings;
    localStorage.setItem(API_CONFIG_KEY, JSON.stringify(defaultSettings));
  }
}

const api = new ApiService();
window.api = api;
