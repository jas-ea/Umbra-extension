const FIELDS = [
  "enabled",
  "dwellMs",
  "scrollIdleMs",
  "overlayOpacity",
  "dimTint",
  "edgeFeather",
  "solidDim",
  "focusMode",
  "paddingX",
  "paddingY",
  "cornerRadius",
  "transitionMs",
  "stationaryTolerance",
  "revealBuffer",
  "readingBandY",
  "autoOnScroll",
  "autoOnHover",
  "showOutline",
  "debug",
];

const settingsDefaults = globalThis.UMBRA_DEFAULTS;
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

function storageRemove(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.remove(keys, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

function formatSiteOverrides(overrides = {}) {
  return Object.entries(overrides)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([host, mode]) => `${host}=${mode}`)
    .join("\n");
}

function parseSiteOverrides(value) {
  const overrides = {};
  for (const rawLine of String(value || "").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const [rawHost, rawMode = "off"] = line.split("=").map((part) => part.trim());
    const host = globalThis.UMBRA_NORMALIZE_HOST(rawHost);
    if (host && ["manual", "off"].includes(rawMode)) overrides[host] = rawMode;
  }
  return overrides;
}

function setStatus(text) {
  $("status").textContent = text;
  clearTimeout(window.__statusTimer);
  window.__statusTimer = setTimeout(() => {
    $("status").textContent = "";
  }, 1800);
}

function fillForm(data) {
  for (const key of FIELDS) {
    const el = $(key);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = !!data[key];
    else el.value = data[key];
  }
  $("siteOverrides").value = formatSiteOverrides(data.siteOverrides);
}

function readForm() {
  const out = {};
  for (const key of FIELDS) {
    const el = $(key);
    if (!el) continue;
    if (el.type === "checkbox") out[key] = el.checked;
    else if (el.type === "number" || el.type === "range") out[key] = Number(el.value);
    else out[key] = el.value;
  }
  out.siteOverrides = parseSiteOverrides($("siteOverrides").value);
  return out;
}

document.addEventListener("DOMContentLoaded", async () => {
  const data = normalizeSettings(await chrome.storage.sync.get(null));
  fillForm(data);

  $("save").addEventListener("click", async () => {
    try {
      await storageRemove(globalThis.UMBRA_LEGACY_STORAGE_KEYS);
      await storageSet(readForm());
      setStatus("Saved");
    } catch (error) {
      setStatus(error.message || "Save failed");
    }
  });

  $("reset").addEventListener("click", async () => {
    try {
      fillForm(settingsDefaults);
      await storageRemove(globalThis.UMBRA_LEGACY_STORAGE_KEYS);
      await storageSet(settingsDefaults);
      setStatus("Reset to defaults");
    } catch (error) {
      setStatus(error.message || "Reset failed");
    }
  });
});
