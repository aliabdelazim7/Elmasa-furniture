/**
 * Curtain Workshop CRM & Inventory Management System
 * Backend Google Apps Script (Primary Database API Layer)
 * 
 * Paste this script into Extensions -> Apps Script inside your Google Sheet.
 * Deploy as a Web App: Execute as "Me", Access: "Anyone".
 */

// Define database schema and table headers
const SECURE_TOKEN = "ELMASA_API_SECURE_TOKEN_2026_xYz987!";

const SHEETS_SCHEMA = {
  "Customers": [
    "Customer ID", "Full Name", "Phone Number", "Secondary Phone", "Address", "Notes", "Created Date"
  ],
  "Orders": [
    "Order ID", "Customer ID", "Order Date", "Delivery Date", "Installation Date", 
    "Assigned Technician", "Order Status", "Total Cost", "Paid Amount", "Remaining Amount", "Notes"
  ],
  "Rooms": [
    "Room ID", "Order ID", "Customer ID", "Room Name", "Width", "Height", "Curtain Type", "Fabric Type", "Color", "Quantity",
    "Fold Multiplier", "Sheer Checked", "Blackout Checked", "Installation Type", "Pull Direction", "Side Extension"
  ],
  "InventoryItems": [
    "Item ID", "Item Name", "Item Category", "Unit", "Purchase Price", "Selling Price", "Quantity Available", "Minimum Quantity Alert", "Supplier", "Barcode"
  ],
  "OrderMaterials": [
    "Material ID", "Order ID", "Item ID", "Quantity Used", "Unit Price", "Total Price"
  ],
  "Payments": [
    "Payment ID", "Order ID", "Amount", "Payment Method", "Date"
  ],
  "Expenses": [
    "Expense ID", "Expense Name", "Category", "Amount", "Date"
  ],
  "Technicians": [
    "Technician Name", "Phone Number", "Notes"
  ],
  "StockMovements": [
    "Movement ID", "Item ID", "Date", "Quantity", "Type", "Reason", "User"
  ],
  "Settings": [
    "Key", "Value"
  ]
};

// Auto-initialize sheets on first run
function initializeDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  for (const sheetName in SHEETS_SCHEMA) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      const headers = SHEETS_SCHEMA[sheetName];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f4f6");
      sheet.setFrozenRows(1);
    }
  }
  
  // Set default settings if empty
  const settingsSheet = ss.getSheetByName("Settings");
  if (settingsSheet.getLastRow() <= 1) {
    const defaultSettings = [
      ["Business Name", "الماسة للستائر والديكور"],
      ["Address", "الدقهليه - المنصوره - مركز تمي الامديد - ظفر"],
      ["Phone Number", "+20 10 07036248"],
      ["Currency", "EGP"],
      ["Admin Email", "elmasa_admin_secure@elmasa.com"],
      ["Admin Password", "ElmasaAdminSecure2026!#"],
      ["Initialized", "true"]
    ];
    settingsSheet.getRange(2, 1, defaultSettings.length, 2).setValues(defaultSettings);
  }
}

