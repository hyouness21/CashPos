'use strict';

let db;

function init(database) { db = database; }

function addEntry({ admin_name, item_id, item_name, quantity, personal_price_usd, notes = '' }) {
  const info = db.prepare(
    'INSERT INTO personal_log (admin_name, item_id, item_name, quantity, personal_price_usd, logged_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(admin_name, item_id, item_name, quantity, personal_price_usd, new Date().toISOString(), notes || null);
  return { id: info.lastInsertRowid };
}

function getEntries({ admin_name, from, to } = {}) {
  let sql = 'SELECT * FROM personal_log WHERE 1=1';
  const params = [];
  if (admin_name) { sql += ' AND admin_name = ?'; params.push(admin_name); }
  if (from)       { sql += ' AND logged_at >= ?'; params.push(from); }
  if (to)         { sql += ' AND logged_at <= ?'; params.push(to); }
  sql += ' ORDER BY logged_at DESC';
  return db.prepare(sql).all(...params);
}

function getDailySummary(date) {
  const from = `${date}T00:00:00.000Z`;
  const to   = `${date}T23:59:59.999Z`;
  return db.prepare(`
    SELECT admin_name,
           SUM(quantity) AS total_items,
           SUM(quantity * personal_price_usd) AS total_value
    FROM personal_log
    WHERE logged_at >= ? AND logged_at <= ?
    GROUP BY admin_name
  `).all(from, to);
}

function getEntry(id) {
  return db.prepare('SELECT * FROM personal_log WHERE id = ?').get(id);
}

function markPaid(id, orderId, paidAt) {
  db.prepare('UPDATE personal_log SET paid = 1, paid_at = ?, order_id = ? WHERE id = ?')
    .run(paidAt, orderId, id);
}

module.exports = { init, addEntry, getEntries, getDailySummary, getEntry, markPaid };
