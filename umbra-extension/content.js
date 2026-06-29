
(() => {
  if (globalThis.__umbraInjected) return;
  globalThis.__umbraInjected = true;

  const settingsDefaults = globalThis.UMBRA_DEFAULTS;
  const normalizeSettings = globalThis.UMBRA_NORMALIZE_SETTINGS;

  const INTERACTIVE_SELECTOR = [
    'button', 'input', 'textarea', 'select', 'summary', 'details',
    'a[href]', '[role="button"]', '[role="tab"]', '[role="link"]',
    '[role="menuitem"]', '[role="checkbox"]', '[role="switch"]',
    '[contenteditable="true"]', '[contenteditable="plaintext-only"]'
  ].join(',');

  const EDITABLE_SELECTOR = [
    'textarea', 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"])',
    '[contenteditable="true"]', '[contenteditable="plaintext-only"]',
    '[role="textbox"]'
  ].join(',');

  const state = {
    settings: { ...settingsDefaults },
    siteProfile: null,
    pausedForTab: false,
    pinned: false,
    activeSurface: null,
    activeRect: null,
    activeMode: null,
    pointerX: Math.round(window.innerWidth / 2),
    pointerY: Math.round(window.innerHeight / 2),
    lastPointerMoveAt: 0,
    lastScrollAt: 0,
    lastInteractionAt: 0,
    lastKeyAt: 0,
    lastClickAt: 0,
    hasUserInteracted: false,
    hoverTimer: null,
    previewTimer: null,
    scrollTimer: null,
    hideTimer: null,
    transitionTimer: null,
    actionLockEl: null,
    actionLockMode: null,
    actionUntil: 0,
    nextAutoAcquireAt: 0,
    overlayHost: null,
    overlayShadow: null,
    shell: null,
    dimmers: null,
    visible: false,
    resizeObserver: null,
    mutationObserver: null,
    rafId: 0,
    mutationRefreshTimer: null,
    routePollId: null,
    routeCheckTimer: null,
    lastHref: location.href,
    navigationHandler: null,
    runtimeMessageHandler: null,
    storageChangedHandler: null
  };

  const storage = chrome.storage.sync;

  function log(...args) {
    if (state.settings.debug) console.log('[Umbra2]', ...args);
  }

  function nowTs() { return Date.now(); }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function distance(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function normalizeHost(value) { return globalThis.UMBRA_NORMALIZE_HOST(value); }
  function selectorList(list) { return Array.isArray(list) ? list.filter(Boolean) : []; }

  function getProfiles() {
    return Array.isArray(globalThis.UMBRA_SITE_PROFILES) ? globalThis.UMBRA_SITE_PROFILES : [];
  }

  function resolveSiteProfile() {
    const ctx = { host: normalizeHost(location.hostname), pathname: location.pathname, href: location.href, doc: document };
    for (const profile of getProfiles()) {
      try {
        if (typeof profile.match === 'function' && profile.match(ctx)) return profile;
      } catch (err) {
        log('profile match error', err);
      }
    }
    return {
      id: 'generic',
      label: 'Generic',
      intent: 'generic',
      defaultMode: 'auto',
      quickSelectors: ['article', 'main', 'section'],
      preferSelectors: ['article', 'main', 'section'],
      surfaceSelectors: ['article', 'main', 'section', '[role="article"]', '[role="main"]'],
      rejectSelectors: ['aside', 'nav', 'header', 'footer'],
      rejectTokens: ['sidebar', 'menu', 'toolbar', 'banner', 'modal', 'dialog', 'popup', 'overlay', 'search', 'rail'],
      fallbackSelectors: ['article', 'main', '[role="article"]', '[role="main"]']
    };
  }

  function currentSiteMode() {
    const host = normalizeHost(location.hostname);
    const overrides = state.settings.siteOverrides || {};
    if (overrides[host]) return overrides[host];
    const parts = host.split('.');
    for (let i = 1; i < parts.length - 1; i += 1) {
      const suffix = parts.slice(i).join('.');
      if (overrides[suffix]) return overrides[suffix];
    }
    return state.siteProfile?.defaultMode || 'auto';
  }

  function visibleCount(selector) {
    return [...document.querySelectorAll(selector)].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
    }).length;
  }

  function isUtilityLikePage() {
    const intent = state.siteProfile?.intent || 'generic';
    if (['article', 'timeline', 'chat', 'gmail', 'comparative'].includes(intent)) return false;
    if (intent === 'utility') return true;
    const buttons = visibleCount('button, [role="button"], input, textarea, select, [contenteditable="true"]');
    const menus = visibleCount('nav, [role="navigation"], [role="tablist"], [role="toolbar"], [role="menu"], [role="grid"], [role="tree"]');
    const paragraphs = visibleCount('p, article, main, blockquote');
    if (menus >= 3 && buttons >= 10 && paragraphs <= 4) return true;
    if (buttons >= 16 && paragraphs <= 2) return true;
    return false;
  }

  function topLayerModalOpen() {
    try {
      if (document.querySelector(':modal')) return true;
    } catch (_) {
      if (document.querySelector('dialog[open]')) return true;
    }
    try {
      return !!document.querySelector(':popover-open');
    } catch (_) {
      return false;
    }
  }

  function autoBlockedReason() {
    if (!state.settings.enabled) return 'disabled';
    if (state.pausedForTab) return 'paused';
    if (topLayerModalOpen()) return 'modal-open';
    const mode = currentSiteMode();
    if (mode === 'off') return 'site-off';
    if (mode === 'manual') return 'site-manual';
    if (state.settings.appAutoSuppress && isUtilityLikePage()) return 'utility-page';
    return null;
  }

  function canManualRun() {
    return state.settings.enabled && !state.pausedForTab && currentSiteMode() !== 'off';
  }

  function canAutoRun() {
    return canManualRun() && !autoBlockedReason();
  }

  function ensureOverlay() {
    if (state.overlayHost) return;
    const host = document.createElement('div');
    host.id = 'umbra-overlay-host';
    host.setAttribute('aria-hidden', 'true');
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.pointerEvents = 'none';
    host.style.zIndex = '2147483646';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .dimmer {
        position: fixed;
        pointer-events: none;
        opacity: 0;
        background: rgba(var(--umbra-dim-rgb, 0,0,0), var(--umbra-opacity,0.58));
        transition: opacity 90ms ease;
        will-change: opacity;
      }
      .dimmer.visible { opacity: 1; }
      .shell {
        position: fixed;
        left: 0;
        top: 0;
        width: 0;
        height: 0;
        opacity: 0;
        background: transparent;
        border-radius: var(--umbra-radius, 18px);
        border: 1px solid var(--umbra-outline, rgba(255,255,255,0.10));
        box-shadow: 0 0 var(--umbra-edge-feather, 0px) rgba(var(--umbra-dim-rgb, 0,0,0), var(--umbra-opacity,0.58));
        transition:
          left var(--umbra-transition,170ms) ease,
          top var(--umbra-transition,170ms) ease,
          width var(--umbra-transition,170ms) ease,
          height var(--umbra-transition,170ms) ease,
          opacity 90ms ease;
        will-change: left, top, width, height, opacity;
      }
      .shell.visible { opacity: 1; }
      .shell.preview {
        opacity: 1;
        box-shadow: none;
        border-color: rgba(255,255,255,0.34);
      }
      @media (prefers-reduced-motion: reduce) {
        .shell {
          transition: opacity 90ms ease;
          will-change: opacity;
        }
        .dimmer {
          transition: opacity 90ms ease;
        }
      }
      @media (prefers-contrast: more) {
        .dimmer {
          background: rgba(0,0,0,0.70);
        }
        .shell {
          border-color: rgba(255,255,255,0.36);
        }
      }
      @media (forced-colors: active) {
        .dimmer {
          display: none;
        }
        .shell {
          border: 2px solid CanvasText;
          box-shadow: none;
        }
      }
    `;
    const dimmers = ['top', 'right', 'bottom', 'left'].map((name) => {
      const dimmer = document.createElement('div');
      dimmer.className = `dimmer ${name}`;
      return dimmer;
    });
    const shell = document.createElement('div');
    shell.className = 'shell';
    shadow.append(style, ...dimmers, shell);
    document.documentElement.appendChild(host);
    state.overlayHost = host;
    state.overlayShadow = shadow;
    state.shell = shell;
    state.dimmers = dimmers;
    applyVisualSettings();
  }

  function applyVisualSettings() {
    if (!state.overlayHost) return;
    const rgb = hexToRgb(state.settings.dimTint || '#000000');
    const opacity = state.settings.solidDim ? 1 : state.settings.overlayOpacity;
    state.overlayHost.style.setProperty('--umbra-opacity', String(opacity));
    state.overlayHost.style.setProperty('--umbra-dim-rgb', rgb.join(','));
    state.overlayHost.style.setProperty('--umbra-radius', `${state.settings.cornerRadius}px`);
    state.overlayHost.style.setProperty('--umbra-transition', `${state.settings.transitionMs}ms`);
    state.overlayHost.style.setProperty('--umbra-outline', state.settings.showOutline ? 'rgba(255,255,255,0.10)' : 'transparent');
    state.overlayHost.style.setProperty('--umbra-edge-feather', `${state.settings.edgeFeather || 0}px`);
  }

  function hexToRgb(value) {
    const match = String(value || '').trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!match) return [0, 0, 0];
    return match.slice(1).map((part) => parseInt(part, 16));
  }

  function setDimmers(rect, visible) {
    if (!state.dimmers) return;
    const [topDimmer, rightDimmer, bottomDimmer, leftDimmer] = state.dimmers;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const left = clamp(rect.left, 0, width);
    const right = clamp(rect.right, 0, width);
    const top = clamp(rect.top, 0, height);
    const bottom = clamp(rect.bottom, 0, height);
    const specs = [
      [topDimmer, 0, 0, width, top],
      [rightDimmer, right, top, Math.max(0, width - right), Math.max(0, bottom - top)],
      [bottomDimmer, 0, bottom, width, Math.max(0, height - bottom)],
      [leftDimmer, 0, top, left, Math.max(0, bottom - top)]
    ];
    for (const [node, x, y, w, h] of specs) {
      node.style.left = `${Math.round(x)}px`;
      node.style.top = `${Math.round(y)}px`;
      node.style.width = `${Math.round(w)}px`;
      node.style.height = `${Math.round(h)}px`;
      node.classList.toggle('visible', visible && w > 0 && h > 0);
    }
  }

  function hideDimmers() {
    if (!state.dimmers) return;
    for (const dimmer of state.dimmers) dimmer.classList.remove('visible');
  }

  function clearHideTimer() {
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }
  }

  function hideOverlay(immediate = false) {
    clearHideTimer();
    if (!state.shell) return;
    if (immediate) {
      state.shell.classList.remove('visible', 'preview');
      hideDimmers();
      state.visible = false;
      state.activeRect = null;
      if (!state.pinned) state.activeSurface = null;
      return;
    }
    state.hideTimer = setTimeout(() => {
      state.shell.classList.remove('visible', 'preview');
      hideDimmers();
      state.visible = false;
      state.activeRect = null;
      if (!state.pinned) state.activeSurface = null;
    }, state.settings.hideGraceMs || 45);
  }

  function setShellRect(rect) {
    ensureOverlay();
    if (topLayerModalOpen()) {
      hideOverlay(true);
      return;
    }
    if (!rect) {
      hideOverlay(true);
      return;
    }
    state.activeRect = rect;
    state.shell.classList.remove('preview');
    setDimmers(rect, true);
    state.shell.style.left = `${Math.round(rect.left)}px`;
    state.shell.style.top = `${Math.round(rect.top)}px`;
    state.shell.style.width = `${Math.max(0, Math.round(rect.width))}px`;
    state.shell.style.height = `${Math.max(0, Math.round(rect.height))}px`;
    state.shell.classList.add('visible');
    state.visible = true;
  }

  function setPreviewRect(rect) {
    ensureOverlay();
    if (!rect || state.visible || state.pinned) return;
    state.shell.classList.add('preview', 'visible');
    state.shell.style.left = `${Math.round(rect.left)}px`;
    state.shell.style.top = `${Math.round(rect.top)}px`;
    state.shell.style.width = `${Math.max(0, Math.round(rect.width))}px`;
    state.shell.style.height = `${Math.max(0, Math.round(rect.height))}px`;
  }

  function rectForElement(el) {
    if (!el || !document.contains(el)) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    if (r.right <= 0 || r.left >= window.innerWidth || r.bottom <= 0 || r.top >= window.innerHeight) return null;
    const left = r.left - state.settings.paddingX;
    const top = r.top - state.settings.paddingY;
    const right = r.right + state.settings.paddingX;
    const bottom = r.bottom + state.settings.paddingY;
    const width = right - left;
    const height = bottom - top;
    if (r.width < 40 || r.height < 28) return null;
    if (state.settings.focusMode === 'band') {
      const bandHeight = Math.min(height, Math.max(96, window.innerHeight * 0.28));
      const bandCenter = readingBandPoint().y;
      const bandTop = clamp(bandCenter - bandHeight / 2, top, bottom - bandHeight);
      return { left, top: bandTop, width, height: bandHeight, right, bottom: bandTop + bandHeight };
    }
    return { left, top, width, height, right, bottom };
  }

  function pointInsideRect(x, y, rect, buffer = 0) {
    if (!rect) return false;
    return x >= rect.left - buffer && x <= rect.right + buffer && y >= rect.top - buffer && y <= rect.bottom + buffer;
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
      try { return node.matches(selector); } catch (_) { return false; }
    });
  }

  function classTokenString(node) {
    return `${node?.className || ''} ${node?.id || ''}`.toLowerCase();
  }

  function containsRejectToken(node) {
    const tokens = selectorList(state.siteProfile?.rejectTokens);
    if (!tokens.length) return false;
    const str = classTokenString(node);
    return tokens.some((token) => str.includes(String(token).toLowerCase()));
  }

  function isVisible(el, rect = null, style = null) {
    if (!el || !document.contains(el)) return false;
    const r = rect || el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    if (r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) return false;
    const s = style || getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || '1') > 0.01;
  }

  function pageFamily() {
    const intent = state.siteProfile?.intent || 'generic';
    if (intent === 'comparative') return 'compare';
    if (intent === 'utility') return 'act';
    if (['article', 'timeline', 'chat', 'gmail'].includes(intent)) return 'read';
    return 'read';
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
    const sameTag = children.filter((child) => child.tagName === el.tagName).length;
    let similar = 0;
    const base = baseRect || el.getBoundingClientRect();
    for (const child of children.slice(0, 12)) {
      const r = child.getBoundingClientRect();
      if (Math.abs(r.height - base.height) < Math.max(24, base.height * 0.35) && Math.abs(r.width - base.width) < Math.max(40, base.width * 0.35)) {
        similar += 1;
      }
    }
    return (sameTag + similar) / 2;
  }

  function pointerPoint() {
    return { x: state.pointerX, y: state.pointerY };
  }

  function readingBandPoint() {
    return {
      x: Math.round(window.innerWidth * 0.5),
      y: Math.round(window.innerHeight * clamp(Number(state.settings.readingBandY) || 0.42, 0.2, 0.75))
    };
  }

  function findInteractionShell(start) {
    if (!start) return null;
    let node = isEditable(start) || isInteractive(start) ? start : start.closest?.(EDITABLE_SELECTOR) || start.closest?.(INTERACTIVE_SELECTOR) || start;
    const selectors = [
      '[role="dialog"]', '[aria-modal="true"]', 'dialog',
      'form', '[data-testid*="composer" i]', '[class*="composer" i]', '[class*="reply" i]',
      '[class*="editor" i]', '[class*="input" i]', '[class*="prompt" i]', '[class*="comment" i]',
      'footer'
    ];
    const shell = closestAny(node, selectors);
    if (shell && isVisible(shell)) return shell;
    let cur = node;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const r = cur.getBoundingClientRect();
      if (r.width > 180 && r.height > 56 && r.width < window.innerWidth * 0.96 && r.height < window.innerHeight * 0.72) {
        const edits = cur.querySelectorAll?.(EDITABLE_SELECTOR).length || 0;
        const buttons = cur.querySelectorAll?.('button, [role="button"]').length || 0;
        if (edits || buttons >= 2) return cur;
      }
      cur = cur.parentElement;
    }
    return node;
  }

  function findComparativeShell(start) {
    if (!start) return null;
    const direct = closestAny(start, ['table', '[role="table"]', '[role="grid"]', '[class*="table" i]', '[class*="grid" i]', '[class*="list" i]']);
    if (direct && isVisible(direct)) return direct;
    let cur = start;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const repeated = repeatedSiblingPattern(cur);
      const r = cur.getBoundingClientRect();
      if (repeated >= 4 && r.width > window.innerWidth * 0.38 && r.height > 120) return cur.parentElement || cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function collectCandidatesFromPoint(x, y) {
    const candidates = new Set();
    const base = document.elementFromPoint(x, y);
    if (!base) return [];
    let node = base;
    while (node && node !== document.body && node !== document.documentElement) {
      candidates.add(node);
      const preferred = closestAny(node, state.siteProfile?.surfaceSelectors);
      if (preferred) candidates.add(preferred);
      const preferred2 = closestAny(node, state.siteProfile?.preferSelectors);
      if (preferred2) candidates.add(preferred2);
      node = node.parentElement;
    }

    for (const selector of selectorList(state.siteProfile?.quickSelectors).slice(0, 6)) {
      try {
        const nearby = document.querySelectorAll(selector);
        for (const el of nearby) {
          if (!isVisible(el)) continue;
          const r = el.getBoundingClientRect();
          if (x >= r.left - 48 && x <= r.right + 48 && y >= r.top - 48 && y <= r.bottom + 48) candidates.add(el);
        }
      } catch (_) {}
    }
    return [...candidates];
  }

  function candidateScore(el, point, family) {
    if (!el || !document.contains(el)) return -Infinity;
    if (matchesAny(el, state.siteProfile?.rejectSelectors) || containsRejectToken(el)) return -Infinity;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0.01) return -Infinity;
    if ((style.position === 'fixed' || style.position === 'sticky') && !isEditable(el) && !isInteractive(el)) return -90;
    const r = el.getBoundingClientRect();
    if (!isVisible(el, r, style)) return -Infinity;
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    const area = Math.max(1, r.width * r.height);
    const areaRatio = area / viewportArea;
    let score = 0;
    if (pointInsideRect(point.x, point.y, { ...r, right: r.right, bottom: r.bottom }, 0)) score += 24;
    score -= Math.min(distance(point.x, point.y, r.left + r.width / 2, r.top + r.height / 2) / 40, 18);
    if (matchesAny(el, state.siteProfile?.surfaceSelectors)) score += 12;
    if (matchesAny(el, state.siteProfile?.preferSelectors)) score += 8;
    if (matchesAny(el, state.siteProfile?.quickSelectors)) score += 4;
    if (el.tagName.toLowerCase() === 'article' || el.getAttribute('role') === 'article' || el.tagName.toLowerCase() === 'main') score += 10;

    const textLen = (el.textContent || '').trim().length;
    const interactiveCount = el.querySelectorAll?.('button, [role="button"], input, textarea, select, a[href]').length || 0;
    const paragraphCount = family === 'read' ? el.querySelectorAll?.('p, li, blockquote').length || 0 : 0;
    const rowLike = family === 'compare' ? repeatedSiblingPattern(el, r) : 0;

    if (family === 'read') {
      score += Math.min(textLen / 80, 28);
      score += Math.min(paragraphCount * 1.8, 10);
      score -= Math.min(interactiveCount, 20) * 0.8;
      if (areaRatio > 0.9) score -= 18;
      if (areaRatio < 0.02) score -= 12;
    } else if (family === 'compare') {
      score += Math.min(rowLike * 4, 18);
      if (areaRatio > 0.18 && areaRatio < 0.92) score += 12;
      if (el.matches?.('tr, [role="row"]')) score -= 30;
    } else if (family === 'create' || family === 'act') {
      const editables = el.querySelectorAll?.(EDITABLE_SELECTOR).length || 0;
      score += editables ? 18 : 0;
      score += Math.min(interactiveCount, 18) * 1.2;
      if (areaRatio > 0.96) score -= 12;
    }

    return score;
  }

  function bestSurfaceNearPoint(point, family) {
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
      const fallback = closestAny(document.elementFromPoint(point.x, point.y), state.siteProfile?.fallbackSelectors) || document.querySelector(selectorList(state.siteProfile?.fallbackSelectors).join(','));
      if (fallback && isVisible(fallback)) best = fallback;
    }
    return best;
  }

  function nearestSurfaceFromPoint(family, point, sourceEl = null) {
    if (family === 'create' || family === 'act') {
      const origin = sourceEl || document.elementFromPoint(point.x, point.y) || document.activeElement;
      return findInteractionShell(origin);
    }
    if (family === 'compare') {
      const origin = sourceEl || document.elementFromPoint(point.x, point.y);
      return findComparativeShell(origin) || bestSurfaceNearPoint(point, family);
    }
    if (family === 'read') {
      const origin = sourceEl || document.elementFromPoint(point.x, point.y);
      const direct = closestAny(origin, [
        ...selectorList(state.siteProfile?.surfaceSelectors),
        ...selectorList(state.siteProfile?.preferSelectors),
        ...selectorList(state.siteProfile?.quickSelectors)
      ]);
      if (direct && isVisible(direct)) return direct;
    }
    return bestSurfaceNearPoint(point, family);
  }

  function nearestSurfaceFromPointer(family, sourceEl = null) {
    return nearestSurfaceFromPoint(family, pointerPoint(), sourceEl);
  }

  function activeTyping() {
    return nowTs() - state.lastKeyAt < 900 && state.actionLockEl && document.contains(state.actionLockEl);
  }

  function actionLockActive() {
    return !!(state.actionLockEl && document.contains(state.actionLockEl) && nowTs() < state.actionUntil);
  }

  function actionSurfaceShouldWin() {
    if (!actionLockActive()) return false;
    if (activeTyping()) return true;
    const shell = findInteractionShell(state.actionLockEl);
    if (!shell) return false;
    const pointerInside = pointInsideRect(state.pointerX, state.pointerY, shell.getBoundingClientRect(), 24);
    if (pointerInside) return true;
    return nowTs() - state.lastInteractionAt < (state.settings.pointerPriorityMs || 220);
  }

  function attachObservers(surface) {
    if (state.resizeObserver) state.resizeObserver.disconnect();
    if (state.mutationObserver) state.mutationObserver.disconnect();
    if (!surface) return;

    state.resizeObserver = new ResizeObserver(() => scheduleSurfaceRefresh('resize'));
    state.resizeObserver.observe(surface);
    if (surface.parentElement) state.resizeObserver.observe(surface.parentElement);

    state.mutationObserver = new MutationObserver(() => scheduleSurfaceRefresh('mutation'));
    state.mutationObserver.observe(surface, { childList: true, subtree: true, characterData: true });
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
      return;
    }
    state.activeSurface = surface;
    state.activeMode = mode;
    state.pinned = !!pin;
    const rect = rectForElement(surface);
    if (!rect) {
      hideOverlay(true);
      return;
    }
    setShellRect(rect);
    attachObservers(surface);
  }

  function refreshActiveSurface() {
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
    if (_reason === 'mutation') {
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

  function scheduleReacquire() {
    clearTimeout(state.transitionTimer);
    const delay = Math.max(120, effectiveAutoAcquireDelay());
    state.transitionTimer = setTimeout(() => {
      if (!canAutoRun() || state.pinned) return;
      acquireSurface('transition');
    }, delay);
  }

  function clearTimers() {
    clearTimeout(state.hoverTimer);
    clearTimeout(state.previewTimer);
    clearTimeout(state.scrollTimer);
    clearTimeout(state.transitionTimer);
    clearTimeout(state.mutationRefreshTimer);
    clearTimeout(state.routeCheckTimer);
    clearInterval(state.routePollId);
    clearHideTimer();
    cancelAnimationFrame(state.rafId);
    state.hoverTimer = state.previewTimer = state.scrollTimer = state.transitionTimer = null;
    state.mutationRefreshTimer = state.routeCheckTimer = null;
    state.routePollId = null;
    state.rafId = 0;
  }

  function autoAcquireCooldownRemaining() {
    return Math.max(0, state.nextAutoAcquireAt - nowTs());
  }

  function effectiveAutoAcquireDelay() {
    if (state.actionLockEl && !activeTyping()) {
      return Math.min(autoAcquireCooldownRemaining(), Math.max(0, state.actionUntil - nowTs()));
    }
    return autoAcquireCooldownRemaining();
  }

  function bumpAutoAcquireCooldown(ms = state.settings.refocusCooldownMs || 5000) {
    const until = nowTs() + ms;
    if (until > state.nextAutoAcquireAt) state.nextAutoAcquireAt = until;
  }

  function autoAcquireBlocked(reason) {
    if (reason === 'manual' || reason === 'click' || reason === 'focus' || reason === 'keydown' || reason === 'scroll') return false;
    if (state.actionLockEl && !activeTyping() && nowTs() >= state.actionUntil) return false;
    return autoAcquireCooldownRemaining() > 0;
  }

  function usePointerReadTruth() {
    return nowTs() - state.lastPointerMoveAt > state.settings.dwellMs && !activeTyping();
  }

  function acquireSurface(reason) {
    if (!canAutoRun() || !state.hasUserInteracted || state.pinned) return null;
    if (autoAcquireBlocked(reason)) return null;

    let family = pageFamily();
    let sourceEl = null;
    let point = pointerPoint();

    if (actionSurfaceShouldWin()) {
      family = state.actionLockMode || 'create';
      sourceEl = state.actionLockEl;
    }

    if (reason === 'hover' || reason === 'transition') {
      if (usePointerReadTruth()) {
        family = pageFamily();
        sourceEl = null;
      }
    }

    if (reason === 'scroll' && !actionSurfaceShouldWin()) {
      family = pageFamily();
      sourceEl = null;
      point = readingBandPoint();
    }

    let surface = nearestSurfaceFromPoint(family, point, sourceEl);

    if (!surface && family !== 'read') {
      surface = nearestSurfaceFromPoint(pageFamily(), point);
      family = pageFamily();
    }

    if (!surface) {
      hideOverlay(false);
      return null;
    }

    switchSurface(surface, family);
    return surface;
  }

  function queueHoverAcquire() {
    clearTimeout(state.hoverTimer);
    if (!canAutoRun() || !state.settings.autoOnHover || state.pinned) return;
    const delay = Math.max(state.settings.dwellMs, effectiveAutoAcquireDelay());
    state.hoverTimer = setTimeout(() => {
      acquireSurface('hover');
    }, delay);
  }

  function queueBoundaryPreview() {
    clearTimeout(state.previewTimer);
    if (!canAutoRun() || !state.settings.autoOnHover || state.pinned || state.visible) return;
    state.previewTimer = setTimeout(() => {
      if (!canAutoRun() || state.pinned || state.visible) return;
      const surface = nearestSurfaceFromPointer(pageFamily());
      const rect = rectForElement(surface);
      if (rect) setPreviewRect(rect);
    }, 120);
  }

  function queueScrollAcquire() {
    clearTimeout(state.scrollTimer);
    if (!canAutoRun() || !state.settings.autoOnScroll || state.pinned) return;
    const delay = Math.max(state.settings.scrollIdleMs, effectiveAutoAcquireDelay());
    state.scrollTimer = setTimeout(() => {
      acquireSurface('scroll');
    }, delay);
  }

  function recordActionLock(el, mode) {
    state.actionLockEl = el;
    state.actionLockMode = mode;
    state.actionUntil = nowTs() + state.settings.actionLockMs;
    state.lastInteractionAt = nowTs();
  }

  function maybeHideOnPointerExit() {
    if (!state.visible || !state.activeRect || state.pinned) return;
    const buffer = state.settings.revealBuffer;
    if (!pointInsideRect(state.pointerX, state.pointerY, state.activeRect, buffer)) {
      const farOutside = !pointInsideRect(state.pointerX, state.pointerY, state.activeRect, buffer * 2.2);
      hideOverlay(farOutside);
    }
  }

  function onPointerMove(event) {
    const moved = distance(state.pointerX, state.pointerY, event.clientX, event.clientY);
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    state.lastPointerMoveAt = nowTs();
    state.hasUserInteracted = true;

    if (moved >= state.settings.stationaryTolerance) {
      if (state.visible && state.activeRect && pointInsideRect(state.pointerX, state.pointerY, state.activeRect, 0)) {
        maybeHideOnPointerExit();
        return;
      }
      bumpAutoAcquireCooldown();
      if (!state.pinned && state.visible) hideOverlay(true);
      queueBoundaryPreview();
      queueHoverAcquire();
    }
    maybeHideOnPointerExit();
  }

  function onScroll(event) {
    const target = event?.target;
    const isDocumentScroll = target === document || target === window || target === document.documentElement || target === document.body || target === document.scrollingElement;
    if (!isDocumentScroll && !state.activeSurface) return;
    state.hasUserInteracted = true;
    state.lastScrollAt = nowTs();
    bumpAutoAcquireCooldown();
    if (state.activeSurface && !state.pinned) scheduleSurfaceRefresh('scroll');
    else if (!state.pinned && state.visible) hideOverlay(true);
    queueScrollAcquire();
  }

  function onFocusIn(event) {
    const target = event.target;
    if (isEditable(target)) {
      recordActionLock(target, 'create');
      if (canAutoRun() && pointInsideRect(state.pointerX, state.pointerY, target.getBoundingClientRect(), 24)) {
        switchSurface(findInteractionShell(target), 'create');
      }
    } else if (isInteractive(target)) {
      recordActionLock(target, 'act');
    }
  }

  function onClick(event) {
    state.hasUserInteracted = true;
    state.lastClickAt = nowTs();
    const target = event.target;
    if (isEditable(target)) {
      recordActionLock(target, 'create');
      if (canAutoRun()) switchSurface(findInteractionShell(target), 'create');
      return;
    }
    if (isInteractive(target)) {
      recordActionLock(target, 'act');
      if (state.visible && state.activeRect && pointInsideRect(event.clientX, event.clientY, state.activeRect, 0)) {
        scheduleSurfaceRefresh('click');
      }
      return;
    }

    if (event.shiftKey && canManualRun() && (getSelection()?.isCollapsed ?? true)) {
      const surface = nearestSurfaceFromPointer(pageFamily(), target);
      if (surface) switchSurface(surface, pageFamily(), { pin: true });
    }
  }

  function onKeyDown(event) {
    const activeElement = document.activeElement;
    if (isEditable(activeElement)) {
      state.lastKeyAt = nowTs();
      recordActionLock(activeElement, 'create');
      if (state.activeMode === 'create' && state.activeSurface?.contains(activeElement)) {
        if (canAutoRun()) scheduleSurfaceRefresh('keydown');
        return;
      }
      if (canAutoRun()) switchSurface(findInteractionShell(activeElement), 'create');
      return;
    }
    if (event.key === 'Escape') {
      state.pinned = false;
      state.actionLockEl = null;
      state.actionUntil = 0;
      bumpAutoAcquireCooldown(0);
      hideOverlay(true);
      scheduleReacquire();
    }
  }

  function loadSettings() {
    return new Promise((resolve) => {
      storage.get(null, (items) => resolve(normalizeSettings(items || {})));
    });
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
    return {
      pausedForTab: state.pausedForTab,
      hostname: location.hostname,
      siteMode: currentSiteMode(),
      autoBlockedReason: autoBlockedReason(),
      activeMode: state.activeMode,
      profile: state.siteProfile?.id || 'generic'
    };
  }

  function setupRuntime() {
    state.runtimeMessageHandler = (message, _sender, sendResponse) => {
      try {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'UMBRA_GET_STATE') {
        sendResponse(runtimeState());
        return true;
      }
      if (message.type === 'UMBRA_TOGGLE_TAB_PAUSE') {
        state.pausedForTab = !state.pausedForTab;
        if (state.pausedForTab) {
          state.pinned = false;
          clearObservers();
          hideOverlay(true);
        } else {
          scheduleReacquire();
        }
        sendResponse({ pausedForTab: state.pausedForTab });
        return true;
      }
      if (message.type === 'UMBRA_FOCUS_NOW') {
        if (canManualRun()) {
          const surface = nearestSurfaceFromPointer(pageFamily());
          if (surface) switchSurface(surface, pageFamily());
        }
        sendResponse({ ok: true });
        return true;
      }
      if (message.type === 'UMBRA_PIN_NOW') {
        if (canManualRun()) {
          const surface = nearestSurfaceFromPointer(pageFamily());
          if (surface) switchSurface(surface, pageFamily(), { pin: true });
        }
        sendResponse({ ok: true });
        return true;
      }
      return false;
      } catch (err) {
        log('message handler error', err);
        try {
          sendResponse({ ok: false, error: 'UMBRA_CONTEXT_ERROR' });
        } catch (_) {}
        return true;
      }
    };
    chrome.runtime.onMessage.addListener(state.runtimeMessageHandler);
  }

  function setupStorageWatcher() {
    state.storageChangedHandler = (changes, areaName) => {
      if (areaName !== 'sync') return;
      const updates = {};
      for (const [key, payload] of Object.entries(changes)) updates[key] = payload.newValue;
      applySettings({ ...state.settings, ...updates });
      state.siteProfile = resolveSiteProfile();
      scheduleReacquire();
    };
    chrome.storage.onChanged.addListener(state.storageChangedHandler);
  }

  function handleLocationChange() {
    if (location.href === state.lastHref) return false;
    state.lastHref = location.href;
    state.siteProfile = resolveSiteProfile();
    state.pinned = false;
    state.activeSurface = null;
    state.activeMode = null;
    clearObservers();
    hideOverlay(true);
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
    if (event?.finished && typeof event.finished.then === 'function') {
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
      globalThis.navigation.addEventListener('navigate', state.navigationHandler);
      return;
    }
    window.addEventListener('popstate', onPopState);
    state.routePollId = setInterval(handleLocationChange, 500);
  }

  function onResize() {
    scheduleSurfaceRefresh('resize');
  }

  function onVisibilityChange() {
    if (document.hidden) hideOverlay(true);
    else scheduleReacquire();
  }

  function teardown() {
    window.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('popstate', onPopState);
    if (state.navigationHandler && globalThis.navigation?.removeEventListener) {
      globalThis.navigation.removeEventListener('navigate', state.navigationHandler);
    }
    if (state.runtimeMessageHandler) {
      chrome.runtime.onMessage.removeListener(state.runtimeMessageHandler);
    }
    if (state.storageChangedHandler) {
      chrome.storage.onChanged.removeListener(state.storageChangedHandler);
    }
    clearObservers();
    clearTimers();
    state.overlayHost?.remove();
    state.overlayHost = null;
    state.overlayShadow = null;
    state.shell = null;
    state.dimmers = null;
    state.activeSurface = null;
    state.activeRect = null;
    state.activeMode = null;
    state.visible = false;
    state.navigationHandler = null;
    state.runtimeMessageHandler = null;
    state.storageChangedHandler = null;
    globalThis.__umbraInjected = false;
  }

  function onPageHide() {
    teardown();
  }

  if (globalThis.__UMBRA_TEST_HOOKS__) {
    globalThis.UMBRA_TEST_API = {
      state,
      clamp,
      distance,
      normalizeHost,
      candidateScore,
      repeatedSiblingPattern,
      pageFamily,
      rectForElement,
      handleLocationChange,
      teardown
    };
  }

  async function mount() {
    state.siteProfile = resolveSiteProfile();
    applySettings(await loadSettings());
    ensureOverlay();
    setupRuntime();
    setupStorageWatcher();
    setupRouteWatcher();

    window.addEventListener('mousemove', onPointerMove, { passive: true });
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    if (!canManualRun()) hideOverlay(true);
  }

  mount().catch((err) => console.error('[Umbra2 mount error]', err));
})();
