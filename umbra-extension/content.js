(() => {
  const DEFAULTS = {
    enabled: true,
    dwellMs: 1800,
    scrollIdleMs: 300,
    overlayOpacity: 0.62,
    blurPx: 2,
    paddingX: 24,
    paddingY: 20,
    cornerRadius: 24,
    transitionMs: 320,
    stationaryTolerance: 10,
    revealBuffer: 48,
    centerBias: 0.38,
    autoOnScroll: true,
    autoOnHover: true,
    showOutline: true,
    ignoreDomains: [],
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
    pointerX: Math.round(window.innerWidth / 2),
    pointerY: Math.round(window.innerHeight / 2),
    anchorX: null,
    anchorY: null,
    activeElement: null,
    activeRect: null,
    host: null,
    shadow: null,
    root: null,
    masks: null,
    mounted: false,
    hasUserInteracted: false,
    hasHoverIntent: false,
    hasScrollIntent: false,
    lastInteractionAt: 0,
    lastPointerMoveAt: 0,
    lastScrollAt: 0,
    pageIntent: 'generic'
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

  function shouldRun() {
    return state.settings.enabled && !state.pausedForTab && !domainIgnored();
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

  function detectIntentProfile() {
    const host = pageHost();
    if (/mail\.google\.com$/.test(host)) return 'gmail';
    if (/x\.com$|twitter\.com$/.test(host)) return 'timeline';

    if (/substack\.com$/.test(host)) {
      if (location.pathname.includes('/notes') || document.querySelector('input[placeholder*="Substack" i], [aria-label*="Search Substack" i]')) {
        return 'timeline';
      }
      if (countVisible('article, [role="article"]') > 1) return 'timeline';
      return 'article';
    }

    if (/medium\.com$|bearblog\.dev$/.test(host)) return 'article';
    if (countVisible('[data-testid="tweet"], article[role="article"]') > 1) return 'timeline';
    if (document.querySelector('article, [role="article"], .prose, .entry-content')) return 'article';
    return 'generic';
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
          --umbra-blur: 2px;
          --umbra-transition: 320ms;
          --umbra-radius: 24px;
          position: fixed;
          inset: 0;
          pointer-events: none;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        }
        .mask, .outline, .label {
          position: fixed;
          opacity: 0;
          transition:
            opacity var(--umbra-transition) ease,
            top var(--umbra-transition) ease,
            left var(--umbra-transition) ease,
            width var(--umbra-transition) ease,
            height var(--umbra-transition) ease,
            transform var(--umbra-transition) ease;
          will-change: top, left, width, height, opacity;
        }
        .mask {
          background: rgba(12, 12, 16, var(--umbra-opacity));
          backdrop-filter: blur(var(--umbra-blur));
          -webkit-backdrop-filter: blur(var(--umbra-blur));
        }
        .outline {
          background: transparent;
          border-radius: var(--umbra-radius);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.22),
            0 16px 48px rgba(0,0,0,0.18),
            inset 0 0 0 1px rgba(255,255,255,0.03);
        }
        .label {
          top: 14px;
          right: 14px;
          left: auto;
          width: auto;
          height: auto;
          transform: translateY(-4px);
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
        #umbra-root.visible .mask,
        #umbra-root.visible .outline,
        #umbra-root.visible .label {
          opacity: 1;
          transform: translateY(0);
        }
        #umbra-root:not(.show-outline) .outline { opacity: 0 !important; }
        #umbra-root:not(.show-label) .label { display: none; }
      </style>
      <div id="umbra-root" class="show-outline">
        <div class="mask" data-part="top"></div>
        <div class="mask" data-part="left"></div>
        <div class="mask" data-part="right"></div>
        <div class="mask" data-part="bottom"></div>
        <div class="outline"></div>
        <div class="label">Umbra active</div>
      </div>
    `;

    document.documentElement.appendChild(host);
    state.host = host;
    state.shadow = shadow;
    state.root = shadow.getElementById('umbra-root');
    state.masks = {
      top: shadow.querySelector('[data-part="top"]'),
      left: shadow.querySelector('[data-part="left"]'),
      right: shadow.querySelector('[data-part="right"]'),
      bottom: shadow.querySelector('[data-part="bottom"]'),
      outline: shadow.querySelector('.outline')
    };
    state.label = shadow.querySelector('.label');
    state.mounted = true;
    applyVisualSettings();
  }

  function applyVisualSettings() {
    if (!state.root) return;
    state.root.style.setProperty('--umbra-opacity', String(state.settings.overlayOpacity));
    state.root.style.setProperty('--umbra-blur', `${state.settings.blurPx}px`);
    state.root.style.setProperty('--umbra-transition', `${state.settings.transitionMs}ms`);
    state.root.style.setProperty('--umbra-radius', `${state.settings.cornerRadius}px`);
    state.root.classList.toggle('show-outline', !!state.settings.showOutline);
    state.root.classList.toggle('show-label', state.pinned);
    if (state.label) state.label.textContent = state.pinned ? 'Umbra pinned' : 'Umbra active';
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
    const tag = el.tagName.toLowerCase();
    if (['nav', 'header', 'footer', 'aside'].includes(tag)) return true;
    if (style.position === 'fixed' || style.position === 'sticky') return true;
    if (style.pointerEvents === 'none' || style.visibility === 'hidden' || style.display === 'none') return true;
    if (style.overflow === 'hidden' && el.getBoundingClientRect().height < 80) return true;
    return /sidebar|menu|header|footer|toolbar|banner|modal|dialog|popup|overlay|composer|search|topbar|bottombar|tablist|nav|rail/.test(cls);
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
    if (state.pageIntent === 'gmail') {
      let boost = 0;
      if (el.matches?.('tr.zA, [role="row"]')) boost += 28;
      if (el.matches?.('.ii.gt, .a3s, .adn.ads, .h7, .gs')) boost += 24;
      if (el.matches?.('[role="main"]')) boost -= 16;
      if (/message|mail|thread|conversation|body|snippet/.test(cls)) boost += 14;
      if (/sidebar|compose|inbox|toolbar|search|category|tabs|pane/.test(cls)) boost -= 26;
      return boost;
    }
    if (state.pageIntent === 'timeline') {
      let boost = 0;
      if (el.matches?.('[data-testid="tweet"], article[role="article"], article')) boost += 24;
      if (/tweet|post|thread|note|feed|card/.test(cls)) boost += 14;
      if (/sidebar|trend|compose|reply|toolbar|recommend|suggestion|carousel/.test(cls)) boost -= 18;
      return boost;
    }
    if (state.pageIntent === 'article') {
      let boost = 0;
      if (el.matches?.('article, main, .prose, .entry-content, .post, .story')) boost += 18;
      if (/article|story|post|content|prose|markdown/.test(cls)) boost += 12;
      return boost;
    }
    return 0;
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

    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dist = Math.hypot(cx - sourceX, cy - sourceY);
    score -= dist / (sourceKind === 'scroll' ? 220 : 180);

    if (sourceKind === 'hover') {
      const containsPointer = sourceX >= r.left && sourceX <= r.right && sourceY >= r.top && sourceY <= r.bottom;
      if (containsPointer) score += 14;
    }

    score += siteSpecificBoost(el);
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
      }

      if (contextScore > 10) chosen = node;
      node = node.parentElement;
      depth += 1;
    }

    return chosen;
  }

  function closestReadableCandidate(startNode, sourceX, sourceY, sourceKind = 'hover') {
    if (!startNode) return null;

    if (state.pageIntent === 'gmail') {
      const gmailQuick = startNode.closest?.('tr.zA, .ii.gt, .a3s, .adn.ads');
      if (gmailQuick) return gmailQuick;
    }

    const quickHit = startNode.closest?.('[data-testid="tweet"], article[role="article"], article, [role="main"], main');
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
      best = startNode.closest('article, main, section, div, tr');
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
    let points;
    if (state.pageIntent === 'gmail') {
      points = [
        [Math.round(window.innerWidth * 0.56), Math.round(window.innerHeight * 0.28)],
        [Math.round(window.innerWidth * 0.56), Math.round(window.innerHeight * 0.42)],
        [Math.round(window.innerWidth * 0.56), Math.round(window.innerHeight * 0.56)]
      ];
    } else if (state.pageIntent === 'timeline') {
      points = [
        [Math.round(window.innerWidth * 0.46), Math.round(window.innerHeight * 0.35)],
        [Math.round(window.innerWidth * 0.46), Math.round(window.innerHeight * 0.5)],
        [Math.round(window.innerWidth * 0.46), Math.round(window.innerHeight * 0.65)]
      ];
    } else {
      points = [
        [Math.round(window.innerWidth / 2), Math.round(window.innerHeight * state.settings.centerBias)],
        [Math.round(window.innerWidth * 0.56), Math.round(window.innerHeight * 0.42)],
        [Math.round(window.innerWidth * 0.44), Math.round(window.innerHeight * 0.42)],
        [Math.round(window.innerWidth / 2), Math.round(window.innerHeight * 0.54)]
      ];
    }

    const target = bestFromPoints(points, 'scroll');
    if (target) return target;
    return document.querySelector('article, main, [role="article"], [role="main"], tr.zA, .ii.gt, .adn.ads') || null;
  }

  function renderRect(rect) {
    injectUi();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const { top, left, right, bottom } = rect;

    Object.assign(state.masks.top.style, { top: '0px', left: '0px', width: `${w}px`, height: `${top}px` });
    Object.assign(state.masks.bottom.style, { top: `${bottom}px`, left: '0px', width: `${w}px`, height: `${Math.max(0, h - bottom)}px` });
    Object.assign(state.masks.left.style, { top: `${top}px`, left: '0px', width: `${left}px`, height: `${Math.max(0, bottom - top)}px` });
    Object.assign(state.masks.right.style, { top: `${top}px`, left: `${right}px`, width: `${Math.max(0, w - right)}px`, height: `${Math.max(0, bottom - top)}px` });
    Object.assign(state.masks.outline.style, { top: `${top}px`, left: `${left}px`, width: `${Math.max(0, right - left)}px`, height: `${Math.max(0, bottom - top)}px` });

    state.root.classList.add('visible');
    state.active = true;
  }

  function focusElement(el, pinned = false) {
    if (!shouldRun() || !el) return;
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
    if (!shouldRun() || !state.settings.autoOnHover || state.pinned) return;
    if (!state.hasUserInteracted || !state.hasHoverIntent) return;
    state.hoverTimer = setTimeout(() => {
      const inactiveFor = Date.now() - state.lastPointerMoveAt;
      if (inactiveFor + 8 < state.settings.dwellMs) return;
      const target = targetFromPoint(state.pointerX, state.pointerY);
      if (target) focusElement(target, false);
    }, state.settings.dwellMs);
  }

  function scheduleScrollFocus() {
    clearTimeout(state.scrollTimer);
    if (!shouldRun() || !state.settings.autoOnScroll || state.pinned) return;
    if (!state.hasUserInteracted || !state.hasScrollIntent) return;
    state.scrollTimer = setTimeout(() => {
      const inactiveFor = Date.now() - state.lastScrollAt;
      if (inactiveFor + 8 < state.settings.scrollIdleMs) return;
      const target = targetFromViewportCenter();
      if (target) focusElement(target, false);
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
          if (!inside) hideOverlay();
        }
        scheduleHoverFocus();
      }
    }
  }

  function onScroll() {
    if (!shouldRun()) return;
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
    if (e.shiftKey && shouldRun()) {
      const target = closestReadableCandidate(e.target, e.clientX, e.clientY, 'hover');
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      markInteraction('hover');
      focusElement(target, true);
      return;
    }

    if (e.target.closest?.(INTERACTIVE_SELECTOR)) {
      hideOverlay();
      markInteraction('hover');
    }
  }

  function applySettings(next) {
    state.settings = { ...DEFAULTS, ...next };
    applyVisualSettings();
    if (!shouldRun()) {
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
  }

  syncSettings().then((items) => {
    applySettings(items);
    mount();
  });
})();