// GET request handler: Returns all database tables as JSON
function doGet(e) {
  const token = e.parameter && e.parameter.token;
  if (token !== SECURE_TOKEN) {
    return createJsonResponse({ success: false, error: "Unauthorized access: Invalid or missing token" });
  }
  initializeDatabase();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // 30 seconds wait
    const dbData = readAllTables();
    return createJsonResponse({ success: true, data: dbData });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// POST request handler: Performs database writes and batch operations
function doPost(e) {
  if (!e.postData || !e.postData.contents) {
    return createJsonResponse({ success: false, error: "Empty request body" });
  }
  
  let request;
  try {
    request = JSON.parse(e.postData.contents);
  } catch (err) {
    return createJsonResponse({ success: false, error: "Malformed JSON" });
  }

  const token = (e.parameter && e.parameter.token) || (request && request.token);
  if (token !== SECURE_TOKEN) {
    return createJsonResponse({ success: false, error: "Unauthorized access: Invalid or missing token" });
  }

  initializeDatabase();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    const action = request.action;
    const payload = request.payload;
    
    if (!action) {
      return createJsonResponse({ success: false, error: "Action is required" });
    }
    
    let result;
    switch(action) {
      case "saveCustomer":
        result = handleSaveCustomer(payload);
        break;
      case "saveOrder":
        result = handleSaveOrder(payload);
        break;
      case "saveInventoryItem":
        result = handleSaveInventoryItem(payload);
        break;
      case "savePayment":
        result = handleSavePayment(payload);
        break;
      case "deletePayment":
        result = handleDeletePayment(payload);
        break;
      case "deleteOrder":
        result = handleDeleteOrder(payload);
        break;
      case "saveExpense":
        result = handleSaveExpense(payload);
        break;
      case "saveTechnician":
        result = handleSaveTechnician(payload);
        break;
      case "saveStockMovement":
        result = handleSaveStockMovement(payload);
        break;
      case "updateSettings":
        result = handleUpdateSettings(payload);
        break;
      case "clearDatabase":
        result = handleClearDatabase(payload);
        break;
      default:
        throw new Error("Unknown action: " + action);
    }
    
    const freshData = readAllTables();
    return createJsonResponse({ success: true, result: result, data: freshData });
    
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// Creates CORS-compliant JSON response
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Reads all sheets and converts them to JSON arrays
function readAllTables() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const result = {};
  
  for (const sheetName in SHEETS_SCHEMA) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      result[sheetName] = [];
      continue;
    }
    
    const headers = SHEETS_SCHEMA[sheetName];
    const dataRange = sheet.getRange(2, 1, lastRow - 1, headers.length);
    const values = dataRange.getValues();
    
    result[sheetName] = values.map(row => {
      const rowObj = {};
      headers.forEach((header, index) => {
        let val = row[index];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, tz, "yyyy-MM-dd");
        }
        rowObj[header] = val;
      });
      return rowObj;
    });
  }
  
  return result;
}

// Helper to convert sheet objects back into array format mapped to columns
function mapObjectToRow(obj, headers) {
  return headers.map(header => {
    const val = obj[header];
    return val === undefined || val === null ? "" : val;
  });
}

// Save or Update Customer
function handleSaveCustomer(customer) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Customers");
  const headers = SHEETS_SCHEMA["Customers"];
  const customerId = customer["Customer ID"];
  
  if (!customerId) throw new Error("Customer ID is required");
  
  const lastRow = sheet.getLastRow();
  let foundRow = -1;
  
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === customerId) {
        foundRow = i + 2;
        break;
      }
    }
  }
  
  const rowData = mapObjectToRow(customer, headers);
  
  if (foundRow !== -1) {
    sheet.getRange(foundRow, 1, 1, headers.length).setValues([rowData]);
    return { action: "update", customerId };
  } else {
    customer["Created Date"] = customer["Created Date"] || new Date().toISOString().split('T')[0];
    const newRowData = mapObjectToRow(customer, headers);
    sheet.appendRow(newRowData);
    return { action: "create", customerId };
  }
}

