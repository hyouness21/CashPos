'use strict';

const { ipcMain } = require('electron');
const tables = require('../db/queries/tables');

function register() {
  ipcMain.handle('tables:get-all', () => {
    return { success: true, data: tables.getAll() };
  });

  ipcMain.handle('tables:add', (_, data) => {
    try { return { success: true, data: tables.add(data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('tables:update', (_, data) => {
    try { tables.update(data); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('tables:delete', (_, id) => {
    try { tables.remove(id); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });
}

module.exports = { register };
