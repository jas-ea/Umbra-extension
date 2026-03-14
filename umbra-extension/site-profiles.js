(() => {
  const P = (data) => ({ defaultMode: 'auto', ...data });

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
      id: 'gmail',
      label: 'Gmail',
      intent: 'gmail',
      defaultMode: 'auto',
      match: ({ host }) => /mail\.google\.com$/.test(host),
      quickSelectors: ['tr.zA', '.ii.gt', '.a3s', '.adn.ads'],
      preferSelectors: ['tr.zA', '.ii.gt', '.a3s', '.adn.ads', '.h7', '.gs'],
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
      match: ({ host, pathname, doc }) => /substack\.com$/.test(host) && (
        pathname.includes('/notes') ||
        !!doc.querySelector('input[placeholder*="Substack" i], [aria-label*="Search Substack" i], [class*="note" i], [data-testid*="note" i]')
      ),
      quickSelectors: ['article', '[role="article"]', '[class*="note" i]', '[class*="post" i]'],
      preferSelectors: ['article', '[role="article"]', '[class*="note" i]', '[class*="post" i]', '[class*="card" i]'],
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
      match: ({ host }) => /substack\.com$/.test(host),
      quickSelectors: ['article', 'main', '[role="article"]'],
      preferSelectors: ['article', 'main', '.prose', '.body', '.post', '.story'],
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
      id: 'article-default',
      label: 'Default Article',
      intent: 'article',
      defaultMode: 'auto',
      match: ({ doc }) => !!doc.querySelector('article, [role="article"], .prose, .entry-content'),
      quickSelectors: ['article', '[role="article"]', 'main'],
      preferSelectors: ['article', '[role="article"]', 'main', '.prose', '.entry-content', '.post', '.story'],
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