// Save or Update Order (including associated rooms and materials)
function handleSaveOrder(orderPayload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet = ss.getSheetByName("Orders");
  const roomSheet = ss.getSheetByName("Rooms");
  const matSheet = ss.getSheetByName("OrderMaterials");
  const prodSheet = ss.getSheetByName("InventoryItems");
  const moveSheet = ss.getSheetByName("StockMovements");
  
  const order = orderPayload.order;
  const rooms = orderPayload.rooms || [];
  const materials = orderPayload.materials || [];
  const orderId = order["Order ID"];
  const customerId = order["Customer ID"];
  
  if (!orderId) throw new Error("Order ID is required");
  
  // 1. Save or Update Order row
  const orderHeaders = SHEETS_SCHEMA["Orders"];
  const lastOrderRow = orderSheet.getLastRow();
  let orderFoundRow = -1;
  
  if (lastOrderRow > 1) {
    const ids = orderSheet.getRange(2, 1, lastOrderRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === orderId) {
        orderFoundRow = i + 2;
        break;
      }
    }
  }
  
  // Check if we need to adjust stock due to material edits (if updating)
  if (orderFoundRow !== -1) {
    // RESTORE stock
    const oldMatsLastRow = matSheet.getLastRow();
    if (oldMatsLastRow > 1) {
      const oldMatsRange = matSheet.getRange(2, 1, oldMatsLastRow - 1, SHEETS_SCHEMA["OrderMaterials"].length);
      const oldMatsValues = oldMatsRange.getValues();
      
      const prodHeaders = SHEETS_SCHEMA["InventoryItems"];
      const prodLastRow = prodSheet.getLastRow();
      const prodValues = prodLastRow > 1 ? prodSheet.getRange(2, 1, prodLastRow - 1, prodHeaders.length).getValues() : [];
      const prodIdCol = prodHeaders.indexOf("Item ID");
      const prodQtyCol = prodHeaders.indexOf("Quantity Available");
      
      for (let i = oldMatsValues.length - 1; i >= 0; i--) {
        const row = oldMatsValues[i];
        const rowOrderId = row[1]; // Order ID index
        const rowItemId = row[2];  // Item ID index
        const rowQtyUsed = parseFloat(row[3]) || 0;
        
        if (rowOrderId === orderId) {
          // Find item and add qty back
          for (let j = 0; j < prodValues.length; j++) {
            if (prodValues[j][prodIdCol] === rowItemId) {
              const currentQty = parseFloat(prodValues[j][prodQtyCol]) || 0;
              prodSheet.getRange(j + 2, prodQtyCol + 1).setValue(currentQty + rowQtyUsed);
              prodValues[j][prodQtyCol] = currentQty + rowQtyUsed; // update local ref
              break;
            }
          }
        }
      }
      
      // Delete old materials rows from sheet
      for (let i = oldMatsValues.length - 1; i >= 0; i--) {
        if (oldMatsValues[i][1] === orderId) {
          matSheet.deleteRow(i + 2);
        }
      }
    }
    
    // Also delete old rooms rows associated with this order
    const oldRoomsLastRow = roomSheet.getLastRow();
    if (oldRoomsLastRow > 1) {
      const oldRoomsValues = roomSheet.getRange(2, 1, oldRoomsLastRow - 1, SHEETS_SCHEMA["Rooms"].length).getValues();
      for (let i = oldRoomsValues.length - 1; i >= 0; i--) {
        if (oldRoomsValues[i][1] === orderId) {
          roomSheet.deleteRow(i + 2);
        }
      }
    }
    
    // Update order row
    const rowData = mapObjectToRow(order, orderHeaders);
    orderSheet.getRange(orderFoundRow, 1, 1, orderHeaders.length).setValues([rowData]);
  } else {
    // Create new order row
    const rowData = mapObjectToRow(order, orderHeaders);
    orderSheet.appendRow(rowData);
  }
  
  // 2. Append new Rooms
  const roomHeaders = SHEETS_SCHEMA["Rooms"];
  rooms.forEach(room => {
    room["Room ID"] = room["Room ID"] || "ROOM-" + Math.floor(100000 + Math.random() * 900000);
    room["Order ID"] = orderId;
    room["Customer ID"] = customerId;
    const roomRow = mapObjectToRow(room, roomHeaders);
    roomSheet.appendRow(roomRow);
  });
  
  // 3. Append new Materials, deduct stock, and log stock movements
  const matHeaders = SHEETS_SCHEMA["OrderMaterials"];
  const moveHeaders = SHEETS_SCHEMA["StockMovements"];
  const prodHeaders = SHEETS_SCHEMA["InventoryItems"];
  
  // Fetch fresh stock values
  const prodLastRow = prodSheet.getLastRow();
  const prodValues = prodLastRow > 1 ? prodSheet.getRange(2, 1, prodLastRow - 1, prodHeaders.length).getValues() : [];
  const prodIdCol = prodHeaders.indexOf("Item ID");
  const prodQtyCol = prodHeaders.indexOf("Quantity Available");
  
  const isQuotation = (order["Order Status"] === "Quotation");

  materials.forEach(material => {
    material["Material ID"] = material["Material ID"] || "MAT-" + Math.floor(100000 + Math.random() * 900000);
    material["Order ID"] = orderId;
    const matRow = mapObjectToRow(material, matHeaders);
    matSheet.appendRow(matRow);
    
    // Deduct stock only if NOT a quotation
    if (!isQuotation) {
      const itemId = material["Item ID"];
      const qtyUsed = parseFloat(material["Quantity Used"]) || 0;
      
      for (let i = 0; i < prodValues.length; i++) {
        if (prodValues[i][prodIdCol] === itemId) {
          const currentQty = parseFloat(prodValues[i][prodQtyCol]) || 0;
          const newQty = Math.max(0, currentQty - qtyUsed);
          
          prodSheet.getRange(i + 2, prodQtyCol + 1).setValue(newQty);
          prodValues[i][prodQtyCol] = newQty; // update local ref
          
          // Log Stock Movement
          const movement = {
            "Movement ID": "MOV-" + Math.floor(100000 + Math.random() * 900000),
            "Item ID": itemId,
            "Date": order["Order Date"] || new Date().toISOString().split('T')[0],
            "Quantity": qtyUsed,
            "Type": "Outgoing",
            "Reason": "صادر لطلب رقم " + orderId,
            "User": "النظام"
          };
          const moveRow = mapObjectToRow(movement, moveHeaders);
          moveSheet.appendRow(moveRow);
          break;
        }
      }
    }
  });
  
  return { orderId };
}

