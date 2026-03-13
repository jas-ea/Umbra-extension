const DEFAULTS = {
  enabled: true,
  dwellMs: 1800,
  scrollIdleMs: 300,
  overlayOpacity: 0.62,
  blurPx: 2,
  paddingX: 24,
  paddingY: 20,
  cornerRadius: 24,
  transitionMs: 320,
  stationaryTolerance: 10,
  revealBuffer: 48,
  centerBias: 0.38,
  autoOnScroll: true,
  autoOnHover: true,
  showOutline: true,
  ignoreDomains: [],
  debug: false
};

const FIELDS = [
  'enabled', 'dwellMs', 'scrollIdleMs', 'overlayOpacity', 'blurPx', 'paddingX', 'paddingY', 'cornerRadius',
  'transitionMs', 'stationaryTolerance', 'revealBuffer', 'centerBias', 'autoOnScroll', 'autoOnHover',
  'showOutline', 'debug'
];

const $ = (id) => document.getElementById(id);

function setStatus(text) {
  $('status').textContent = text;
  clearTimeout(window.__statusTimer);
  window.__statusTimer = setTimeout(() => $('status').textContent = '', 1800);
}

function fillForm(data) {
  for (const key of FIELDS) {
    const el = $(key);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!data[key];
    else el.value = data[key];
  }
  $('ignoreDomains').value = (data.ignoreDomains || []).join('\n');
}

function readForm() {
  const out = {};
  for (const key of FIELDS) {
    const el = $(key);
    if (!el) continue;
    out[key] = el.type === 'checkbox' ? el.checked : Number(el.value);
  }
  out.ignoreDomains = $('ignoreDomains').value.split('\n').map((v) => v.trim()).filter(Boolean);
  return out;
}

document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.sync.get(DEFAULTS);
  fillForm(data);

  $('save').addEventListener('click', async () => {
    await chrome.storage.sync.set(readForm());
    setStatus('Saved');
  });

  $('reset').addEventListener('click', async () => {
    fillForm(DEFAULTS);
    await chrome.storage.sync.set(DEFAULTS);
    setStatus('Reset to defaults');
  });
});
