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

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULTS, (items) => chrome.storage.sync.set(items));
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
