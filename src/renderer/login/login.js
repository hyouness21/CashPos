'use strict';

let pinValue = '';

function updateDots() {
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
    updateDots();
    document.getElementById('error-msg').textContent = '';
    return;
  }

  if (pinValue.length >= 4) return;
  pinValue += k;
  updateDots();

  if (pinValue.length === 4) {
    const res = await window.api.login(pinValue);
    if (res.success) {
      await window.api.navigate('tables');
    } else {
      document.getElementById('error-msg').textContent = 'Wrong PIN. Try again.';
      pinValue = '';
      updateDots();
    }
  }
});
