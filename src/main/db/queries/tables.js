'use strict';

let db;

function init(database) { db = database; }

function getAll() {
  return db.prepare('SELECT * FROM tables WHERE active = 1 ORDER BY sort_order, name').all();
}

function add({ name, sort_order = 0 }) {
  const info = db.prepare('INSERT INTO tables (name, sort_order) VALUES (?, ?)').run(name, sort_order);
  return { id: info.lastInsertRowid };
}

function update({ id, name, sort_order }) {
  db.prepare('UPDATE tables SET name = ?, sort_order = ? WHERE id = ?').run(name, sort_order, id);
}

function remove(id) {
  db.prepare('UPDATE tables SET active = 0 WHERE id = ?').run(id);
}

module.exports = { init, getAll, add, update, remove };
