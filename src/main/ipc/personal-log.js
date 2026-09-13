'use strict';

const { ipcMain } = require('electron');
const personalLog = require('../db/queries/personal-log');
const orders      = require('../db/queries/orders');
const { getDb }   = require('../db/index');

function register() {
  ipcMain.handle('personal-log:add', (_, data) => {
    try { return { success: true, data: personalLog.addEntry(data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('personal-log:get', (_, filters) => {
    return { success: true, data: personalLog.getEntries(filters) };
  });

  ipcMain.handle('personal-log:get-daily-summary', (_, date) => {
    return { success: true, data: personalLog.getDailySummary(date) };
  });

  ipcMain.handle('personal-log:pay', (_, id) => {
    try {
      const entry = personalLog.getEntry(id);
      if (!entry)      return { success: false, error: 'Entry not found' };
      if (entry.paid)  return { success: false, error: 'Already paid' };

      const item = getDb().prepare('SELECT * FROM items WHERE id = ?').get(entry.item_id);

      const orderData = orders.createAndPayOrder({
        items: [{
          item_id:        entry.item_id,
          label:          entry.item_name,
          quantity:       entry.quantity,
          unit_price_usd: entry.personal_price_usd,
          cost_usd:       item ? item.cost_usd : 0,
          is_resale:      item ? item.is_resale : 0,
        }],
        notes: `Personal — ${entry.admin_name}`,
      });

      personalLog.markPaid(id, orderData.order_id, new Date().toISOString());
      return { success: true, data: { order_id: orderData.order_id } };
    } catch (e) { return { success: false, error: e.message }; }
  });
}

module.exports = { register };
