'use strict';

let tables     = [];
let editingId  = null;

document.getElementById('btn-back').addEventListener('click', () => window.api.navigate('admin-hub'));

async function init() {
  await loadTables();
}

async function loadTables() {
  const res = await window.api.getTables();
  tables = res.success ? res.data : [];
  renderList();
}

function renderList() {
  const list = document.getElementById('table-list');
  list.innerHTML = '';

  if (tables.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding:32px"><div>No tables yet</div></div>';
    return;
  }

  for (const t of tables) {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = `
      <span class="table-row-name">${esc(t.name)}</span>
      <span class="table-row-order">#${t.sort_order}</span>
      <button class="btn btn-secondary btn-sm" data-edit="${t.id}">Edit</button>
      <button class="btn btn-danger btn-sm" data-del="${t.id}">✕</button>
    `;
    row.querySelector('[data-edit]').addEventListener('click', () => startEdit(t));
    row.querySelector('[data-del]').addEventListener('click', () => deleteTable(t.id, t.name));
    list.appendChild(row);
  }
}

function startEdit(table) {
  editingId = table.id;
  document.getElementById('form-title').textContent = 'Edit Table';
  document.getElementById('name-input').value  = table.name;
  document.getElementById('order-input').value = table.sort_order;
  document.getElementById('btn-cancel-form').style.display = 'inline-flex';
  document.getElementById('form-msg').textContent = '';
  document.getElementById('name-input').focus();
}

function resetForm() {
  editingId = null;
  document.getElementById('form-title').textContent = 'Add Table';
  document.getElementById('name-input').value  = '';
  document.getElementById('order-input').value = tables.length;
  document.getElementById('btn-cancel-form').style.display = 'none';
  document.getElementById('form-msg').textContent = '';
}

document.getElementById('btn-new').addEventListener('click', resetForm);
document.getElementById('btn-cancel-form').addEventListener('click', resetForm);

document.getElementById('btn-save').addEventListener('click', async () => {
  const name       = document.getElementById('name-input').value.trim();
  const sort_order = parseInt(document.getElementById('order-input').value) || 0;
  const msgEl      = document.getElementById('form-msg');

  if (!name) { msgEl.textContent = 'Name is required'; return; }

  let res;
  if (editingId) {
    res = await window.api.updateTable({ id: editingId, name, sort_order });
  } else {
    res = await window.api.addTable({ name, sort_order });
  }

  if (!res.success) { msgEl.textContent = res.error; return; }

  showToast(editingId ? 'Table updated' : 'Table added', 'success');
  resetForm();
  await loadTables();
});

async function deleteTable(id, name) {
  if (!confirm(`Remove "${name}"?\n\nAny open orders for this table will not be affected.`)) return;
  const res = await window.api.deleteTable(id);
  if (!res.success) { showToast(res.error, 'error'); return; }
  if (editingId === id) resetForm();
  await loadTables();
  showToast('Table removed', 'success');
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

init();
