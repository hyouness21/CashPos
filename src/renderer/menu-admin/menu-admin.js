'use strict';

let categories    = [];
let selectedCatId = null;
let editingCatId  = null;
let editingItemId = null;
let lbpRate       = 90000;
let inputCurrency = 'usd'; // 'usd' | 'lbp'

document.getElementById('btn-back').addEventListener('click', () => window.api.navigate('admin-hub'));

async function init() {
  const settingsRes = await window.api.getSettings();
  if (settingsRes.success && settingsRes.data.usd_to_lbp) {
    lbpRate = parseFloat(settingsRes.data.usd_to_lbp);
  }
  await loadCategories();
}

// ── Currency toggle ───────────────────────────────────────────────────────────
document.querySelectorAll('.cur-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const newCur = btn.dataset.cur;
    if (newCur === inputCurrency) return;

    // Convert current values in inputs
    const fields = ['item-price-input', 'item-cost-input', 'item-personal-price-input'];
    fields.forEach(id => {
      const val = parseFloat(document.getElementById(id).value);
      if (!isNaN(val) && val > 0) {
        document.getElementById(id).value = newCur === 'lbp'
          ? Math.round(val * lbpRate)
          : (val / lbpRate).toFixed(2);
      }
    });

    inputCurrency = newCur;
    document.querySelectorAll('.cur-btn').forEach(b => b.classList.toggle('active', b.dataset.cur === newCur));
    const suffix = newCur === 'lbp' ? '(LL)' : '(USD)';
    document.getElementById('label-price').textContent    = `Price ${suffix}`;
    document.getElementById('label-cost').textContent     = `Cost ${suffix}`;
    document.getElementById('label-personal').textContent = `Personal Price ${suffix}`;
  });
});

function toUsd(val) {
  return inputCurrency === 'lbp' ? val / lbpRate : val;
}

function resetCurrencyToggle() {
  inputCurrency = 'usd';
  document.querySelectorAll('.cur-btn').forEach(b => b.classList.toggle('active', b.dataset.cur === 'usd'));
  document.getElementById('label-price').textContent    = 'Price (USD)';
  document.getElementById('label-cost').textContent     = 'Cost (USD)';
  document.getElementById('label-personal').textContent = 'Personal Price (USD)';
}

async function loadCategories() {
  const res = await window.api.getCategories();
  categories = res.success ? res.data : [];
  renderCategories();
  if (selectedCatId) await loadItems(selectedCatId);
}

function renderCategories() {
  const list = document.getElementById('cat-list');
  list.innerHTML = '';
  for (const cat of categories) {
    const div = document.createElement('div');
    div.className = `cat-item${cat.id === selectedCatId ? ' active' : ''}`;
    div.innerHTML = `
      <span class="cat-name">${esc(cat.name)}</span>
      <div class="cat-actions">
        <button class="cat-action-btn" data-edit="${cat.id}" title="Edit">✏️</button>
        <button class="cat-action-btn" data-del="${cat.id}" title="Delete">🗑</button>
      </div>
    `;
    div.addEventListener('click', (e) => {
      if (e.target.closest('[data-edit]')) { openCatModal(cat); return; }
      if (e.target.closest('[data-del]')) { deleteCategory(cat.id); return; }
      selectCategory(cat.id);
    });
    list.appendChild(div);
  }
}

function selectCategory(id) {
  selectedCatId = id;
  const cat = categories.find(c => c.id === id);
  document.getElementById('items-panel-title').textContent = cat ? cat.name : '—';
  document.getElementById('btn-add-item').disabled = false;
  renderCategories();
  loadItems(id);
}

async function loadItems(catId) {
  const res = await window.api.getItems(catId);
  renderItems(res.success ? res.data : []);
}

