'use strict';

let db;

function init(database) { db = database; }

function getCategories() {
  return db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, name').all();
}

function addCategory({ name, sort_order = 0 }) {
  const info = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name, sort_order);
  return { id: info.lastInsertRowid };
}

function updateCategory({ id, name, sort_order }) {
  db.prepare('UPDATE categories SET name = ?, sort_order = ? WHERE id = ?').run(name, sort_order, id);
}

function deleteCategory(id) {
  const itemCount = db.prepare('SELECT COUNT(*) as cnt FROM items WHERE category_id = ? AND active = 1').get(id).cnt;
  if (itemCount > 0) throw new Error('Category has active items. Remove items first.');
  db.prepare('UPDATE categories SET active = 0 WHERE id = ?').run(id);
}

function getItems(categoryId) {
  return db.prepare(`
    SELECT i.*,
      (SELECT COUNT(*) FROM stock_purchases sp WHERE sp.item_id = i.id) AS purchase_count
    FROM items i
    WHERE i.category_id = ? AND i.active = 1
    ORDER BY i.name
  `).all(categoryId);
}

function getAllItems() {
  return db.prepare(`
    SELECT i.*, c.name as category_name
    FROM items i
    JOIN categories c ON c.id = i.category_id
    WHERE i.active = 1
    ORDER BY c.sort_order, i.name
  `).all();
}

function addItem({ category_id, name, price_usd, cost_usd = 0, personal_price_usd = 0, is_resale = 0 }) {
  const info = db.prepare(
    'INSERT INTO items (category_id, name, price_usd, cost_usd, personal_price_usd, is_resale) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(category_id, name, price_usd, cost_usd, personal_price_usd, is_resale ? 1 : 0);
  return { id: info.lastInsertRowid };
}

function updateItem({ id, category_id, name, price_usd, cost_usd, personal_price_usd, is_resale }) {
  db.prepare(
    'UPDATE items SET category_id = ?, name = ?, price_usd = ?, cost_usd = ?, personal_price_usd = ?, is_resale = ? WHERE id = ?'
  ).run(category_id, name, price_usd, cost_usd, personal_price_usd, is_resale ? 1 : 0, id);
}

function deleteItem(id) {
  db.prepare('UPDATE items SET active = 0 WHERE id = ?').run(id);
}

module.exports = { init, getCategories, addCategory, updateCategory, deleteCategory, getItems, getAllItems, addItem, updateItem, deleteItem };
