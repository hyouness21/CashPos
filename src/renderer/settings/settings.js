'use strict';

document.getElementById('btn-back').addEventListener('click', () => window.api.navigate('admin-hub'));

async function init() {
  const res = await window.api.getSettings();
  if (!res.success) return;
  const s = res.data;
  document.getElementById('rate-input').value         = s.usd_to_lbp || '90000';
  document.getElementById('admin1-name-input').value  = s.admin1_name || 'Admin 1';
  document.getElementById('admin2-name-input').value  = s.admin2_name || 'Admin 2';
}

document.getElementById('btn-save-rate').addEventListener('click', async () => {
  const val = document.getElementById('rate-input').value.trim();
  if (!val || isNaN(val) || Number(val) <= 0) { showToast('Enter a valid rate', 'error'); return; }
  const res = await window.api.updateSetting('usd_to_lbp', val);
  if (res.success) showToast('Exchange rate saved', 'success');
  else showToast(res.error, 'error');
});

document.getElementById('btn-save-admin1').addEventListener('click', async () => {
  const val = document.getElementById('admin1-name-input').value.trim();
  if (!val) { showToast('Name required', 'error'); return; }
  const res = await window.api.updateSetting('admin1_name', val);
  if (res.success) showToast('Admin 1 name saved', 'success');
  else showToast(res.error, 'error');
});

document.getElementById('btn-save-admin2').addEventListener('click', async () => {
  const val = document.getElementById('admin2-name-input').value.trim();
  if (!val) { showToast('Name required', 'error'); return; }
  const res = await window.api.updateSetting('admin2_name', val);
  if (res.success) showToast('Admin 2 name saved', 'success');
  else showToast(res.error, 'error');
});

document.getElementById('btn-change-pass').addEventListener('click', async () => {
  const currentPassword = document.getElementById('cur-pass').value;
  const newPassword     = document.getElementById('new-pass').value;
  if (!currentPassword || !newPassword) { showToast('Fill both fields', 'error'); return; }
  if (newPassword.length < 4) { showToast('New password too short (min 4 chars)', 'error'); return; }
  const res = await window.api.changePassword({ currentPassword, newPassword });
  if (res.success) {
    showToast('Password updated', 'success');
    document.getElementById('cur-pass').value = '';
    document.getElementById('new-pass').value = '';
  } else showToast(res.error, 'error');
});

document.getElementById('btn-change-pin').addEventListener('click', async () => {
  const currentPin = document.getElementById('cur-pin').value;
  const newPin     = document.getElementById('new-pin').value;
  if (!currentPin || !newPin) { showToast('Fill both fields', 'error'); return; }
  if (!/^\d{4}$/.test(newPin)) { showToast('PIN must be exactly 4 digits', 'error'); return; }
  const res = await window.api.changePin({ currentPin, newPin });
  if (res.success) {
    showToast('PIN updated', 'success');
    document.getElementById('cur-pin').value = '';
    document.getElementById('new-pin').value = '';
  } else showToast(res.error, 'error');
});

init();
