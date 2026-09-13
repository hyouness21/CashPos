'use strict';

const { ipcMain } = require('electron');
const backup = require('../backup');

function register() {
  ipcMain.handle('backup:trigger', () => {
    try {
      const dest = backup.runBackup();
      return { success: true, data: { path: dest } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

module.exports = { register };
