'use strict';

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active     INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS items (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id         INTEGER NOT NULL,
    name                TEXT    NOT NULL,
    price_usd           REAL    NOT NULL DEFAULT 0,
    cost_usd            REAL    NOT NULL DEFAULT 0,
    personal_price_usd  REAL    NOT NULL DEFAULT 0,
    is_resale           INTEGER NOT NULL DEFAULT 0,
    active              INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS tables (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active     INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS orders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT    NOT NULL,
    total_usd   REAL    NOT NULL DEFAULT 0,
    status      TEXT    NOT NULL DEFAULT 'paid',
    table_id    INTEGER,
    table_name  TEXT,
    notes       TEXT
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id      INTEGER NOT NULL,
    item_id       INTEGER,
    session_id    INTEGER,
    label         TEXT    NOT NULL,
    quantity      REAL    NOT NULL DEFAULT 1,
    unit_price_usd REAL   NOT NULL DEFAULT 0,
    cost_usd      REAL    NOT NULL DEFAULT 0,
    FOREIGN KEY (order_id)   REFERENCES orders(id),
    FOREIGN KEY (item_id)    REFERENCES items(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    type         TEXT    NOT NULL,
    label        TEXT,
    started_at   TEXT    NOT NULL,
    ended_at     TEXT,
    billing_type TEXT    NOT NULL DEFAULT 'hourly',
    rate         REAL    NOT NULL DEFAULT 0,
    match_count  INTEGER NOT NULL DEFAULT 0,
    total_usd    REAL    NOT NULL DEFAULT 0,
    order_id     INTEGER,
    status       TEXT    NOT NULL DEFAULT 'active',
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS stock_purchases (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id          INTEGER NOT NULL,
    quantity         REAL    NOT NULL,
    total_cost_usd   REAL    NOT NULL,
    cost_per_unit_usd REAL   NOT NULL,
    purchased_at     TEXT    NOT NULL,
    notes            TEXT,
    FOREIGN KEY (item_id) REFERENCES items(id)
  );

  CREATE TABLE IF NOT EXISTS personal_log (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_name          TEXT NOT NULL,
    item_id             INTEGER NOT NULL,
    item_name           TEXT NOT NULL,
    quantity            REAL NOT NULL DEFAULT 1,
    personal_price_usd  REAL NOT NULL DEFAULT 0,
    logged_at           TEXT NOT NULL,
    notes               TEXT,
    FOREIGN KEY (item_id) REFERENCES items(id)
  );

  CREATE TABLE IF NOT EXISTS backup_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    backed_up_at TEXT    NOT NULL,
    file_path   TEXT    NOT NULL
  );
`;

const DEFAULT_SETTINGS = [
  ['app_password',  '0000'],
  ['admin_pin',     '2601'],
  ['usd_to_lbp',   '90000'],
  ['admin1_name',   'Admin 1'],
  ['admin2_name',   'Admin 2'],
];

const SEED_CATEGORIES = [
  { name: 'Hot Drinks',    sort_order: 1 },
  { name: 'Cold Drinks',   sort_order: 2 },
  { name: 'Shisha',        sort_order: 3 },
  { name: 'Snacks',        sort_order: 4 },
  { name: 'PlayStation',   sort_order: 5 },
  { name: 'Private Room',  sort_order: 6 },
];

const SEED_TABLES = [
  { name: 'Table 1', sort_order: 1 },
  { name: 'Table 2', sort_order: 2 },
  { name: 'Table 3', sort_order: 3 },
  { name: 'Table 4', sort_order: 4 },
];

module.exports = { SCHEMA_SQL, DEFAULT_SETTINGS, SEED_CATEGORIES, SEED_TABLES };
