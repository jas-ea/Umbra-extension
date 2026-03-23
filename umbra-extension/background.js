const DEFAULTS = {
  enabled: true,
  dwellMs: 1200,
  scrollIdleMs: 380,
  overlayOpacity: 0.58,
  blurPx: 2,
  paddingX: 24,
  paddingY: 20,
  cornerRadius: 18,
  transitionMs: 170,
  stationaryTolerance: 10,
  revealBuffer: 44,
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
