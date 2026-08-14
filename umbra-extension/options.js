const FIELDS = ["showOutline"];
const settingsDefaults = globalThis.UMBRA_DEFAULTS;
const normalizeSettings = globalThis.UMBRA_NORMALIZE_SETTINGS;
const $ = (id) => document.getElementById(id);

let currentSettings = null;

function storageSet(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(items, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

function storageClear() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.clear(() => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

function setStatus(text, tone = "saved") {
  $("status").textContent = text;
  $("status").dataset.tone = tone;
  clearTimeout(window.__statusTimer);
  window.__statusTimer = setTimeout(() => {
    $("status").textContent = "";
    delete $("status").dataset.tone;
  }, 1800);
}

function modeLabel(mode) {
  return mode === "manual" ? "On request" : "Off";
}

function renderSites(overrides = {}) {
  const entries = Object.entries(overrides).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  $("siteCount").textContent = entries.length ? String(entries.length) : "";
  $("siteOverrides").replaceChildren();

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No site-specific changes";
    $("siteOverrides").append(empty);
    return;
  }

  for (const [host, mode] of entries) {
    const row = document.createElement("div");
    row.className = "site-row";

    const site = document.createElement("span");
    site.className = "site-host";
    site.textContent = host;

    const state = document.createElement("span");
    state.className = "site-mode";
    state.textContent = modeLabel(mode);

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "reset-site";
    reset.dataset.host = host;
    reset.textContent = "Use default";
    reset.setAttribute("aria-label", `Use the default behavior on ${host}`);

    row.append(site, state, reset);
    $("siteOverrides").append(row);
  }
}

function fillForm(data) {
  currentSettings = data;
  $("automaticFocus").checked = !!(data.autoOnHover || data.autoOnScroll);
  for (const key of FIELDS) $(key).checked = !!data[key];
  renderSites(data.siteOverrides);
}

async function save(items) {
  await storageSet(items);
  currentSettings = normalizeSettings({ ...currentSettings, ...items });
  setStatus("Saved");
}

document.addEventListener("DOMContentLoaded", async () => {
  fillForm(normalizeSettings(await chrome.storage.sync.get(null)));

  $("automaticFocus").addEventListener("change", async () => {
    const enabled = $("automaticFocus").checked;
    try {
      await save({ autoOnHover: enabled, autoOnScroll: enabled });
    } catch (error) {
      fillForm(currentSettings);
      setStatus(error.message || "Save failed", "error");
    }
  });

  $("showOutline").addEventListener("change", async () => {
    try {
      await save({ showOutline: $("showOutline").checked });
    } catch (error) {
      fillForm(currentSettings);
      setStatus(error.message || "Save failed", "error");
    }
  });

  $("siteOverrides").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-host]");
    if (!button) return;
    const siteOverrides = { ...(currentSettings.siteOverrides || {}) };
    delete siteOverrides[button.dataset.host];
    try {
      await save({ siteOverrides });
      renderSites(siteOverrides);
    } catch (error) {
      setStatus(error.message || "Save failed", "error");
    }
  });

  $("shortcuts").addEventListener("click", () => {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });

  $("reset").addEventListener("click", async () => {
    if (!confirm("Restore all Umbra settings to their defaults?")) return;
    try {
      await storageClear();
      await storageSet(settingsDefaults);
      fillForm(settingsDefaults);
      setStatus("Defaults restored");
    } catch (error) {
      setStatus(error.message || "Reset failed", "error");
    }
  });
});
