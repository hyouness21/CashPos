'use strict';

const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3');
const { SCHEMA_SQL, DEFAULT_SETTINGS, SEED_CATEGORIES, SEED_TABLES } = require('./schema');

const settingsQ    = require('./queries/settings');
const menuQ        = require('./queries/menu');
const ordersQ      = require('./queries/orders');
const sessionsQ    = require('./queries/sessions');
const stockQ       = require('./queries/stock');
const profitQ      = require('./queries/profit');
const personalLogQ = require('./queries/personal-log');
const tablesQ      = require('./queries/tables');

let db;

function getDb() { return db; }

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'zawia-pos.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(SCHEMA_SQL);

  // Migrations — safe to run on every startup; ALTER TABLE fails silently if column exists
  try { db.exec('ALTER TABLE orders ADD COLUMN table_id   INTEGER'); } catch (_) {}
  try { db.exec('ALTER TABLE orders ADD COLUMN table_name TEXT');    } catch (_) {}
  try { db.exec('ALTER TABLE personal_log ADD COLUMN paid     INTEGER NOT NULL DEFAULT 0'); } catch (_) {}
  try { db.exec('ALTER TABLE personal_log ADD COLUMN paid_at  TEXT');    } catch (_) {}
  try { db.exec('ALTER TABLE personal_log ADD COLUMN order_id INTEGER'); } catch (_) {}
  try { db.exec('ALTER TABLE items ADD COLUMN stock_qty REAL NOT NULL DEFAULT 0'); } catch (_) {}
  try { db.exec('ALTER TABLE orders ADD COLUMN discount_usd REAL NOT NULL DEFAULT 0'); } catch (_) {}

  settingsQ.init(db);
  menuQ.init(db);
  ordersQ.init(db);
  sessionsQ.init(db);
  stockQ.init(db);
  profitQ.init(db);
  personalLogQ.init(db);
  tablesQ.init(db);

  seedDefaults();

  return db;
}

function seedDefaults() {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  const seedTx = db.transaction(() => {
    for (const [key, value] of DEFAULT_SETTINGS) insert.run(key, value);
  });
  seedTx();

  const catCount = db.prepare('SELECT COUNT(*) as cnt FROM categories').get().cnt;
  if (catCount === 0) {
    const insertCat = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
    const catTx = db.transaction(() => {
      for (const c of SEED_CATEGORIES) insertCat.run(c.name, c.sort_order);
    });
    catTx();
  }

  const tableCount = db.prepare('SELECT COUNT(*) as cnt FROM tables').get().cnt;
  if (tableCount === 0) {
    const insertTable = db.prepare('INSERT INTO tables (name, sort_order) VALUES (?, ?)');
    const tableTx = db.transaction(() => {
      for (const t of SEED_TABLES) insertTable.run(t.name, t.sort_order);
    });
    tableTx();
  }
}

module.exports = { initDatabase, getDb };
