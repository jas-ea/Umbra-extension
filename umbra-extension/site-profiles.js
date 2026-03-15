(() => {
  const P = (data) => ({ defaultMode: 'auto', selectionModel: 'adaptive', surfaceSelectors: [], ...data });

  const profiles = [
    P({
      id: 'google-calendar',
      label: 'Google Calendar',
      intent: 'utility',
      defaultMode: 'off',
      match: ({ host }) => /calendar\.google\.com$/.test(host),
      quickSelectors: [],
      preferSelectors: [],
      rejectSelectors: ['[role="main"]', '[role="navigation"]', '[role="grid"]'],
      rejectTokens: ['calendar', 'event', 'toolbar', 'sidebar', 'month', 'week', 'day', 'agenda', 'grid'],
      viewportPoints: [],
      fallbackSelectors: []
    }),
    P({
      id: 'docs-editors',
      label: 'Google Docs Editors',
      intent: 'utility',
      defaultMode: 'manual',
      match: ({ host }) => /docs\.google\.com$/.test(host),
      quickSelectors: [],
      preferSelectors: [],
      rejectSelectors: ['[role="application"]', '[role="main"]', '[role="toolbar"]'],
      rejectTokens: ['docs', 'sheet', 'slides', 'toolbar', 'ruler', 'sidebar', 'canvas', 'editor'],
      viewportPoints: [],
      fallbackSelectors: []
    }),
    P({
      id: 'figma',
      label: 'Figma',
      intent: 'utility',
      defaultMode: 'off',
      match: ({ host }) => /figma\.com$/.test(host),
      quickSelectors: [],
      preferSelectors: [],
      rejectSelectors: ['[role="application"]'],
      rejectTokens: ['canvas', 'toolbar', 'layers', 'properties', 'prototype'],
      viewportPoints: [],
      fallbackSelectors: []
    }),
    P({
      id: 'notion-app',
      label: 'Notion',
      intent: 'hybrid',
      defaultMode: 'manual',
      match: ({ host }) => /notion\.so$/.test(host),
      quickSelectors: ['article', 'main'],
      preferSelectors: ['article', 'main'],
      rejectSelectors: ['aside', '[role="navigation"]', '[role="toolbar"]'],
      rejectTokens: ['sidebar', 'toolbar', 'peek', 'modal', 'calendar', 'board', 'database'],
      viewportPoints: [[0.50,0.42]],
      fallbackSelectors: ['article','main']
    }),
    P({
      id: 'slack',
      label: 'Slack',
      intent: 'utility',
      defaultMode: 'off',
      match: ({ host }) => /slack\.com$|app\.slack\.com$/.test(host),
      quickSelectors: [],
      preferSelectors: [],
      rejectSelectors: ['[role="main"]', '[role="navigation"]'],
      rejectTokens: ['sidebar', 'composer', 'channel', 'thread', 'toolbar', 'pane'],
      viewportPoints: [],
      fallbackSelectors: []
    }),

    P({
      id: 'chatgpt',
      label: 'ChatGPT',
      intent: 'chat',
      defaultMode: 'auto',
      selectionModel: 'surface',
      match: ({ host }) => /chatgpt\.com$|chat\.openai\.com$/.test(host),
      quickSelectors: ['[data-message-author-role]', 'main article', 'main'],
      preferSelectors: ['[data-message-author-role]', 'main article', 'main'],
      surfaceSelectors: ['[data-message-author-role]', 'main article', 'main'],
      rejectSelectors: ['nav', 'aside', '[role="navigation"]', '[role="complementary"]', 'form'],
      rejectTokens: ['sidebar', 'composer', 'toolbar', 'input', 'prompt', 'search', 'history'],
      viewportPoints: [[0.5, 0.34], [0.5, 0.48], [0.5, 0.62]],
      fallbackSelectors: ['[data-message-author-role]', 'main article', 'main']
    }),
    P({
      id: 'claude',
      label: 'Claude',
      intent: 'chat',
      defaultMode: 'auto',
      selectionModel: 'surface',
      match: ({ host }) => /claude\.ai$/.test(host),
      quickSelectors: ['[data-testid*="message"]', 'main article', 'main'],
      preferSelectors: ['[data-testid*="message"]', 'main article', 'main'],
      surfaceSelectors: ['[data-testid*="message"]', 'main article', 'main'],
      rejectSelectors: ['nav', 'aside', '[role="navigation"]', 'form'],
      rejectTokens: ['sidebar', 'composer', 'toolbar', 'input', 'search', 'history'],
      viewportPoints: [[0.5, 0.34], [0.5, 0.48], [0.5, 0.62]],
      fallbackSelectors: ['[data-testid*="message"]', 'main article', 'main']
    }),
    P({
      id: 'gemini',
      label: 'Gemini',
      intent: 'chat',
      defaultMode: 'auto',
      selectionModel: 'surface',
      match: ({ host }) => /gemini\.google\.com$/.test(host),
      quickSelectors: ['main article', 'main'],
      preferSelectors: ['main article', 'main'],
      surfaceSelectors: ['main article', 'main'],
      rejectSelectors: ['nav', 'aside', '[role="navigation"]', 'form'],
      rejectTokens: ['sidebar', 'composer', 'toolbar', 'input', 'prompt', 'search', 'history'],
      viewportPoints: [[0.5, 0.34], [0.5, 0.48], [0.5, 0.62]],
      fallbackSelectors: ['main article', 'main']
    }),
    P({
      id: 'gmail',
      label: 'Gmail',
      intent: 'gmail',
      defaultMode: 'auto',
      selectionModel: 'surface',
      match: ({ host }) => /mail\.google\.com$/.test(host),
      quickSelectors: ['tr.zA', '.ii.gt', '.a3s', '.adn.ads'],
      preferSelectors: ['tr.zA', '.ii.gt', '.a3s', '.adn.ads', '.h7', '.gs'],
      surfaceSelectors: ['tr.zA', '.adn.ads', '.ii.gt', '.a3s'],
      rejectSelectors: ['[role="main"]', '[role="navigation"]', '[role="search"]'],
      rejectTokens: ['sidebar', 'compose', 'toolbar', 'search', 'category', 'tabs', 'pane', 'appshell'],
      viewportPoints: [
        [0.56, 0.28],
        [0.56, 0.42],
        [0.56, 0.56]
      ],
      fallbackSelectors: ['.ii.gt', '.adn.ads', 'tr.zA']
    }),
    P({
      id: 'substack-feed',
      label: 'Substack Feed / Notes',
      intent: 'timeline',
      defaultMode: 'auto',
      selectionModel: 'surface',
      match: ({ host, pathname, doc }) => /substack\.com$/.test(host) && (
        pathname.includes('/notes') ||
        !!doc.querySelector('input[placeholder*="Substack" i], [aria-label*="Search Substack" i], [class*="note" i], [data-testid*="note" i]')
      ),
      quickSelectors: ['article', '[role="article"]', '[class*="note" i]', '[class*="post" i]'],
      preferSelectors: ['article', '[role="article"]', '[class*="note" i]', '[class*="post" i]', '[class*="card" i]'],
      surfaceSelectors: ['article', '[role="article"]', '[class*="note" i]', '[class*="post" i]', '[class*="card" i]'],
      rejectSelectors: ['aside', '[aria-label*="search" i]', '[class*="suggest" i]', '[class*="recommend" i]', '[class*="carousel" i]'],
      rejectTokens: ['sidebar', 'trend', 'compose', 'reply', 'toolbar', 'recommend', 'suggestion', 'carousel'],
      viewportPoints: [
        [0.46, 0.35],
        [0.46, 0.5],
        [0.46, 0.65]
      ],
      fallbackSelectors: ['article', '[role="article"]']
    }),
    P({
      id: 'substack-article',
      label: 'Substack Article',
      intent: 'article',
      defaultMode: 'auto',
      selectionModel: 'surface',
      match: ({ host }) => /substack\.com$/.test(host),
      quickSelectors: ['article', 'main', '[role="article"]'],
      preferSelectors: ['article', 'main', '.prose', '.body', '.post', '.story'],
      surfaceSelectors: ['article', 'main', '[role="article"]', '[role="main"]', '.post', '.story'],
      rejectSelectors: ['aside', '[class*="up-next" i]', '[class*="recommend" i]'],
      rejectTokens: ['sidebar', 'recommend', 'search', 'rail'],
      viewportPoints: [
        [0.50, 0.38],
        [0.56, 0.42],
        [0.44, 0.42],
        [0.50, 0.54]
      ],
      fallbackSelectors: ['article', 'main', '[role="article"]']
    }),
    P({
      id: 'x-timeline',
      label: 'X / Twitter',
      intent: 'timeline',
      defaultMode: 'auto',
      selectionModel: 'surface',
      match: ({ host }) => /x\.com$|twitter\.com$/.test(host),
      quickSelectors: ['[data-testid="tweet"]', 'article[role="article"]', 'article'],
      preferSelectors: ['[data-testid="tweet"]', 'article[role="article"]', 'article'],
      rejectSelectors: ['[data-testid="sidebarColumn"]', '[aria-label*="Timeline" i] nav', '[role="complementary"]'],
      rejectTokens: ['sidebar', 'trend', 'compose', 'reply', 'toolbar', 'recommend', 'suggestion'],
      viewportPoints: [
        [0.46, 0.35],
        [0.46, 0.5],
        [0.46, 0.65]
      ],
      fallbackSelectors: ['[data-testid="tweet"]', 'article[role="article"]']
    }),

    P({
      id: 'coingecko',
      label: 'CoinGecko',
      intent: 'comparative',
      defaultMode: 'manual',
      selectionModel: 'comparative',
      match: ({ host }) => /coingecko\.com$/.test(host),
      quickSelectors: ['table', '[role="table"]', '[data-view-component="true"] table', '[class*="table" i]', '[class*="coin-table" i]'],
      preferSelectors: ['table', '[role="table"]', 'thead', 'tbody'],
      surfaceSelectors: ['table', '[role="table"]', '[class*="table" i]', '[class*="coin-table" i]'],
      rejectSelectors: ['tr', '[role="row"]', 'aside', 'nav', '[class*="drawer" i]', '[class*="popover" i]'],
      rejectTokens: ['sidebar', 'drawer', 'popover', 'tooltip', 'modal', 'banner', 'ad', 'rail'],
      viewportPoints: [[0.5, 0.42], [0.5, 0.56]],
      fallbackSelectors: ['table', '[role="table"]', '[class*="table" i]']
    }),
    P({
      id: 'market-comparative',
      label: 'Comparative Market Tables',
      intent: 'comparative',
      defaultMode: 'manual',
      selectionModel: 'comparative',
      match: ({ host, doc }) => /(coinmarketcap|dexscreener|tradingview|finance\.yahoo|messari|defillama)\./.test(host) || !!doc.querySelector('table thead + tbody tr, [role="table"] [role="row"]'),
      quickSelectors: ['table', '[role="table"]', '[class*="table" i]', '[class*="grid" i]'],
      preferSelectors: ['table', '[role="table"]', 'thead', 'tbody'],
      surfaceSelectors: ['table', '[role="table"]', '[class*="table" i]', '[class*="grid" i]'],
      rejectSelectors: ['tr', '[role="row"]', 'aside', 'nav'],
      rejectTokens: ['sidebar', 'drawer', 'popover', 'tooltip', 'modal', 'banner', 'ad', 'rail'],
      viewportPoints: [[0.5, 0.42], [0.5, 0.56]],
      fallbackSelectors: ['table', '[role="table"]', '[class*="table" i]', '[class*="grid" i]']
    }),
    P({
      id: 'article-default',
      label: 'Default Article',
      intent: 'article',
      defaultMode: 'auto',
      selectionModel: 'surface',
      match: ({ doc }) => !!doc.querySelector('article, [role="article"], .prose, .entry-content'),
      quickSelectors: ['article', '[role="article"]', 'main'],
      preferSelectors: ['article', '[role="article"]', 'main', '.prose', '.entry-content', '.post', '.story'],
      surfaceSelectors: ['article', '[role="article"]', 'main', '[role="main"]', '.entry-content', '.post', '.story'],
      rejectSelectors: ['aside', 'nav', 'header', 'footer'],
      rejectTokens: ['sidebar', 'menu', 'toolbar', 'recommend', 'search', 'rail'],
      viewportPoints: [
        [0.50, 0.38],
        [0.56, 0.42],
        [0.44, 0.42],
        [0.50, 0.54]
      ],
      fallbackSelectors: ['article', 'main', '[role="article"]']
    }),
    P({
      id: 'generic',
      label: 'Generic',
      intent: 'generic',
      defaultMode: 'auto',
      match: () => true,
      quickSelectors: ['article', 'main', 'section'],
      preferSelectors: ['article', 'main', 'section'],
      rejectSelectors: ['aside', 'nav', 'header', 'footer'],
      rejectTokens: ['sidebar', 'menu', 'toolbar', 'banner', 'modal', 'dialog', 'popup', 'overlay', 'search', 'rail'],
      viewportPoints: [
        [0.50, 0.38],
        [0.56, 0.42],
        [0.44, 0.42],
        [0.50, 0.54]
      ],
      fallbackSelectors: ['article', 'main', 'section', '[role="article"]', '[role="main"]']
    })
  ];

  globalThis.UMBRA_SITE_PROFILES = profiles;
})();
