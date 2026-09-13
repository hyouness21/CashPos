'use strict';

document.querySelectorAll('[data-nav]').forEach(card => {
  card.addEventListener('click', () => window.api.navigate(card.dataset.nav));
});

document.getElementById('btn-back').addEventListener('click', () => window.api.navigate('tables'));

document.getElementById('backup-card').addEventListener('click', async () => {
  const res = await window.api.triggerBackup();
  if (res.success) showToast('Backup saved', 'success');
  else showToast(res.error, 'error');
});
