'use strict';

const { ipcMain } = require('electron');
const stock = require('../db/queries/stock');

function register() {
  ipcMain.handle('stock:add-purchase', (_, data) => {
    try { return { success: true, data: stock.addPurchase(data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('stock:get-purchases', (_, filters) => {
    return { success: true, data: stock.getPurchases(filters) };
  });

  ipcMain.handle('stock:get-latest-cost', (_, item_id) => {
    return { success: true, data: stock.getLatestCost(item_id) };
  });

  ipcMain.handle('stock:get-levels', () => {
    return { success: true, data: stock.getStockLevels() };
  });
}

module.exports = { register };
