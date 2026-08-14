const normalizeSettings = globalThis.UMBRA_NORMALIZE_SETTINGS;
const $ = (id) => document.getElementById(id);

let popupTab = null;
let popupSettings = null;
let popupState = null;
let popupHostname = "Current page";
let darknessSaveTimer = null;

function storageSet(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(items, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

function tabHostname(tab) {
  try {
    return new URL(tab?.url || "").hostname || "Current page";
  } catch (_) {
    return "Current page";
  }
}

function normalizeHost(hostname) {
  return String(hostname || "").replace(/^www\./, "");
}

function canInjectInto(tab) {
  return (
    /^https?:\/\//.test(tab?.url || "") || /^file:\/\//.test(tab?.url || "")
  );
}

async function injectUmbra(tab) {
  if (!tab?.id || !canInjectInto(tab) || !chrome.scripting?.executeScript)
    return false;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [
        "defaults.js",
        "site-profiles.js",
        "focus-policy.js",
        "content.js",
      ],
    });
    return true;
  } catch (_) {
    return false;
  }
}

async function sendOnce(tab, message) {
  if (!tab?.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (_) {
    return null;
  }
}

async function sendToTab(message, options = {}) {
  const tab = options.tab || (await getActiveTab());
  let response = await sendOnce(tab, message);
  if (response !== null) return response;
  if (options.inject === false || !(await injectUmbra(tab))) return null;

  for (const delay of [35, 80, 160, 260]) {
    await wait(delay);
    response = await sendOnce(tab, message);
    if (response !== null) return response;
  }
  return null;
}

async function setSiteMode(hostname, mode) {
  const host = normalizeHost(hostname);
  if (!host || host === "Current page") return;
  const settings = normalizeSettings(await chrome.storage.sync.get(null));
  const overrides = { ...(settings.siteOverrides || {}) };
  if (!mode || mode === "auto") delete overrides[host];
  else overrides[host] = mode;
  const entries = Object.entries(overrides).slice(
    -(globalThis.UMBRA_MAX_SITE_OVERRIDES || 120),
  );
  await storageSet({ siteOverrides: Object.fromEntries(entries) });
}

function currentMode() {
  return (
    popupState?.siteMode ||
    popupSettings?.siteOverrides?.[normalizeHost(popupHostname)] ||
    "auto"
  );
}

function setStatus(text, tone) {
  $("siteState").textContent = text;
  $("statusDot").className = `status-dot ${tone || ""}`.trim();
}

function setPrimary(label, action, disabled = false) {
  $("primaryAction").textContent = label;
  $("primaryAction").dataset.action = action || "";
  $("primaryAction").disabled = disabled;
}

function paintPopup() {
  const restricted = !canInjectInto(popupTab);
  const mode = currentMode();
  const enabled = !!popupSettings?.enabled;

  $("hostname").textContent = popupHostname;
  $("enabledToggle").checked = enabled;
  const darkness = Math.min(
    0.9,
    Math.max(0.45, Number(popupSettings?.overlayOpacity) || 0.74),
  );
  $("darknessSlider").value = String(darkness);
  $("darknessValue").textContent = `${Math.round(darkness * 100)}%`;
  $("darknessSlider").disabled = restricted || !enabled;
  $("siteModeSelect").value = mode;
  $("siteModeSelect").disabled = restricted;
  $("pauseTab").disabled = restricted || !enabled || mode === "off";
  $("pauseTab").textContent = popupState?.pausedForTab
    ? "Resume tab"
    : "Pause tab";

  if (restricted) {
    setStatus("Umbra can't run on this page", "off");
    setPrimary("Unavailable here", "", true);
    return;
  }
  if (!popupState) {
    setStatus("Umbra couldn't start here", "off");
    setPrimary("Try again", "retry");
    return;
  }
  if (!enabled) {
    setStatus("Umbra is off", "off");
    setPrimary("Umbra is off", "", true);
    return;
  }
  if (mode === "off") {
    setStatus("Off on this site", "off");
    setPrimary("Turn on here", "turn-on");
    return;
  }
  if (popupState.pausedForTab) {
    setStatus("Paused on this tab", "paused");
    setPrimary("Resume", "resume");
    return;
  }
  if (popupState.pinned) {
    setStatus("Area selected", "active");
    setPrimary("Clear focus", "clear");
    return;
  }
  if (mode === "manual") {
    setStatus("On request for this site", "active");
  } else {
    setStatus("Automatic on this site", "active");
  }
  setPrimary("Choose an area", "choose");
}

async function refreshPopup({ inject = true } = {}) {
  popupSettings = normalizeSettings(await chrome.storage.sync.get(null));
  popupState = await sendToTab(
    { type: "UMBRA_GET_STATE" },
    { tab: popupTab, inject },
  );
  popupHostname = popupState?.hostname || tabHostname(popupTab);
  paintPopup();
}

async function togglePause() {
  const response = await sendToTab(
    { type: "UMBRA_TOGGLE_TAB_PAUSE" },
    { tab: popupTab },
  );
  if (!response) {
    popupState = null;
  } else {
    popupState = { ...popupState, pausedForTab: !!response.pausedForTab };
  }
  paintPopup();
}

async function runPrimaryAction() {
  const action = $("primaryAction").dataset.action;
  if (action === "retry") {
    setPrimary("Getting ready", "", true);
    await refreshPopup({ inject: true });
    return;
  }
  if (action === "resume") {
    await togglePause();
    return;
  }
  if (action === "turn-on") {
    await setSiteMode(popupHostname, "auto");
    popupState = { ...popupState, siteMode: "auto", autoBlockedReason: null };
    await refreshPopup({ inject: false });
    return;
  }
  if (action === "clear") {
    const response = await sendToTab(
      { type: "UMBRA_CLEAR_FOCUS" },
      { tab: popupTab },
    );
    if (response?.ok) popupState = { ...popupState, pinned: false };
    paintPopup();
    return;
  }
  if (action === "choose") {
    const response = await sendToTab(
      { type: "UMBRA_BEGIN_PICK" },
      { tab: popupTab },
    );
    if (response?.ok) window.close();
    else await refreshPopup({ inject: false });
  }
}

async function initPopup() {
  popupTab = await getActiveTab();
  popupHostname = tabHostname(popupTab);
  await refreshPopup();

  $("enabledToggle").addEventListener("change", async () => {
    const enabled = $("enabledToggle").checked;
    await storageSet({ enabled });
    popupSettings = { ...popupSettings, enabled };
    await refreshPopup({ inject: false });
  });

  const saveDarkness = async () => {
    clearTimeout(darknessSaveTimer);
    const overlayOpacity = Number($("darknessSlider").value);
    await storageSet({ overlayOpacity, solidDim: false });
    popupSettings = { ...popupSettings, overlayOpacity, solidDim: false };
  };

  $("darknessSlider").addEventListener("input", () => {
    const value = Number($("darknessSlider").value);
    $("darknessValue").textContent = `${Math.round(value * 100)}%`;
    clearTimeout(darknessSaveTimer);
    darknessSaveTimer = setTimeout(() => {
      saveDarkness().catch(() => refreshPopup({ inject: false }));
    }, 140);
  });
  $("darknessSlider").addEventListener("change", () => {
    saveDarkness().catch(() => refreshPopup({ inject: false }));
  });

  $("siteModeSelect").addEventListener("change", async () => {
    const mode = $("siteModeSelect").value;
    await setSiteMode(popupHostname, mode);
    popupState = {
      ...popupState,
      siteMode: mode,
      autoBlockedReason:
        mode === "off" ? "site-off" : mode === "manual" ? "site-manual" : null,
    };
    paintPopup();
  });

  $("primaryAction").addEventListener("click", () => {
    runPrimaryAction().catch(() => refreshPopup({ inject: false }));
  });
  $("pauseTab").addEventListener("click", () => {
    togglePause().catch(() => refreshPopup({ inject: false }));
  });
  $("openOptions").addEventListener("click", () =>
    chrome.runtime.openOptionsPage(),
  );
}

document.addEventListener("DOMContentLoaded", () => {
  initPopup().catch(() => {
    popupSettings = normalizeSettings({ enabled: true });
    popupState = null;
    paintPopup();
  });
});
