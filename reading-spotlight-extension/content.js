(() => {
  const DEFAULTS = {
    enabled: true,
    dwellMs: 2200,
    overlayOpacity: 0.88,
    paddingX: 22,
    paddingY: 18,
    cornerRadius: 18,
    transitionMs: 280,
    minWidth: 280,
    minHeight: 120,
    stationaryTolerance: 10,
    revealOnMoveDistance: 36,
    debug: false
  };

  const state = {
    settings: { ...DEFAULTS },
    lastPointerX: window.innerWidth / 2,
    lastPointerY: window.innerHeight / 2,
    anchorX: null,
    anchorY: null,
    dwellTimer: null,
    active: false,
    pausedForTab: false,
    masksReady: false,
    targetEl: null,
    targetRect: null,
    root: null,
    nodes: null
  };

  const storage = chrome?.storage?.sync;

  function log(...args) {
    if (state.settings.debug) console.log('[ReadingSpotlight]', ...args);
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function ensureMasks() {
    if (state.masksReady) return;

    const existing = document.getElementById('rs-root');
    if (existing) existing.remove();

    const root = document.createElement('div');
    root.id = 'rs-root';

    const parts = ['top', 'left', 'right', 'bottom', 'outline'];
    const nodes = {};
    for (const part of parts) {
      const div = document.createElement('div');
      div.className = `rs-mask rs-${part}`;
      root.appendChild(div);
      nodes[part] = div;
    }

    document.documentElement.appendChild(root);
    state.root = root;
    state.nodes = nodes;
    applyVisualSettings();
    state.masksReady = true;
  }

  function applyVisualSettings() {
    if (!state.masksReady) return;
    state.root.style.setProperty('--rs-opacity', String(state.settings.overlayOpacity));
    state.root.style.setProperty('--rs-transition-ms', `${state.settings.transitionMs}ms`);
    state.root.style.setProperty('--rs-radius', `${state.settings.cornerRadius}px`);
  }

  function hideMasks() {
    if (!state.masksReady) return;
    state.root.classList.remove('rs-visible');
    state.targetEl = null;
    state.targetRect = null;
    state.active = false;
  }

  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function getRect(el) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const px = state.settings.paddingX;
    const py = state.settings.paddingY;
    return {
      top: clamp(r.top - py, 0, window.innerHeight),
      left: clamp(r.left - px, 0, window.innerWidth),
      right: clamp(r.right + px, 0, window.innerWidth),
      bottom: clamp(r.bottom + py, 0, window.innerHeight)
    };
  }

  function scoreElement(el) {
    if (!el || el === document.body || el === document.documentElement) return -Infinity;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return -Infinity;
    if (style.position === 'fixed' && Number.parseFloat(style.zIndex || '0') > 999) return -Infinity;

    const rect = el.getBoundingClientRect();
    if (rect.width < state.settings.minWidth || rect.height < state.settings.minHeight) return -Infinity;
    if (rect.bottom < 0 || rect.top > window.innerHeight) return -Infinity;

    const text = (el.innerText || '').trim();
    const textLen = text.length;
    const paragraphs = el.querySelectorAll ? el.querySelectorAll('p, article, blockquote, [data-testid="tweetText"]').length : 0;
    const links = el.querySelectorAll ? el.querySelectorAll('a').length : 0;
    const images = el.querySelectorAll ? el.querySelectorAll('img, video').length : 0;
    const area = Math.max(rect.width * rect.height, 1);
    const textDensity = Math.min((textLen / area) * 2500, 18);

    let score = 0;
    score += Math.min(textLen / 50, 45);
    score += Math.min(paragraphs * 4, 20);
    score += textDensity;
    score += images ? 4 : 0;
    score -= Math.min(links, 24) * 0.5;

    const tag = el.tagName.toLowerCase();
    if (['article', 'main', 'section'].includes(tag)) score += 12;
    if (el.matches?.('[role="article"], article, main, [data-testid="tweet"], [data-testid="cellInnerDiv"]')) score += 16;
    if (el.matches?.('aside, nav, header, footer, [role="navigation"], [role="complementary"]')) score -= 25;

    const cls = `${el.className || ''}`.toLowerCase();
    const id = `${el.id || ''}`.toLowerCase();
    if (/tweet|post|article|content|story|thread|reader|main/.test(cls + ' ' + id)) score += 12;
    if (/sidebar|nav|menu|footer|header|toolbar|modal|dialog|popup|banner/.test(cls + ' ' + id)) score -= 18;

    const viewportArea = window.innerWidth * window.innerHeight;
    const ratio = area / viewportArea;
    // Prefer blocks that are a reasonable fraction of the viewport,
    // not almost-full-page containers.
    if (ratio > 0.05 && ratio < 0.6) score += 14;
    if (ratio >= 0.6 && ratio < 1.2) score -= 6;
    if (ratio >= 1.2) score -= 12;

    return score;
  }

  function findBestTargetFromPoint(x, y) {
    let leaf = document.elementFromPoint(x, y);
    if (!leaf) return null;

    // X/Twitter: strongly prefer the tweet container the pointer is over.
    function findTweetLikeAncestor(node) {
      let best = null;
      while (node && node !== document.body && node !== document.documentElement) {
        if (node.matches?.('[data-testid="tweet"]')) return node;
        if (!best && node.matches?.('[data-testid="cellInnerDiv"]')) best = node;
        node = node.parentElement;
      }
      return best;
    }

    const tweetContainer = findTweetLikeAncestor(leaf);
    if (tweetContainer) {
      log('tweet-target', tweetContainer);
      return tweetContainer;
    }

    const seen = new Set();
    let best = null;
    let bestScore = -Infinity;
    const candidates = [];

    let node = leaf;
    while (node && node !== document.body && node !== document.documentElement) {
      if (!seen.has(node)) {
        seen.add(node);
        candidates.push(node);
      }
      node = node.parentElement;
    }

    if (leaf.querySelectorAll) {
      const descendants = leaf.querySelectorAll('article, main, section, [role="article"], [data-testid="tweet"], [data-testid="cellInnerDiv"]');
      for (const d of descendants) {
        if (!seen.has(d)) candidates.push(d);
      }
    }

    for (const candidate of candidates) {
      const score = scoreElement(candidate);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    if (!best) best = leaf.closest?.('article, main, section, div') || leaf;
    log('target', best, bestScore);
    return best;
  }

  function renderForRect(rect) {
    if (!state.masksReady || !rect) return;
    const { top, left, right, bottom } = rect;
    const w = window.innerWidth;
    const h = window.innerHeight;

    const topNode = state.nodes.top;
    const leftNode = state.nodes.left;
    const rightNode = state.nodes.right;
    const bottomNode = state.nodes.bottom;
    const outline = state.nodes.outline;

    topNode.style.top = '0px';
    topNode.style.left = '0px';
    topNode.style.width = `${w}px`;
    topNode.style.height = `${top}px`;

    bottomNode.style.top = `${bottom}px`;
    bottomNode.style.left = '0px';
    bottomNode.style.width = `${w}px`;
    bottomNode.style.height = `${Math.max(0, h - bottom)}px`;

    leftNode.style.top = `${top}px`;
    leftNode.style.left = '0px';
    leftNode.style.width = `${left}px`;
    leftNode.style.height = `${Math.max(0, bottom - top)}px`;

    rightNode.style.top = `${top}px`;
    rightNode.style.left = `${right}px`;
    rightNode.style.width = `${Math.max(0, w - right)}px`;
    rightNode.style.height = `${Math.max(0, bottom - top)}px`;

    outline.style.top = `${top}px`;
    outline.style.left = `${left}px`;
    outline.style.width = `${Math.max(0, right - left)}px`;
    outline.style.height = `${Math.max(0, bottom - top)}px`;

    state.root.classList.add('rs-visible');
    state.active = true;
  }

  function activateSpotlight() {
    if (!state.settings.enabled || state.pausedForTab) return;
    ensureMasks();
    const target = findBestTargetFromPoint(state.lastPointerX, state.lastPointerY);
    if (!target) return;
    const rect = getRect(target);
    if (!rect) return;

    state.targetEl = target;
    state.targetRect = rect;
    renderForRect(rect);
  }

  function clearDwellTimer() {
    if (state.dwellTimer) {
      clearTimeout(state.dwellTimer);
      state.dwellTimer = null;
    }
  }

  function scheduleDwell() {
    clearDwellTimer();
    if (!state.settings.enabled || state.pausedForTab) return;
    state.dwellTimer = setTimeout(() => {
      activateSpotlight();
    }, state.settings.dwellMs);
  }

  function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function onPointerMove(e) {
    state.lastPointerX = e.clientX;
    state.lastPointerY = e.clientY;

    if (state.anchorX == null || state.anchorY == null) {
      state.anchorX = e.clientX;
      state.anchorY = e.clientY;
      scheduleDwell();
      return;
    }

    const d = distance(state.anchorX, state.anchorY, e.clientX, e.clientY);

    if (d > state.settings.stationaryTolerance) {
      state.anchorX = e.clientX;
      state.anchorY = e.clientY;
      scheduleDwell();
    }

    if (state.active && state.targetRect) {
      const r = state.targetRect;
      const expanded = {
        top: r.top - state.settings.revealOnMoveDistance,
        left: r.left - state.settings.revealOnMoveDistance,
        right: r.right + state.settings.revealOnMoveDistance,
        bottom: r.bottom + state.settings.revealOnMoveDistance
      };
      const inside = e.clientX >= expanded.left && e.clientX <= expanded.right &&
                     e.clientY >= expanded.top && e.clientY <= expanded.bottom;

      if (!inside) {
        hideMasks();
        scheduleDwell();
      }
    }
  }

  function onScroll() {
    if (!state.settings.enabled || state.pausedForTab) return;
    if (state.active && state.targetEl) {
      const rect = getRect(state.targetEl);
      if (!rect) {
        hideMasks();
        scheduleDwell();
        return;
      }
      state.targetRect = rect;
      renderForRect(rect);
    } else {
      scheduleDwell();
    }
  }

  function onResize() {
    if (state.active && state.targetEl) {
      const rect = getRect(state.targetEl);
      if (rect) {
        state.targetRect = rect;
        renderForRect(rect);
      } else {
        hideMasks();
      }
    }
  }

  function applySettings(newSettings = {}) {
    state.settings = { ...DEFAULTS, ...newSettings };
    applyVisualSettings();
    if (!state.settings.enabled) {
      hideMasks();
      clearDwellTimer();
    } else {
      scheduleDwell();
    }
  }

  function loadSettings() {
    return new Promise((resolve) => {
      if (!storage) {
        resolve({ ...DEFAULTS });
        return;
      }
      storage.get(DEFAULTS, (items) => {
        resolve(items || { ...DEFAULTS });
      });
    });
  }

  function setupStorageWatch() {
    if (!storage || !chrome.storage?.onChanged) return;
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync') return;
      const update = {};
      for (const [key, payload] of Object.entries(changes)) update[key] = payload.newValue;
      applySettings({ ...state.settings, ...update });
    });
  }

  function setupRuntimeMessages() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'RS_TOGGLE_TAB_PAUSE') {
        state.pausedForTab = !state.pausedForTab;
        if (state.pausedForTab) {
          hideMasks();
          clearDwellTimer();
        } else {
          scheduleDwell();
        }
        sendResponse?.({ pausedForTab: state.pausedForTab });
      } else if (message.type === 'RS_GET_STATE') {
        sendResponse?.({ pausedForTab: state.pausedForTab, enabled: state.settings.enabled, settings: state.settings });
      } else if (message.type === 'RS_FOCUS_NOW') {
        activateSpotlight();
        sendResponse?.({ ok: true });
      }
      return true;
    });
  }

  function mount() {
    ensureMasks();
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('scroll', debounce(onScroll, 30), { passive: true });
    window.addEventListener('resize', debounce(onResize, 60), { passive: true });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.active) {
        hideMasks();
        scheduleDwell();
      }
    });
    setupStorageWatch();
    setupRuntimeMessages();
    scheduleDwell();
  }

  loadSettings().then((settings) => {
    applySettings(settings);
    mount();
  });
})();
