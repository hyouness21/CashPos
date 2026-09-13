'use strict';

const { ipcMain } = require('electron');
const settings = require('../db/queries/settings');

function register() {
  ipcMain.handle('settings:get-all', () => {
    const all = settings.getAll();
    delete all.app_password;
    delete all.admin_pin;
    return { success: true, data: all };
  });

  ipcMain.handle('settings:update', (_, { key, value }) => {
    const restricted = ['app_password', 'admin_pin'];
    if (restricted.includes(key)) return { success: false, error: 'Use auth channels for password changes' };
    settings.set(key, value);
    return { success: true };
  });
}

module.exports = { register };
