'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { initDatabase } = require('./db/index');
const { registerAllIpc } = require('./ipc/index');
const backup = require('./backup');

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'A new version has been downloaded. The app will restart to apply the update.',
    buttons: ['Restart Now'],
    defaultId: 0,
  }).then(() => {
    autoUpdater.quitAndInstall();
  });
});

let mainWindow;

// In-memory table cart state — persists across page navigations within a session
const tableState = {
  currentTableId:   null,
  currentTableName: null,
  carts: {},  // { [tableId]: { items: [], billedSessionIds: [] } }
};

const PAGES = {
  login:           'login/index.html',
  tables:          'tables/index.html',
  cashier:         'cashier/index.html',
  'menu-admin':    'menu-admin/index.html',
  'tables-admin':  'tables-admin/index.html',
  stock:           'stock/index.html',
  profit:          'profit/index.html',
  'personal-log':  'personal-log/index.html',
  'admin-hub':     'admin-hub/index.html',
  settings:        'settings/index.html',
};

function rendererPath(page) {
  return path.join(__dirname, '../renderer', page);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Zawia Cafe POS',
    backgroundColor: '#f2efe9',
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(rendererPath(PAGES.login));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  initDatabase();
  registerAllIpc();

  // Navigation
  ipcMain.handle('navigate:go', (_, page) => {
    if (!PAGES[page]) return { success: false, error: 'Unknown page' };
    mainWindow.loadFile(rendererPath(PAGES[page]));
    return { success: true };
  });

  // Table session state
  ipcMain.handle('state:set-table', (_, { id, name }) => {
    tableState.currentTableId   = id;
    tableState.currentTableName = name;
    return { success: true };
  });

  ipcMain.handle('state:get-table', () => ({
    success: true,
    data: { id: tableState.currentTableId, name: tableState.currentTableName },
  }));

  ipcMain.handle('state:save-cart', (_, { tableId, items, billedSessionIds, discountUsd }) => {
    tableState.carts[tableId] = { items, billedSessionIds, discountUsd: discountUsd || 0 };
    return { success: true };
  });

  ipcMain.handle('state:load-cart', (_, tableId) => ({
    success: true,
    data: tableState.carts[tableId] || { items: [], billedSessionIds: [], discountUsd: 0 },
  }));

  ipcMain.handle('state:clear-cart', (_, tableId) => {
    delete tableState.carts[tableId];
    return { success: true };
  });

  ipcMain.handle('state:get-occupied', () => {
    const occupied = {};
    for (const [id, cart] of Object.entries(tableState.carts)) {
      if ((cart.items && cart.items.length > 0) || (cart.billedSessionIds && cart.billedSessionIds.length > 0)) {
        occupied[id] = true;
      }
    }
    return { success: true, data: occupied };
  });

  // Returns qty of each item currently reserved in all OTHER tables' carts
  ipcMain.handle('state:get-reserved', (_, excludeTableId) => {
    const reserved = {};
    for (const [tableId, cart] of Object.entries(tableState.carts)) {
      if (String(tableId) === String(excludeTableId)) continue;
      for (const item of (cart.items || [])) {
        if (item.item_id) {
          reserved[item.item_id] = (reserved[item.item_id] || 0) + item.quantity;
        }
      }
    }
    return { success: true, data: reserved };
  });

  createWindow();
  backup.startPeriodicBackup();
  if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify();

  app.on('before-quit', () => {
    try { backup.runBackup(); } catch (_) {}
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