function renderItems(items) {
  const tbody = document.getElementById('items-tbody');
  tbody.innerHTML = '';
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center" style="padding:32px">No items yet</td></tr>';
    return;
  }
  for (const item of items) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(item.name)}</td>
      <td>$${item.price_usd.toFixed(2)}</td>
      <td>$${item.cost_usd.toFixed(2)}</td>
      <td>$${item.personal_price_usd.toFixed(2)}</td>
      <td>${item.is_resale ? '<span class="badge badge-accent">Yes</span>' : '<span class="badge badge-muted">No</span>'}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm" data-edit="${item.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-del="${item.id}">Delete</button>
        </div>
      </td>
    `;
    tr.querySelector('[data-edit]').addEventListener('click', () => openItemModal(item));
    tr.querySelector('[data-del]').addEventListener('click', () => deleteItem(item.id));
    tbody.appendChild(tr);
  }
}

// ── Category modal ────────────────────────────────────────────────────────────
function openCatModal(cat = null) {
  editingCatId = cat ? cat.id : null;
  document.getElementById('cat-modal-title').textContent = cat ? 'Edit Category' : 'Add Category';
  document.getElementById('cat-name-input').value  = cat ? cat.name : '';
  document.getElementById('cat-order-input').value = cat ? cat.sort_order : '0';
  document.getElementById('cat-modal').classList.remove('hidden');
}

document.getElementById('btn-add-cat').addEventListener('click', () => openCatModal());
document.getElementById('cat-modal-cancel').addEventListener('click', () => {
  document.getElementById('cat-modal').classList.add('hidden');
});

document.getElementById('cat-modal-save').addEventListener('click', async () => {
  const name = document.getElementById('cat-name-input').value.trim();
  const sort_order = parseInt(document.getElementById('cat-order-input').value) || 0;
  if (!name) { showToast('Name is required', 'error'); return; }

  let res;
  if (editingCatId) {
    res = await window.api.updateCategory({ id: editingCatId, name, sort_order });
  } else {
    res = await window.api.addCategory({ name, sort_order });
  }

  if (!res.success) { showToast(res.error, 'error'); return; }
  document.getElementById('cat-modal').classList.add('hidden');
  await loadCategories();
  showToast('Category saved', 'success');
});

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  const res = await window.api.deleteCategory(id);
  if (!res.success) { showToast(res.error, 'error'); return; }
  if (selectedCatId === id) { selectedCatId = null; document.getElementById('items-tbody').innerHTML = ''; }
  await loadCategories();
  showToast('Category deleted', 'success');
}

// ── Item modal ────────────────────────────────────────────────────────────────
function openItemModal(item = null) {
  editingItemId = item ? item.id : null;
  resetCurrencyToggle();
  document.getElementById('item-modal-title').textContent = item ? 'Edit Item' : 'Add Item';
  document.getElementById('item-name-input').value           = item ? item.name : '';
  document.getElementById('item-price-input').value          = item ? item.price_usd : '';
  document.getElementById('item-cost-input').value           = item ? item.cost_usd : '';
  document.getElementById('item-personal-price-input').value = item ? item.personal_price_usd : '';
  document.getElementById('item-resale-input').checked       = item ? !!item.is_resale : false;
  document.getElementById('item-modal').classList.remove('hidden');
}

document.getElementById('btn-add-item').addEventListener('click', () => openItemModal());
document.getElementById('item-modal-cancel').addEventListener('click', () => {
  document.getElementById('item-modal').classList.add('hidden');
});

document.getElementById('item-modal-save').addEventListener('click', async () => {
  const name               = document.getElementById('item-name-input').value.trim();
  const price_usd          = toUsd(parseFloat(document.getElementById('item-price-input').value) || 0);
  const cost_usd           = toUsd(parseFloat(document.getElementById('item-cost-input').value) || 0);
  const personal_price_usd = toUsd(parseFloat(document.getElementById('item-personal-price-input').value) || 0);
  const is_resale          = document.getElementById('item-resale-input').checked ? 1 : 0;

  if (!name) { showToast('Name is required', 'error'); return; }
  if (price_usd <= 0) { showToast('Price must be > 0', 'error'); return; }

  let res;
  if (editingItemId) {
    res = await window.api.updateItem({ id: editingItemId, category_id: selectedCatId, name, price_usd, cost_usd, personal_price_usd, is_resale });
  } else {
    res = await window.api.addItem({ category_id: selectedCatId, name, price_usd, cost_usd, personal_price_usd, is_resale });
  }

  if (!res.success) { showToast(res.error, 'error'); return; }
  document.getElementById('item-modal').classList.add('hidden');
  await loadItems(selectedCatId);
  showToast('Item saved', 'success');
});

async function deleteItem(id) {
  if (!confirm('Remove this item?')) return;
  const res = await window.api.deleteItem(id);
  if (!res.success) { showToast(res.error, 'error'); return; }
  await loadItems(selectedCatId);
  showToast('Item removed', 'success');
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

init();
