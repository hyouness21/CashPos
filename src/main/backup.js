'use strict';

const fs   = require('fs');
const path = require('path');
const { app } = require('electron');

const KEEP_COUNT = 30;
const INTERVAL_MS = 60 * 60 * 1000; // every 1 hour

function getBackupDir() {
  return path.join(app.getPath('userData'), 'backups');
}

function getDbPath() {
  return path.join(app.getPath('userData'), 'zawia-pos.db');
}

function runBackup() {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) return null;

  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
  const destPath = path.join(backupDir, `zawia-pos-${stamp}.db`);

  fs.copyFileSync(dbPath, destPath);

  pruneOldBackups(backupDir);

  return destPath;
}

function pruneOldBackups(backupDir) {
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('zawia-pos-') && f.endsWith('.db'))
    .sort()
    .reverse();

  for (const file of files.slice(KEEP_COUNT)) {
    fs.unlinkSync(path.join(backupDir, file));
  }
}

function startPeriodicBackup() {
  setInterval(() => {
    try { runBackup(); } catch (_) { /* silent — backup failures shouldn't crash the app */ }
  }, INTERVAL_MS);
}

module.exports = { runBackup, startPeriodicBackup };
