'use strict';

const { ipcMain } = require('electron');
const sessions = require('../db/queries/sessions');

function register() {
  ipcMain.handle('sessions:start', (_, data) => {
    try { return { success: true, data: sessions.startSession(data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('sessions:close', (_, data) => {
    try { return { success: true, data: sessions.closeSession(data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('sessions:get-active', () => {
    return { success: true, data: sessions.getActiveSessions() };
  });

  ipcMain.handle('sessions:get', (_, id) => {
    return { success: true, data: sessions.getSession(id) };
  });
}

module.exports = { register };
