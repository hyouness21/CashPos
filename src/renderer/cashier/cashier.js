'use strict';

// ── State ────────────────────────────────────────────────────────────────────
const cartEmptyEl = document.getElementById('cart-empty'); // saved once — innerHTML='' would destroy it otherwise
let cart = [];          // { id, item_id, label, quantity, unit_price_usd, cost_usd, is_resale }
let billedSessionIds = [];
let lbpRate = 90000;
let categories = [];
let activeSessions = [];
let sessionTimerTick;
let currentTableId   = null;
let currentTableName = null;
let currentItems     = [];  // last loaded items list — used to re-render on cart change
let reservedByOthers = {};  // { [itemId]: qty } — units held in other tables' carts
let discountUsd      = 0;

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  const [settingsRes, catRes, tableRes] = await Promise.all([
    window.api.getSettings(),
    window.api.getCategories(),
    window.api.getCurrentTable(),
  ]);

  if (settingsRes.success && settingsRes.data.usd_to_lbp) {
    lbpRate = parseFloat(settingsRes.data.usd_to_lbp);
  }

  if (tableRes.success && tableRes.data && tableRes.data.id !== null) {
    currentTableId   = tableRes.data.id;
    currentTableName = tableRes.data.name;
    document.getElementById('topbar-title').textContent = `Cashier — ${currentTableName}`;
    document.getElementById('table-badge').textContent  = currentTableName;

    const cartRes = await window.api.loadCart(currentTableId);
    if (cartRes.success && cartRes.data) {
      cart             = cartRes.data.items          || [];
      billedSessionIds = cartRes.data.billedSessionIds || [];
      discountUsd      = cartRes.data.discountUsd    || 0;
    }
  }

  if (catRes.success) {
    categories = catRes.data;
    renderCategories();
    if (categories.length > 0) selectCategory(categories[0].id);
  }

  renderCart();
  await refreshSessions();
  startSessionTimer();
}

// ── Stock-exempt categories (never show as OOS) ───────────────────────────────
function isStockExempt(item) {
  const cat = categories.find(c => c.id === item.category_id);
  return cat && cat.name.toLowerCase() === 'shisha';
}

// ── Cart state persistence ────────────────────────────────────────────────────
async function saveCartState() {
  if (currentTableId !== null) {
    await window.api.saveCart(currentTableId, cart, billedSessionIds, discountUsd);
  }
}

// ── Categories ───────────────────────────────────────────────────────────────
function renderCategories() {
  const bar = document.getElementById('cat-bar');
  bar.innerHTML = '';
  for (const cat of categories) {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.textContent = cat.name;
    btn.dataset.id = cat.id;
    btn.addEventListener('click', () => selectCategory(cat.id));
    bar.appendChild(btn);
  }
}

async function refreshReserved() {
  const res = await window.api.getReserved(currentTableId);
  if (res.success) reservedByOthers = res.data;
}

async function selectCategory(catId) {
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.id) === catId);
  });

  const [itemsRes] = await Promise.all([
    window.api.getItems(catId),
    refreshReserved(),
  ]);
  renderItems(itemsRes.success ? itemsRes.data : []);
}

// ── Items grid ───────────────────────────────────────────────────────────────
function renderItems(items) {
  currentItems = items;
  const grid = document.getElementById('items-grid');
  grid.innerHTML = '';

  if (items.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div>No items available</div></div>';
    return;
  }

  for (const item of items) {
    const inCart    = cart.find(r => r.item_id === item.id)?.quantity || 0;
    const othersQty = reservedByOthers[item.id] || 0;
    const remaining = item.stock_qty - othersQty - inCart;
    const exempt    = isStockExempt(item);
    const oos       = !exempt && (item.purchase_count === 0 || remaining <= 0);

    const card = document.createElement('div');
    card.className = oos ? 'item-card item-oos' : 'item-card';
    card.innerHTML = `
      <div class="item-name">${esc(item.name)}</div>
      <div class="item-price">$${item.price_usd.toFixed(2)}</div>
      ${oos ? '<div class="oos-label">Out of Stock</div>' : ''}
    `;
    if (!oos) card.addEventListener('click', () => addToCart(item));
    grid.appendChild(card);
  }
}

