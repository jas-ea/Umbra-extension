const normalizeSettings = globalThis.UMBRA_NORMALIZE_SETTINGS;
const $ = (id) => document.getElementById(id);

function storageSet(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(items, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
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

function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function normalizeHost(hostname) {
  return String(hostname || '').replace(/^www\./, '');
}

async function setSiteMode(hostname, mode) {
  const host = normalizeHost(hostname);
  const settings = normalizeSettings(await chrome.storage.sync.get(null));
  const overrides = { ...(settings.siteOverrides || {}) };
  if (!mode || mode === 'inherit') delete overrides[host];
  else overrides[host] = mode;
  const entries = Object.entries(overrides).slice(-(globalThis.UMBRA_MAX_SITE_OVERRIDES || 120));
  await storageSet({ siteOverrides: Object.fromEntries(entries) });
  return mode;
}

function paintSiteState(state) {
  const siteState = $('siteState');
  const reason = state?.autoBlockedReason;
  if (state?.pausedForTab) {
    siteState.textContent = 'Paused on this tab';
    siteState.style.background = 'rgba(255,255,255,0.08)';
    siteState.style.color = '#f1f1f7';
    return;
  }
  if (reason === 'site-off') {
    siteState.textContent = 'Off on this site';
    siteState.style.background = 'rgba(255,173,92,0.14)';
    siteState.style.color = '#ffd4a6';
    return;
  }
  if (reason === 'site-manual') {
    siteState.textContent = 'Manual-only here';
    siteState.style.background = 'rgba(159,192,255,0.14)';
    siteState.style.color = '#cfe0ff';
    return;
  }
  if (reason === 'utility-page') {
    siteState.textContent = 'Auto-suppressed on utility page';
    siteState.style.background = 'rgba(255,255,255,0.08)';
    siteState.style.color = '#f1f1f7';
    return;
  }
  siteState.textContent = 'Active';
  siteState.style.background = 'rgba(126, 241, 167, 0.12)';
  siteState.style.color = '#b7f2c9';
}

function paintReloadHint() {
  const siteState = $('siteState');
  siteState.textContent = 'Reload this tab to control Umbra';
  siteState.style.background = 'rgba(255,173,92,0.14)';
  siteState.style.color = '#ffd4a6';
  for (const id of ['focusNow', 'pinNow', 'pauseTab']) {
    $(id).disabled = true;
  }
}

function paintSiteMode(mode) {
  $('siteModeText').textContent = mode === 'off' ? 'Off' : mode === 'manual' ? 'Manual' : 'Auto';
  $('siteModeBadge').textContent = mode === 'off' ? 'Off mode' : mode === 'manual' ? 'Manual mode' : 'Auto mode';
  const helps = {
    auto: 'Auto focuses when Umbra detects reading intent. Best for articles, feeds, and email reading.',
    manual: 'Manual disables auto-focus but still allows Focus now, Pin block, and Shift + Click.',
    off: 'Off disables Umbra entirely on this site. Best for calendars, canvases, and utility apps.'
  };
  $('modeHelp').textContent = helps[mode] || helps.auto;
  ['auto','manual','off'].forEach((key) => {
    const btn = $(`siteMode${key.charAt(0).toUpperCase()}${key.slice(1)}`);
    btn.classList.toggle('active-mode', key === mode);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const settings = normalizeSettings(await chrome.storage.sync.get(null));
  const state = await sendToTab({ type: 'UMBRA_GET_STATE' });
  const tab = await getActiveTab();
  const hostname = state?.hostname || (() => { try { return new URL(tab.url).hostname; } catch { return 'Current page'; } })();

  $('hostname').textContent = hostname;
  $('enabledToggle').checked = !!settings.enabled;
  $('dwellMs').value = Number(settings.dwellMs);
  $('overlayOpacity').value = Number(settings.overlayOpacity);
  $('dwellValue').textContent = formatSeconds(Number(settings.dwellMs));
  $('opacityValue').textContent = `${Math.round(Number(settings.overlayOpacity) * 100)}%`;
  if (state) paintSiteState(state);
  else paintReloadHint();
  const currentSiteMode = state?.siteMode || (settings.siteOverrides || {})[normalizeHost(hostname)] || 'auto';
  paintSiteMode(currentSiteMode);
  $('pauseTab').textContent = state?.pausedForTab ? 'Resume on this tab' : 'Pause on this tab';

  $('enabledToggle').addEventListener('change', async () => {
    await storageSet({ enabled: $('enabledToggle').checked });
  });

  $('dwellMs').addEventListener('input', () => {
    const value = Number($('dwellMs').value);
    $('dwellValue').textContent = formatSeconds(value);
  });
  $('dwellMs').addEventListener('change', async () => {
    await storageSet({ dwellMs: Number($('dwellMs').value) });
  });

  $('overlayOpacity').addEventListener('input', () => {
    const value = Number($('overlayOpacity').value);
    $('opacityValue').textContent = `${Math.round(value * 100)}%`;
  });
  $('overlayOpacity').addEventListener('change', async () => {
    await storageSet({ overlayOpacity: Number($('overlayOpacity').value) });
  });

  $('siteModeAuto').addEventListener('click', async () => {
    await setSiteMode(hostname, 'auto');
    paintSiteMode('auto');
    paintSiteState({ autoBlockedReason: null });
  });
  $('siteModeManual').addEventListener('click', async () => {
    await setSiteMode(hostname, 'manual');
    paintSiteMode('manual');
    paintSiteState({ autoBlockedReason: 'site-manual' });
  });
  $('siteModeOff').addEventListener('click', async () => {
    await setSiteMode(hostname, 'off');
    paintSiteMode('off');
    paintSiteState({ autoBlockedReason: 'site-off' });
  });

  $('focusNow').addEventListener('click', async () => {
    await sendToTab({ type: 'UMBRA_FOCUS_NOW' });
    window.close();
  });

  $('pinNow').addEventListener('click', async () => {
    await sendToTab({ type: 'UMBRA_PIN_NOW' });
    window.close();
  });

  $('pauseTab').addEventListener('click', async () => {
    const response = await sendToTab({ type: 'UMBRA_TOGGLE_TAB_PAUSE' });
    if (!response) {
      paintReloadHint();
      return;
    }
    $('pauseTab').textContent = response?.pausedForTab ? 'Resume on this tab' : 'Pause on this tab';
    paintSiteState({ pausedForTab: !!response?.pausedForTab });
  });

  $('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
});