// Save or Update Inventory Item
function handleSaveInventoryItem(item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("InventoryItems");
  const headers = SHEETS_SCHEMA["InventoryItems"];
  const itemId = item["Item ID"];
  
  if (!itemId) throw new Error("Item ID is required");
  
  const lastRow = sheet.getLastRow();
  let foundRow = -1;
  
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === itemId) {
        foundRow = i + 2;
        break;
      }
    }
  }
  
  const rowData = mapObjectToRow(item, headers);
  
  if (foundRow !== -1) {
    sheet.getRange(foundRow, 1, 1, headers.length).setValues([rowData]);
    return { action: "update", itemId };
  } else {
    sheet.appendRow(rowData);
    return { action: "create", itemId };
  }
}

// Save Payment and update Order balances
function handleSavePayment(payment) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const paySheet = ss.getSheetByName("Payments");
  const orderSheet = ss.getSheetByName("Orders");
  
  const paymentId = payment["Payment ID"] || "PAY-" + Math.floor(100000 + Math.random() * 900000);
  payment["Payment ID"] = paymentId;
  payment["Date"] = payment["Date"] || new Date().toISOString().split('T')[0];
  
  const amount = parseFloat(payment["Amount"]) || 0;
  if (amount <= 0) throw new Error("قيمة دفعة السداد يجب أن تكون أكبر من الصفر");
  payment["Amount"] = amount;
  
  // Save Payment row
  const payHeaders = SHEETS_SCHEMA["Payments"];
  const payRow = mapObjectToRow(payment, payHeaders);
  paySheet.appendRow(payRow);
  
  // Update Order Paid & Remaining Amounts
  const orderId = payment["Order ID"];
  const orderHeaders = SHEETS_SCHEMA["Orders"];
  const orderLastRow = orderSheet.getLastRow();
  
  if (orderLastRow > 1) {
    const orderValues = orderSheet.getRange(2, 1, orderLastRow - 1, orderHeaders.length).getValues();
    const orderIdCol = orderHeaders.indexOf("Order ID");
    const paidCol = orderHeaders.indexOf("Paid Amount");
    const remCol = orderHeaders.indexOf("Remaining Amount");
    const totalCol = orderHeaders.indexOf("Total Cost");
    
    for (let i = 0; i < orderValues.length; i++) {
      if (orderValues[i][orderIdCol] === orderId) {
        const orderRowIndex = i + 2;
        const currentPaid = parseFloat(orderValues[i][paidCol]) || 0;
        const totalCost = parseFloat(orderValues[i][totalCol]) || 0;
        const newPaid = currentPaid + amount;
        const newRem = Math.max(0, totalCost - newPaid);
        
        orderSheet.getRange(orderRowIndex, paidCol + 1).setValue(newPaid);
        orderSheet.getRange(orderRowIndex, remCol + 1).setValue(newRem);
        break;
      }
    }
  }
  
  return { paymentId };
}

