chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({
    enabled: true,
    dwellMs: 2200,
    overlayOpacity: 0.68,
    paddingX: 22,
    paddingY: 18,
    cornerRadius: 18,
    transitionMs: 280,
    minWidth: 280,
    minHeight: 120,
    stationaryTolerance: 10,
    revealOnMoveDistance: 36,
    debug: false
  }, (items) => {
    chrome.storage.sync.set(items);
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-extension') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'RS_TOGGLE_TAB_PAUSE' });
});
