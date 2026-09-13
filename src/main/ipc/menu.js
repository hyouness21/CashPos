'use strict';

const { ipcMain } = require('electron');
const menu = require('../db/queries/menu');

function register() {
  ipcMain.handle('menu:get-categories', () => {
    return { success: true, data: menu.getCategories() };
  });

  ipcMain.handle('menu:add-category', (_, data) => {
    try {
      return { success: true, data: menu.addCategory(data) };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('menu:update-category', (_, data) => {
    try { menu.updateCategory(data); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('menu:delete-category', (_, id) => {
    try { menu.deleteCategory(id); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('menu:get-items', (_, categoryId) => {
    return { success: true, data: menu.getItems(categoryId) };
  });

  ipcMain.handle('menu:get-all-items', () => {
    return { success: true, data: menu.getAllItems() };
  });

  ipcMain.handle('menu:add-item', (_, data) => {
    try { return { success: true, data: menu.addItem(data) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('menu:update-item', (_, data) => {
    try { menu.updateItem(data); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('menu:delete-item', (_, id) => {
    try { menu.deleteItem(id); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });
}

module.exports = { register };