// Save Expense
function handleSaveExpense(expense) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Expenses");
  const headers = SHEETS_SCHEMA["Expenses"];
  
  expense["Expense ID"] = expense["Expense ID"] || "EXP-" + Math.floor(100000 + Math.random() * 900000);
  expense["Date"] = expense["Date"] || new Date().toISOString().split('T')[0];
  
  const amount = parseFloat(expense["Amount"]) || 0;
  if (amount <= 0) throw new Error("قيمة المصروف يجب أن تكون أكبر من الصفر");
  expense["Amount"] = amount;
  
  const rowData = mapObjectToRow(expense, headers);
  sheet.appendRow(rowData);
  return { expenseId: expense["Expense ID"] };
}

// Save Technician
function handleSaveTechnician(technician) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Technicians");
  const headers = SHEETS_SCHEMA["Technicians"];
  const techName = technician["Technician Name"];
  
  if (!techName) throw new Error("Technician Name is required");
  
  const lastRow = sheet.getLastRow();
  let foundRow = -1;
  
  if (lastRow > 1) {
    const names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < names.length; i++) {
      if (names[i][0] === techName) {
        foundRow = i + 2;
        break;
      }
    }
  }
  
  const rowData = mapObjectToRow(technician, headers);
  
  if (foundRow !== -1) {
    sheet.getRange(foundRow, 1, 1, headers.length).setValues([rowData]);
    return { action: "update", technicianName: techName };
  } else {
    sheet.appendRow(rowData);
    return { action: "create", technicianName: techName };
  }
}

// Save Manual Stock Movement and update inventory item
function handleSaveStockMovement(movement) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const moveSheet = ss.getSheetByName("StockMovements");
  const prodSheet = ss.getSheetByName("InventoryItems");
  
  movement["Movement ID"] = movement["Movement ID"] || "MOV-" + Math.floor(100000 + Math.random() * 900000);
  movement["Date"] = movement["Date"] || new Date().toISOString().split('T')[0];
  movement["Quantity"] = parseFloat(movement["Quantity"]) || 0;
  
  // Save Movement Row
  const moveHeaders = SHEETS_SCHEMA["StockMovements"];
  const moveRow = mapObjectToRow(movement, moveHeaders);
  moveSheet.appendRow(moveRow);
  
  // Adjust stock
  const itemId = movement["Item ID"];
  const qtyDiff = movement["Quantity"];
  const type = movement["Type"];
  
  const prodHeaders = SHEETS_SCHEMA["InventoryItems"];
  const prodLastRow = prodSheet.getLastRow();
  
  if (prodLastRow > 1) {
    const prodValues = prodSheet.getRange(2, 1, prodLastRow - 1, prodHeaders.length).getValues();
    const itemIdCol = prodHeaders.indexOf("Item ID");
    const qtyCol = prodHeaders.indexOf("Quantity Available");
    
    for (let i = 0; i < prodValues.length; i++) {
      if (prodValues[i][itemIdCol] === itemId) {
        const currentQty = parseFloat(prodValues[i][qtyCol]) || 0;
        let newQty = currentQty;
        
        if (type === "Incoming") {
          newQty = currentQty + qtyDiff;
        } else if (type === "Outgoing") {
          newQty = Math.max(0, currentQty - qtyDiff);
        } else {
          newQty = Math.max(0, currentQty + qtyDiff);
        }
        
        prodSheet.getRange(i + 2, qtyCol + 1).setValue(newQty);
        break;
      }
    }
  }
  
  return { movementId: movement["Movement ID"] };
}

