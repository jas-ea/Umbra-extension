# Testing

## Local Gates

Run these from the repository root:

```bash
npm ci
npm run lint
npm test
npm run test:e2e
npm run validate
```

`npm test` runs the settings contract and unit helper tests. `npm run test:e2e` serves fixtures from `test/fixtures/` and loads `umbra-extension/` as an unpacked MV3 extension in Chromium.

## Fixture Coverage

- `article.html`: article cutout geometry and outline toggling.
- `chat-stream.html`: nested scroll tracking and mutation debounce during streaming text.
- `feed.html`: same-document route handling.
- `comparative-table.html`: table fixture for comparative targeting work.
- `composer.html`: composer fixture for action-lock and typing checks.
- `transformed-html.html`: transformed-root fixture for masked dimming and native modal suppression.
- `noisy-chat-app.html`: ChatGPT/Codex-style app shell with sidebars, sticky header, composer, toolbars, and adjacent answer blocks.
- `noisy-social-feed.html`: X/Instagram-style timeline with side rails, composer, sponsored content, a fixed drawer, repeated posts, and action buttons.
- `productivity-workspace.html`: three-pane Gmail, Calendar, and Slack-style applications with composite collections, a sidebar mini-calendar, nested menus, a composer, competing videos, picture-in-picture, dragging, and fullscreen.

## Recommended Live QA Before Release

1. ChatGPT or Codex: hover across adjacent answer blocks, then move into the composer and verify focus switches cleanly without selecting the page shell.
2. X / Twitter or Instagram-style feeds: read adjacent posts near promoted content, side rails, and fixed drawers; verify posts win over surrounding chrome.
3. Gmail: move across inbox rows and controls; verify the complete list stays visible, then open a message and verify the reading pane wins.
4. Calendar: move across cells and events; verify the current grid stays visible and event menus suspend the overlay.
5. Slack: move through messages, the composer, reactions, menus, and submenus; verify the conversation stays stable and controls are never dimmed during use.
6. YouTube or an inline news video: verify user-started playback can hold focus, muted autoplay cannot steal it, and fullscreen suspends Umbra.
7. Comparative site such as CoinGecko: verify row-level autofocus does not activate by default.

## Acceptance criteria

- First focus must not occur before 1 second of stable residence. Refocus must not occur before 1.45 seconds on one challenger.
- Composite collections must remain whole while the user scans their rows or cells.
- The current cutout must remain visible while the next block is confirmed.
- Menus, dialogs, dragging, and fullscreen must suspend the overlay immediately.
- Pinned focus must survive those interruptions and tab visibility changes.
- Muted autoplay must not steal focus from user-started media.
- The mask and outline must stay aligned during movement and clipping.
- A clicked control must not trap the cutout after the pointer moves away.
- Direct area selection must pin the block the user clicks.
- When selection is uncertain, no focus is better than a broad app shell.
