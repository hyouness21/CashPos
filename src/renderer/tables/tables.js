'use strict';

let tables   = [];
let occupied = {};

async function init() {
  await refresh();
}

async function refresh() {
  const [tablesRes, occupiedRes] = await Promise.all([
    window.api.getTables(),
    window.api.getOccupiedTables(),
  ]);

  tables   = tablesRes.success  ? tablesRes.data  : [];
  occupied = occupiedRes.success ? occupiedRes.data : {};
  render();
}

function render() {
  const grid = document.getElementById('tables-grid');
  grid.innerHTML = '';

  if (tables.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🪑</div><div>No tables — add them in Admin → Tables</div></div>';
    return;
  }

  for (const table of tables) {
    const isOccupied = !!occupied[table.id];
    const card = document.createElement('div');
    card.className = `table-card${isOccupied ? ' occupied' : ''}`;
    card.innerHTML = `
      <div class="table-icon">🪑</div>
      <div class="table-name">${esc(table.name)}</div>
      <span class="table-status ${isOccupied ? 'status-occupied' : 'status-free'}">
        ${isOccupied ? 'Has order' : 'Free'}
      </span>
    `;
    card.addEventListener('click', () => openTable(table));
    grid.appendChild(card);
  }
}

async function openTable(table) {
  await window.api.setCurrentTable(table.id, table.name);
  window.api.navigate('cashier');
}

// ── Admin PIN ─────────────────────────────────────────────────────────────────
let pinValue = '';

document.getElementById('btn-admin').addEventListener('click', () => {
  pinValue = '';
  updatePinDots();
  document.getElementById('pin-error').textContent = '';
  document.getElementById('admin-pin-modal').classList.remove('hidden');
});

document.getElementById('pin-cancel').addEventListener('click', () => {
  document.getElementById('admin-pin-modal').classList.add('hidden');
});

document.getElementById('pin-pad').addEventListener('click', async (e) => {
  const key = e.target.closest('.pin-key');
  if (!key) return;
  const k = key.dataset.key;
  if (k === 'del') {
    pinValue = pinValue.slice(0, -1);
    updatePinDots();
  } else if (pinValue.length < 4) {
    pinValue += k;
    updatePinDots();
    if (pinValue.length === 4) {
      const res = await window.api.verifyAdminPin(pinValue);
      if (res.success) {
        document.getElementById('admin-pin-modal').classList.add('hidden');
        window.api.navigate('admin-hub');
      } else {
        document.getElementById('pin-error').textContent = 'Wrong PIN';
        pinValue = '';
        updatePinDots();
      }
    }
  }
});

function updatePinDots() {
  document.querySelectorAll('.pin-dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < pinValue.length);
  });
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

init();