// Update multiple settings rows
function handleUpdateSettings(settingsList) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Settings");
  
  settingsList.forEach(setting => {
    const key = setting.Key;
    const val = setting.Value;
    
    const lastRow = sheet.getLastRow();
    let foundRow = -1;
    
    if (lastRow > 1) {
      const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < keys.length; i++) {
        if (keys[i][0] === key) {
          foundRow = i + 2;
          break;
        }
      }
    }
    
    if (foundRow !== -1) {
      sheet.getRange(foundRow, 2).setValue(val);
    } else {
      sheet.appendRow([key, val]);
    }
  });
  
  return { updated: settingsList.length };
}

// Delete Payment and update Order balances
function handleDeletePayment(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const paySheet = ss.getSheetByName("Payments");
  const orderSheet = ss.getSheetByName("Orders");
  const paymentId = payload.paymentId;
  
  if (!paymentId) throw new Error("Payment ID is required");
  
  const lastRow = paySheet.getLastRow();
  let foundRow = -1;
  let orderId = "";
  let amount = 0;
  
  if (lastRow > 1) {
    const payValues = paySheet.getRange(2, 1, lastRow - 1, SHEETS_SCHEMA["Payments"].length).getValues();
    for (let i = 0; i < payValues.length; i++) {
      if (payValues[i][0] === paymentId) {
        foundRow = i + 2;
        orderId = payValues[i][1];
        amount = parseFloat(payValues[i][2]) || 0;
        break;
      }
    }
  }
  
  if (foundRow === -1) throw new Error("Payment record not found");
  
  // Delete the row
  paySheet.deleteRow(foundRow);
  
  // Recalculate order paid amount
  if (orderId) {
    const orderHeaders = SHEETS_SCHEMA["Orders"];
    const orderLastRow = orderSheet.getLastRow();
    if (orderLastRow > 1) {
      const orderValues = orderSheet.getRange(2, 1, orderLastRow - 1, orderHeaders.length).getValues();
      const orderIdCol = orderHeaders.indexOf("Order ID");
      const paidCol = orderHeaders.indexOf("Paid Amount");
      const remCol = orderHeaders.indexOf("Remaining Amount");
      const totalCol = orderHeaders.indexOf("Total Cost");
      
      for (let i = 0; i < orderValues.length; i++) {
        if (orderValues[i][orderIdCol] === orderId) {
          const orderRowIndex = i + 2;
          const currentPaid = parseFloat(orderValues[i][paidCol]) || 0;
          const totalCost = parseFloat(orderValues[i][totalCol]) || 0;
          const newPaid = Math.max(0, currentPaid - amount);
          const newRem = Math.max(0, totalCost - newPaid);
          
          orderSheet.getRange(orderRowIndex, paidCol + 1).setValue(newPaid);
          orderSheet.getRange(orderRowIndex, remCol + 1).setValue(newRem);
          break;
        }
      }
    }
  }
  
  return { success: true, paymentId };
}

