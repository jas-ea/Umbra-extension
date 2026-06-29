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

async function withActiveTab(fn) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await fn(tab);
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-tab-pause') {
    await withActiveTab((tab) => chrome.tabs.sendMessage(tab.id, { type: 'UMBRA_TOGGLE_TAB_PAUSE' }));
  }
  if (command === 'focus-now') {
    await withActiveTab((tab) => chrome.tabs.sendMessage(tab.id, { type: 'UMBRA_FOCUS_NOW' }));
  }
});
