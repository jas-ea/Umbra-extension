const DEFAULTS = {
  enabled: true,
  dwellMs: 2200,
  overlayOpacity: 0.88
};

function getActiveTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => tab);
}

async function sendToTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    return null;
  }
}

function fmtMs(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const enabledToggle = document.getElementById('enabledToggle');
  const dwellMs = document.getElementById('dwellMs');
  const dwellMsValue = document.getElementById('dwellMsValue');
  const overlayOpacity = document.getElementById('overlayOpacity');
  const overlayOpacityValue = document.getElementById('overlayOpacityValue');
  const pauseTab = document.getElementById('pauseTab');
  const focusNow = document.getElementById('focusNow');
  const openOptions = document.getElementById('openOptions');

  const settings = await chrome.storage.sync.get(DEFAULTS);
  enabledToggle.checked = settings.enabled;
  dwellMs.value = settings.dwellMs;
  overlayOpacity.value = settings.overlayOpacity;
  dwellMsValue.textContent = fmtMs(Number(settings.dwellMs));
  overlayOpacityValue.textContent = `${Math.round(Number(settings.overlayOpacity) * 100)}%`;

  enabledToggle.addEventListener('change', async () => {
    await chrome.storage.sync.set({ enabled: enabledToggle.checked });
  });

  dwellMs.addEventListener('input', async () => {
    const val = Number(dwellMs.value);
    dwellMsValue.textContent = fmtMs(val);
    await chrome.storage.sync.set({ dwellMs: val });
  });

  overlayOpacity.addEventListener('input', async () => {
    const val = Number(overlayOpacity.value);
    overlayOpacityValue.textContent = `${Math.round(val * 100)}%`;
    await chrome.storage.sync.set({ overlayOpacity: val });
  });

  pauseTab.addEventListener('click', async () => {
    const res = await sendToTab({ type: 'RS_TOGGLE_TAB_PAUSE' });
    pauseTab.textContent = res?.pausedForTab ? 'Resume on this tab' : 'Pause on this tab';
  });

  focusNow.addEventListener('click', async () => {
    await sendToTab({ type: 'RS_FOCUS_NOW' });
    window.close();
  });

  openOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  const state = await sendToTab({ type: 'RS_GET_STATE' });
  if (state?.pausedForTab) {
    pauseTab.textContent = 'Resume on this tab';
  }
});