// ── Cart ─────────────────────────────────────────────────────────────────────
async function rerenderItems() {
  await refreshReserved();
  renderItems(currentItems);
}

async function addToCart(item) {
  const existing = cart.find(r => r.item_id === item.id);
  if (!isStockExempt(item)) {
    if (item.purchase_count === 0) {
      showToast('Out of stock', 'error');
      return;
    }
    const inCart = existing?.quantity || 0;
    const others = reservedByOthers[item.id] || 0;
    if (inCart + others >= item.stock_qty) {
      showToast('Out of stock', 'error');
      return;
    }
  }
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      id: Date.now(),
      item_id: item.id,
      label: item.name,
      quantity: 1,
      unit_price_usd: item.price_usd,
      cost_usd: item.cost_usd,
      is_resale: item.is_resale,
    });
  }
  renderCart();
  await rerenderItems();
  saveCartState();
}

async function changeQty(cartId, delta) {
  const idx = cart.findIndex(r => r.id === cartId);
  if (idx === -1) return;
  if (delta > 0) {
    const item = currentItems.find(i => i.id === cart[idx].item_id);
    if (item && !isStockExempt(item) && item.purchase_count > 0) {
      const others = reservedByOthers[item.id] || 0;
      if (cart[idx].quantity + others >= item.stock_qty) {
        showToast('Out of stock', 'error');
        return;
      }
    }
  }
  cart[idx].quantity += delta;
  if (cart[idx].quantity <= 0) cart.splice(idx, 1);
  renderCart();
  await rerenderItems();
  saveCartState();
}

async function removeFromCart(cartId) {
  cart = cart.filter(r => r.id !== cartId);
  renderCart();
  await rerenderItems();
  saveCartState();
}

function renderCart() {
  const container  = document.getElementById('cart-items');
  const totalUsdEl = document.getElementById('total-usd');
  const totalLbpEl = document.getElementById('total-lbp');

  if (cart.length === 0 && billedSessionIds.length === 0) {
    container.innerHTML = '';
    container.appendChild(cartEmptyEl);
    cartEmptyEl.style.display = 'flex';
    totalUsdEl.textContent = '$0.00';
    totalLbpEl.textContent = '';
    return;
  }
  if (cartEmptyEl.parentNode) cartEmptyEl.remove();
  container.innerHTML = '';

  let total = 0;

  for (const row of cart) {
    const rowTotal = row.quantity * row.unit_price_usd;
    total += rowTotal;
    const el = cartRowEl(row.id, row.label, `×${row.quantity}`, rowTotal, true);
    container.appendChild(el);
  }

  for (const s of billedSessionIds) {
    total += s.total_usd;
    const el = cartRowEl(`s-${s.id}`, s._label, null, s.total_usd, false);
    container.appendChild(el);
  }

  if (discountUsd > 0) {
    const discRow = document.createElement('div');
    discRow.className = 'cart-row';
    discRow.innerHTML = `
      <div class="cart-row-label" style="color:var(--success);font-weight:600">Discount</div>
      <div class="cart-row-price" style="color:var(--success)">-$${discountUsd.toFixed(2)}</div>
      <span class="cart-remove" id="disc-row-remove">✕</span>
    `;
    discRow.querySelector('#disc-row-remove').addEventListener('click', () => {
      discountUsd = 0;
      renderCart();
      saveCartState();
    });
    container.appendChild(discRow);
    total = Math.max(0, total - discountUsd);
  }

  totalUsdEl.textContent = `$${total.toFixed(2)}`;
  totalLbpEl.textContent = `${Math.round(total * lbpRate).toLocaleString()} LL`;
}

