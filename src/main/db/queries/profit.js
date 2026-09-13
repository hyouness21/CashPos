'use strict';

let db;

function init(database) { db = database; }

function getAllTimeSummary() {
  const rev        = db.prepare("SELECT COALESCE(SUM(total_usd),0) as v FROM orders WHERE status='paid'").get().v;
  const orderCount = db.prepare("SELECT COUNT(*) as v FROM orders WHERE status='paid'").get().v;
  const stockSpend = db.prepare("SELECT COALESCE(SUM(total_cost_usd),0) as v FROM stock_purchases").get().v;
  const cogs       = db.prepare("SELECT COALESCE(SUM(quantity * cost_usd),0) as v FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status='paid'").get().v;
  return { revenue: rev, order_count: orderCount, stock_spend: stockSpend, cogs, gross_profit: rev - stockSpend };
}

function getItemProfit({ from, to } = {}) {
  let where = "o.status = 'paid'";
  const params = [];
  if (from) { where += ' AND o.created_at >= ?'; params.push(from); }
  if (to)   { where += ' AND o.created_at <= ?'; params.push(to); }

  return db.prepare(`
    SELECT
      oi.item_id,
      oi.label,
      SUM(oi.quantity)                                        AS total_sold,
      SUM(oi.quantity * oi.unit_price_usd)                    AS revenue,
      SUM(oi.quantity * oi.cost_usd)                          AS cogs,
      SUM(oi.quantity * oi.unit_price_usd - oi.quantity * oi.cost_usd) AS profit
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE ${where} AND oi.item_id IS NOT NULL
    GROUP BY oi.item_id, oi.label
    ORDER BY profit DESC
  `).all(...params);
}

function getDailyTotals({ from, to } = {}) {
  let where = "o.status = 'paid'";
  const params = [];
  if (from) { where += ' AND o.created_at >= ?'; params.push(from); }
  if (to)   { where += ' AND o.created_at <= ?'; params.push(to); }

  const revenue = db.prepare(`
    SELECT date(o.created_at) AS day, SUM(o.total_usd) AS revenue
    FROM orders o WHERE ${where} GROUP BY day ORDER BY day DESC
  `).all(...params);

  const stockParam = [...params];
  let stockWhere = '1=1';
  if (from) { stockWhere += ' AND purchased_at >= ?'; stockParam.push(from); }
  if (to)   { stockWhere += ' AND purchased_at <= ?'; stockParam.push(to); }

  const spend = db.prepare(`
    SELECT date(purchased_at) AS day, SUM(total_cost_usd) AS stock_spend
    FROM stock_purchases WHERE ${stockWhere} GROUP BY day ORDER BY day DESC
  `).all(...stockParam);

  const map = {};
  for (const r of revenue) map[r.day] = { day: r.day, revenue: r.revenue, stock_spend: 0 };
  for (const s of spend) {
    if (!map[s.day]) map[s.day] = { day: s.day, revenue: 0, stock_spend: 0 };
    map[s.day].stock_spend = s.stock_spend;
  }

  return Object.values(map)
    .map(r => ({ ...r, profit: r.revenue - r.stock_spend }))
    .sort((a, b) => b.day.localeCompare(a.day));
}

function getMonthlyTotals({ year } = {}) {
  const params = [];
  let where = "o.status = 'paid'";
  if (year) { where += " AND strftime('%Y', o.created_at) = ?"; params.push(String(year)); }

  const revenue = db.prepare(`
    SELECT strftime('%Y-%m', o.created_at) AS month, SUM(o.total_usd) AS revenue
    FROM orders o WHERE ${where} GROUP BY month ORDER BY month DESC
  `).all(...params);

  const stockParams = [];
  let stockWhere = '1=1';
  if (year) { stockWhere += " AND strftime('%Y', purchased_at) = ?"; stockParams.push(String(year)); }

  const spend = db.prepare(`
    SELECT strftime('%Y-%m', purchased_at) AS month, SUM(total_cost_usd) AS stock_spend
    FROM stock_purchases WHERE ${stockWhere} GROUP BY month ORDER BY month DESC
  `).all(...stockParams);

  const map = {};
  for (const r of revenue) map[r.month] = { month: r.month, revenue: r.revenue, stock_spend: 0 };
  for (const s of spend) {
    if (!map[s.month]) map[s.month] = { month: s.month, revenue: 0, stock_spend: 0 };
    map[s.month].stock_spend = s.stock_spend;
  }

  return Object.values(map)
    .map(r => ({ ...r, profit: r.revenue - r.stock_spend }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

module.exports = { init, getAllTimeSummary, getItemProfit, getDailyTotals, getMonthlyTotals };
