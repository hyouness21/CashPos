'use strict';

const { ipcMain } = require('electron');
const profit = require('../db/queries/profit');

function register() {
  ipcMain.handle('profit:get-summary', () => {
    return { success: true, data: profit.getAllTimeSummary() };
  });

  ipcMain.handle('profit:get-by-item', (_, filters) => {
    return { success: true, data: profit.getItemProfit(filters) };
  });

  ipcMain.handle('profit:get-daily', (_, filters) => {
    return { success: true, data: profit.getDailyTotals(filters) };
  });

  ipcMain.handle('profit:get-monthly', (_, filters) => {
    return { success: true, data: profit.getMonthlyTotals(filters) };
  });
}

module.exports = { register };