function cartRowEl(id, label, sub, price, hasQtyControls) {
  const row = cart.find(r => r.id === id);
  const div = document.createElement('div');
  div.className = 'cart-row';
  div.innerHTML = `
    <div class="cart-row-label">
      ${esc(label)}
      ${sub ? `<small>${esc(sub)}</small>` : ''}
    </div>
    ${hasQtyControls && row ? `
      <div class="cart-qty-controls">
        <button class="qty-btn" data-action="dec" data-id="${id}">−</button>
        <span class="qty-num">${row.quantity}</span>
        <button class="qty-btn" data-action="inc" data-id="${id}">+</button>
      </div>
    ` : ''}
    <div class="cart-row-price">$${price.toFixed(2)}</div>
    <span class="cart-remove" data-remove="${id}">✕</span>
  `;

  div.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      changeQty(Number(btn.dataset.id), action === 'inc' ? 1 : -1);
    });
  });

  div.querySelectorAll('.cart-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.remove;
      if (key.startsWith('s-')) {
        const sid = parseInt(key.slice(2));
        billedSessionIds = billedSessionIds.filter(s => s.id !== sid);
        renderCart();
        saveCartState();
      } else {
        removeFromCart(Number(key));
      }
    });
  });

  return div;
}

// ── Sessions ─────────────────────────────────────────────────────────────────
async function refreshSessions() {
  const res = await window.api.getActiveSessions();
  activeSessions = res.success ? res.data : [];
  renderSessionBar();
}

const SESSION_ICONS = { playstation: '🎮', private_room: '🚪' };

function renderSessionBar() {
  const bar      = document.getElementById('session-bar');
  const addBtn   = document.getElementById('btn-add-session');
  const checkoutBtn = document.getElementById('btn-checkout');

  bar.querySelectorAll('.session-chip').forEach(c => c.remove());

  for (const s of activeSessions) {
    const icon       = SESSION_ICONS[s.type] || '⏱';
    const label      = s.label || s.type.replace('_', ' ');
    const billingLbl = s.billing_type === 'per_match' ? 'Per match' : `$${s.rate}/hr`;

    const chip = document.createElement('div');
    chip.className = 'session-chip';
    chip.innerHTML = `
      <div class="chip-pulse"></div>
      <div class="chip-body">
        <div class="chip-title">${icon} ${esc(label)}</div>
        <div class="chip-sub">${billingLbl}</div>
      </div>
      <div class="chip-right">
        <span class="session-chip-time" data-started="${s.started_at}">0:00:00</span>
        <span class="chip-cost" data-billing="${s.billing_type}" data-rate="${s.rate}" data-started="${s.started_at}">
          ${s.billing_type === 'per_match' ? '— /match' : '$0.00'}
        </span>
      </div>
    `;
    chip.addEventListener('click', () => openCloseSessionModal(s));
    bar.insertBefore(chip, addBtn);
  }

  // Block checkout while sessions are open
  const hasSessions = activeSessions.length > 0;
  checkoutBtn.disabled = hasSessions;
  checkoutBtn.title    = hasSessions ? 'Close all sessions before checkout' : '';

  updateSessionTimes();
}

function startSessionTimer() {
  clearInterval(sessionTimerTick);
  sessionTimerTick = setInterval(updateSessionTimes, 1000);
}

