import "./defaults.js";

async function migrateStoredSettings() {
  const items = await chrome.storage.sync.get(null);
  const migration = globalThis.UMBRA_STORAGE_MIGRATION(items || {});
  if (Object.keys(migration.set).length) {
    await chrome.storage.sync.set(migration.set);
  }
  if (migration.remove.length) {
    await chrome.storage.sync.remove(migration.remove);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  migrateStoredSettings();
});

chrome.runtime.onStartup?.addListener(() => {
  migrateStoredSettings();
});

const badgeForState = globalThis.UMBRA_BADGE_FOR_STATE;
const PAUSED_TABS_KEY = "pausedTabIds";

async function pausedTabIds() {
  const session = chrome.storage.session;
  if (!session) return [];
  const stored = await session.get(PAUSED_TABS_KEY);
  return Array.isArray(stored[PAUSED_TABS_KEY])
    ? stored[PAUSED_TABS_KEY].filter(Number.isInteger)
    : [];
}

async function setTabPaused(tabId, paused) {
  if (!chrome.storage.session || typeof tabId !== "number") return;
  const ids = new Set(await pausedTabIds());
  if (paused) ids.add(tabId);
  else ids.delete(tabId);
  await chrome.storage.session.set({ [PAUSED_TABS_KEY]: [...ids] });
}

async function isTabPaused(tabId) {
  return typeof tabId === "number" && (await pausedTabIds()).includes(tabId);
}

// Per-tab toolbar badge so Umbra's current state (off / paused / manual) is
// visible at a glance without opening the popup. Pillar P4 (honest & respectful):
// surface real state, never a label that lies.
function paintBadge(tabId, state) {
  if (typeof tabId !== "number") return;
  const { text, color } = badgeForState(state);
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  if (text)
    chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(() => {});
}

async function refreshBadge(tabId) {
  if (typeof tabId !== "number") return;
  try {
    const state = await chrome.tabs.sendMessage(tabId, {
      type: "UMBRA_GET_STATE",
    });
    paintBadge(tabId, state || null);
  } catch {
    // No content script on this tab (chrome://, store pages, pre-injection): clear it.
    paintBadge(tabId, null);
  }
}

async function refreshActiveTabBadge() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await refreshBadge(tab.id);
}

chrome.tabs.onActivated.addListener(({ tabId }) => refreshBadge(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") refreshBadge(tabId);
});
chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === "sync") refreshActiveTabBadge();
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "UMBRA_GET_TAB_PAUSE" && sender.tab?.id) {
    isTabPaused(sender.tab.id)
      .then((pausedForTab) => sendResponse({ pausedForTab }))
      .catch(() => sendResponse({ pausedForTab: false }));
    return true;
  }
  if (message?.type === "UMBRA_STATE_PUSH" && sender.tab?.id) {
    setTabPaused(sender.tab.id, !!message.state?.pausedForTab).catch(() => {});
    paintBadge(sender.tab.id, message.state || null);
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  setTabPaused(tabId, false).catch(() => {});
});

async function withActiveTab(fn) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await fn(tab);
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-tab-pause") {
    await withActiveTab((tab) =>
      chrome.tabs.sendMessage(tab.id, { type: "UMBRA_TOGGLE_TAB_PAUSE" }),
    );
  }
  if (command === "focus-now") {
    await withActiveTab((tab) =>
      chrome.tabs.sendMessage(tab.id, { type: "UMBRA_FOCUS_NOW" }),
    );
  }
});
