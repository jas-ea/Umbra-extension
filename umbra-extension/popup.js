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
  return tab || null;
}

function tabHostname(tab) {
  try {
    return new URL(tab?.url || '').hostname || 'Current page';
  } catch (_) {
    return 'Current page';
  }
}

function normalizeHost(hostname) {
  return String(hostname || '').replace(/^www\./, '');
}

function canInjectInto(tab) {
  return /^https?:\/\//.test(tab?.url || '') || /^file:\/\//.test(tab?.url || '');
}

async function injectUmbra(tab) {
  if (!tab?.id || !canInjectInto(tab) || !chrome.scripting?.executeScript) return false;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['defaults.js', 'site-profiles.js', 'content.js']
    });
    return true;
  } catch (_) {
    return false;
  }
}

async function sendToTab(message, options = {}) {
  const tab = options.tab || (await getActiveTab());
  if (!tab?.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (_) {
    if (options.inject !== false && await injectUmbra(tab)) {
      try {
        return await chrome.tabs.sendMessage(tab.id, message);
      } catch (_) {}
    }
    return null;
  }
}

async function setSiteMode(hostname, mode) {
  const host = normalizeHost(hostname);
  const settings = normalizeSettings(await chrome.storage.sync.get(null));
  const overrides = { ...(settings.siteOverrides || {}) };
  if (!mode || mode === 'auto') delete overrides[host];
  else overrides[host] = mode;
  const entries = Object.entries(overrides).slice(-(globalThis.UMBRA_MAX_SITE_OVERRIDES || 120));
  await storageSet({ siteOverrides: Object.fromEntries(entries) });
  return mode;
}

function setBadgeTone(kind) {
  const siteState = $('siteState');
  siteState.classList.remove('warning', 'info');
  if (kind) siteState.classList.add(kind);
}

function paintActionAvailability(state) {
  const reason = state?.autoBlockedReason;
  const canUsePageActions = !!state && !state.pausedForTab && !['disabled', 'site-off', 'modal-open'].includes(reason);
  $('focusNow').disabled = !canUsePageActions;
  $('pinNow').disabled = !canUsePageActions;
  $('pauseTab').disabled = !state || reason === 'disabled' || reason === 'site-off';
}

function paintSiteState(state, tab) {
  paintActionAvailability(state);
  setBadgeTone(null);
  if (!state) {
    $('siteState').textContent = canInjectInto(tab) ? 'Starting' : 'Unavailable here';
    setBadgeTone('warning');
    return;
  }
  const reason = state.autoBlockedReason;
  if (state.pausedForTab) {
    $('siteState').textContent = 'Paused';
    setBadgeTone('info');
    return;
  }
  if (reason === 'disabled') {
    $('siteState').textContent = 'Disabled';
    setBadgeTone('warning');
    return;
  }
  if (reason === 'site-off') {
    $('siteState').textContent = 'Off here';
    setBadgeTone('warning');
    return;
  }
  if (reason === 'site-manual') {
    $('siteState').textContent = 'Manual';
    setBadgeTone('info');
    return;
  }
  if (reason === 'utility-page') {
    $('siteState').textContent = 'Manual suggested';
    setBadgeTone('info');
    return;
  }
  if (reason === 'modal-open') {
    $('siteState').textContent = 'Modal open';
    setBadgeTone('info');
    return;
  }
  $('siteState').textContent = 'Active';
}

function paintSiteMode(mode) {
  const label = mode === 'off' ? 'Off' : mode === 'manual' ? 'Manual' : 'Auto';
  $('siteModeText').textContent = label;
  $('siteModeBadge').textContent = label;
  ['auto','manual','off'].forEach((key) => {
    const btn = $(`siteMode${key.charAt(0).toUpperCase()}${key.slice(1)}`);
    btn.classList.toggle('active-mode', key === mode);
  });
}

async function initPopup() {
  const settings = normalizeSettings(await chrome.storage.sync.get(null));
  const tab = await getActiveTab();
  const state = await sendToTab({ type: 'UMBRA_GET_STATE' }, { tab });
  const hostname = state?.hostname || tabHostname(tab);
  const currentSiteMode = state?.siteMode || (settings.siteOverrides || {})[normalizeHost(hostname)] || 'auto';

  $('hostname').textContent = hostname;
  $('enabledToggle').checked = !!settings.enabled;
  $('pauseTab').textContent = state?.pausedForTab ? 'Resume tab' : 'Pause tab';
  paintSiteState(state, tab);
  paintSiteMode(currentSiteMode);

  $('enabledToggle').addEventListener('change', async () => {
    await storageSet({ enabled: $('enabledToggle').checked });
    const nextState = await sendToTab({ type: 'UMBRA_GET_STATE' }, { tab });
    paintSiteState(nextState, tab);
  });

  $('siteModeAuto').addEventListener('click', async () => {
    await setSiteMode(hostname, 'auto');
    paintSiteMode('auto');
    paintSiteState(await sendToTab({ type: 'UMBRA_GET_STATE' }, { tab }), tab);
  });
  $('siteModeManual').addEventListener('click', async () => {
    await setSiteMode(hostname, 'manual');
    paintSiteMode('manual');
    paintSiteState({ autoBlockedReason: 'site-manual' }, tab);
  });
  $('siteModeOff').addEventListener('click', async () => {
    await setSiteMode(hostname, 'off');
    paintSiteMode('off');
    paintSiteState({ autoBlockedReason: 'site-off' }, tab);
  });

  $('focusNow').addEventListener('click', async () => {
    const response = await sendToTab({ type: 'UMBRA_FOCUS_NOW' }, { tab });
    if (response) window.close();
    else paintSiteState(null, tab);
  });

  $('pinNow').addEventListener('click', async () => {
    const response = await sendToTab({ type: 'UMBRA_PIN_NOW' }, { tab });
    if (response) window.close();
    else paintSiteState(null, tab);
  });

  $('pauseTab').addEventListener('click', async () => {
    const response = await sendToTab({ type: 'UMBRA_TOGGLE_TAB_PAUSE' }, { tab });
    if (!response) {
      paintSiteState(null, tab);
      return;
    }
    $('pauseTab').textContent = response.pausedForTab ? 'Resume tab' : 'Pause tab';
    paintSiteState({ ...state, pausedForTab: !!response.pausedForTab }, tab);
  });

  $('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
}

document.addEventListener('DOMContentLoaded', () => {
  initPopup().catch(() => {
    paintActionAvailability(null);
    $('siteState').textContent = 'Unavailable here';
    setBadgeTone('warning');
  });
});