function updateSessionTimes() {
  document.querySelectorAll('.session-chip-time').forEach(el => {
    const started = new Date(el.dataset.started);
    const elapsed = Math.floor((Date.now() - started) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    el.textContent = `${h}:${pad(m)}:${pad(s)}`;
  });

  document.querySelectorAll('.chip-cost').forEach(el => {
    if (el.dataset.billing !== 'hourly') return;
    const ms    = Date.now() - new Date(el.dataset.started);
    const hours = ms / 3600000;
    const cost  = Math.ceil(hours * 4) / 4 * parseFloat(el.dataset.rate);
    el.textContent = `$${cost.toFixed(2)}`;
  });
}

// ── Close session modal ───────────────────────────────────────────────────────
let closingSession = null;

function openCloseSessionModal(session) {
  closingSession = session;
  const modal = document.getElementById('close-session-modal');
  document.getElementById('close-session-title').textContent = `Close — ${session.label || session.type}`;
  const started = new Date(session.started_at);
  const elapsed = Date.now() - started;
  document.getElementById('close-session-info').textContent =
    `Started: ${started.toLocaleTimeString()}  |  Running: ${msToHm(elapsed)}`;

  const matchField = document.getElementById('match-count-field');
  matchField.style.display = session.billing_type === 'per_match' ? 'flex' : 'none';

  updateCloseSessionTotal();
  modal.classList.remove('hidden');
}

function updateCloseSessionTotal() {
  if (!closingSession) return;
  let total = 0;
  if (closingSession.billing_type === 'per_match') {
    const mc = parseInt(document.getElementById('match-count-input').value) || 0;
    total = mc * closingSession.rate;
  } else {
    const ms = Date.now() - new Date(closingSession.started_at);
    const hours = ms / 3600000;
    total = Math.ceil(hours * 4) / 4 * closingSession.rate;
  }
  document.getElementById('close-session-total').textContent = `$${total.toFixed(2)}`;
}

document.getElementById('match-count-input').addEventListener('input', updateCloseSessionTotal);

document.getElementById('close-session-confirm').addEventListener('click', async () => {
  if (!closingSession) return;
  const matchCount = parseInt(document.getElementById('match-count-input').value) || 0;
  const res = await window.api.closeSession({ id: closingSession.id, match_count: matchCount });
  if (!res.success) { showToast(res.error, 'error'); return; }

  const s = res.data;
  const billing = s.billing_type === 'per_match'
    ? `${s.match_count} match${s.match_count !== 1 ? 'es' : ''}`
    : msToHm(new Date(s.ended_at) - new Date(s.started_at));

  billedSessionIds.push({
    id: s.id,
    total_usd: s.total_usd,
    _label: `${closingSession.label || closingSession.type} — ${billing}`,
  });

  document.getElementById('close-session-modal').classList.add('hidden');
  closingSession = null;

  await refreshSessions();
  renderCart();
  saveCartState();
  showToast('Session closed and added to cart', 'success');
});

document.getElementById('close-session-cancel').addEventListener('click', () => {
  document.getElementById('close-session-modal').classList.add('hidden');
  closingSession = null;
});

// ── Start session modal ───────────────────────────────────────────────────────
let selectedSessionType = 'playstation';
let sessionRateCurrency = 'usd';

document.getElementById('session-cur-usd').addEventListener('click', () => {
  sessionRateCurrency = 'usd';
  document.getElementById('session-cur-usd').classList.add('active');
  document.getElementById('session-cur-lbp').classList.remove('active');
  document.getElementById('session-rate').placeholder = 'e.g. 5';
  document.getElementById('session-rate').step = '0.5';
});

document.getElementById('session-cur-lbp').addEventListener('click', () => {
  sessionRateCurrency = 'lbp';
  document.getElementById('session-cur-lbp').classList.add('active');
  document.getElementById('session-cur-usd').classList.remove('active');
  document.getElementById('session-rate').placeholder = 'e.g. 450000';
  document.getElementById('session-rate').step = '1000';
});

document.querySelectorAll('.session-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.session-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedSessionType = btn.dataset.type;
    const billingSelect = document.getElementById('session-billing');
    if (selectedSessionType === 'private_room') {
      billingSelect.value = 'hourly';
      billingSelect.querySelector('option[value="per_match"]').disabled = true;
    } else {
      billingSelect.querySelector('option[value="per_match"]').disabled = false;
    }
  });
});

document.getElementById('btn-add-session').addEventListener('click', () => {
  document.getElementById('session-label').value = '';
  document.getElementById('session-rate').value = '';
  document.getElementById('session-rate').placeholder = 'e.g. 5';
  document.getElementById('session-rate').step = '0.5';
  document.getElementById('session-billing').value = 'hourly';
  sessionRateCurrency = 'usd';
  document.getElementById('session-cur-usd').classList.add('active');
  document.getElementById('session-cur-lbp').classList.remove('active');
  document.getElementById('session-modal').classList.remove('hidden');
});

