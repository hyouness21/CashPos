'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Auth
  login:          (password) => ipcRenderer.invoke('auth:login', password),
  verifyAdminPin: (pin)      => ipcRenderer.invoke('auth:verify-admin-pin', pin),
  changePassword: (data)     => ipcRenderer.invoke('auth:change-password', data),
  changePin:      (data)     => ipcRenderer.invoke('auth:change-pin', data),

  // Navigation
  navigate: (page) => ipcRenderer.invoke('navigate:go', page),

  // Settings
  getSettings:   ()           => ipcRenderer.invoke('settings:get-all'),
  updateSetting: (key, value) => ipcRenderer.invoke('settings:update', { key, value }),

  // Tables (venue tables)
  getTables:   ()     => ipcRenderer.invoke('tables:get-all'),
  addTable:    (data) => ipcRenderer.invoke('tables:add', data),
  updateTable: (data) => ipcRenderer.invoke('tables:update', data),
  deleteTable: (id)   => ipcRenderer.invoke('tables:delete', id),

  // Table session state (in-memory, per-table cart persistence)
  setCurrentTable:  (id, name)                    => ipcRenderer.invoke('state:set-table', { id, name }),
  getCurrentTable:  ()                             => ipcRenderer.invoke('state:get-table'),
  saveCart:         (tableId, items, sessions, discountUsd) => ipcRenderer.invoke('state:save-cart', { tableId, items, billedSessionIds: sessions, discountUsd }),
  loadCart:         (tableId)                      => ipcRenderer.invoke('state:load-cart', tableId),
  clearCart:        (tableId)                      => ipcRenderer.invoke('state:clear-cart', tableId),
  getOccupiedTables:()                             => ipcRenderer.invoke('state:get-occupied'),
  getReserved:      (tableId)                      => ipcRenderer.invoke('state:get-reserved', tableId),

  // Menu
  getCategories:  ()      => ipcRenderer.invoke('menu:get-categories'),
  addCategory:    (data)  => ipcRenderer.invoke('menu:add-category', data),
  updateCategory: (data)  => ipcRenderer.invoke('menu:update-category', data),
  deleteCategory: (id)    => ipcRenderer.invoke('menu:delete-category', id),
  getItems:       (catId) => ipcRenderer.invoke('menu:get-items', catId),
  getAllItems:     ()      => ipcRenderer.invoke('menu:get-all-items'),
  addItem:        (data)  => ipcRenderer.invoke('menu:add-item', data),
  updateItem:     (data)  => ipcRenderer.invoke('menu:update-item', data),
  deleteItem:     (id)    => ipcRenderer.invoke('menu:delete-item', id),

  // Orders
  checkout:        (data)  => ipcRenderer.invoke('orders:checkout', data),
  getRecentOrders: (limit) => ipcRenderer.invoke('orders:get-recent', limit),
  getOrder:        (id)    => ipcRenderer.invoke('orders:get', id),
  voidOrder:       (id)    => ipcRenderer.invoke('orders:void', id),

  // Sessions (PlayStation / private room)
  startSession:     (data) => ipcRenderer.invoke('sessions:start', data),
  closeSession:     (data) => ipcRenderer.invoke('sessions:close', data),
  getActiveSessions:()     => ipcRenderer.invoke('sessions:get-active'),
  getSession:       (id)   => ipcRenderer.invoke('sessions:get', id),

  // Stock
  addStockPurchase:  (data)    => ipcRenderer.invoke('stock:add-purchase', data),
  getStockPurchases: (filters) => ipcRenderer.invoke('stock:get-purchases', filters),
  getLatestCost:     (itemId)  => ipcRenderer.invoke('stock:get-latest-cost', itemId),
  getStockLevels:    ()        => ipcRenderer.invoke('stock:get-levels'),

  // Profit
  getProfitSummary: ()        => ipcRenderer.invoke('profit:get-summary'),
  getItemProfit:    (filters) => ipcRenderer.invoke('profit:get-by-item', filters),
  getDailyTotals:   (filters) => ipcRenderer.invoke('profit:get-daily', filters),
  getMonthlyTotals: (filters) => ipcRenderer.invoke('profit:get-monthly', filters),

  // Personal log
  addPersonalLog:        (data)    => ipcRenderer.invoke('personal-log:add', data),
  getPersonalLog:        (filters) => ipcRenderer.invoke('personal-log:get', filters),
  getPersonalLogSummary: (date)    => ipcRenderer.invoke('personal-log:get-daily-summary', date),
  payPersonalLog:        (id)      => ipcRenderer.invoke('personal-log:pay', id),

  // Backup
  triggerBackup: () => ipcRenderer.invoke('backup:trigger'),
});
