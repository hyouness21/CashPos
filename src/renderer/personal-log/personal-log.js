'use strict';

let adminNames = { admin1: 'Admin 1', admin2: 'Admin 2' };
let allItems = [];
let filterAdmin  = 'all';
let filterPeriod = 'day';

document.getElementById('btn-back').addEventListener('click', () => window.api.navigate('admin-hub'));

async function init() {
  const [settingsRes, itemsRes] = await Promise.all([
    window.api.getSettings(),
    window.api.getAllItems(),
  ]);

  if (settingsRes.success) {
    if (settingsRes.data.admin1_name) adminNames.admin1 = settingsRes.data.admin1_name;
    if (settingsRes.data.admin2_name) adminNames.admin2 = settingsRes.data.admin2_name;
    document.querySelector('[data-admin="admin1"]').textContent = adminNames.admin1;
    document.querySelector('[data-admin="admin2"]').textContent = adminNames.admin2;
    document.getElementById('tab-admin1').textContent = adminNames.admin1;
    document.getElementById('tab-admin2').textContent = adminNames.admin2;

    const adminSelect = document.getElementById('admin-select');
    adminSelect.options[0].text = adminNames.admin1;
    adminSelect.options[1].text = adminNames.admin2;
  }

  allItems = itemsRes.success ? itemsRes.data : [];
  const itemSelect = document.getElementById('item-select');
  for (const item of allItems) {
    itemSelect.appendChild(new Option(`${item.name} (${item.category_name})`, item.id));
  }

  document.getElementById('date-filter').value  = todayStr();
  document.getElementById('month-filter').value = todayStr().slice(0, 7);
  await loadLog();
}

// Auto-fill personal price when item changes
document.getElementById('item-select').addEventListener('change', () => {
  const id = parseInt(document.getElementById('item-select').value);
  const item = allItems.find(i => i.id === id);
  if (item) document.getElementById('price-input').value = item.personal_price_usd || item.price_usd || '';
  updateLineTotal();
});
document.getElementById('qty-input').addEventListener('input', updateLineTotal);
document.getElementById('price-input').addEventListener('input', updateLineTotal);

function updateLineTotal() {
  const qty   = parseFloat(document.getElementById('qty-input').value) || 0;
  const price = parseFloat(document.getElementById('price-input').value) || 0;
  const el = document.getElementById('line-total');
  if (qty > 0 && price > 0) {
    el.textContent = `Total: $${(qty * price).toFixed(2)}`;
  } else {
    el.textContent = '';
  }
}

document.getElementById('btn-log').addEventListener('click', async () => {
  const admin_name       = document.getElementById('admin-select').value;
  const item_id          = parseInt(document.getElementById('item-select').value);
  const quantity         = parseFloat(document.getElementById('qty-input').value) || 0;
  const personal_price_usd = parseFloat(document.getElementById('price-input').value) || 0;
  const notes            = document.getElementById('notes-input').value.trim();

  if (!item_id)          { showToast('Select an item', 'error'); return; }
  if (quantity <= 0)     { showToast('Quantity must be > 0', 'error'); return; }
  if (personal_price_usd < 0) { showToast('Price invalid', 'error'); return; }

  const item = allItems.find(i => i.id === item_id);
  const res = await window.api.addPersonalLog({
    admin_name,
    item_id,
    item_name: item ? item.name : '',
    quantity,
    personal_price_usd,
    notes,
  });

  if (!res.success) { showToast(res.error, 'error'); return; }

  showToast('Entry logged', 'success');
  document.getElementById('item-select').value = '';
  document.getElementById('qty-input').value = '1';
  document.getElementById('price-input').value = '';
  document.getElementById('notes-input').value = '';
  document.getElementById('line-total').textContent = '';
  await loadLog();
});

document.getElementById('admin-tabs').addEventListener('click', e => {
  const tab = e.target.closest('.admin-tab');
  if (!tab) return;
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  filterAdmin = tab.dataset.admin;
  loadLog();
});

document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterPeriod = btn.dataset.period;
    document.getElementById('date-filter').style.display  = filterPeriod === 'day'   ? '' : 'none';
    document.getElementById('month-filter').style.display = filterPeriod === 'month' ? '' : 'none';
    loadLog();
  });
});

