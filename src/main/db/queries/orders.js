'use strict';

const sessionQueries = require('./sessions');
const stockQueries = require('./stock');

let db;

function init(database) { db = database; }

function createAndPayOrder({ items, sessions = [], notes = '', table_id = null, table_name = null, discount_usd = 0 }) {
  const created_at = new Date().toISOString();

  const tx = db.transaction(() => {
    let total_usd = 0;

    for (const item of items) {
      total_usd += item.quantity * item.unit_price_usd;
    }

    for (const sid of sessions) {
      const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid);
      if (s) total_usd += s.total_usd;
    }

    const discountCapped = Math.min(Math.max(discount_usd || 0, 0), total_usd);
    total_usd = Math.max(0, total_usd - discountCapped);

    const orderInfo = db.prepare(
      'INSERT INTO orders (created_at, total_usd, discount_usd, status, table_id, table_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(created_at, total_usd, discountCapped, 'paid', table_id || null, table_name || null, notes || null);

    const orderId = orderInfo.lastInsertRowid;

    const insertItem = db.prepare(
      'INSERT INTO order_items (order_id, item_id, session_id, label, quantity, unit_price_usd, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    for (const item of items) {
      let cost = item.cost_usd || 0;
      if (item.is_resale && item.item_id) {
        const latestCost = stockQueries.getLatestCost(item.item_id);
        cost = latestCost;
      }
      insertItem.run(orderId, item.item_id || null, null, item.label, item.quantity, item.unit_price_usd, cost);

      if (item.item_id) {
        db.prepare('UPDATE items SET stock_qty = MAX(0, stock_qty - ?) WHERE id = ?')
          .run(item.quantity, item.item_id);
      }
    }

    for (const sid of sessions) {
      const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid);
      if (!s) continue;
      const billing = s.billing_type === 'per_match'
        ? `${s.match_count} match${s.match_count !== 1 ? 'es' : ''}`
        : formatDuration(new Date(s.ended_at) - new Date(s.started_at));
      insertItem.run(orderId, null, sid, `${s.label || s.type} — ${billing}`, 1, s.total_usd, 0);
      sessionQueries.markBilled(sid, orderId);
    }

    return { order_id: orderId, total_usd };
  });

  return tx();
}

function getRecentOrders(limit = 50) {
  return db.prepare(`
    SELECT o.*, COUNT(oi.id) as item_count
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT ?
  `).all(limit);
}

function getOrder(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
  return { ...order, items };
}

function voidOrder(id) {
  const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(id);
  if (!order || order.status === 'voided') return;

  const tx = db.transaction(() => {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
    for (const item of items) {
      if (item.item_id) {
        db.prepare('UPDATE items SET stock_qty = stock_qty + ? WHERE id = ?')
          .run(item.quantity, item.item_id);
      }
    }
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('voided', id);
  });
  tx();
}

function formatDuration(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

module.exports = { init, createAndPayOrder, getRecentOrders, getOrder, voidOrder };
