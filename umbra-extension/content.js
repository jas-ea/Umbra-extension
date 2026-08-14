(() => {
  const RUNTIME_VERSION = "2.5.1";
  const previousRuntime = globalThis.UMBRA_RUNTIME;
  if (previousRuntime?.version === RUNTIME_VERSION) return;
  if (previousRuntime?.teardown) {
    try {
      previousRuntime.teardown();
    } catch (_) {}
  } else {
    document.getElementById("umbra-overlay-host")?.remove();
  }
  globalThis.__umbraInjected = true;

  const settingsDefaults = globalThis.UMBRA_DEFAULTS;
  const normalizeSettings = globalThis.UMBRA_NORMALIZE_SETTINGS;
  const focusCoordinator = globalThis.UMBRA_CREATE_FOCUS_COORDINATOR();

  const INTERACTIVE_SELECTOR = [
    "button",
    "input",
    "textarea",
    "select",
    "summary",
    "details",
    "a[href]",
    '[role="button"]',
    '[role="tab"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="option"]',
    '[role="treeitem"]',
    '[role="checkbox"]',
    '[role="switch"]',
    "[aria-haspopup]",
    '[contenteditable="true"]',
    '[contenteditable="plaintext-only"]',
  ].join(",");

  const EDITABLE_SELECTOR = [
    "textarea",
    'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"])',
    '[contenteditable="true"]',
    '[contenteditable="plaintext-only"]',
    '[role="textbox"]',
  ].join(",");

  const READ_SURFACE_SELECTOR = [
    "article",
    '[role="article"]',
    "[data-message-author-role]",
    '[data-testid*="message" i]',
    '[data-testid*="card" i]',
    '[class*="card" i]',
    '[class*="message" i]',
    '[class*="post" i]',
    '[class*="story" i]',
    '[class*="note" i]',
    ".prose",
    ".entry-content",
  ].join(",");

  const TRANSIENT_INTERACTION_SELECTOR = [
    "dialog[open]",
    '[aria-modal="true"]',
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[role="menu"]',
    '[role="listbox"]',
  ].join(",");

  const COMPOSITE_COLLECTION_SELECTOR = [
    '[role="grid"]',
    '[role="treegrid"]',
    '[role="list"]',
    '[role="listbox"]',
    '[role="tree"]',
    "table",
    'table[role="grid"]',
  ].join(",");

  const MEDIA_SELECTOR = "video";

  const state = {
    settings: { ...settingsDefaults },
    siteProfile: null,
    pausedForTab: false,
    pinned: false,
    pickMode: false,
    pickSurface: null,
    activeSurface: null,
    activeRect: null,
    activeMode: null,
    pointerX: Math.round(window.innerWidth / 2),
    pointerY: Math.round(window.innerHeight / 2),
    lastPointerMoveAt: 0,
    lastScrollAt: 0,
    lastInteractionAt: 0,
    lastKeyAt: 0,
    hasUserInteracted: false,
    hoverTimer: null,
    hoverHint: null,
    hoverMode: null,
    hoverAnchorX: 0,
    hoverAnchorY: 0,
    scrollTimer: null,
    lastScrollContainer: null,
    exitTimer: null,
    hideTimer: null,
    transitionTimer: null,
    actionLockEl: null,
    actionLockMode: null,
    actionUntil: 0,
    interactionUntil: 0,
    lastAcceptedAt: 0,
    dragging: false,
    fullscreenSuspended: !!document.fullscreenElement,
    activeMedia: null,
    pictureInPictureMedia: null,
    mediaActivatedAt: new WeakMap(),
    overlayHost: null,
    overlayShadow: null,
    mask: null,
    maskPath: null,
    shell: null,
    visible: false,
    resizeObserver: null,
    mutationObserver: null,
    pageObserver: null,
    interactionCheckTimer: null,
    rafId: 0,
    motionRafId: 0,
    renderedRect: null,
    mutationRefreshTimer: null,
    routePollId: null,
    routeCheckTimer: null,
    lastHref: location.href,
    navigationHandler: null,
    runtimeMessageHandler: null,
    storageChangedHandler: null,
  };

  const storage = chrome.storage.sync;

  function log(...args) {
    if (state.settings.debug) console.log("[Umbra2]", ...args);
  }

  function nowTs() {
    return Date.now();
  }
  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }
  function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }
  function normalizeHost(value) {
    return globalThis.UMBRA_NORMALIZE_HOST(value);
  }
  function selectorList(list) {
    return Array.isArray(list) ? list.filter(Boolean) : [];
  }

  function getProfiles() {
    return Array.isArray(globalThis.UMBRA_SITE_PROFILES)
      ? globalThis.UMBRA_SITE_PROFILES
      : [];
  }

  function resolveSiteProfile() {
    const ctx = {
      host: normalizeHost(location.hostname),
      pathname: location.pathname,
      href: location.href,
      doc: document,
    };
    for (const profile of getProfiles()) {
      try {
        if (typeof profile.match === "function" && profile.match(ctx))
          return profile;
      } catch (err) {
        log("profile match error", err);
      }
    }
    return {
      id: "generic",
      label: "Generic",
      intent: "generic",
      defaultMode: "auto",
      quickSelectors: ["article", "main", "section"],
      preferSelectors: ["article", "main", "section"],
      surfaceSelectors: [
        "article",
        '[role="article"]',
        "[data-message-author-role]",
        '[data-testid*="message" i]',
        '[data-testid*="card" i]',
        '[class*="card" i]',
        '[class*="message" i]',
        '[class*="post" i]',
        '[class*="story" i]',
        '[class*="note" i]',
        ".prose",
        ".entry-content",
      ],
      rejectSelectors: ["aside", "nav", "header", "footer"],
      rejectTokens: [
        "sidebar",
        "menu",
        "toolbar",
        "banner",
        "modal",
        "dialog",
        "popup",
        "overlay",
        "search",
        "rail",
      ],
      fallbackSelectors: [
        "article",
        '[role="article"]',
        "[data-message-author-role]",
        '[class*="card" i]',
        "main",
        '[role="main"]',
      ],
    };
  }

  function currentSiteMode() {
    const host = normalizeHost(location.hostname);
    const overrides = state.settings.siteOverrides || {};
    if (overrides[host]) return overrides[host];
    const parts = host.split(".");
    for (let i = 1; i < parts.length - 1; i += 1) {
      const suffix = parts.slice(i).join(".");
      if (overrides[suffix]) return overrides[suffix];
    }
    return state.siteProfile?.defaultMode || "auto";
  }

  function visibleCount(selector) {
    return [...document.querySelectorAll(selector)].filter((el) => {
      const r = el.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.height > 0 &&
        r.bottom > 0 &&
        r.top < window.innerHeight
      );
    }).length;
  }

  function isUtilityLikePage() {
    const intent = state.siteProfile?.intent || "generic";
    if (
      [
        "article",
        "timeline",
        "chat",
        "gmail",
        "workspace",
        "comparative",
      ].includes(intent)
    )
      return false;
    if (intent === "utility") return true;
    const buttons = visibleCount(
      'button, [role="button"], input, textarea, select, [contenteditable="true"]',
    );
    const menus = visibleCount(
      'nav, [role="navigation"], [role="tablist"], [role="toolbar"], [role="menu"], [role="grid"], [role="tree"]',
    );
    const paragraphs = visibleCount("p, article, main, blockquote");
    if (menus >= 3 && buttons >= 10 && paragraphs <= 4) return true;
    if (buttons >= 16 && paragraphs <= 2) return true;
    return false;
  }

  function topLayerModalOpen() {
    try {
      if (document.querySelector(":modal")) return true;
    } catch (_) {
      if (document.querySelector("dialog[open]")) return true;
    }
    try {
      return !!document.querySelector(":popover-open");
    } catch (_) {
      return false;
    }
  }

  function transientInteractionFrom(node) {
    if (!node?.closest) return null;
    const surface = node.closest(TRANSIENT_INTERACTION_SELECTOR);
    if (!surface || !isVisible(surface)) return null;
    if (surface.matches?.('[role="listbox"]')) {
      const position = getComputedStyle(surface).position;
      if (position !== "fixed" && position !== "absolute") return null;
    }
    return surface;
  }

  function visibleTransientInteraction() {
    const active = transientInteractionFrom(document.activeElement);
    if (active) return active;
    try {
      const popover = document.querySelector(":popover-open");
      if (popover && isVisible(popover)) return popover;
    } catch (_) {}
    for (const surface of document.querySelectorAll(
      TRANSIENT_INTERACTION_SELECTOR,
    )) {
      if (!isVisible(surface)) continue;
      const style = getComputedStyle(surface);
      if (
        surface.matches?.('dialog[open], [aria-modal="true"]') ||
        style.position === "fixed" ||
        style.position === "absolute"
      ) {
        return surface;
      }
    }
    return null;
  }

  function autoBlockedReason() {
    if (!state.settings.enabled) return "disabled";
    if (state.pausedForTab) return "paused";
    if (state.fullscreenSuspended || document.fullscreenElement)
      return "fullscreen";
    if (state.dragging || nowTs() < state.interactionUntil)
      return "interaction";
    if (topLayerModalOpen()) return "modal-open";
    const mode = currentSiteMode();
    if (mode === "off") return "site-off";
    if (mode === "manual") return "site-manual";
    if (state.settings.appAutoSuppress && isUtilityLikePage())
      return "utility-page";
    return null;
  }

  function canManualRun() {
    return (
      state.settings.enabled &&
      !state.pausedForTab &&
      currentSiteMode() !== "off"
    );
  }

  function canAutoRun() {
    return canManualRun() && !autoBlockedReason();
  }

  function ensureOverlay() {
    if (state.overlayHost) return;
    const host = document.createElement("div");
    host.id = "umbra-overlay-host";
    host.setAttribute("aria-hidden", "true");
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.pointerEvents = "none";
    host.style.zIndex = "2147483646";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .mask {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        opacity: 0;
        transition: opacity 90ms ease;
        will-change: opacity;
      }
      .mask.visible { opacity: 1; }
      .mask path {
        fill: rgba(var(--umbra-dim-rgb, 0,0,0), var(--umbra-opacity,0.58));
      }
      .shell {
        position: fixed;
        left: 0;
        top: 0;
        width: 0;
        height: 0;
        opacity: 0;
        background: transparent;
        border-radius: var(--umbra-radius, 12px);
        border: 1px solid var(--umbra-outline, rgba(255,255,255,0.10));
        box-shadow: 0 0 var(--umbra-edge-feather, 0px) rgba(var(--umbra-dim-rgb, 0,0,0), var(--umbra-opacity,0.58));
        transition: opacity 90ms ease;
        will-change: left, top, width, height, opacity;
      }
      .shell.visible { opacity: 1; }
      .shell.choosing {
        border-color: rgba(255,255,255,0.72);
        border-width: 2px;
      }
      @media (prefers-reduced-motion: reduce) {
        .shell {
          transition: opacity 90ms ease;
          will-change: opacity;
        }
        .mask {
          transition: opacity 90ms ease;
        }
      }
      @media (prefers-contrast: more) {
        .mask path {
          fill: rgba(0,0,0,0.70);
        }
        .shell {
          border-color: rgba(255,255,255,0.36);
        }
      }
      @media (forced-colors: active) {
        .mask {
          display: none;
        }
        .shell {
          border: 2px solid CanvasText;
          box-shadow: none;
        }
      }
    `;
    const mask = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    mask.classList.add("mask");
    mask.setAttribute("aria-hidden", "true");
    mask.setAttribute("focusable", "false");
    const maskPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    maskPath.setAttribute("fill-rule", "evenodd");
    mask.append(maskPath);
    const shell = document.createElement("div");
    shell.className = "shell";
    shadow.append(style, mask, shell);
    document.documentElement.appendChild(host);
    state.overlayHost = host;
    state.overlayShadow = shadow;
    state.mask = mask;
    state.maskPath = maskPath;
    state.shell = shell;
    applyVisualSettings();
  }

  function applyVisualSettings() {
    if (!state.overlayHost) return;
    const rgb = hexToRgb(state.settings.dimTint || "#000000");
    const opacity = state.settings.solidDim ? 1 : state.settings.overlayOpacity;
    state.overlayHost.style.setProperty("--umbra-opacity", String(opacity));
    state.overlayHost.style.setProperty("--umbra-dim-rgb", rgb.join(","));
    state.overlayHost.style.setProperty(
      "--umbra-radius",
      `${state.settings.cornerRadius}px`,
    );
    state.overlayHost.style.setProperty(
      "--umbra-transition",
      `${state.settings.transitionMs}ms`,
    );
    state.overlayHost.style.setProperty(
      "--umbra-outline",
      state.settings.showOutline ? "rgba(255,255,255,0.10)" : "transparent",
    );
    state.overlayHost.style.setProperty(
      "--umbra-edge-feather",
      `${state.settings.edgeFeather || 0}px`,
    );
  }

  function hexToRgb(value) {
    const match = String(value || "")
      .trim()
      .match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!match) return [0, 0, 0];
    return match.slice(1).map((part) => parseInt(part, 16));
  }

  function roundedCutoutPath(rect) {
    const viewportWidth = Math.max(0, Math.round(window.innerWidth));
    const viewportHeight = Math.max(0, Math.round(window.innerHeight));
    const left = clamp(Math.round(rect.left), 0, viewportWidth);
    const top = clamp(Math.round(rect.top), 0, viewportHeight);
    const right = clamp(Math.round(rect.right), 0, viewportWidth);
    const bottom = clamp(Math.round(rect.bottom), 0, viewportHeight);
    const width = right - left;
    const height = bottom - top;
    const outer = `M0 0H${viewportWidth}V${viewportHeight}H0Z`;
    if (width <= 0 || height <= 0) return outer;

    const radius = Math.min(
      Math.max(0, Number(state.settings.cornerRadius) || 0),
      width / 2,
      height / 2,
    );
    if (!radius) {
      return `${outer}M${left} ${top}H${right}V${bottom}H${left}Z`;
    }

    const topLeft = rect.clippedTop || rect.clippedLeft ? 0 : radius;
    const topRight = rect.clippedTop || rect.clippedRight ? 0 : radius;
    const bottomRight = rect.clippedBottom || rect.clippedRight ? 0 : radius;
    const bottomLeft = rect.clippedBottom || rect.clippedLeft ? 0 : radius;

    return [
      outer,
      `M${left} ${top + topLeft}`,
      topLeft
        ? `A${topLeft} ${topLeft} 0 0 1 ${left + topLeft} ${top}`
        : `L${left} ${top}`,
      `H${right - topRight}`,
      topRight
        ? `A${topRight} ${topRight} 0 0 1 ${right} ${top + topRight}`
        : `L${right} ${top}`,
      `V${bottom - bottomRight}`,
      bottomRight
        ? `A${bottomRight} ${bottomRight} 0 0 1 ${right - bottomRight} ${bottom}`
        : `L${right} ${bottom}`,
      `H${left + bottomLeft}`,
      bottomLeft
        ? `A${bottomLeft} ${bottomLeft} 0 0 1 ${left} ${bottom - bottomLeft}`
        : `L${left} ${bottom}`,
      "Z",
    ].join("");
  }

  function setMask(rect, visible) {
    if (!state.mask || !state.maskPath) return;
    const width = Math.max(0, Math.round(window.innerWidth));
    const height = Math.max(0, Math.round(window.innerHeight));
    state.mask.setAttribute("viewBox", `0 0 ${width} ${height}`);
    state.maskPath.setAttribute("d", roundedCutoutPath(rect));
    state.mask.classList.toggle("visible", !!visible);
  }

  function hideMask() {
    if (!state.mask) return;
    state.mask.classList.remove("visible");
  }

  function clearExitTimer() {
    if (!state.exitTimer) return;
    clearTimeout(state.exitTimer);
    state.exitTimer = null;
  }

  function cancelSpotlightMotion() {
    cancelAnimationFrame(state.motionRafId);
    state.motionRafId = 0;
  }

  function clearHideTimer() {
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }
  }

  function hideOverlay(immediate = false, { preserveSurface = false } = {}) {
    clearHideTimer();
    clearExitTimer();
    if (!state.shell) return;
    if (immediate) {
      cancelSpotlightMotion();
      state.shell.classList.remove("visible");
      hideMask();
      state.visible = false;
      state.activeRect = null;
      state.renderedRect = null;
      if (!state.pinned && !preserveSurface) {
        state.activeSurface = null;
        state.activeMode = null;
        focusCoordinator.clear();
      }
      return;
    }
    state.hideTimer = setTimeout(() => {
      cancelSpotlightMotion();
      state.shell.classList.remove("visible");
      hideMask();
      state.visible = false;
      state.activeRect = null;
      state.renderedRect = null;
      if (!state.pinned && !preserveSurface) {
        state.activeSurface = null;
        state.activeMode = null;
        focusCoordinator.clear();
      }
    }, state.settings.hideGraceMs || 45);
  }

  function renderSpotlightRect(rect) {
    setMask(rect, true);
    state.shell.style.left = `${Math.round(rect.left)}px`;
    state.shell.style.top = `${Math.round(rect.top)}px`;
    state.shell.style.width = `${Math.max(0, Math.round(rect.width))}px`;
    state.shell.style.height = `${Math.max(0, Math.round(rect.height))}px`;
    const radius = Math.max(0, Number(state.settings.cornerRadius) || 0);
    state.shell.style.borderRadius = [
      rect.clippedTop || rect.clippedLeft ? 0 : radius,
      rect.clippedTop || rect.clippedRight ? 0 : radius,
      rect.clippedBottom || rect.clippedRight ? 0 : radius,
      rect.clippedBottom || rect.clippedLeft ? 0 : radius,
    ]
      .map((value) => `${value}px`)
      .join(" ");
    state.renderedRect = { ...rect };
  }

  function prefersReducedMotion() {
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }

  function animateSpotlightTo(rect) {
    const from = state.renderedRect;
    const duration = Math.max(0, Number(state.settings.transitionMs) || 0);
    cancelSpotlightMotion();
    if (!from || !duration || prefersReducedMotion()) {
      renderSpotlightRect(rect);
      return;
    }

    const startedAt = performance.now();
    const tick = (timestamp) => {
      const progress = clamp((timestamp - startedAt) / duration, 0, 1);
      const eased = 1 - (1 - progress) ** 3;
      const next = {};
      for (const key of ["left", "top", "right", "bottom", "width", "height"]) {
        next[key] = from[key] + (rect[key] - from[key]) * eased;
      }
      next.clippedTop = rect.clippedTop;
      next.clippedRight = rect.clippedRight;
      next.clippedBottom = rect.clippedBottom;
      next.clippedLeft = rect.clippedLeft;
      renderSpotlightRect(next);
      if (progress < 1) state.motionRafId = requestAnimationFrame(tick);
      else state.motionRafId = 0;
    };
    state.motionRafId = requestAnimationFrame(tick);
  }

  function setShellRect(rect, { animate = false } = {}) {
    ensureOverlay();
    if (topLayerModalOpen()) {
      hideOverlay(true, { preserveSurface: true });
      return;
    }
    if (!rect) {
      hideOverlay(true);
      return;
    }
    clearHideTimer();
    clearExitTimer();
    state.activeRect = rect;
    if (animate) animateSpotlightTo(rect);
    else {
      cancelSpotlightMotion();
      renderSpotlightRect(rect);
    }
    state.shell.classList.add("visible");
    state.visible = true;
  }

  function rectForElement(el) {
    if (!el || !document.contains(el)) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    if (
      r.right <= 0 ||
      r.left >= window.innerWidth ||
      r.bottom <= 0 ||
      r.top >= window.innerHeight
    )
      return null;
    let left = r.left - state.settings.paddingX;
    let top = r.top - state.settings.paddingY;
    let right = r.right + state.settings.paddingX;
    let bottom = r.bottom + state.settings.paddingY;
    const padded = { left, top, right, bottom };
    let ancestor = el.parentElement;
    while (
      ancestor &&
      ancestor !== document.body &&
      ancestor !== document.documentElement
    ) {
      const style = getComputedStyle(ancestor);
      const clipsX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX);
      const clipsY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
      if (clipsX || clipsY) {
        const clip = ancestor.getBoundingClientRect();
        const clipLeft = clip.left + ancestor.clientLeft;
        const clipTop = clip.top + ancestor.clientTop;
        const clipRight = clipLeft + ancestor.clientWidth;
        const clipBottom = clipTop + ancestor.clientHeight;
        if (clipsX) {
          left = Math.max(left, clipLeft);
          right = Math.min(right, clipRight);
        }
        if (clipsY) {
          top = Math.max(top, clipTop);
          bottom = Math.min(bottom, clipBottom);
        }
      }
      ancestor = ancestor.parentElement;
    }
    left = clamp(left, 0, window.innerWidth);
    top = clamp(top, 0, window.innerHeight);
    right = clamp(right, 0, window.innerWidth);
    bottom = clamp(bottom, 0, window.innerHeight);
    const clippedTop = top > padded.top + 0.5;
    const clippedRight = right < padded.right - 0.5;
    const clippedBottom = bottom < padded.bottom - 0.5;
    const clippedLeft = left > padded.left + 0.5;
    left = Math.round(left);
    top = Math.round(top);
    right = Math.round(right);
    bottom = Math.round(bottom);
    const width = right - left;
    const height = bottom - top;
    if (r.width < 40 || r.height < 28 || width < 40 || height < 28) return null;
    if (state.settings.focusMode === "band") {
      const bandHeight = Math.min(
        height,
        Math.max(96, window.innerHeight * 0.28),
      );
      const bandCenter = readingBandPoint().y;
      const bandTop = clamp(
        bandCenter - bandHeight / 2,
        top,
        bottom - bandHeight,
      );
      return {
        left,
        top: bandTop,
        width,
        height: bandHeight,
        right,
        bottom: bandTop + bandHeight,
        clippedTop: false,
        clippedRight,
        clippedBottom: false,
        clippedLeft,
      };
    }
    return {
      left,
      top,
      width,
      height,
      right,
      bottom,
      clippedTop,
      clippedRight,
      clippedBottom,
      clippedLeft,
    };
  }

  function pointInsideRect(x, y, rect, buffer = 0) {
    if (!rect) return false;
    return (
      x >= rect.left - buffer &&
      x <= rect.right + buffer &&
      y >= rect.top - buffer &&
      y <= rect.bottom + buffer
    );
  }

  function closestAny(node, selectors) {
    if (!node || !node.closest) return null;
    for (const selector of selectorList(selectors)) {
      try {
        const found = node.closest(selector);
        if (found) return found;
      } catch (_) {}
    }
    return null;
  }

  function matchesAny(node, selectors) {
    if (!node || !node.matches) return false;
    return selectorList(selectors).some((selector) => {
      try {
        return node.matches(selector);
      } catch (_) {
        return false;
      }
    });
  }

  function classTokenString(node) {
    return `${node?.className || ""} ${node?.id || ""}`.toLowerCase();
  }

  function containsRejectToken(node) {
    const tokens = selectorList(state.siteProfile?.rejectTokens);
    if (!tokens.length) return false;
    const str = classTokenString(node);
    return tokens.some((token) => str.includes(String(token).toLowerCase()));
  }

  function hasRejectedContext(node) {
    if (closestAny(node, state.siteProfile?.rejectSelectors)) return true;
    let current = node;
    while (
      current &&
      current !== document.body &&
      current !== document.documentElement
    ) {
      if (matchesAny(current, state.siteProfile?.rejectSelectors)) return true;
      if (
        current.tagName?.toLowerCase() === "main" ||
        current.getAttribute?.("role") === "main"
      ) {
        break;
      }
      if (containsRejectToken(current)) return true;
      current = current.parentElement;
    }
    return false;
  }

  function isVisible(el, rect = null, style = null) {
    if (!el || !document.contains(el)) return false;
    if (el.closest?.('[hidden], [aria-hidden="true"], [inert]')) return false;
    const r = rect || el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    if (
      r.bottom <= 0 ||
      r.top >= window.innerHeight ||
      r.right <= 0 ||
      r.left >= window.innerWidth
    )
      return false;
    const s = style || getComputedStyle(el);
    return (
      s.display !== "none" &&
      s.visibility !== "hidden" &&
      Number(s.opacity || "1") > 0.01
    );
  }

  function pageFamily() {
    const intent = state.siteProfile?.intent || "generic";
    if (intent === "comparative") return "compare";
    if (intent === "utility") return "act";
    if (["article", "timeline", "chat", "gmail"].includes(intent))
      return "read";
    return "read";
  }

  function isEditable(el) {
    return !!(el && el.matches && el.matches(EDITABLE_SELECTOR));
  }

  function isInteractive(el) {
    return !!(el && el.matches && el.matches(INTERACTIVE_SELECTOR));
  }

  function repeatedSiblingPattern(el, baseRect = null) {
    const parent = el?.parentElement;
    if (!parent) return 0;
    const children = [...parent.children].filter((child) => isVisible(child));
    if (children.length < 4) return 0;
    const sameTag = children.filter(
      (child) => child.tagName === el.tagName,
    ).length;
    let similar = 0;
    const base = baseRect || el.getBoundingClientRect();
    for (const child of children.slice(0, 12)) {
      const r = child.getBoundingClientRect();
      if (
        Math.abs(r.height - base.height) < Math.max(24, base.height * 0.35) &&
        Math.abs(r.width - base.width) < Math.max(40, base.width * 0.35)
      ) {
        similar += 1;
      }
    }
    return (sameTag + similar) / 2;
  }

  function readSurfaceChildCount(el) {
    if (!el?.querySelectorAll) return 0;
    try {
      return [...el.querySelectorAll(READ_SURFACE_SELECTOR)]
        .filter((child) => child !== el && isVisible(child))
        .slice(0, 8).length;
    } catch (_) {
      return 0;
    }
  }

  function isBroadReadContainer(el, areaRatio) {
    const tag = el?.tagName?.toLowerCase();
    return (
      tag === "main" ||
      el?.getAttribute?.("role") === "main" ||
      areaRatio > 0.55
    );
  }

  function pointerPoint() {
    return { x: state.pointerX, y: state.pointerY };
  }

  function readingBandPoint(container = null) {
    if (
      container &&
      container !== document &&
      container !== document.body &&
      container !== document.documentElement &&
      document.contains(container)
    ) {
      const rect = container.getBoundingClientRect();
      const left = clamp(rect.left, 0, window.innerWidth);
      const right = clamp(rect.right, 0, window.innerWidth);
      const top = clamp(rect.top, 0, window.innerHeight);
      const bottom = clamp(rect.bottom, 0, window.innerHeight);
      return {
        x: Math.round((left + right) / 2),
        y: Math.round(
          top +
            (bottom - top) *
              clamp(Number(state.settings.readingBandY) || 0.42, 0.2, 0.75),
        ),
      };
    }
    return {
      x: Math.round(window.innerWidth * 0.5),
      y: Math.round(
        window.innerHeight *
          clamp(Number(state.settings.readingBandY) || 0.42, 0.2, 0.75),
      ),
    };
  }

  function findInteractionShell(start) {
    if (!start) return null;
    let node =
      isEditable(start) || isInteractive(start)
        ? start
        : start.closest?.(EDITABLE_SELECTOR) ||
          start.closest?.(INTERACTIVE_SELECTOR) ||
          start;
    const selectors = [
      '[role="dialog"]',
      '[aria-modal="true"]',
      "dialog",
      "form",
      '[data-testid*="composer" i]',
      '[class*="composer" i]',
      '[class*="reply" i]',
      '[class*="editor" i]',
      '[class*="input" i]',
      '[class*="prompt" i]',
      '[class*="comment" i]',
      "footer",
    ];
    const shell = closestAny(node, selectors);
    if (shell && isVisible(shell)) return shell;
    let cur = node;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const r = cur.getBoundingClientRect();
      if (
        r.width > 180 &&
        r.height > 56 &&
        r.width < window.innerWidth * 0.96 &&
        r.height < window.innerHeight * 0.72
      ) {
        const edits = cur.querySelectorAll?.(EDITABLE_SELECTOR).length || 0;
        const buttons =
          cur.querySelectorAll?.('button, [role="button"]').length || 0;
        if (edits || buttons >= 2) return cur;
      }
      cur = cur.parentElement;
    }
    return node;
  }

  function findComparativeShell(start) {
    if (!start) return null;
    const direct = closestAny(start, [
      "table",
      '[role="table"]',
      '[role="grid"]',
      '[class*="table" i]',
      '[class*="grid" i]',
      '[class*="list" i]',
    ]);
    if (direct && isVisible(direct)) return direct;
    let cur = start;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const repeated = repeatedSiblingPattern(cur);
      const r = cur.getBoundingClientRect();
      if (repeated >= 4 && r.width > window.innerWidth * 0.38 && r.height > 120)
        return cur.parentElement || cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function collectCandidatesFromPoint(x, y) {
    const candidates = new Set();
    const base = document.elementFromPoint(x, y);
    if (!base) return [];
    let node = base;
    while (
      node &&
      node !== document.body &&
      node !== document.documentElement
    ) {
      candidates.add(node);
      const preferred = closestAny(node, state.siteProfile?.surfaceSelectors);
      if (preferred) candidates.add(preferred);
      const preferred2 = closestAny(node, state.siteProfile?.preferSelectors);
      if (preferred2) candidates.add(preferred2);
      node = node.parentElement;
    }

    for (const selector of selectorList(
      state.siteProfile?.quickSelectors,
    ).slice(0, 6)) {
      try {
        const nearby = document.querySelectorAll(selector);
        for (const el of nearby) {
          if (!isVisible(el)) continue;
          const r = el.getBoundingClientRect();
          if (
            x >= r.left - 48 &&
            x <= r.right + 48 &&
            y >= r.top - 48 &&
            y <= r.bottom + 48
          )
            candidates.add(el);
        }
      } catch (_) {}
    }
    return [...candidates];
  }

  function candidateScore(el, point, family) {
    if (!el || !document.contains(el)) return -Infinity;
    if (hasRejectedContext(el)) return -Infinity;
    const style = getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity || "1") <= 0.01
    )
      return -Infinity;
    if (
      (style.position === "fixed" || style.position === "sticky") &&
      !isEditable(el) &&
      !isInteractive(el)
    )
      return -90;
    const r = el.getBoundingClientRect();
    if (!isVisible(el, r, style)) return -Infinity;
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    const area = Math.max(1, r.width * r.height);
    const areaRatio = area / viewportArea;
    const isExplicitSurface = matchesAny(
      el,
      state.siteProfile?.surfaceSelectors,
    );
    let score = 0;
    if (
      pointInsideRect(
        point.x,
        point.y,
        { ...r, right: r.right, bottom: r.bottom },
        0,
      )
    )
      score += 24;
    score -= Math.min(
      distance(point.x, point.y, r.left + r.width / 2, r.top + r.height / 2) /
        40,
      18,
    );
    if (isExplicitSurface) score += 18;
    if (matchesAny(el, state.siteProfile?.preferSelectors)) score += 8;
    if (matchesAny(el, state.siteProfile?.quickSelectors)) score += 4;
    if (
      el.tagName.toLowerCase() === "article" ||
      el.getAttribute("role") === "article" ||
      el.tagName.toLowerCase() === "main"
    )
      score += 10;

    const textLen = (el.textContent || "").trim().length;
    const interactiveCount =
      el.querySelectorAll?.(
        'button, [role="button"], input, textarea, select, a[href]',
      ).length || 0;
    const paragraphCount =
      family === "read"
        ? el.querySelectorAll?.("p, li, blockquote").length || 0
        : 0;
    const rowLike = family === "compare" ? repeatedSiblingPattern(el, r) : 0;

    if (family === "read") {
      score += Math.min(textLen / 100, 18);
      score += Math.min(paragraphCount * 1.8, 10);
      score -= Math.min(interactiveCount, 20) * 0.8;
      if (matchesAny(el, [READ_SURFACE_SELECTOR])) score += 12;
      if (areaRatio >= 0.04 && areaRatio <= 0.42) score += 8;
      if (areaRatio > 0.55) score -= Math.min((areaRatio - 0.55) * 48, 22);
      if (!isExplicitSurface)
        score -= Math.min(readSurfaceChildCount(el) * 10, 40);
      if (isBroadReadContainer(el, areaRatio))
        score -= Math.min(readSurfaceChildCount(el) * 7, 28);
      if (areaRatio > 0.9) score -= 18;
      if (areaRatio < 0.02) score -= 12;
    } else if (family === "compare") {
      score += Math.min(rowLike * 4, 18);
      if (areaRatio > 0.18 && areaRatio < 0.92) score += 12;
      if (el.matches?.('tr, [role="row"]')) score -= 30;
    } else if (family === "create" || family === "act") {
      const editables = el.querySelectorAll?.(EDITABLE_SELECTOR).length || 0;
      score += editables ? 18 : 0;
      score += Math.min(interactiveCount, 18) * 1.2;
      if (areaRatio > 0.96) score -= 12;
    }

    return score;
  }

  function bestSurfaceNearPoint(point, family) {
    const origin = document.elementFromPoint(point.x, point.y);
    if (!origin || hasRejectedContext(origin)) return null;

    const candidates = collectCandidatesFromPoint(point.x, point.y);
    let best = null;
    let bestScore = -Infinity;
    for (const el of candidates) {
      const score = candidateScore(el, point, family);
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }

    if (!best || bestScore < -10) {
      const fallbackSelectors = selectorList(
        state.siteProfile?.fallbackSelectors,
      );
      const fallback = closestAny(origin, fallbackSelectors);
      if (fallback && isVisible(fallback)) best = fallback;
    }
    return best;
  }

  function nearestSurfaceFromPoint(family, point, sourceEl = null) {
    if (family === "create" || family === "act") {
      const origin =
        sourceEl ||
        document.elementFromPoint(point.x, point.y) ||
        document.activeElement;
      return findInteractionShell(origin);
    }
    if (family === "compare") {
      const origin = sourceEl || document.elementFromPoint(point.x, point.y);
      return (
        findComparativeShell(origin) || bestSurfaceNearPoint(point, family)
      );
    }
    return bestSurfaceNearPoint(point, family);
  }

  function nearestSurfaceFromPointer(family, sourceEl = null) {
    return nearestSurfaceFromPoint(family, pointerPoint(), sourceEl);
  }

  function visibleCompositeItemCount(surface) {
    if (!surface?.querySelectorAll) return 0;
    const selector = [
      ':scope > [role="row"]',
      ':scope > [role="listitem"]',
      ':scope > [role="option"]',
      ':scope > [role="treeitem"]',
      ':scope > [role="gridcell"]',
      ":scope > tbody > tr",
      '[role="row"]',
      '[role="listitem"]',
      '[role="option"]',
      '[role="treeitem"]',
      '[role="gridcell"]',
    ].join(",");
    try {
      return [...surface.querySelectorAll(selector)]
        .filter((item) => isVisible(item))
        .slice(0, 5).length;
    } catch (_) {
      return 0;
    }
  }

  function hasRejectedCollectionContext(origin) {
    let current = origin;
    while (
      current &&
      current !== document.body &&
      current !== document.documentElement
    ) {
      if (
        matchesAny(current, state.siteProfile?.rejectSelectors) ||
        containsRejectToken(current)
      ) {
        return true;
      }
      if (
        current.tagName?.toLowerCase() === "main" ||
        current.getAttribute?.("role") === "main"
      ) {
        break;
      }
      current = current.parentElement;
    }
    return false;
  }

  function collectionSurfaceFrom(origin) {
    if (!origin?.closest || hasRejectedCollectionContext(origin)) return null;
    const collectionItem = closestAny(
      origin,
      state.siteProfile?.collectionItemSelectors,
    );
    const originIsCollection = matchesAny(
      origin,
      state.siteProfile?.collectionSelectors,
    );
    if (
      state.siteProfile?.strictTargeting &&
      !collectionItem &&
      !originIsCollection
    ) {
      return null;
    }
    const explicit = closestAny(
      collectionItem || origin,
      state.siteProfile?.collectionSelectors,
    );
    if (explicit && isVisible(explicit)) return explicit;
    if (state.siteProfile?.strictTargeting) return null;
    const semantic = origin.closest(COMPOSITE_COLLECTION_SELECTOR);
    if (
      semantic &&
      isVisible(semantic) &&
      visibleCompositeItemCount(semantic) >= 4
    ) {
      return semantic;
    }
    return null;
  }

  function detailSurfaceFrom(origin) {
    const detail = closestAny(origin, state.siteProfile?.detailSelectors);
    return detail && isVisible(detail) ? detail : null;
  }

  function mediaSurfaceFrom(origin) {
    const video = origin?.closest?.(MEDIA_SELECTOR);
    if (!video || !isVisible(video)) return null;
    const player = closestAny(video, [
      '[data-testid*="player" i]',
      '[class*="video-player" i]',
      '[class*="player-container" i]',
      "figure",
    ]);
    if (!player || !isVisible(player)) return video;
    const rect = player.getBoundingClientRect();
    if (
      rect.width > window.innerWidth * 0.96 ||
      rect.height > window.innerHeight * 0.92
    ) {
      return video;
    }
    return player;
  }

  function isStrongPlayingVideo(video) {
    if (
      !video ||
      !document.contains(video) ||
      video.paused ||
      video.ended ||
      !isVisible(video)
    ) {
      return false;
    }
    const audible = !video.muted && Number(video.volume) > 0;
    const activatedAt = state.mediaActivatedAt.get(video) || 0;
    const recentlyActivated = nowTs() - activatedAt < 5000;
    const ownsFocus =
      video === state.activeMedia && state.activeMode === "media";
    return audible || recentlyActivated || ownsFocus;
  }

  function resolvedTargetFromPoint(
    family,
    point,
    sourceEl = null,
    { allowPassiveMedia = true } = {},
  ) {
    const origin =
      sourceEl || document.elementFromPoint(point.x, point.y) || null;
    if (!origin) return null;
    if (transientInteractionFrom(origin)) return { suspended: true };

    const directMedia = mediaSurfaceFrom(origin);
    const directVideo = origin.closest?.(MEDIA_SELECTOR);
    if (directMedia) {
      if (allowPassiveMedia || isStrongPlayingVideo(directVideo)) {
        return { surface: directMedia, mode: "media", origin };
      }
      return null;
    }

    const detail = detailSurfaceFrom(origin);
    if (detail) return { surface: detail, mode: "read", origin };

    const collection = collectionSurfaceFrom(origin);
    if (collection) return { surface: collection, mode: "scan", origin };

    if (state.siteProfile?.strictTargeting) {
      const editable = isEditable(origin)
        ? origin
        : origin.closest?.(EDITABLE_SELECTOR);
      const shell = editable ? findInteractionShell(editable) : null;
      return shell && isVisible(shell)
        ? { surface: shell, mode: "create", origin }
        : null;
    }

    const surface = nearestSurfaceFromPoint(family, point, sourceEl);
    if (!surface) return null;

    const promotedCollection = collectionSurfaceFrom(surface);
    if (promotedCollection) {
      return { surface: promotedCollection, mode: "scan", origin };
    }
    return { surface, mode: family, origin };
  }

  function directSurfaceFromPointer(family, sourceEl) {
    if (!sourceEl || hasRejectedContext(sourceEl)) return null;
    const explicit = closestAny(sourceEl, state.siteProfile?.surfaceSelectors);
    if (explicit && isVisible(explicit)) return explicit;
    return nearestSurfaceFromPointer(family, sourceEl);
  }

  function visibleElementCenter(el) {
    if (
      !el ||
      el === document.body ||
      el === document.documentElement ||
      !isVisible(el)
    )
      return null;
    const rect = el.getBoundingClientRect();
    return {
      x: clamp(rect.left + rect.width / 2, 0, window.innerWidth),
      y: clamp(rect.top + rect.height / 2, 0, window.innerHeight),
    };
  }

  function nearestManualSurface(family) {
    const active = document.activeElement;
    if (isEditable(active) || isInteractive(active)) {
      const surface = findInteractionShell(active);
      if (surface && isVisible(surface))
        return { surface, family: isEditable(active) ? "create" : "act" };
    }

    const activePoint = visibleElementCenter(active);
    if (activePoint) {
      const activeSurface = nearestSurfaceFromPoint(
        family,
        activePoint,
        active,
      );
      if (activeSurface) return { surface: activeSurface, family };
    }

    const bandSurface = nearestSurfaceFromPoint(family, readingBandPoint());
    if (bandSurface) return { surface: bandSurface, family };

    const pointerSurface = nearestSurfaceFromPointer(family);
    return pointerSurface ? { surface: pointerSurface, family } : null;
  }

  function activeTyping() {
    return (
      nowTs() - state.lastKeyAt < 900 &&
      state.actionLockEl &&
      document.contains(state.actionLockEl)
    );
  }

  function actionLockActive() {
    return !!(
      state.actionLockEl &&
      document.contains(state.actionLockEl) &&
      nowTs() < state.actionUntil
    );
  }

  function actionSurfaceShouldWin() {
    if (!actionLockActive()) return false;
    if (activeTyping()) return true;
    const shell = findInteractionShell(state.actionLockEl);
    if (!shell) return false;
    const pointerInside = pointInsideRect(
      state.pointerX,
      state.pointerY,
      shell.getBoundingClientRect(),
      24,
    );
    if (pointerInside) return true;
    if (state.lastPointerMoveAt >= state.lastInteractionAt) return false;
    return (
      nowTs() - state.lastInteractionAt <
      (state.settings.interactionGraceMs || 700)
    );
  }

  function attachObservers(surface) {
    if (state.resizeObserver) state.resizeObserver.disconnect();
    if (state.mutationObserver) state.mutationObserver.disconnect();
    if (!surface) return;

    state.resizeObserver = new ResizeObserver(() =>
      scheduleSurfaceRefresh("resize"),
    );
    state.resizeObserver.observe(surface);
    if (surface.parentElement)
      state.resizeObserver.observe(surface.parentElement);

    state.mutationObserver = new MutationObserver(() =>
      scheduleSurfaceRefresh("mutation"),
    );
    state.mutationObserver.observe(surface, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function clearObservers() {
    if (state.resizeObserver) state.resizeObserver.disconnect();
    if (state.mutationObserver) state.mutationObserver.disconnect();
    state.resizeObserver = null;
    state.mutationObserver = null;
  }

  function switchSurface(surface, mode, { pin = false } = {}) {
    if (!surface || !document.contains(surface)) {
      if (!pin) {
        state.activeSurface = null;
        state.activeMode = null;
        state.pinned = false;
      }
      hideOverlay(true);
      clearObservers();
      focusCoordinator.clear();
      return;
    }
    const previousSurface = state.activeSurface;
    const shouldAnimate = !!(
      state.visible &&
      previousSurface &&
      previousSurface !== surface
    );
    state.activeSurface = surface;
    state.activeMode = mode;
    state.pinned = !!pin;
    const rect = rectForElement(surface);
    if (!rect) {
      hideOverlay(true);
      focusCoordinator.clear();
      return;
    }
    setShellRect(rect, { animate: shouldAnimate });
    attachObservers(surface);
    state.lastAcceptedAt = nowTs();
    focusCoordinator.sync({ surface, mode }, state.lastAcceptedAt);
  }

  function refreshActiveSurface() {
    if (
      state.fullscreenSuspended ||
      document.fullscreenElement ||
      state.dragging ||
      nowTs() < state.interactionUntil
    ) {
      hideOverlay(true, { preserveSurface: true });
      return;
    }
    if (!state.activeSurface || !document.contains(state.activeSurface)) {
      state.activeSurface = null;
      state.activeMode = null;
      clearObservers();
      if (state.visible) hideOverlay(true);
      scheduleReacquire();
      return;
    }
    const rect = rectForElement(state.activeSurface);
    if (!rect) {
      hideOverlay(true);
      scheduleReacquire();
      return;
    }
    setShellRect(rect);
  }

  function scheduleSurfaceRefresh(_reason) {
    if (_reason === "mutation") {
      clearTimeout(state.mutationRefreshTimer);
      state.mutationRefreshTimer = setTimeout(() => {
        state.mutationRefreshTimer = null;
        refreshActiveSurface();
      }, 140);
      return;
    }
    cancelAnimationFrame(state.rafId);
    state.rafId = requestAnimationFrame(() => refreshActiveSurface());
  }

  function scheduleReacquire(delay = state.settings.dwellMs) {
    clearTimeout(state.transitionTimer);
    state.transitionTimer = setTimeout(
      () => {
        if (!canAutoRun() || state.pinned) return;
        acquireSurface("transition");
      },
      Math.max(120, Number(delay) || 0),
    );
  }

  function clearTimers() {
    clearTimeout(state.hoverTimer);
    clearTimeout(state.scrollTimer);
    clearTimeout(state.exitTimer);
    clearTimeout(state.transitionTimer);
    clearTimeout(state.mutationRefreshTimer);
    clearTimeout(state.routeCheckTimer);
    clearInterval(state.routePollId);
    clearHideTimer();
    cancelAnimationFrame(state.rafId);
    cancelSpotlightMotion();
    state.hoverTimer = state.scrollTimer = state.transitionTimer = null;
    state.hoverHint = null;
    state.hoverMode = null;
    state.exitTimer = null;
    state.mutationRefreshTimer = state.routeCheckTimer = null;
    state.routePollId = null;
    state.rafId = 0;
  }

  function focusDelayFor(target) {
    const targetVideo = target?.origin?.closest?.(MEDIA_SELECTOR);
    const targetActivatedAt = targetVideo
      ? state.mediaActivatedAt.get(targetVideo) || 0
      : 0;
    if (target?.mode === "media" && nowTs() - targetActivatedAt < 5000) {
      return state.settings.mediaFocusMs;
    }
    if (!state.activeSurface || !state.visible) return state.settings.dwellMs;
    if (state.activeMode === "media" && isStrongPlayingVideo(state.activeMedia))
      return Math.max(1800, state.settings.refocusDwellMs);
    return state.settings.refocusDwellMs;
  }

  function commitResolvedTarget(target) {
    if (!target?.surface) return null;
    switchSurface(target.surface, target.mode);
    return target.surface;
  }

  function restoreIncumbent() {
    if (
      !canManualRun() ||
      visibleTransientInteraction() ||
      !state.activeSurface ||
      !document.contains(state.activeSurface)
    ) {
      return false;
    }
    const rect = rectForElement(state.activeSurface);
    if (!rect) return false;
    setShellRect(rect);
    return true;
  }

  function suspendAutomaticFocus(grace = state.settings.interactionGraceMs) {
    clearHoverResidence();
    clearTimeout(state.scrollTimer);
    focusCoordinator.suspend();
    state.interactionUntil = Math.max(
      state.interactionUntil,
      nowTs() + Math.max(0, Number(grace) || 0),
    );
    hideOverlay(true, { preserveSurface: true });
    clearTimeout(state.transitionTimer);
    state.transitionTimer = setTimeout(
      () => {
        if (visibleTransientInteraction()) {
          suspendAutomaticFocus(grace);
          return;
        }
        if (!restoreIncumbent()) scheduleReacquire();
      },
      Math.max(120, Number(grace) || 0),
    );
  }

  function acquireSurface(reason) {
    if (!canAutoRun() || !state.hasUserInteracted || state.pinned) return null;

    let family = pageFamily();
    let sourceEl = null;
    let point = pointerPoint();

    if (actionSurfaceShouldWin()) {
      family = state.actionLockMode || "create";
      sourceEl = state.actionLockEl;
    }

    if (reason === "scroll" && !actionSurfaceShouldWin()) {
      family = pageFamily();
      sourceEl = null;
      point = readingBandPoint(state.lastScrollContainer);
    }

    let target = resolvedTargetFromPoint(family, point, sourceEl, {
      allowPassiveMedia: false,
    });
    if (target?.suspended) {
      suspendAutomaticFocus();
      return null;
    }
    if (!target && family !== "read") {
      target = resolvedTargetFromPoint(pageFamily(), point, null, {
        allowPassiveMedia: false,
      });
    }
    if (!target) {
      schedulePointerExit();
      return null;
    }
    return commitResolvedTarget(target);
  }

  function clearHoverResidence() {
    clearTimeout(state.hoverTimer);
    state.hoverTimer = null;
    state.hoverHint = null;
    state.hoverMode = null;
    focusCoordinator.resetChallenger();
  }

  function queueHoverAcquire(sourceEl) {
    if (!canAutoRun() || !state.settings.autoOnHover || state.pinned) return;
    const target = resolvedTargetFromPoint(
      pageFamily(),
      pointerPoint(),
      sourceEl,
    );
    if (target?.suspended) {
      suspendAutomaticFocus();
      return;
    }
    if (!target?.surface) {
      clearHoverResidence();
      schedulePointerExit();
      return;
    }
    clearExitTimer();
    clearHideTimer();

    const candidateChanged =
      target.surface !== state.hoverHint || target.mode !== state.hoverMode;
    const anchorMoved =
      distance(
        state.hoverAnchorX,
        state.hoverAnchorY,
        state.pointerX,
        state.pointerY,
      ) >= state.settings.stationaryTolerance;
    if (candidateChanged || anchorMoved) {
      clearTimeout(state.hoverTimer);
      focusCoordinator.resetChallenger();
      state.hoverAnchorX = state.pointerX;
      state.hoverAnchorY = state.pointerY;
    } else if (state.hoverTimer) {
      return;
    }

    state.hoverHint = target.surface;
    state.hoverMode = target.mode;
    const delay = focusDelayFor(target);
    const observedAt = nowTs();
    const currentChallenger = focusCoordinator.snapshot().challenger;
    const challengerSince =
      currentChallenger?.surface === target.surface &&
      currentChallenger.mode === target.mode
        ? currentChallenger.since
        : observedAt;
    const quietDelay = Math.max(
      0,
      state.lastPointerMoveAt + state.settings.pointerQuietMs - challengerSince,
    );
    const decision = focusCoordinator.observe(target, {
      now: observedAt,
      delay: Math.max(delay, quietDelay),
    });
    if (decision.action === "hold") {
      clearHoverResidence();
      return;
    }
    if (decision.action === "commit") {
      commitResolvedTarget(target);
      clearHoverResidence();
      return;
    }

    state.hoverTimer = setTimeout(() => {
      state.hoverTimer = null;
      const current = document.elementFromPoint(state.pointerX, state.pointerY);
      queueHoverAcquire(current);
    }, decision.remaining || delay);
  }

  function queueScrollAcquire() {
    clearTimeout(state.scrollTimer);
    if (!canAutoRun() || !state.settings.autoOnScroll || state.pinned) return;
    const delay = state.settings.scrollIdleMs;
    state.scrollTimer = setTimeout(() => {
      acquireSurface("scroll");
    }, delay);
  }

  function recordActionLock(el, mode) {
    state.actionLockEl = el;
    state.actionLockMode = mode;
    state.actionUntil = nowTs() + state.settings.actionLockMs;
    state.lastInteractionAt = nowTs();
  }

  function schedulePointerExit() {
    if (state.exitTimer || !state.visible || state.pinned) return;
    state.exitTimer = setTimeout(() => {
      state.exitTimer = null;
      if (
        !state.pinned &&
        state.activeRect &&
        !pointInsideRect(
          state.pointerX,
          state.pointerY,
          state.activeRect,
          state.settings.revealBuffer,
        )
      ) {
        hideOverlay(false);
      }
    }, state.settings.noTargetHoldMs);
  }

  function onPointerMove(event) {
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    state.lastPointerMoveAt = nowTs();
    state.hasUserInteracted = true;

    if (state.pickMode) {
      const surface = directSurfaceFromPointer(pageFamily(), event.target);
      if (surface) {
        state.pickSurface = surface;
        switchSurface(surface, pageFamily());
        state.shell?.classList.add("choosing");
      } else {
        state.pickSurface = null;
        hideOverlay(false);
      }
      return;
    }

    if (state.pinned) return;
    if (transientInteractionFrom(event.target)) {
      suspendAutomaticFocus();
      return;
    }
    queueHoverAcquire(event.target);
  }

  function onScroll(event) {
    const target = event?.target;
    const isDocumentScroll =
      target === document ||
      target === window ||
      target === document.documentElement ||
      target === document.body ||
      target === document.scrollingElement;
    state.hasUserInteracted = true;
    state.lastScrollAt = nowTs();
    state.lastScrollContainer = isDocumentScroll ? null : target;
    clearHoverResidence();
    if (state.activeSurface && !state.pinned) scheduleSurfaceRefresh("scroll");
    queueScrollAcquire();
  }

  function onFocusIn(event) {
    const target = event.target;
    if (transientInteractionFrom(target)) {
      suspendAutomaticFocus();
      return;
    }
    if (isEditable(target)) {
      recordActionLock(target, "create");
      if (
        canAutoRun() &&
        pointInsideRect(
          state.pointerX,
          state.pointerY,
          target.getBoundingClientRect(),
          24,
        )
      ) {
        switchSurface(findInteractionShell(target), "create");
      }
    } else if (isInteractive(target)) {
      recordActionLock(target, "act");
      const collection = collectionSurfaceFrom(target);
      if (collection && canAutoRun()) {
        if (state.siteProfile?.strictTargeting) queueHoverAcquire(target);
        else switchSurface(collection, "scan");
      }
    }
  }

  function interactiveTriggerOpensLayer(target) {
    if (!target?.closest) return false;
    return !!target.closest(
      '[aria-haspopup], [aria-expanded="true"], [role="menuitem"], [role="combobox"]',
    );
  }

  function onPointerDown(event) {
    state.hasUserInteracted = true;
    const target = event.target;
    const video = target.closest?.(MEDIA_SELECTOR);
    if (video) state.mediaActivatedAt.set(video, nowTs());
    if (
      interactiveTriggerOpensLayer(target) ||
      transientInteractionFrom(target)
    ) {
      suspendAutomaticFocus();
      return;
    }
    if (isInteractive(target) && !state.activeSurface?.contains(target)) {
      suspendAutomaticFocus();
    }
  }

  function onDragStart() {
    state.dragging = true;
    suspendAutomaticFocus(state.settings.actionLockMs);
  }

  function onDragEnd() {
    state.dragging = false;
    suspendAutomaticFocus(state.settings.interactionGraceMs);
  }

  function onClick(event) {
    state.hasUserInteracted = true;
    const target = event.target;
    const clickedVideo = target.closest?.(MEDIA_SELECTOR);
    if (clickedVideo) {
      state.mediaActivatedAt.set(clickedVideo, nowTs());
    }
    if (state.pickMode) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      state.pickMode = false;
      state.shell?.classList.remove("choosing");
      if (state.pickSurface && document.contains(state.pickSurface)) {
        state.activeSurface = state.pickSurface;
        state.pinned = true;
        attachObservers(state.activeSurface);
      } else {
        state.pinned = false;
        hideOverlay(true);
      }
      state.pickSurface = null;
      pushRuntimeState();
      return;
    }
    if (isEditable(target)) {
      recordActionLock(target, "create");
      if (canAutoRun()) switchSurface(findInteractionShell(target), "create");
      return;
    }
    if (isInteractive(target)) {
      recordActionLock(target, "act");
      if (interactiveTriggerOpensLayer(target)) {
        suspendAutomaticFocus();
        return;
      }
      const collection = collectionSurfaceFrom(target);
      if (collection && canAutoRun()) {
        if (state.siteProfile?.strictTargeting) queueHoverAcquire(target);
        else switchSurface(collection, "scan");
        return;
      }
      if (
        state.visible &&
        state.activeRect &&
        pointInsideRect(event.clientX, event.clientY, state.activeRect, 0)
      ) {
        scheduleSurfaceRefresh("click");
      }
      return;
    }

    if (
      event.shiftKey &&
      canManualRun() &&
      (getSelection()?.isCollapsed ?? true)
    ) {
      const surface = nearestSurfaceFromPointer(pageFamily(), target);
      if (surface) switchSurface(surface, pageFamily(), { pin: true });
    }
  }

  function onKeyDown(event) {
    if (event.key === "Escape" && state.pickMode) {
      state.pickMode = false;
      state.pickSurface = null;
      state.shell?.classList.remove("choosing");
      hideOverlay(true);
      pushRuntimeState();
      return;
    }
    if (visibleTransientInteraction()) {
      suspendAutomaticFocus();
      return;
    }
    const activeElement = document.activeElement;
    if (transientInteractionFrom(activeElement)) {
      suspendAutomaticFocus();
      return;
    }
    if (isEditable(activeElement)) {
      state.lastKeyAt = nowTs();
      recordActionLock(activeElement, "create");
      if (
        state.activeMode === "create" &&
        state.activeSurface?.contains(activeElement)
      ) {
        if (canAutoRun()) scheduleSurfaceRefresh("keydown");
        return;
      }
      if (canAutoRun())
        switchSurface(findInteractionShell(activeElement), "create");
      return;
    }
    if (event.key === "Escape") {
      state.pinned = false;
      state.actionLockEl = null;
      state.actionUntil = 0;
      state.activeSurface = null;
      state.activeMode = null;
      focusCoordinator.clear();
      hideOverlay(true);
      scheduleReacquire();
    }
  }

  function onMediaPlay(event) {
    const video = event.target;
    if (!(video instanceof HTMLVideoElement) || !isVisible(video)) return;
    if (!isStrongPlayingVideo(video)) return;
    state.activeMedia = video;
    const surface = mediaSurfaceFrom(video);
    if (!surface || state.pinned || !canAutoRun()) return;
    clearTimeout(state.transitionTimer);
    state.transitionTimer = setTimeout(() => {
      if (isStrongPlayingVideo(video) && canAutoRun() && !state.pinned) {
        switchSurface(surface, "media");
      }
    }, state.settings.mediaFocusMs);
  }

  function onMediaStop(event) {
    if (
      event.target !== state.activeMedia &&
      event.target !== state.pictureInPictureMedia
    )
      return;
    if (event.target === state.activeMedia) state.activeMedia = null;
    if (event.target === state.pictureInPictureMedia) return;
    scheduleReacquire(state.settings.interactionGraceMs);
  }

  function onEnterPictureInPicture(event) {
    if (!(event.target instanceof HTMLVideoElement)) return;
    state.pictureInPictureMedia = event.target;
    if (event.target === state.activeMedia) state.activeMedia = null;
    if (state.activeMode === "media") {
      state.activeSurface = null;
      state.activeMode = null;
      focusCoordinator.clear();
      hideOverlay(true);
    }
  }

  function onLeavePictureInPicture(event) {
    const video = event.target;
    if (video !== state.pictureInPictureMedia) return;
    state.pictureInPictureMedia = null;
    if (!isStrongPlayingVideo(video) || !canAutoRun() || state.pinned) {
      scheduleReacquire(state.settings.interactionGraceMs);
      return;
    }
    state.activeMedia = video;
    const surface = mediaSurfaceFrom(video);
    if (!surface) return;
    clearTimeout(state.transitionTimer);
    state.transitionTimer = setTimeout(() => {
      if (isStrongPlayingVideo(video) && canAutoRun() && !state.pinned) {
        switchSurface(surface, "media");
      }
    }, state.settings.mediaFocusMs);
  }

  function onFullscreenChange() {
    state.fullscreenSuspended = !!document.fullscreenElement;
    if (state.fullscreenSuspended) {
      suspendAutomaticFocus(state.settings.fullscreenExitGraceMs);
      return;
    }
    state.interactionUntil = nowTs() + state.settings.fullscreenExitGraceMs;
    clearTimeout(state.transitionTimer);
    state.transitionTimer = setTimeout(() => {
      if (!restoreIncumbent()) scheduleReacquire();
    }, state.settings.fullscreenExitGraceMs);
  }

  function loadSettings() {
    return new Promise((resolve) => {
      storage.get(null, (items) => resolve(normalizeSettings(items || {})));
    });
  }

  async function loadTabPause() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "UMBRA_GET_TAB_PAUSE",
      });
      return !!response?.pausedForTab;
    } catch (_) {
      return false;
    }
  }

  function applySettings(newSettings) {
    state.settings = normalizeSettings(newSettings || {});
    applyVisualSettings();
    if (!canManualRun()) {
      state.pinned = false;
      state.activeSurface = null;
      clearObservers();
      hideOverlay(true);
    }
  }

  function runtimeState() {
    const snapshot = {
      pausedForTab: state.pausedForTab,
      hostname: location.hostname,
      siteMode: currentSiteMode(),
      autoBlockedReason: autoBlockedReason(),
      activeMode: state.activeMode,
      hasActiveSurface: !!(
        state.activeSurface && document.contains(state.activeSurface)
      ),
      pinned: state.pinned,
      choosing: state.pickMode,
      profile: state.siteProfile?.id || "generic",
    };
    if (state.settings.debug) {
      snapshot.activeSurfaceId = state.activeSurface?.id || "";
      snapshot.activeSurfaceTag = state.activeSurface?.tagName || "";
      snapshot.activeMediaId = state.activeMedia?.id || "";
      snapshot.pictureInPictureMediaId = state.pictureInPictureMedia?.id || "";
    }
    return snapshot;
  }

  function pushRuntimeState() {
    try {
      chrome.runtime
        .sendMessage({ type: "UMBRA_STATE_PUSH", state: runtimeState() })
        ?.catch?.(() => {});
    } catch (_) {}
  }

  function setupRuntime() {
    state.runtimeMessageHandler = (message, _sender, sendResponse) => {
      try {
        if (!message || typeof message !== "object") return;
        if (message.type === "UMBRA_GET_STATE") {
          sendResponse(runtimeState());
          return true;
        }
        if (message.type === "UMBRA_TOGGLE_TAB_PAUSE") {
          state.pausedForTab = !state.pausedForTab;
          if (state.pausedForTab) {
            state.pinned = false;
            clearObservers();
            hideOverlay(true);
          } else {
            scheduleReacquire();
          }
          pushRuntimeState();
          sendResponse({ pausedForTab: state.pausedForTab });
          return true;
        }
        if (message.type === "UMBRA_BEGIN_PICK") {
          if (canManualRun()) {
            state.pickMode = true;
            state.pickSurface = null;
            state.pinned = false;
            state.activeSurface = null;
            hideOverlay(true);
            sendResponse({ ok: true });
          } else {
            sendResponse({ ok: false, reason: autoBlockedReason() });
          }
          return true;
        }
        if (message.type === "UMBRA_FOCUS_NOW") {
          if (canManualRun()) {
            const target = nearestManualSurface(pageFamily());
            if (target?.surface) switchSurface(target.surface, target.family);
            sendResponse({ ok: !!target?.surface });
          } else {
            sendResponse({ ok: false, reason: autoBlockedReason() });
          }
          return true;
        }
        if (message.type === "UMBRA_PIN_NOW") {
          if (canManualRun()) {
            const target = nearestManualSurface(pageFamily());
            if (target?.surface)
              switchSurface(target.surface, target.family, { pin: true });
            sendResponse({ ok: !!target?.surface });
          } else {
            sendResponse({ ok: false, reason: autoBlockedReason() });
          }
          return true;
        }
        if (message.type === "UMBRA_CLEAR_FOCUS") {
          state.pickMode = false;
          state.pickSurface = null;
          state.pinned = false;
          state.activeSurface = null;
          state.activeMode = null;
          state.shell?.classList.remove("choosing");
          clearObservers();
          hideOverlay(true);
          pushRuntimeState();
          sendResponse({ ok: true });
          return true;
        }
        return false;
      } catch (err) {
        log("message handler error", err);
        try {
          sendResponse({ ok: false, error: "UMBRA_CONTEXT_ERROR" });
        } catch (_) {}
        return true;
      }
    };
    chrome.runtime.onMessage.addListener(state.runtimeMessageHandler);
  }

  function setupStorageWatcher() {
    state.storageChangedHandler = (changes, areaName) => {
      if (areaName !== "sync") return;
      const updates = {};
      for (const [key, payload] of Object.entries(changes))
        updates[key] = payload.newValue;
      applySettings({ ...state.settings, ...updates });
      state.siteProfile = resolveSiteProfile();
      pushRuntimeState();
      scheduleReacquire();
    };
    chrome.storage.onChanged.addListener(state.storageChangedHandler);
  }

  function queueInteractionLayerCheck() {
    clearTimeout(state.interactionCheckTimer);
    state.interactionCheckTimer = setTimeout(() => {
      state.interactionCheckTimer = null;
      if (visibleTransientInteraction()) {
        suspendAutomaticFocus();
        return;
      }
      if (
        !state.dragging &&
        !state.fullscreenSuspended &&
        nowTs() >= state.interactionUntil &&
        !state.visible
      ) {
        if (!restoreIncumbent()) scheduleReacquire();
      }
    }, 60);
  }

  function setupPageObserver() {
    state.pageObserver?.disconnect();
    state.pageObserver = new MutationObserver(queueInteractionLayerCheck);
    state.pageObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "aria-expanded",
        "aria-hidden",
        "aria-modal",
        "class",
        "hidden",
        "inert",
        "open",
        "popover",
        "style",
      ],
    });
  }

  function handleLocationChange() {
    if (location.href === state.lastHref) return false;
    state.lastHref = location.href;
    state.siteProfile = resolveSiteProfile();
    state.pinned = false;
    state.actionLockEl = null;
    state.actionLockMode = null;
    state.actionUntil = 0;
    state.activeSurface = null;
    state.activeMode = null;
    clearObservers();
    hideOverlay(true);
    pushRuntimeState();
    scheduleReacquire();
    return true;
  }

  function queueLocationCheck() {
    clearTimeout(state.routeCheckTimer);
    state.routeCheckTimer = setTimeout(() => {
      state.routeCheckTimer = null;
      handleLocationChange();
    }, 80);
  }

  function onNavigationNavigate(event) {
    if (event?.finished && typeof event.finished.then === "function") {
      event.finished.then(queueLocationCheck).catch(queueLocationCheck);
      return;
    }
    queueLocationCheck();
  }

  function onPopState() {
    queueLocationCheck();
  }

  function setupRouteWatcher() {
    state.lastHref = location.href;
    if (globalThis.navigation?.addEventListener) {
      state.navigationHandler = onNavigationNavigate;
      globalThis.navigation.addEventListener(
        "navigate",
        state.navigationHandler,
      );
      return;
    }
    window.addEventListener("popstate", onPopState);
    state.routePollId = setInterval(handleLocationChange, 500);
  }

  function onResize() {
    scheduleSurfaceRefresh("resize");
  }

  function handleVisibility(hidden) {
    if (hidden) {
      hideOverlay(true, { preserveSurface: true });
      return;
    }
    if (!restoreIncumbent()) scheduleReacquire();
  }

  function onVisibilityChange() {
    handleVisibility(document.hidden);
  }

  function teardown() {
    window.removeEventListener("mousemove", onPointerMove);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("focusin", onFocusIn, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("dragstart", onDragStart, true);
    document.removeEventListener("dragend", onDragEnd, true);
    document.removeEventListener("play", onMediaPlay, true);
    document.removeEventListener("pause", onMediaStop, true);
    document.removeEventListener("ended", onMediaStop, true);
    document.removeEventListener(
      "enterpictureinpicture",
      onEnterPictureInPicture,
      true,
    );
    document.removeEventListener(
      "leavepictureinpicture",
      onLeavePictureInPicture,
      true,
    );
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("popstate", onPopState);
    if (state.navigationHandler && globalThis.navigation?.removeEventListener) {
      globalThis.navigation.removeEventListener(
        "navigate",
        state.navigationHandler,
      );
    }
    if (state.runtimeMessageHandler) {
      chrome.runtime.onMessage.removeListener(state.runtimeMessageHandler);
    }
    if (state.storageChangedHandler) {
      chrome.storage.onChanged.removeListener(state.storageChangedHandler);
    }
    clearObservers();
    state.pageObserver?.disconnect();
    state.pageObserver = null;
    clearTimeout(state.interactionCheckTimer);
    state.interactionCheckTimer = null;
    clearTimers();
    state.overlayHost?.remove();
    state.overlayHost = null;
    state.overlayShadow = null;
    state.mask = null;
    state.maskPath = null;
    state.shell = null;
    state.activeSurface = null;
    state.activeRect = null;
    state.activeMode = null;
    state.visible = false;
    state.navigationHandler = null;
    state.runtimeMessageHandler = null;
    state.storageChangedHandler = null;
    globalThis.UMBRA_RUNTIME = null;
    globalThis.__umbraInjected = false;
  }

  function onPageHide(event) {
    if (event?.persisted) {
      hideOverlay(true);
      return;
    }
    teardown();
  }

  function onPageShow(event) {
    if (!event?.persisted) return;
    state.siteProfile = resolveSiteProfile();
    loadSettings()
      .then(applySettings)
      .catch(() => {});
    if (state.pinned) refreshActiveSurface();
    else scheduleReacquire();
    pushRuntimeState();
  }

  if (globalThis.__UMBRA_TEST_HOOKS__) {
    globalThis.UMBRA_TEST_API = {
      state,
      clamp,
      distance,
      normalizeHost,
      candidateScore,
      collectionSurfaceFrom,
      repeatedSiblingPattern,
      resolvedTargetFromPoint,
      pageFamily,
      focusCoordinator,
      rectForElement,
      handleLocationChange,
      handleVisibility,
      switchSurface,
      teardown,
    };
  }

  async function mount() {
    globalThis.UMBRA_RUNTIME = { teardown, version: RUNTIME_VERSION };
    state.siteProfile = resolveSiteProfile();
    const [settings, pausedForTab] = await Promise.all([
      loadSettings(),
      loadTabPause(),
    ]);
    state.pausedForTab = pausedForTab;
    applySettings(settings);
    ensureOverlay();
    setupRuntime();
    setupStorageWatcher();
    setupRouteWatcher();
    setupPageObserver();

    window.addEventListener("mousemove", onPointerMove, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("dragend", onDragEnd, true);
    document.addEventListener("play", onMediaPlay, true);
    document.addEventListener("pause", onMediaStop, true);
    document.addEventListener("ended", onMediaStop, true);
    document.addEventListener(
      "enterpictureinpicture",
      onEnterPictureInPicture,
      true,
    );
    document.addEventListener(
      "leavepictureinpicture",
      onLeavePictureInPicture,
      true,
    );
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);

    if (!canManualRun()) hideOverlay(true);
    pushRuntimeState();
  }

  mount().catch((err) => console.error("[Umbra2 mount error]", err));
})();
