'use strict';

let db;

function init(database) { db = database; }

function addPurchase({ item_id, quantity, total_cost_usd, notes = '' }) {
  const cost_per_unit_usd = total_cost_usd / quantity;
  const info = db.prepare(
    'INSERT INTO stock_purchases (item_id, quantity, total_cost_usd, cost_per_unit_usd, purchased_at, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(item_id, quantity, total_cost_usd, cost_per_unit_usd, new Date().toISOString(), notes || null);

  db.prepare('UPDATE items SET cost_usd = ?, stock_qty = stock_qty + ? WHERE id = ?')
    .run(cost_per_unit_usd, quantity, item_id);

  return { id: info.lastInsertRowid, cost_per_unit_usd };
}

function getStockLevels() {
  return db.prepare(`
    SELECT i.id, i.name, i.stock_qty, c.name AS category_name
    FROM items i
    JOIN categories c ON c.id = i.category_id
    WHERE i.active = 1
    ORDER BY c.sort_order, i.name
  `).all();
}

function getLatestCost(item_id) {
  const row = db.prepare(
    'SELECT cost_per_unit_usd FROM stock_purchases WHERE item_id = ? ORDER BY purchased_at DESC LIMIT 1'
  ).get(item_id);
  return row ? row.cost_per_unit_usd : 0;
}

function getPurchases({ item_id, from, to } = {}) {
  let sql = `
    SELECT sp.*, i.name as item_name
    FROM stock_purchases sp
    JOIN items i ON i.id = sp.item_id
    WHERE 1=1
  `;
  const params = [];
  if (item_id) { sql += ' AND sp.item_id = ?'; params.push(item_id); }
  if (from)    { sql += ' AND sp.purchased_at >= ?'; params.push(from); }
  if (to)      { sql += ' AND sp.purchased_at <= ?'; params.push(to); }
  sql += ' ORDER BY sp.purchased_at DESC';
  return db.prepare(sql).all(...params);
}

module.exports = { init, addPurchase, getLatestCost, getPurchases, getStockLevels };
