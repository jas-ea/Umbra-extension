(() => {
  const DEFAULTS = Object.freeze({
    enabled: true,
    dwellMs: 1000,
    refocusDwellMs: 1450,
    scrollIdleMs: 650,
    overlayOpacity: 0.74,
    dimTint: "#000000",
    edgeFeather: 0,
    solidDim: false,
    focusMode: "block",
    paddingX: 18,
    paddingY: 14,
    cornerRadius: 10,
    transitionMs: 160,
    stationaryTolerance: 12,
    pointerQuietMs: 240,
    revealBuffer: 44,
    readingBandY: 0.42,
    hideGraceMs: 90,
    noTargetHoldMs: 1800,
    actionLockMs: 1200,
    interactionGraceMs: 700,
    fullscreenExitGraceMs: 1200,
    mediaFocusMs: 180,
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
    "pointer" + "PriorityMs",
    "refocus" + "CooldownMs",
  ]);
  const MAX_SITE_OVERRIDES = 120;
  const VISUAL_DEFAULTS_VERSION = 1;
  const BEHAVIOR_DEFAULTS_VERSION = 1;
  const BEHAVIOR_DEFAULT_KEYS = Object.freeze([
    "dwellMs",
    "refocusDwellMs",
    "scrollIdleMs",
    "stationaryTolerance",
    "pointerQuietMs",
    "noTargetHoldMs",
    "actionLockMs",
    "interactionGraceMs",
    "fullscreenExitGraceMs",
    "mediaFocusMs",
  ]);

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

    for (const [rawHost, rawMode] of Object.entries(value).slice(
      -MAX_SITE_OVERRIDES,
    )) {
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
    const visualDefaultsVersion = Number(items.visualDefaultsVersion);
    if (
      (!Number.isFinite(visualDefaultsVersion) ||
        visualDefaultsVersion < VISUAL_DEFAULTS_VERSION) &&
      Number(items.overlayOpacity) === 0.52
    ) {
      settings.overlayOpacity = DEFAULTS.overlayOpacity;
    }
    const behaviorDefaultsVersion = Number(items.behaviorDefaultsVersion);
    if (
      !Number.isFinite(behaviorDefaultsVersion) ||
      behaviorDefaultsVersion < BEHAVIOR_DEFAULTS_VERSION
    ) {
      for (const key of BEHAVIOR_DEFAULT_KEYS) settings[key] = DEFAULTS[key];
    }
    // Keep normalized settings self-describing so a second normalization pass
    // cannot mistake them for pre-migration storage values.
    settings.visualDefaultsVersion = Math.max(
      VISUAL_DEFAULTS_VERSION,
      Number.isFinite(visualDefaultsVersion) ? visualDefaultsVersion : 0,
    );
    settings.behaviorDefaultsVersion = Math.max(
      BEHAVIOR_DEFAULTS_VERSION,
      Number.isFinite(behaviorDefaultsVersion) ? behaviorDefaultsVersion : 0,
    );
    return settings;
  }

  function storageMigrationPatch(items = {}) {
    const migratedOverrides = {
      ...normalizeSiteOverrides(items.siteOverrides),
      ...legacyIgnoreOverrides(items[LEGACY_STORAGE_KEYS[2]]),
    };
    const set = {};
    const visualDefaultsVersion = Number(items.visualDefaultsVersion);
    if (
      !Number.isFinite(visualDefaultsVersion) ||
      visualDefaultsVersion < VISUAL_DEFAULTS_VERSION
    ) {
      set.visualDefaultsVersion = VISUAL_DEFAULTS_VERSION;
      if (
        !Object.hasOwn(items, "overlayOpacity") ||
        Number(items.overlayOpacity) === 0.52
      ) {
        set.overlayOpacity = DEFAULTS.overlayOpacity;
      }
    }
    const behaviorDefaultsVersion = Number(items.behaviorDefaultsVersion);
    if (
      !Number.isFinite(behaviorDefaultsVersion) ||
      behaviorDefaultsVersion < BEHAVIOR_DEFAULTS_VERSION
    ) {
      set.behaviorDefaultsVersion = BEHAVIOR_DEFAULTS_VERSION;
      for (const key of BEHAVIOR_DEFAULT_KEYS) set[key] = DEFAULTS[key];
    }
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
    if (state.autoBlockedReason === "disabled")
      return { text: "OFF", color: "#9aa0a6" };
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
