'use strict';

const { ipcMain } = require('electron');
const orders = require('../db/queries/orders');

function register() {
  ipcMain.handle('orders:checkout', (_, data) => {
    try {
      return { success: true, data: orders.createAndPayOrder(data) };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('orders:get-recent', (_, limit) => {
    return { success: true, data: orders.getRecentOrders(limit) };
  });

  ipcMain.handle('orders:get', (_, id) => {
    return { success: true, data: orders.getOrder(id) };
  });

  ipcMain.handle('orders:void', (_, id) => {
    try { orders.voidOrder(id); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });
}

module.exports = { register };
