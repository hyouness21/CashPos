'use strict';

document.getElementById('btn-back').addEventListener('click', () => window.api.navigate('admin-hub'));
document.getElementById('btn-refresh').addEventListener('click', loadAll);

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

document.getElementById('btn-item-filter').addEventListener('click', loadItemProfit);
document.getElementById('btn-daily-filter').addEventListener('click', loadDaily);
document.getElementById('btn-monthly-filter').addEventListener('click', loadMonthly);

async function init() {
  document.getElementById('monthly-year').value = new Date().getFullYear();
  await loadAll();
}

async function loadAll() {
  await Promise.all([loadSummary(), loadItemProfit(), loadDaily(), loadMonthly()]);
}

async function loadSummary() {
  const res = await window.api.getProfitSummary();
  if (!res.success) return;
  const d = res.data;
  document.getElementById('stat-revenue').textContent = `$${d.revenue.toFixed(2)}`;
  document.getElementById('stat-stock').textContent   = `$${d.stock_spend.toFixed(2)}`;
  document.getElementById('stat-profit').textContent  = `$${d.gross_profit.toFixed(2)}`;
  document.getElementById('stat-orders').textContent  = d.order_count;
}

async function loadItemProfit() {
  const from = document.getElementById('item-from').value || undefined;
  const to   = document.getElementById('item-to').value   || undefined;
  const res  = await window.api.getItemProfit(from || to ? { from, to } : {});
  const rows = res.success ? res.data : [];
  const maxProfit = Math.max(...rows.map(r => r.profit || 0), 1);

  const tbody = document.getElementById('items-tbody');
  tbody.innerHTML = '';
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">No sales data</td></tr>';
    return;
  }

  for (const r of rows) {
    const margin = r.revenue > 0 ? ((r.profit / r.revenue) * 100).toFixed(1) : '0.0';
    const barW   = Math.round((r.profit / maxProfit) * 120);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(r.label)}</td>
      <td>${r.total_sold}</td>
      <td>$${r.revenue.toFixed(2)}</td>
      <td>$${r.cogs.toFixed(2)}</td>
      <td style="color:var(--success);font-weight:700">$${r.profit.toFixed(2)}</td>
      <td>${margin}%</td>
      <td><div class="bar-cell"><div class="profit-bar" style="width:${barW}px"></div></div></td>
    `;
    tbody.appendChild(tr);
  }
}

async function loadDaily() {
  const from = document.getElementById('daily-from').value || undefined;
  const to   = document.getElementById('daily-to').value   || undefined;
  const res  = await window.api.getDailyTotals(from || to ? { from, to } : {});
  const rows = res.success ? res.data : [];

  const tbody = document.getElementById('daily-tbody');
  tbody.innerHTML = '';
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:32px">No data</td></tr>';
    return;
  }
  for (const r of rows) {
    const profitColor = r.profit >= 0 ? 'var(--success)' : 'var(--danger)';
    tbody.innerHTML += `
      <tr>
        <td>${r.day}</td>
        <td style="color:var(--accent)">$${r.revenue.toFixed(2)}</td>
        <td>$${r.stock_spend.toFixed(2)}</td>
        <td style="color:${profitColor};font-weight:700">$${r.profit.toFixed(2)}</td>
      </tr>
    `;
  }
}

async function loadMonthly() {
  const year = document.getElementById('monthly-year').value || undefined;
  const res  = await window.api.getMonthlyTotals(year ? { year: parseInt(year) } : {});
  const rows = res.success ? res.data : [];

  const tbody = document.getElementById('monthly-tbody');
  tbody.innerHTML = '';
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:32px">No data</td></tr>';
    return;
  }
  for (const r of rows) {
    const profitColor = r.profit >= 0 ? 'var(--success)' : 'var(--danger)';
    const [yr, mo] = r.month.split('-');
    const monthName = new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    tbody.innerHTML += `
      <tr>
        <td>${monthName}</td>
        <td style="color:var(--accent)">$${r.revenue.toFixed(2)}</td>
        <td>$${r.stock_spend.toFixed(2)}</td>
        <td style="color:${profitColor};font-weight:700">$${r.profit.toFixed(2)}</td>
      </tr>
    `;
  }
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

init();