document.getElementById('btn-filter').addEventListener('click', loadLog);

async function loadLog() {
  const filters = {};
  if (filterAdmin !== 'all') filters.admin_name = filterAdmin;

  let summaryDate = null;

  if (filterPeriod === 'day') {
    const date = document.getElementById('date-filter').value;
    if (date) {
      filters.from = `${date}T00:00:00.000Z`;
      filters.to   = `${date}T23:59:59.999Z`;
      summaryDate  = date;
    }
  } else if (filterPeriod === 'month') {
    const month = document.getElementById('month-filter').value; // "YYYY-MM"
    if (month) {
      const [y, m] = month.split('-').map(Number);
      const last   = new Date(y, m, 0).getDate(); // last day of month
      filters.from = `${month}-01T00:00:00.000Z`;
      filters.to   = `${month}-${String(last).padStart(2,'0')}T23:59:59.999Z`;
    }
  }
  // filterPeriod === 'all' → no date range set

  const logRes = await window.api.getPersonalLog(filters);
  const entries = logRes.success ? logRes.data : [];
  renderLog(entries);
  renderSummary(entries);
}

function renderSummary(entries) {
  const el = document.getElementById('daily-summary');
  el.innerHTML = '';
  if (entries.length === 0) { el.style.display = 'none'; return; }

  // Aggregate per admin
  const byAdmin = {};
  for (const e of entries) {
    if (!byAdmin[e.admin_name]) byAdmin[e.admin_name] = { total: 0, count: 0, unpaid: 0 };
    const rowTotal = e.quantity * e.personal_price_usd;
    byAdmin[e.admin_name].total  += rowTotal;
    byAdmin[e.admin_name].count  += 1;
    if (!e.paid) byAdmin[e.admin_name].unpaid += rowTotal;
  }

  el.style.display = 'flex';
  for (const [adminKey, s] of Object.entries(byAdmin)) {
    const name = adminNames[adminKey] || adminKey;
    el.innerHTML += `
      <div class="daily-card">
        <div class="daily-card-name">${esc(name)}</div>
        <div class="daily-card-value">$${s.total.toFixed(2)}</div>
        <div style="font-size:12px;color:var(--text-muted)">${s.count} entr${s.count !== 1 ? 'ies' : 'y'}</div>
        ${s.unpaid > 0 ? `<div style="font-size:12px;color:var(--warning);font-weight:600;margin-top:4px">$${s.unpaid.toFixed(2)} unpaid</div>` : ''}
      </div>
    `;
  }
}

function renderLog(entries) {
  const tbody = document.getElementById('log-tbody');
  tbody.innerHTML = '';
  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px">No entries</td></tr>';
    return;
  }
  for (const e of entries) {
    const time  = new Date(e.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const total = (e.quantity * e.personal_price_usd).toFixed(2);
    const adminDisplayName = adminNames[e.admin_name] || e.admin_name;

    const tr = document.createElement('tr');
    if (!e.paid) tr.className = 'row-unpaid';
    tr.innerHTML = `
      <td>${time}</td>
      <td>${esc(adminDisplayName)}</td>
      <td>${esc(e.item_name)}</td>
      <td>${e.quantity}</td>
      <td>$${e.personal_price_usd.toFixed(2)}</td>
      <td style="color:var(--accent);font-weight:600">$${total}</td>
      <td style="color:var(--text-muted)">${esc(e.notes || '—')}</td>
      <td></td>
    `;

    const statusCell = tr.querySelector('td:last-child');
    if (e.paid) {
      statusCell.innerHTML = '<span class="badge badge-success">Paid ✓</span>';
    } else {
      statusCell.innerHTML = '<span class="unpaid-badge">⚠ Unpaid</span>';
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary btn-sm';
      btn.textContent = 'Pay';
      btn.addEventListener('click', () => payEntry(e.id, btn));
      statusCell.appendChild(btn);
    }

    tbody.appendChild(tr);
  }
}

async function payEntry(id, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  const res = await window.api.payPersonalLog(id);
  if (!res.success) {
    showToast(res.error, 'error');
    btn.disabled = false;
    btn.textContent = 'Pay';
    return;
  }
  showToast(`Paid — Order #${res.data.order_id}`, 'success');
  await loadLog();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

init();
