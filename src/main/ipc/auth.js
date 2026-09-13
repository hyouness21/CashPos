'use strict';

const { ipcMain } = require('electron');
const auth = require('../db/queries/auth');

function register() {
  ipcMain.handle('auth:login', (_, password) => {
    const ok = auth.validateAppPassword(password);
    return { success: ok, error: ok ? null : 'Wrong password' };
  });

  ipcMain.handle('auth:verify-admin-pin', (_, pin) => {
    const ok = auth.validateAdminPin(pin);
    return { success: ok, error: ok ? null : 'Wrong PIN' };
  });

  ipcMain.handle('auth:change-password', (_, { currentPassword, newPassword }) => {
    const ok = auth.changeAppPassword(currentPassword, newPassword);
    return { success: ok, error: ok ? null : 'Current password incorrect' };
  });

  ipcMain.handle('auth:change-pin', (_, { currentPin, newPin }) => {
    const ok = auth.changeAdminPin(currentPin, newPin);
    return { success: ok, error: ok ? null : 'Current PIN incorrect' };
  });
}

module.exports = { register };
