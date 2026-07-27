(() => {
  const DEFAULTS = Object.freeze({
    enabled: true,
    dwellMs: 1200,
    scrollIdleMs: 380,
    overlayOpacity: 0.58,
    dimTint: "#000000",
    edgeFeather: 0,
    solidDim: false,
    focusMode: "block",
    paddingX: 24,
    paddingY: 20,
    cornerRadius: 12,
    transitionMs: 170,
    stationaryTolerance: 10,
    revealBuffer: 44,
    readingBandY: 0.42,
    hideGraceMs: 45,
    actionLockMs: 700,
    pointerPriorityMs: 220,
    refocusCooldownMs: 5000,
    autoOnScroll: true,
    autoOnHover: true,
    showOutline: true,
    siteOverrides: {},
    appAutoSuppress: true,
    debug: false,
  });

  const LEGACY_STORAGE_KEYS = Object.freeze([
    "blur" + "Px",
    "center" + "Bias",
    "ignore" + "Domains",
  ]);
  const MAX_SITE_OVERRIDES = 120;

  function normalizeHost(value) {
    return String(value || "")
      .trim()
      .replace(/^www\./, "");
  }

  function normalizeSiteMode(mode) {
    return ["auto", "manual", "off"].includes(mode) ? mode : null;
  }

  function normalizeSiteOverrides(value) {
    const output = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return output;
    }

    for (const [rawHost, rawMode] of Object.entries(value).slice(-MAX_SITE_OVERRIDES)) {
      const host = normalizeHost(rawHost);
      const mode = normalizeSiteMode(rawMode);
      if (host && mode && mode !== "auto") output[host] = mode;
    }
    return output;
  }

  function legacyIgnoreOverrides(value) {
    const output = {};
    if (!Array.isArray(value)) return output;
    for (const entry of value) {
      const host = normalizeHost(entry);
      if (host) output[host] = "off";
    }
    return output;
  }

  function normalizeSettings(items = {}) {
    const settings = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) {
      if (key === "siteOverrides") continue;
      if (Object.hasOwn(items, key)) settings[key] = items[key];
    }
    settings.siteOverrides = {
      ...normalizeSiteOverrides(items.siteOverrides),
      ...legacyIgnoreOverrides(items[LEGACY_STORAGE_KEYS[2]]),
    };
    return settings;
  }

  function storageMigrationPatch(items = {}) {
    const migratedOverrides = {
      ...normalizeSiteOverrides(items.siteOverrides),
      ...legacyIgnoreOverrides(items[LEGACY_STORAGE_KEYS[2]]),
    };
    const set = {};
    if (
      Object.keys(migratedOverrides).length ||
      JSON.stringify(migratedOverrides) !==
        JSON.stringify(normalizeSiteOverrides(items.siteOverrides))
    ) {
      set.siteOverrides = migratedOverrides;
    }

    const remove = LEGACY_STORAGE_KEYS.filter((key) =>
      Object.hasOwn(items, key),
    );
    return { set, remove };
  }

  function badgeForState(state) {
    if (!state) return { text: "", color: "#5b8def" };
    if (state.autoBlockedReason === "disabled") return { text: "OFF", color: "#9aa0a6" };
    if (state.pausedForTab) return { text: "II", color: "#f5a623" };
    if (state.siteMode === "off") return { text: "OFF", color: "#9aa0a6" };
    if (state.siteMode === "manual") return { text: "M", color: "#5b8def" };
    return { text: "", color: "#5b8def" };
  }

  globalThis.UMBRA_DEFAULTS = DEFAULTS;
  globalThis.UMBRA_LEGACY_STORAGE_KEYS = LEGACY_STORAGE_KEYS;
  globalThis.UMBRA_MAX_SITE_OVERRIDES = MAX_SITE_OVERRIDES;
  globalThis.UMBRA_NORMALIZE_SETTINGS = normalizeSettings;
  globalThis.UMBRA_STORAGE_MIGRATION = storageMigrationPatch;
  globalThis.UMBRA_NORMALIZE_HOST = normalizeHost;
  globalThis.UMBRA_BADGE_FOR_STATE = badgeForState;
})();
