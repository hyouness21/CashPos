'use strict';

const authIpc        = require('./auth');
const menuIpc        = require('./menu');
const ordersIpc      = require('./orders');
const sessionsIpc    = require('./sessions');
const stockIpc       = require('./stock');
const profitIpc      = require('./profit');
const personalLogIpc = require('./personal-log');
const settingsIpc    = require('./settings');
const backupIpc      = require('./backup');
const tablesIpc      = require('./tables');

function registerAllIpc() {
  authIpc.register();
  menuIpc.register();
  ordersIpc.register();
  sessionsIpc.register();
  stockIpc.register();
  profitIpc.register();
  personalLogIpc.register();
  settingsIpc.register();
  backupIpc.register();
  tablesIpc.register();
}

module.exports = { registerAllIpc };
