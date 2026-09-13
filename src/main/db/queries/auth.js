'use strict';

const settings = require('./settings');

function validateAppPassword(password) {
  return settings.get('app_password') === password;
}

function validateAdminPin(pin) {
  return settings.get('admin_pin') === pin;
}

function changeAppPassword(currentPassword, newPassword) {
  if (!validateAppPassword(currentPassword)) return false;
  settings.set('app_password', newPassword);
  return true;
}

function changeAdminPin(currentPin, newPin) {
  if (!validateAdminPin(currentPin)) return false;
  settings.set('admin_pin', newPin);
  return true;
}

module.exports = { validateAppPassword, validateAdminPin, changeAppPassword, changeAdminPin };
