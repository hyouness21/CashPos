'use strict';

// Block text selection on non-interactive elements (POS UI shouldn't be selectable)
document.addEventListener('selectstart', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  e.preventDefault();
});

let _timeout;

function showToast(message, type = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `toast-${type} show`;
  clearTimeout(_timeout);
  _timeout = setTimeout(() => { el.className = el.className.replace(' show', ''); }, 2800);
}

window.showToast = showToast;
