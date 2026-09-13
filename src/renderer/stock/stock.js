'use strict';

let allItems    = [];
let lbpRate     = 90000;
let costCurrency = 'usd';

document.getElementById('btn-back').addEventListener('click', () => window.api.navigate('admin-hub'));

document.getElementById('cost-cur-usd').addEventListener('click', () => {
  costCurrency = 'usd';
  document.getElementById('cost-cur-usd').classList.add('active');
  document.getElementById('cost-cur-lbp').classList.remove('active');
  document.getElementById('cost-label').textContent = 'Total Cost Paid (USD)';
  document.getElementById('cost-input').placeholder = 'e.g. 12.00';
  document.getElementById('cost-input').step = '0.01';
  updateCostPreview();
});

document.getElementById('cost-cur-lbp').addEventListener('click', () => {
  costCurrency = 'lbp';
  document.getElementById('cost-cur-lbp').classList.add('active');
  document.getElementById('cost-cur-usd').classList.remove('active');
  document.getElementById('cost-label').textContent = 'Total Cost Paid (LL)';
  document.getElementById('cost-input').placeholder = 'e.g. 1,080,000';
  document.getElementById('cost-input').step = '1000';
  updateCostPreview();
});

async function init() {
  const [settingsRes, itemsRes] = await Promise.all([
    window.api.getSettings(),
    window.api.getAllItems(),
  ]);
  if (settingsRes.success && settingsRes.data.usd_to_lbp) {
    lbpRate = parseFloat(settingsRes.data.usd_to_lbp);
  }
  allItems = itemsRes.success ? itemsRes.data : [];

  const itemSelect   = document.getElementById('item-select');
  const filterSelect = document.getElementById('filter-item');

  for (const item of allItems) {
    const opt = new Option(`${item.name} (${item.category_name})`, item.id);
    itemSelect.appendChild(opt.cloneNode(true));
    filterSelect.appendChild(opt);
  }

  await Promise.all([loadHistory(), loadLevels()]);
}

// Show on-hand count when item is selected in the form
document.getElementById('item-select').addEventListener('change', () => {
  const id    = parseInt(document.getElementById('item-select').value);
  const badge = document.getElementById('on-hand-badge');
  const item  = allItems.find(i => i.id === id);
  if (item) {
    const qty = item.stock_qty ?? 0;
    const cls = qty <= 0 ? 'stock-out' : qty <= 5 ? 'stock-low' : 'stock-ok';
    badge.innerHTML = `On hand: <span class="stock-badge ${cls}">${qty} units</span>`;
    badge.style.display = 'block';
    // refresh from DB to get live value
    window.api.getStockLevels().then(r => {
      if (!r.success) return;
      const live = r.data.find(i => i.id === id);
      if (!live) return;
      const c = live.stock_qty <= 0 ? 'stock-out' : live.stock_qty <= 5 ? 'stock-low' : 'stock-ok';
      badge.innerHTML = `On hand: <span class="stock-badge ${c}">${live.stock_qty} units</span>`;
    });
  } else {
    badge.style.display = 'none';
  }
});

// Tab switching
document.getElementById('stock-tabs').addEventListener('click', e => {
  const btn = e.target.closest('.stab');
  if (!btn) return;
  document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const tab = btn.dataset.tab;
  document.getElementById('pane-purchases').style.display = tab === 'purchases' ? '' : 'none';
  document.getElementById('pane-levels').style.display    = tab === 'levels'    ? '' : 'none';
  document.getElementById('filter-item').style.display   = tab === 'purchases' ? '' : 'none';
  if (tab === 'levels') loadLevels();
});

document.getElementById('qty-input').addEventListener('input', updateCostPreview);
document.getElementById('cost-input').addEventListener('input', updateCostPreview);

function updateCostPreview() {
  const qty  = parseFloat(document.getElementById('qty-input').value);
  const cost = parseFloat(document.getElementById('cost-input').value);
  const preview = document.getElementById('cost-preview');
  if (qty > 0 && cost > 0) {
    const costUsd = costCurrency === 'lbp' ? cost / lbpRate : cost;
    const cpuUsd  = costUsd / qty;
    const cpuLbp  = Math.round(cpuUsd * lbpRate);
    document.getElementById('cpu-preview').textContent = `$${cpuUsd.toFixed(4)}`;
    document.getElementById('cpu-preview-lbp').textContent = `(${cpuLbp.toLocaleString()} LL)`;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
}

document.getElementById('btn-log').addEventListener('click', async () => {
  const item_id  = parseInt(document.getElementById('item-select').value);
  const quantity = parseFloat(document.getElementById('qty-input').value);
  const rawCost  = parseFloat(document.getElementById('cost-input').value);
  const total_cost_usd = costCurrency === 'lbp' ? rawCost / lbpRate : rawCost;
  const notes    = document.getElementById('notes-input').value.trim();

  if (!item_id)        { showToast('Select an item', 'error'); return; }
  if (!(quantity > 0)) { showToast('Quantity must be > 0', 'error'); return; }
  if (!(total_cost_usd > 0)) { showToast('Cost must be > 0', 'error'); return; }

  const res = await window.api.addStockPurchase({ item_id, quantity, total_cost_usd, notes });
  if (!res.success) { showToast(res.error, 'error'); return; }

  showToast(`Logged! Cost/unit: $${res.data.cost_per_unit_usd.toFixed(4)}`, 'success');
  document.getElementById('item-select').value = '';
  document.getElementById('qty-input').value = '';
  document.getElementById('cost-input').value = '';
  document.getElementById('notes-input').value = '';
  document.getElementById('cost-preview').style.display = 'none';
  document.getElementById('on-hand-badge').style.display = 'none';
  await Promise.all([loadHistory(), loadLevels()]);
});

document.getElementById('filter-item').addEventListener('change', loadHistory);

async function loadHistory() {
  const item_id = document.getElementById('filter-item').value || undefined;
  const res = await window.api.getStockPurchases(item_id ? { item_id: parseInt(item_id) } : {});
  const purchases = res.success ? res.data : [];

  const tbody = document.getElementById('history-tbody');
  tbody.innerHTML = '';

  if (purchases.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">No purchases recorded yet</td></tr>';
    return;
  }

  for (const p of purchases) {
    const date = new Date(p.purchased_at).toLocaleDateString();
    const time = new Date(p.purchased_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${date} <small style="color:var(--text-muted)">${time}</small></td>
      <td>${esc(p.item_name)}</td>
      <td>${p.quantity}</td>
      <td>$${p.total_cost_usd.toFixed(2)}</td>
      <td style="color:var(--accent);font-weight:700">$${p.cost_per_unit_usd.toFixed(4)}</td>
      <td style="color:var(--text-muted)">${esc(p.notes || '—')}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function loadLevels() {
  const res   = await window.api.getStockLevels();
  const items = res.success ? res.data : [];
  const tbody = document.getElementById('levels-tbody');
  tbody.innerHTML = '';

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:32px">No items</td></tr>';
    return;
  }

  for (const item of items) {
    const qty = item.stock_qty;
    let badge, label;
    if (qty <= 0)  { badge = 'stock-out'; label = 'Out of stock'; }
    else if (qty <= 5) { badge = 'stock-low'; label = 'Low'; }
    else               { badge = 'stock-ok';  label = 'OK'; }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:600">${esc(item.name)}</td>
      <td style="color:var(--text-muted)">${esc(item.category_name)}</td>
      <td style="font-weight:700;font-size:15px">${qty}</td>
      <td><span class="stock-badge ${badge}">${label}</span></td>
    `;
    tbody.appendChild(tr);
  }
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

init();