// Delete Order and perform cascade deletions + stock restoration
function handleDeleteOrder(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet = ss.getSheetByName("Orders");
  const roomSheet = ss.getSheetByName("Rooms");
  const matSheet = ss.getSheetByName("OrderMaterials");
  const prodSheet = ss.getSheetByName("InventoryItems");
  
  const orderId = payload.orderId;
  if (!orderId) throw new Error("Order ID is required");
  
  // 1. Locate the Order
  const orderHeaders = SHEETS_SCHEMA["Orders"];
  const lastOrderRow = orderSheet.getLastRow();
  let foundRow = -1;
  let orderStatus = "";
  
  if (lastOrderRow > 1) {
    const orderValues = orderSheet.getRange(2, 1, lastOrderRow - 1, orderHeaders.length).getValues();
    const orderIdCol = orderHeaders.indexOf("Order ID");
    const statusCol = orderHeaders.indexOf("Order Status");
    for (let i = 0; i < orderValues.length; i++) {
      if (orderValues[i][orderIdCol] === orderId) {
        foundRow = i + 2;
        orderStatus = orderValues[i][statusCol];
        break;
      }
    }
  }
  
  if (foundRow === -1) throw new Error("Order record not found");
  
  // 2. If it is NOT a quotation, restore stock
  if (orderStatus !== "Quotation") {
    const matsLastRow = matSheet.getLastRow();
    if (matsLastRow > 1) {
      const matsValues = matSheet.getRange(2, 1, matsLastRow - 1, SHEETS_SCHEMA["OrderMaterials"].length).getValues();
      const prodHeaders = SHEETS_SCHEMA["InventoryItems"];
      const prodLastRow = prodSheet.getLastRow();
      const prodValues = prodLastRow > 1 ? prodSheet.getRange(2, 1, prodLastRow - 1, prodHeaders.length).getValues() : [];
      const prodIdCol = prodHeaders.indexOf("Item ID");
      const prodQtyCol = prodHeaders.indexOf("Quantity Available");
      
      for (let i = 0; i < matsValues.length; i++) {
        const rowOrderId = matsValues[i][1];
        const itemId = matsValues[i][2];
        const qtyUsed = parseFloat(matsValues[i][3]) || 0;
        
        if (rowOrderId === orderId) {
          // Find item and add qty back
          for (let j = 0; j < prodValues.length; j++) {
            if (prodValues[j][prodIdCol] === itemId) {
              const currentQty = parseFloat(prodValues[j][prodQtyCol]) || 0;
              prodSheet.getRange(j + 2, prodQtyCol + 1).setValue(currentQty + qtyUsed);
              prodValues[j][prodQtyCol] = currentQty + qtyUsed;
              break;
            }
          }
        }
      }
    }
  }
  
  // 3. Delete associated materials rows
  const matsLastRow = matSheet.getLastRow();
  if (matsLastRow > 1) {
    const matsValues = matSheet.getRange(2, 1, matsLastRow - 1, SHEETS_SCHEMA["OrderMaterials"].length).getValues();
    for (let i = matsValues.length - 1; i >= 0; i--) {
      if (matsValues[i][1] === orderId) {
        matSheet.deleteRow(i + 2);
      }
    }
  }
  
  // 4. Delete associated rooms rows
  const roomsLastRow = roomSheet.getLastRow();
  if (roomsLastRow > 1) {
    const roomsValues = roomSheet.getRange(2, 1, roomsLastRow - 1, SHEETS_SCHEMA["Rooms"].length).getValues();
    for (let i = roomsValues.length - 1; i >= 0; i--) {
      if (roomsValues[i][1] === orderId) {
        roomSheet.deleteRow(i + 2);
      }
    }
  }
  
  // 5. Delete associated payments rows
  const paySheet = ss.getSheetByName("Payments");
  const payLastRow = paySheet.getLastRow();
  if (payLastRow > 1) {
    const payValues = paySheet.getRange(2, 1, payLastRow - 1, SHEETS_SCHEMA["Payments"].length).getValues();
    for (let i = payValues.length - 1; i >= 0; i--) {
      if (payValues[i][1] === orderId) {
        paySheet.deleteRow(i + 2);
      }
    }
  }
  
  // 6. Finally, delete the Order row
  orderSheet.deleteRow(foundRow);
  
  return { success: true, orderId };
}

// Danger Zone: Clear database tables with security confirmation
function handleClearDatabase(payload) {
  if (payload.confirmationPhrase !== "مسح البيانات") {
    throw new Error("رقم أو عبارة التأكيد غير صحيحة");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  for (const sheetName in SHEETS_SCHEMA) {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
    }
  }
  
  // Re-run settings reset
  const settingsSheet = ss.getSheetByName("Settings");
  const defaultSettings = [
    ["Business Name", "الماسة للستائر والديكور"],
    ["Address", "الدقهليه - المنصوره - مركز تمي الامديد - ظفر"],
    ["Phone Number", "+20 10 07036248"],
    ["Currency", "EGP"],
    ["Admin Email", "elmasa_admin_secure@elmasa.com"],
    ["Admin Password", "ElmasaAdminSecure2026!#"],
    ["Initialized", "true"]
  ];
  settingsSheet.getRange(2, 1, defaultSettings.length, 2).setValues(defaultSettings);
  
  return { cleared: true };
}