document.getElementById('session-cancel').addEventListener('click', () => {
  document.getElementById('session-modal').classList.add('hidden');
});

document.getElementById('session-start').addEventListener('click', async () => {
  const label = document.getElementById('session-label').value.trim();
  const billing_type = document.getElementById('session-billing').value;
  let rate = parseFloat(document.getElementById('session-rate').value);
  if (!rate || rate <= 0) { showToast('Enter a valid rate', 'error'); return; }
  if (sessionRateCurrency === 'lbp') rate = rate / lbpRate;

  const res = await window.api.startSession({ type: selectedSessionType, label, billing_type, rate });
  if (!res.success) { showToast(res.error, 'error'); return; }

  document.getElementById('session-modal').classList.add('hidden');
  await refreshSessions();
  showToast('Session started', 'success');
});

// ── Discount modal ────────────────────────────────────────────────────────────
let discPinValue  = '';
let discCurrency  = 'usd';

function cartGrossTotal() {
  let t = 0;
  for (const r of cart) t += r.quantity * r.unit_price_usd;
  for (const s of billedSessionIds) t += s.total_usd;
  return t;
}

document.getElementById('btn-discount').addEventListener('click', () => {
  if (cart.length === 0 && billedSessionIds.length === 0) {
    showToast('Cart is empty', 'error');
    return;
  }
  discPinValue = '';
  updateDiscPinDots();
  document.getElementById('disc-pin-error').textContent = '';
  document.getElementById('disc-pin-phase').classList.remove('hidden');
  document.getElementById('disc-input-phase').classList.add('hidden');
  document.getElementById('discount-modal').classList.remove('hidden');
});

function updateDiscPinDots() {
  document.querySelectorAll('#disc-pin-dots .pin-dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < discPinValue.length);
  });
}

document.getElementById('disc-pin-pad').addEventListener('click', async (e) => {
  const key = e.target.closest('.pin-key');
  if (!key) return;
  const k = key.dataset.key;
  if (k === 'del') {
    discPinValue = discPinValue.slice(0, -1);
    updateDiscPinDots();
  } else if (discPinValue.length < 4) {
    discPinValue += k;
    updateDiscPinDots();
    if (discPinValue.length === 4) {
      const res = await window.api.verifyAdminPin(discPinValue);
      if (res.success) {
        showDiscountInput();
      } else {
        document.getElementById('disc-pin-error').textContent = 'Wrong PIN';
        discPinValue = '';
        updateDiscPinDots();
      }
    }
  }
});

async function showDiscountInput() {
  const gross = cartGrossTotal();

  // Fetch fresh cost from DB so corrections in Stock page reflect immediately
  let adminCost = 0;
  for (const r of cart) {
    let unitCost = r.cost_usd || 0;
    if (r.item_id) {
      const res = await window.api.getLatestCost(r.item_id);
      if (res && res.success && res.data > 0) unitCost = res.data;
    }
    adminCost += r.quantity * unitCost;
  }

  document.getElementById('disc-order-total').textContent     = `$${gross.toFixed(2)}`;
  document.getElementById('disc-order-total-lbp').textContent = `${Math.round(gross * lbpRate).toLocaleString()} LL`;
  document.getElementById('disc-admin-cost').textContent      = `$${adminCost.toFixed(2)}`;
  document.getElementById('disc-admin-cost-lbp').textContent  = `${Math.round(adminCost * lbpRate).toLocaleString()} LL`;

  discCurrency = 'usd';
  document.getElementById('disc-cur-usd').classList.add('active');
  document.getElementById('disc-cur-lbp').classList.remove('active');
  document.getElementById('disc-amount').placeholder = '0.00';
  document.getElementById('disc-amount').step = '0.5';
  document.getElementById('disc-amount').value = discountUsd > 0 ? discountUsd.toFixed(2) : '';

  document.getElementById('disc-pin-phase').classList.add('hidden');
  document.getElementById('disc-input-phase').classList.remove('hidden');
}

