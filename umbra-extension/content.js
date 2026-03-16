(() => {
  const DEFAULTS = {
    enabled: true,
    dwellMs: 1800,
    scrollIdleMs: 300,
    overlayOpacity: 0.62,
    blurPx: 2,
    paddingX: 24,
    paddingY: 20,
    cornerRadius: 16,
    transitionMs: 340,
    stationaryTolerance: 10,
    revealBuffer: 56,
    hideGraceMs: 120,
    switchOverlapThreshold: 0.72,
    centerBias: 0.38,
    autoOnScroll: true,
    autoOnHover: true,
    showOutline: true,
    ignoreDomains: [],
    siteOverrides: {},
    appAutoSuppress: true,
    debug: false
  };

  const INTERACTIVE_SELECTOR = [
    'button', 'input', 'textarea', 'select', 'label', 'summary', 'details',
    'a[href]', '[role="button"]', '[role="tab"]', '[role="menuitem"]', '[role="link"]',
    '[contenteditable="true"]'
  ].join(',');

  const READABLE_SELECTOR = [
    'article', 'main', 'section', '[role="article"]', '[role="main"]',
    '[data-testid="tweet"]', '[data-testid="tweetText"]',
    '.tweet', '.post', '.story', '.article', '.entry-content', '.prose', '.markdown',
    '.note', '.thread', '.message', '.conversation'
  ].join(',');

  const META_SELECTOR = [
    'header', 'footer', 'time', '[role="toolbar"]', '[aria-label*="Like"]',
    '[aria-label*="Reply"]', '[aria-label*="Comment"]', '[aria-label*="Share"]',
    '[data-testid*="reply"]', '[data-testid*="like"]', '[data-testid*="retweet"]',
    'img[alt*="avatar" i]', 'img[class*="avatar" i]'
  ].join(',');

  const state = {
    settings: { ...DEFAULTS },
    pausedForTab: false,
    pinned: false,
    active: false,
    hoverTimer: null,
    scrollTimer: null,
    hideTimer: null,
    settleTimer: null,
    pointerX: Math.round(window.innerWidth / 2),
    pointerY: Math.round(window.innerHeight / 2),
    anchorX: null,
    anchorY: null,
    activeElement: null,
    activeRect: null,
    host: null,
    shadow: null,
    root: null,
    focusShell: null,
    mounted: false,
    hasUserInteracted: false,
    hasHoverIntent: false,
    hasScrollIntent: false,
    lastInteractionAt: 0,
    lastPointerMoveAt: 0,
    lastScrollAt: 0,
    pageIntent: 'generic',
    siteProfile: null,
    interactionLockEl: null,
    interactionLockTimer: null
  };

  const storage = chrome.storage.sync;

  function normalizeHost(value) {
    return String(value || '').trim().replace(/^www\./, '');
  }

  function domainIgnored() {
    const host = normalizeHost(location.hostname);
    return (state.settings.ignoreDomains || []).some((entry) => {
      const needle = normalizeHost(entry);
      return needle && (host === needle || host.endsWith(`.${needle}`));
    });
  }

  function getSiteOverrideMode() {
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

  function getAutoBlockReason() {
    if (!state.settings.enabled) return 'disabled';
    if (state.pausedForTab) return 'paused';
    if (domainIgnored()) return 'ignored';
    const siteMode = getSiteOverrideMode();
    if (siteMode === 'off') return 'site-off';
    if (siteMode === 'manual') return 'site-manual';
    if (state.settings.appAutoSuppress && isUtilityLikePage()) return 'utility-page';
    return null;
  }

  function canManualRun() {
    return state.settings.enabled && !state.pausedForTab && !domainIgnored() && getSiteOverrideMode() !== 'off';
  }

  function shouldRun() {
    return canManualRun();
  }

  function canAutoRun() {
    return canManualRun() && !getAutoBlockReason();
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function pageHost() {
    return normalizeHost(location.hostname);
  }

  function countVisible(selector) {
    return [...document.querySelectorAll(selector)].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
    }).length;
  }


  function visibleViewportStats() {
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    const texts = [...document.querySelectorAll('p, article, main, section, li, blockquote')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
    });
    const buttons = countVisible('button, [role="button"], input, textarea, select, [contenteditable="true"]');
    const menus = countVisible('[role="menu"], [role="menubar"], nav, [role="navigation"], [role="tablist"], [role="grid"], [role="tree"], [role="listbox"]');
    const forms = countVisible('form, input, textarea, select, [contenteditable="true"]');
    const textChars = texts.slice(0, 40).reduce((sum, el) => sum + ((el.innerText || '').trim().length), 0);
    const overlayShells = countVisible('[role="application"], [class*="toolbar" i], [class*="sidebar" i], [class*="panel" i], [class*="drawer" i], [class*="calendar" i], [class*="board" i], [class*="canvas" i]');
    const main = document.querySelector('main, [role="main"]');
    const mainRect = main?.getBoundingClientRect();
    const mainAreaRatio = mainRect ? (Math.max(0, Math.min(mainRect.right, window.innerWidth) - Math.max(mainRect.left, 0)) * Math.max(0, Math.min(mainRect.bottom, window.innerHeight) - Math.max(mainRect.top, 0))) / viewportArea : 0;
    return { buttons, menus, forms, textChars, overlayShells, mainAreaRatio };
  }

  function isUtilityLikePage() {
    const profileIntent = state.siteProfile?.intent || 'generic';
    if (profileIntent === 'article' || profileIntent === 'timeline' || profileIntent === 'comparative' || profileIntent === 'chat' || profileIntent === 'gmail') return false;
    if (profileIntent === 'utility') return true;
    const stats = visibleViewportStats();
    if (stats.overlayShells >= 3 && stats.textChars < 900) return true;
    if (stats.menus >= 3 && stats.buttons >= 12 && stats.textChars < 1100) return true;
    if (stats.forms >= 4 && stats.buttons >= 8 && stats.textChars < 1000) return true;
    if (stats.mainAreaRatio > 0.75 && stats.buttons >= 14 && stats.textChars < 800) return true;
    return false;
  }


  function getProfiles() {
    return Array.isArray(globalThis.UMBRA_SITE_PROFILES) ? globalThis.UMBRA_SITE_PROFILES : [];
  }

  function resolveSiteProfile() {
    const ctx = {
      host: pageHost(),
      pathname: location.pathname,
      href: location.href,
      doc: document
    };
    for (const profile of getProfiles()) {
      try {
        if (typeof profile.match === 'function' && profile.match(ctx)) return profile;
      } catch (_) {}
    }
    return {
      id: 'generic',
      label: 'Generic',
      intent: 'generic',
      quickSelectors: ['article', 'main', 'section'],
      preferSelectors: ['article', 'main', 'section'],
      surfaceSelectors: ['article', 'main', 'section', '[role="article"]', '[role="main"]'],
      selectionModel: 'adaptive',
      rejectSelectors: ['aside', 'nav', 'header', 'footer'],
      rejectTokens: ['sidebar', 'menu', 'toolbar', 'banner', 'modal', 'dialog', 'popup', 'overlay', 'search', 'rail'],
      viewportPoints: [[0.5, 0.38], [0.56, 0.42], [0.44, 0.42], [0.5, 0.54]],
      fallbackSelectors: ['article', 'main', 'section', '[role="article"]', '[role="main"]']
    };
  }

  function selectorList(list) {
    return Array.isArray(list) ? list.filter(Boolean) : [];
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
    for (const selector of selectorList(selectors)) {
      try {
        if (node.matches(selector)) return true;
      } catch (_) {}
    }
    return false;
  }

  function detectIntentProfile() {
    state.siteProfile = resolveSiteProfile();
    return state.siteProfile.intent || 'generic';
  }

  function selectionModel() {
    return state.siteProfile?.selectionModel || 'adaptive';
  }

  function findIntentSurface(startNode) {
    const profile = state.siteProfile || resolveSiteProfile();
    const surfaces = selectorList(profile.surfaceSelectors);
    if (surfaces.length) {
      const hit = closestAny(startNode, surfaces);
      if (hit) return hit;
    }
    if (state.pageIntent === 'gmail') {
      return startNode.closest?.('tr.zA, .adn.ads, .ii.gt, .a3s') || null;
    }
    if (state.pageIntent === 'timeline') {
      return startNode.closest?.('[data-testid="tweet"], article[role="article"], article, [role="article"]') || null;
    }
    if (state.pageIntent === 'chat') {
      return startNode.closest?.('[data-message-author-role], [data-testid*="message"], article, main, .conversation, .message, [role="article"]') || null;
    }
    if (state.pageIntent === 'article') {
      return startNode.closest?.('article, main, [role="article"], [role="main"]') || null;
    }
    if (state.pageIntent === 'comparative') {
      return startNode.closest?.('table, [role="table"], [class*="table" i], [class*="grid" i], [data-view-component="true"] table') || null;
    }
    return startNode.closest?.('article, main, section, table, [role="article"], [role="main"], [role="table"]') || null;
  }

  function injectUi() {
    if (state.mounted) return;
    const host = document.createElement('div');
    host.id = 'umbra-host';
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.pointerEvents = 'none';
    host.style.zIndex = '2147483646';
    host.style.all = 'initial';

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        #umbra-root {
          --umbra-opacity: 0.62;
          --umbra-transition: 340ms;
          --umbra-radius: 12px;
          position: fixed;
          inset: 0;
          pointer-events: none;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        }
        .focus-shell, .label {
          position: fixed;
          opacity: 0;
          transition:
            opacity var(--umbra-transition) ease,
            top var(--umbra-transition) ease,
            left var(--umbra-transition) ease,
            width var(--umbra-transition) ease,
            height var(--umbra-transition) ease,
            transform var(--umbra-transition) ease,
            box-shadow var(--umbra-transition) ease,
            border-radius var(--umbra-transition) ease;
          will-change: top, left, width, height, opacity, box-shadow, border-radius;
        }
        .focus-shell {
          background: transparent;
          border-radius: var(--umbra-radius);
          box-shadow:
            0 0 0 9999px rgba(12, 12, 16, var(--umbra-opacity)),
            0 0 0 1px rgba(255,255,255,0.12),
            0 10px 28px rgba(0,0,0,0.12),
            inset 0 0 0 1px rgba(255,255,255,0.02);
        }
        .label {
          top: 14px;
          right: 14px;
          left: auto;
          width: auto;
          height: auto;
          transform: translateY(-3px);
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(10,10,12,0.76);
          color: rgba(255,255,255,0.92);
          font-size: 11px;
          line-height: 1;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        #umbra-root.visible .focus-shell,
        #umbra-root.visible .label {
          opacity: 1;
          transform: translateY(0);
        }
        #umbra-root:not(.show-outline) .focus-shell {
          box-shadow: 0 0 0 9999px rgba(12, 12, 16, var(--umbra-opacity));
        }
        #umbra-root:not(.show-label) .label { display: none; }
      </style>
      <div id="umbra-root" class="show-outline">
        <div class="focus-shell"></div>
        <div class="label">Umbra active</div>
      </div>
    `;

    document.documentElement.appendChild(host);
    state.host = host;
    state.shadow = shadow;
    state.root = shadow.getElementById('umbra-root');
    state.focusShell = shadow.querySelector('.focus-shell');
    state.label = shadow.querySelector('.label');
    state.mounted = true;
    applyVisualSettings();
  }

  function applyVisualSettings() {
    if (!state.root) return;
    state.root.style.setProperty('--umbra-opacity', String(state.settings.overlayOpacity));
    state.root.style.setProperty('--umbra-transition', `${state.settings.transitionMs}ms`);
    state.root.style.setProperty('--umbra-radius', `${state.settings.cornerRadius}px`);
    state.root.classList.toggle('show-outline', !!state.settings.showOutline);
    state.root.classList.toggle('show-label', state.pinned || !!getAutoBlockReason());
    if (state.label) {
      const reason = getAutoBlockReason();
      if (state.pinned) state.label.textContent = 'Umbra pinned';
      else if (reason === 'site-manual') state.label.textContent = 'Manual mode';
      else if (reason === 'site-off') state.label.textContent = 'Off on this site';
      else if (reason === 'utility-page') state.label.textContent = 'Utility app detected';
      else if (state.interactionLockEl) state.label.textContent = 'Interaction mode';
      else state.label.textContent = 'Umbra active';
    }
  }

  function hideOverlay() {
    if (!state.root) return;
    state.root.classList.remove('visible');
    state.active = false;
    state.activeRect = null;
    if (!state.pinned) state.activeElement = null;
  }

  function elementRect(el) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const top = clamp(r.top - state.settings.paddingY, 0, window.innerHeight);
    const left = clamp(r.left - state.settings.paddingX, 0, window.innerWidth);
    const right = clamp(r.right + state.settings.paddingX, 0, window.innerWidth);
    const bottom = clamp(r.bottom + state.settings.paddingY, 0, window.innerHeight);
    return { top, left, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  }

  function viewportIntersectionRatio(el) {
    const r = el.getBoundingClientRect();
    const iw = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
    const ih = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    const visibleArea = iw * ih;
    const totalArea = Math.max(1, r.width * r.height);
    return visibleArea / totalArea;
  }

  function visibleTextLength(el) {
    const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
    return text.length;
  }

  function interactiveCount(el) {
    return el.querySelectorAll ? el.querySelectorAll(INTERACTIVE_SELECTOR).length : 0;
  }

  function lineBlockCount(el) {
    return el.querySelectorAll ? el.querySelectorAll('p, blockquote, li, pre, [data-testid="tweetText"], br').length : 0;
  }

  function mediaCount(el) {
    return el.querySelectorAll ? el.querySelectorAll('img, video, figure').length : 0;
  }

  function linkCount(el) {
    return el.querySelectorAll ? el.querySelectorAll('a[href]').length : 0;
  }

  function metaCount(el) {
    return el.querySelectorAll ? el.querySelectorAll(META_SELECTOR).length : 0;
  }

  function childElementCount(el) {
    return el.children ? el.children.length : 0;
  }

  function looksLikeChrome(el, style, cls) {
    if (!el) return true;
    const profile = state.siteProfile || resolveSiteProfile();
    const tag = el.tagName.toLowerCase();
    if (['nav', 'header', 'footer', 'aside'].includes(tag)) return true;
    if (matchesAny(el, profile.rejectSelectors)) return true;
    if (style.position === 'fixed' || style.position === 'sticky') return true;
    if (style.pointerEvents === 'none' || style.visibility === 'hidden' || style.display === 'none') return true;
    if (style.overflow === 'hidden' && el.getBoundingClientRect().height < 80) return true;
    const rejectTokens = selectorList(profile.rejectTokens).join('|');
    const pattern = rejectTokens ? new RegExp(rejectTokens) : /sidebar|menu|header|footer|toolbar|banner|modal|dialog|popup|overlay|composer|search|topbar|bottombar|tablist|nav|rail/;
    return pattern.test(cls);
  }

  function looksLikeShell(el) {
    const cls = `${el.className || ''} ${el.id || ''}`.toLowerCase();
    const r = el.getBoundingClientRect();
    const areaRatio = (r.width * r.height) / Math.max(1, window.innerWidth * window.innerHeight);
    const interactive = interactiveCount(el);
    const children = childElementCount(el);
    return areaRatio > 0.72 && (interactive > 14 || children > 30 || /container|shell|layout|contentpane|scrollarea|viewport/.test(cls));
  }

  function siteSpecificBoost(el) {
    const cls = `${el.className || ''} ${el.id || ''}`.toLowerCase();
    const profile = state.siteProfile || resolveSiteProfile();
    let profileBoost = 0;
    if (matchesAny(el, profile.preferSelectors)) profileBoost += 18;
    if (matchesAny(el, profile.rejectSelectors)) profileBoost -= 24;
    const rejectTokens = selectorList(profile.rejectTokens).join('|');
    if (rejectTokens && new RegExp(rejectTokens).test(cls)) profileBoost -= 14;
    if (state.pageIntent === 'gmail') {
      let boost = 0;
      if (el.matches?.('tr.zA, [role="row"]')) boost += 28;
      if (el.matches?.('.ii.gt, .a3s, .adn.ads, .h7, .gs')) boost += 24;
      if (el.matches?.('[role="main"]')) boost -= 16;
      if (/message|mail|thread|conversation|body|snippet/.test(cls)) boost += 14;
      if (/sidebar|compose|inbox|toolbar|search|category|tabs|pane/.test(cls)) boost -= 26;
      return boost + profileBoost;
    }
    if (state.pageIntent === 'timeline') {
      let boost = 0;
      if (el.matches?.('[data-testid="tweet"], article[role="article"], article')) boost += 24;
      if (/tweet|post|thread|note|feed|card/.test(cls)) boost += 14;
      if (/sidebar|trend|compose|reply|toolbar|recommend|suggestion|carousel/.test(cls)) boost -= 18;
      return boost + profileBoost;
    }
    if (state.pageIntent === 'article') {
      let boost = 0;
      if (el.matches?.('article, main, .prose, .entry-content, .post, .story')) boost += 18;
      if (/article|story|post|content|prose|markdown/.test(cls)) boost += 12;
      return boost + profileBoost;
    }
    if (state.pageIntent === 'comparative') {
      let boost = 0;
      if (el.matches?.('table, [role="table"], thead, tbody')) boost += 26;
      if (el.matches?.('tr, [role="row"]')) boost -= 34;
      if (/table|grid|market|screener|ranking|leaderboard|list/.test(cls)) boost += 12;
      if (/row|cell/.test(cls)) boost -= 10;
      return boost + profileBoost;
    }
    return profileBoost;
  }

  function scoreCandidate(el, sourceX, sourceY, sourceKind = 'hover') {
    if (!el || el === document.body || el === document.documentElement) return -Infinity;
    const style = getComputedStyle(el);
    const cls = `${el.className || ''} ${el.id || ''}`.toLowerCase();
    if (looksLikeChrome(el, style, cls)) return -Infinity;

    const r = el.getBoundingClientRect();
    if (r.width < 140 || r.height < 44) return -Infinity;
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return -Infinity;

    const area = r.width * r.height;
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    const areaRatio = area / viewportArea;
    const visibleRatio = viewportIntersectionRatio(el);
    const textLen = visibleTextLength(el);
    const blocks = lineBlockCount(el);
    const media = mediaCount(el);
    const links = linkCount(el);
    const interactive = interactiveCount(el);
    const meta = metaCount(el);
    const tag = el.tagName.toLowerCase();
    const textDensity = textLen / Math.max(1, area / 1000);
    const surface = findIntentSurface(el);
    let depthPenalty = 0;
    if (surface && surface !== el) {
      let cursor = el;
      let depth = 0;
      while (cursor && cursor !== surface && depth < 10) {
        cursor = cursor.parentElement;
        depth += 1;
      }
      depthPenalty = depth;
    }

    let score = 0;
    score += Math.min(textLen / 55, 36);
    score += Math.min(blocks * 3, 18);
    score += Math.min(media * 2, 8);
    score += Math.min(textDensity, 12);
    score += Math.min(meta * 1.8, 10);

    score -= Math.min(links * 0.45, 10);
    score -= Math.min(interactive * 0.95, 20);

    if (['article', 'main', 'section'].includes(tag)) score += 10;
    if (el.matches?.(READABLE_SELECTOR)) score += 14;
    if (/tweet|thread|article|post|content|reader|story|markdown|prose|message|mail|conversation|snippet|note/.test(cls)) score += 10;

    if (visibleRatio > 0.55) score += 12;
    else if (visibleRatio > 0.25) score += 5;
    else score -= 12;

    if (areaRatio >= 0.02 && areaRatio <= 0.62) score += 10;
    if (areaRatio < 0.012 && textLen < 40) score -= 12;
    if (areaRatio > 0.85) score -= 18;
    if (r.width > window.innerWidth * 0.96) score -= 16;
    if (r.height > window.innerHeight * 0.92) score -= 14;

    if (looksLikeShell(el)) score -= 20;
    if (selectionModel() === 'surface' && depthPenalty > 0) score -= Math.min(20, depthPenalty * 6);
    if (selectionModel() === 'comparative') {
      if (el.matches?.('tr, td, th, [role="row"], [role="cell"], [role="gridcell"]')) score -= 42;
      if (el.matches?.('table, [role="table"], tbody, thead')) score += 24;
      if (interactive > 20) score -= 10;
      if (blocks > 12 && textLen < 280) score += 6;
    }

    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dist = Math.hypot(cx - sourceX, cy - sourceY);
    score -= dist / (sourceKind === 'scroll' ? 220 : 180);

    if (sourceKind === 'hover') {
      const containsPointer = sourceX >= r.left && sourceX <= r.right && sourceY >= r.top && sourceY <= r.bottom;
      if (containsPointer) score += 14;
    }

    score += siteSpecificBoost(el);
    if (selectionModel() === 'surface' && surface === el) score += 18;
    if (selectionModel() === 'comparative' && surface === el) score += 22;
    return score;
  }

  function collectCandidateChain(startNode, maxDepth = 10) {
    const candidates = [];
    const seen = new Set();
    let node = startNode;
    let depth = 0;
    while (node && node !== document.body && node !== document.documentElement && depth < maxDepth) {
      if (node.nodeType === 1 && !seen.has(node)) {
        seen.add(node);
        candidates.push(node);
      }
      node = node.parentElement;
      depth += 1;
    }
    return candidates;
  }

  function expandCandidateWithContext(base) {
    if (!base) return base;
    let chosen = base;
    const baseRect = base.getBoundingClientRect();
    const baseText = visibleTextLength(base);
    const baseInteractive = interactiveCount(base);
    const baseMeta = metaCount(base);

    let depth = 0;
    let node = base.parentElement;
    while (node && node !== document.body && node !== document.documentElement && depth < 5) {
      const style = getComputedStyle(node);
      const cls = `${node.className || ''} ${node.id || ''}`.toLowerCase();
      if (looksLikeChrome(node, style, cls)) break;
      const r = node.getBoundingClientRect();
      const areaMultiple = (r.width * r.height) / Math.max(1, baseRect.width * baseRect.height);
      const widthRatio = r.width / Math.max(1, baseRect.width);
      const heightRatio = r.height / Math.max(1, baseRect.height);
      const textDelta = visibleTextLength(node) - baseText;
      const interactiveDelta = interactiveCount(node) - baseInteractive;
      const metaDelta = metaCount(node) - baseMeta;

      let contextScore = 0;
      if (r.left <= baseRect.left + 8 && r.right >= baseRect.right - 8) contextScore += 4;
      if (widthRatio >= 1.0 && widthRatio <= 1.25) contextScore += 8;
      if (heightRatio >= 1.0 && heightRatio <= 2.6) contextScore += 6;
      if (metaDelta >= 1 && metaDelta <= 10) contextScore += 10;
      if (interactiveDelta >= 0 && interactiveDelta <= 12) contextScore += 6;
      if (textDelta >= 0 && textDelta <= Math.max(260, baseText * 0.8)) contextScore += 5;
      if (areaMultiple > 3.6) contextScore -= 10;
      if (widthRatio > 1.45 || heightRatio > 3.2) contextScore -= 12;
      if (interactiveDelta > 15) contextScore -= 18;
      if (looksLikeShell(node)) contextScore -= 16;

      if (state.pageIntent === 'gmail') {
        if (node.matches?.('tr.zA, .adn.ads, .ii.gt')) contextScore += 22;
        if (node.matches?.('[role="main"]')) contextScore -= 14;
      } else if (state.pageIntent === 'timeline') {
        if (node.matches?.('article, [role="article"]')) contextScore += 18;
        if (/card|note|post|thread/.test(cls)) contextScore += 10;
        if (/carousel|suggestion|recommend/.test(cls)) contextScore -= 10;
      } else if (state.pageIntent === 'article') {
        if (node.matches?.('article, main')) contextScore += 14;
      } else if (state.pageIntent === 'comparative') {
        if (node.matches?.('table, [role="table"], tbody, thead')) contextScore += 20;
        if (node.matches?.('tr, [role="row"]')) contextScore -= 20;
      }

      if (contextScore > 10) chosen = node;
      node = node.parentElement;
      depth += 1;
    }

    return chosen;
  }

  function closestReadableCandidate(startNode, sourceX, sourceY, sourceKind = 'hover') {
    if (!startNode) return null;

    const lockedInteractiveSurface = state.interactionLockEl && document.contains(state.interactionLockEl) ? findInteractionSurface(state.interactionLockEl) : null;
    if (lockedInteractiveSurface) return lockedInteractiveSurface;
    const localInteractiveSurface = findInteractionSurface(startNode);
    if (localInteractiveSurface && (isInteractiveEngaged() || startNode.closest?.(INTERACTIVE_SELECTOR))) return localInteractiveSurface;

    const model = selectionModel();
    const surface = findIntentSurface(startNode);

    if (state.pageIntent === 'gmail') {
      const gmailQuick = startNode.closest?.('tr.zA, .ii.gt, .a3s, .adn.ads');
      if (gmailQuick && model === 'surface') return expandCandidateWithContext(gmailQuick);
      if (gmailQuick) return gmailQuick;
    }
    if (state.pageIntent === 'comparative') {
      const comparativeQuick = startNode.closest?.('table, [role="table"], tbody, thead, [class*="table" i], [class*="grid" i]');
      if (comparativeQuick) return expandCandidateWithContext(comparativeQuick);
    }

    const profile = state.siteProfile || resolveSiteProfile();
    const quickHit = surface || closestAny(startNode, profile.quickSelectors) || startNode.closest?.('[data-testid="tweet"], article[role="article"], article, [role="main"], main');

    if (model === 'surface' && quickHit) {
      return expandCandidateWithContext(quickHit);
    }

    const quickScore = quickHit ? scoreCandidate(quickHit, sourceX, sourceY, sourceKind) : -Infinity;
    let best = quickScore > 0 ? quickHit : null;
    let bestScore = quickScore;

    for (const node of collectCandidateChain(startNode)) {
      const score = scoreCandidate(node, sourceX, sourceY, sourceKind);
      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    }

    if (!best && startNode.closest) {
      const profileFallback = surface || closestAny(startNode, profile.fallbackSelectors);
      best = profileFallback || startNode.closest('article, main, section, div, tr');
    }

    return expandCandidateWithContext(best);
  }

  function targetFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    return closestReadableCandidate(el, x, y, 'hover');
  }

  function bestFromPoints(points, sourceKind = 'scroll') {
    let best = null;
    let bestScore = -Infinity;
    for (const [x, y] of points) {
      const el = document.elementFromPoint(x, y);
      const candidate = closestReadableCandidate(el, x, y, sourceKind);
      if (!candidate) continue;
      const score = scoreCandidate(candidate, x, y, sourceKind);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }

  function targetFromViewportCenter() {
    const profile = state.siteProfile || resolveSiteProfile();
    const interactionSurface = state.interactionLockEl && document.contains(state.interactionLockEl) ? findInteractionSurface(state.interactionLockEl) : null;
    if (interactionSurface) return interactionSurface;
    let points = selectorList(profile.viewportPoints).map((pair) => [
      Math.round(window.innerWidth * pair[0]),
      Math.round(window.innerHeight * pair[1])
    ]);

    if (!points.length) {
      points = [
        [Math.round(window.innerWidth / 2), Math.round(window.innerHeight * state.settings.centerBias)],
        [Math.round(window.innerWidth * 0.56), Math.round(window.innerHeight * 0.42)],
        [Math.round(window.innerWidth * 0.44), Math.round(window.innerHeight * 0.42)],
        [Math.round(window.innerWidth / 2), Math.round(window.innerHeight * 0.54)]
      ];
    }

    const target = bestFromPoints(points, 'scroll');
    if (target) return target;
    for (const selector of selectorList(profile.fallbackSelectors)) {
      try {
        const found = document.querySelector(selector);
        if (found) return found;
      } catch (_) {}
    }
    return document.querySelector('article, main, [role="article"], [role="main"], table, [role="table"], tr.zA, .ii.gt, .adn.ads') || null;
  }


  function rectArea(rect) {
    return Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top);
  }

  function rectOverlapRatio(a, b) {
    if (!a || !b) return 0;
    const left = Math.max(a.left, b.left);
    const right = Math.min(a.right, b.right);
    const top = Math.max(a.top, b.top);
    const bottom = Math.min(a.bottom, b.bottom);
    const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
    if (!intersection) return 0;
    return intersection / Math.max(1, Math.min(rectArea(a), rectArea(b)));
  }

  function isEditableElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.matches?.('textarea, select, input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"])')) return true;
    if (el.isContentEditable || el.matches?.('[contenteditable="true"], [role="textbox"], [role="searchbox"]')) return true;
    return false;
  }

  function isInteractiveEngaged() {
    const active = document.activeElement;
    return !!(active && active !== document.body && isEditableElement(active));
  }

  function findInteractionSurface(startNode) {
    if (!startNode || !startNode.closest) return null;
    const selectors = [
      'form', '[role="dialog"]', '[aria-modal="true"]', '[data-testid*="composer"]',
      '[data-testid*="reply"]', '[data-testid*="toolBar"]', '[data-testid*="tweetTextarea"]',
      '[data-testid*="inline_reply"]', '[data-testid*="DMComposer"]', '.composer', '.editor', '.toolbar',
      '[class*="composer" i]', '[class*="editor" i]', '[class*="reply" i]', '[class*="toolbar" i]'
    ];
    const surface = closestAny(startNode, selectors);
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    const areaRatio = (rect.width * rect.height) / Math.max(1, window.innerWidth * window.innerHeight);
    if (areaRatio > 0.88) return null;
    return expandCandidateWithContext(surface);
  }

  function scheduleHideOverlay() {
    clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(() => {
      if (!state.pinned) hideOverlay();
    }, state.settings.hideGraceMs || 120);
  }

  function shouldKeepCurrentFocus(nextEl) {
    if (!state.activeElement || !state.activeRect || !nextEl) return false;
    if (state.interactionLockEl && state.activeElement.contains?.(state.interactionLockEl)) return true;
    if (nextEl === state.activeElement || state.activeElement.contains?.(nextEl) || nextEl.contains?.(state.activeElement)) return true;
    const nextRect = elementRect(nextEl);
    if (!nextRect) return false;
    return rectOverlapRatio(state.activeRect, nextRect) >= (state.settings.switchOverlapThreshold || 0.72);
  }

  function renderRect(rect) {
    injectUi();
    Object.assign(state.focusShell.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${Math.max(0, rect.right - rect.left)}px`,
      height: `${Math.max(0, rect.bottom - rect.top)}px`
    });

    state.root.classList.remove('settled');
    state.root.classList.add('visible');
    clearTimeout(state.settleTimer);
    state.settleTimer = setTimeout(() => state.root?.classList.add('settled'), 90);
    state.active = true;
  }

  function focusElement(el, pinned = false) {
    if (!canManualRun() || !el) return;
    const rect = elementRect(el);
    if (!rect) return;
    state.pinned = !!pinned;
    state.activeElement = el;
    state.activeRect = rect;
    applyVisualSettings();
    renderRect(rect);
  }

  function refreshActiveTarget() {
    if (!state.activeElement) return;
    if (!document.contains(state.activeElement)) {
      state.pinned = false;
      hideOverlay();
      return;
    }
    const rect = elementRect(state.activeElement);
    if (!rect || rect.height < 10 || rect.width < 10) {
      hideOverlay();
      return;
    }
    state.activeRect = rect;
    renderRect(rect);
  }

  function clearPin() {
    state.pinned = false;
    applyVisualSettings();
  }

  function markInteraction(kind) {
    const now = Date.now();
    state.hasUserInteracted = true;
    state.lastInteractionAt = now;
    if (kind === 'hover') {
      state.hasHoverIntent = true;
      state.lastPointerMoveAt = now;
    }
    if (kind === 'scroll') {
      state.hasScrollIntent = true;
      state.lastScrollAt = now;
    }
  }

  function scheduleHoverFocus() {
    clearTimeout(state.hoverTimer);
    if (!canAutoRun() || !state.settings.autoOnHover || state.pinned) return;
    if (!state.hasUserInteracted || !state.hasHoverIntent) return;
    state.hoverTimer = setTimeout(() => {
      const inactiveFor = Date.now() - state.lastPointerMoveAt;
      if (inactiveFor + 8 < state.settings.dwellMs) return;
      const target = targetFromPoint(state.pointerX, state.pointerY);
      if (target && !shouldKeepCurrentFocus(target)) focusElement(target, false);
    }, state.settings.dwellMs);
  }

  function scheduleScrollFocus() {
    clearTimeout(state.scrollTimer);
    if (!canAutoRun() || !state.settings.autoOnScroll || state.pinned) return;
    if (!state.hasUserInteracted || !state.hasScrollIntent) return;
    state.scrollTimer = setTimeout(() => {
      const inactiveFor = Date.now() - state.lastScrollAt;
      if (inactiveFor + 8 < state.settings.scrollIdleMs) return;
      const target = targetFromViewportCenter();
      if (target && !shouldKeepCurrentFocus(target)) focusElement(target, false);
    }, state.settings.scrollIdleMs);
  }

  function onMouseMove(e) {
    state.pointerX = e.clientX;
    state.pointerY = e.clientY;
    if (state.anchorX == null || state.anchorY == null) {
      state.anchorX = e.clientX;
      state.anchorY = e.clientY;
      markInteraction('hover');
      scheduleHoverFocus();
      return;
    }

    if (distance(state.anchorX, state.anchorY, e.clientX, e.clientY) > state.settings.stationaryTolerance) {
      state.anchorX = e.clientX;
      state.anchorY = e.clientY;
      markInteraction('hover');
      if (!state.pinned) {
        if (state.activeRect) {
          const r = state.activeRect;
          const inside = e.clientX >= r.left - state.settings.revealBuffer &&
            e.clientX <= r.right + state.settings.revealBuffer &&
            e.clientY >= r.top - state.settings.revealBuffer &&
            e.clientY <= r.bottom + state.settings.revealBuffer;
          if (!inside) scheduleHideOverlay();
        }
        scheduleHoverFocus();
      }
    }
  }

  function onFocusIn(e) {
    const target = e.target;
    if (!isEditableElement(target)) return;
    state.interactionLockEl = target;
    clearTimeout(state.interactionLockTimer);
    hideOverlay();
    const surface = findInteractionSurface(target);
    if (surface && canManualRun()) {
      focusElement(surface, false);
    }
    applyVisualSettings();
  }

  function onFocusOut() {
    clearTimeout(state.interactionLockTimer);
    state.interactionLockTimer = setTimeout(() => {
      if (!isInteractiveEngaged()) {
        state.interactionLockEl = null;
        applyVisualSettings();
      }
    }, 140);
  }

  function onScroll() {
    if (!canManualRun()) return;
    markInteraction('scroll');
    state.pageIntent = detectIntentProfile();
    if (state.activeElement) refreshActiveTarget();
    if (!state.pinned && state.active) hideOverlay();
    scheduleScrollFocus();
  }

  function onResize() {
    state.pageIntent = detectIntentProfile();
    if (state.activeElement) refreshActiveTarget();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      clearPin();
      hideOverlay();
      scheduleScrollFocus();
    }
  }

  function onClick(e) {
    if (e.shiftKey && canManualRun()) {
      const target = closestReadableCandidate(e.target, e.clientX, e.clientY, 'hover');
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      markInteraction('hover');
      focusElement(target, true);
      return;
    }

    if (e.target.closest?.(INTERACTIVE_SELECTOR)) {
      const surface = findInteractionSurface(e.target);
      if (surface && canManualRun()) focusElement(surface, false);
      else hideOverlay();
      markInteraction('hover');
    }
  }

  function applySettings(next) {
    state.settings = { ...DEFAULTS, ...next };
    applyVisualSettings();
    if (!canManualRun()) {
      hideOverlay();
      clearTimeout(state.hoverTimer);
      clearTimeout(state.scrollTimer);
    }
  }

  function syncSettings() {
    return new Promise((resolve) => storage.get(DEFAULTS, (items) => resolve(items || DEFAULTS)));
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    const next = { ...state.settings };
    Object.keys(changes).forEach((key) => {
      next[key] = changes[key].newValue;
    });
    applySettings(next);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message?.type) return;
    if (message.type === 'UMBRA_GET_STATE') {
      sendResponse({
        pausedForTab: state.pausedForTab,
        pinned: state.pinned,
        enabled: state.settings.enabled,
        ignored: domainIgnored(),
        hostname: location.hostname,
        pageIntent: state.pageIntent,
        siteProfile: state.siteProfile?.id || 'generic',
        siteMode: getSiteOverrideMode(),
        autoBlockedReason: getAutoBlockReason(),
        utilityLike: isUtilityLikePage(),
        settings: state.settings
      });
      return true;
    }
    if (message.type === 'UMBRA_TOGGLE_TAB_PAUSE') {
      state.pausedForTab = !state.pausedForTab;
      if (state.pausedForTab) hideOverlay();
      sendResponse({ pausedForTab: state.pausedForTab });
      return true;
    }
    if (message.type === 'UMBRA_SET_SITE_MODE') {
      sendResponse({ ok: true, siteMode: getSiteOverrideMode() });
      return true;
    }
    if (message.type === 'UMBRA_FOCUS_NOW') {
      const target = targetFromPoint(state.pointerX, state.pointerY) || targetFromViewportCenter();
      if (target) focusElement(target, false);
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === 'UMBRA_PIN_NOW') {
      const target = targetFromPoint(state.pointerX, state.pointerY) || targetFromViewportCenter();
      if (target) focusElement(target, true);
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === 'UMBRA_CLEAR_PIN') {
      clearPin();
      hideOverlay();
      sendResponse({ ok: true });
      return true;
    }
  });

  function mount() {
    injectUi();
    state.pageIntent = detectIntentProfile();
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('focusout', onFocusOut, true);
  }

  syncSettings().then((items) => {
    applySettings(items);
    mount();
  });
})();
