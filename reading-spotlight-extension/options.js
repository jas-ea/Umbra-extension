const DEFAULTS = {
  enabled: true,
  dwellMs: 2200,
  overlayOpacity: 0.88,
  paddingX: 22,
  paddingY: 18,
  cornerRadius: 18,
  transitionMs: 280,
  minWidth: 280,
  minHeight: 120,
  stationaryTolerance: 10,
  revealOnMoveDistance: 36,
  debug: false
};

const FIELDS = [
  'enabled', 'dwellMs', 'overlayOpacity', 'paddingX', 'paddingY', 'cornerRadius',
  'transitionMs', 'minWidth', 'minHeight', 'stationaryTolerance',
  'revealOnMoveDistance', 'debug'
];

function setStatus(msg) {
  const status = document.getElementById('status');
  status.textContent = msg;
  clearTimeout(window.__statusTimer);
  window.__statusTimer = setTimeout(() => status.textContent = '', 1600);
}

function fillForm(data) {
  for (const key of FIELDS) {
    const el = document.getElementById(key);
    if (!el) continue;
    if (el.type === 'checkbox') {
      el.checked = Boolean(data[key]);
    } else {
      el.value = data[key];
    }
  }
}

function readForm() {
  const out = {};
  for (const key of FIELDS) {
    const el = document.getElementById(key);
    if (!el) continue;
    out[key] = el.type === 'checkbox' ? el.checked : Number(el.value);
  }
  return out;
}

document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.sync.get(DEFAULTS);
  fillForm(data);

  document.getElementById('save').addEventListener('click', async () => {
    await chrome.storage.sync.set(readForm());
    setStatus('Saved');
  });

  document.getElementById('reset').addEventListener('click', async () => {
    fillForm(DEFAULTS);
    await chrome.storage.sync.set(DEFAULTS);
    setStatus('Reset to defaults');
  });
});