document.getElementById('disc-cur-usd').addEventListener('click', () => {
  discCurrency = 'usd';
  document.getElementById('disc-cur-usd').classList.add('active');
  document.getElementById('disc-cur-lbp').classList.remove('active');
  document.getElementById('disc-amount').placeholder = '0.00';
  document.getElementById('disc-amount').step = '0.5';
});

document.getElementById('disc-cur-lbp').addEventListener('click', () => {
  discCurrency = 'lbp';
  document.getElementById('disc-cur-lbp').classList.add('active');
  document.getElementById('disc-cur-usd').classList.remove('active');
  document.getElementById('disc-amount').placeholder = '0';
  document.getElementById('disc-amount').step = '1000';
});

document.getElementById('disc-apply').addEventListener('click', () => {
  let amount = parseFloat(document.getElementById('disc-amount').value) || 0;
  if (discCurrency === 'lbp') amount = amount / lbpRate;
  discountUsd = Math.min(Math.max(amount, 0), cartGrossTotal());
  document.getElementById('discount-modal').classList.add('hidden');
  renderCart();
  saveCartState();
  if (discountUsd > 0) showToast(`Discount $${discountUsd.toFixed(2)} applied`, 'success');
});

document.getElementById('disc-pin-cancel').addEventListener('click', () => {
  document.getElementById('discount-modal').classList.add('hidden');
});

document.getElementById('disc-input-cancel').addEventListener('click', () => {
  document.getElementById('discount-modal').classList.add('hidden');
});

// ── Admin PIN modal ───────────────────────────────────────────────────────────
let pinValue = '';

function openAdminPin() {
  pinValue = '';
  updatePinDots();
  document.getElementById('pin-error').textContent = '';
  document.getElementById('admin-pin-modal').classList.remove('hidden');
}

function updatePinDots() {
  document.querySelectorAll('.pin-dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < pinValue.length);
  });
}

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

document.getElementById('pin-cancel').addEventListener('click', () => {
  document.getElementById('admin-pin-modal').classList.add('hidden');
});

// ── Checkout / void ───────────────────────────────────────────────────────────
document.getElementById('btn-checkout').addEventListener('click', async () => {
  if (activeSessions.length > 0) {
    showToast('Close all active sessions before checkout', 'error');
    return;
  }
  if (cart.length === 0 && billedSessionIds.length === 0) {
    showToast('Cart is empty', 'error');
    return;
  }

  const items = cart.map(r => ({
    item_id: r.item_id,
    label: r.label,
    quantity: r.quantity,
    unit_price_usd: r.unit_price_usd,
    cost_usd: r.cost_usd,
    is_resale: r.is_resale,
  }));

  const sessions = billedSessionIds.map(s => s.id);

  const res = await window.api.checkout({
    items, sessions,
    table_id: currentTableId, table_name: currentTableName,
    discount_usd: discountUsd,
  });
  if (!res.success) { showToast(res.error, 'error'); return; }

  const total = res.data.total_usd;
  cart = [];
  billedSessionIds = [];
  discountUsd = 0;
  if (currentTableId !== null) await window.api.clearCart(currentTableId);
  showToast(`Order #${res.data.order_id} — $${total.toFixed(2)} — paid!`, 'success');
  setTimeout(() => window.api.navigate('tables'), 900);
});

document.getElementById('btn-void').addEventListener('click', async () => {
  if (cart.length === 0 && billedSessionIds.length === 0 && discountUsd === 0) return;
  if (!confirm('Clear cart?')) return;
  cart = [];
  billedSessionIds = [];
  discountUsd = 0;
  renderCart();
  await rerenderItems();
  saveCartState();
});


// ── Top bar actions ───────────────────────────────────────────────────────────
document.getElementById('btn-admin').addEventListener('click', openAdminPin);
document.getElementById('btn-tables').addEventListener('click', () => window.api.navigate('tables'));

// ── Utils ─────────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }
function esc(str) { return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function msToHm(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
