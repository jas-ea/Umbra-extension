const DEFAULTS = {
  enabled: true,
  dwellMs: 1800,
  overlayOpacity: 0.62,
  ignoreDomains: [],
  siteOverrides: {}
};

const $ = (id) => document.getElementById(id);

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

async function toggleIgnoreForHost(hostname) {
  const host = normalizeHost(hostname);
  const settings = await chrome.storage.sync.get(DEFAULTS);
  const current = new Set((settings.ignoreDomains || []).map(normalizeHost));
  if (current.has(host)) current.delete(host); else current.add(host);
  await chrome.storage.sync.set({ ignoreDomains: Array.from(current).sort() });
  return current.has(host);
}

async function setSiteMode(hostname, mode) {
  const host = normalizeHost(hostname);
  const settings = await chrome.storage.sync.get(DEFAULTS);
  const overrides = { ...(settings.siteOverrides || {}) };
  if (!mode || mode === 'inherit') delete overrides[host];
  else overrides[host] = mode;
  await chrome.storage.sync.set({ siteOverrides: overrides });
  return mode;
}

function paintSiteState(state) {
  const siteState = $('siteState');
  const reason = state?.autoBlockedReason;
  if (state?.ignored) {
    siteState.textContent = 'Ignored by domain list';
    siteState.style.background = 'rgba(255,173,92,0.14)';
    siteState.style.color = '#ffd4a6';
    return;
  }
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
  const settings = await chrome.storage.sync.get(DEFAULTS);
  const state = await sendToTab({ type: 'UMBRA_GET_STATE' });
  const tab = await getActiveTab();
  const hostname = state?.hostname || (() => { try { return new URL(tab.url).hostname; } catch { return 'Current page'; } })();

  $('hostname').textContent = hostname;
  $('enabledToggle').checked = !!settings.enabled;
  $('dwellMs').value = Number(settings.dwellMs);
  $('overlayOpacity').value = Number(settings.overlayOpacity);
  $('dwellValue').textContent = formatSeconds(Number(settings.dwellMs));
  $('opacityValue').textContent = `${Math.round(Number(settings.overlayOpacity) * 100)}%`;
  paintSiteState(state || { pausedForTab: false, ignored: false });
  const currentSiteMode = state?.siteMode || (settings.siteOverrides || {})[normalizeHost(hostname)] || 'auto';
  paintSiteMode(currentSiteMode);
  $('toggleIgnore').textContent = state?.ignored ? 'Remove from legacy ignore list' : 'Add to legacy ignore list';
  $('pauseTab').textContent = state?.pausedForTab ? 'Resume on this tab' : 'Pause on this tab';

  $('enabledToggle').addEventListener('change', async () => {
    await chrome.storage.sync.set({ enabled: $('enabledToggle').checked });
  });

  $('dwellMs').addEventListener('input', async () => {
    const value = Number($('dwellMs').value);
    $('dwellValue').textContent = formatSeconds(value);
    await chrome.storage.sync.set({ dwellMs: value });
  });

  $('overlayOpacity').addEventListener('input', async () => {
    const value = Number($('overlayOpacity').value);
    $('opacityValue').textContent = `${Math.round(value * 100)}%`;
    await chrome.storage.sync.set({ overlayOpacity: value });
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
    $('pauseTab').textContent = response?.pausedForTab ? 'Resume on this tab' : 'Pause on this tab';
    paintSiteState({ pausedForTab: !!response?.pausedForTab, ignored: false });
  });

  $('toggleIgnore').addEventListener('click', async () => {
    const ignoredNow = await toggleIgnoreForHost(hostname);
    $('toggleIgnore').textContent = ignoredNow ? 'Remove from legacy ignore list' : 'Add to legacy ignore list';
    paintSiteState({ pausedForTab: false, ignored: ignoredNow });
  });

  $('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
});
