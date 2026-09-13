'use strict';

let db;

function init(database) { db = database; }

function startSession({ type, label, billing_type, rate }) {
  const info = db.prepare(
    'INSERT INTO sessions (type, label, started_at, billing_type, rate, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(type, label || null, new Date().toISOString(), billing_type, rate, 'active');
  return { id: info.lastInsertRowid };
}

function closeSession({ id, match_count = 0 }) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!session) throw new Error('Session not found');
  if (session.status !== 'active') throw new Error('Session is not active');

  const ended_at = new Date().toISOString();
  let total_usd = 0;

  if (session.billing_type === 'per_match') {
    total_usd = match_count * session.rate;
  } else {
    const ms = new Date(ended_at) - new Date(session.started_at);
    const hours = ms / 3600000;
    total_usd = Math.ceil(hours * 4) / 4 * session.rate; // round up to nearest 15 min
  }

  const duration_minutes = Math.round((new Date(ended_at) - new Date(session.started_at)) / 60000);

  db.prepare(
    'UPDATE sessions SET ended_at = ?, match_count = ?, total_usd = ?, status = ? WHERE id = ?'
  ).run(ended_at, match_count, total_usd, 'closed', id);

  return { ...session, ended_at, match_count, total_usd, duration_minutes };
}

function getActiveSessions() {
  return db.prepare('SELECT * FROM sessions WHERE status = ? ORDER BY started_at').all('active');
}

function getSession(id) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
}

function markBilled(id, order_id) {
  db.prepare('UPDATE sessions SET status = ?, order_id = ? WHERE id = ?').run('billed', order_id, id);
}

module.exports = { init, startSession, closeSession, getActiveSessions, getSession, markBilled };
