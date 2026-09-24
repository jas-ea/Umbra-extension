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

1. ChatGPT or Codex: test short and multi-screen answers, code, tables, source actions, the thread rail, and the composer.
2. Claude, Gemini, and Grok: move between adjacent turns and confirm the nearest message or local reading block wins.
3. X or Instagram: read adjacent posts near promoted content, side rails, composers, and fixed drawers.
4. LinkedIn: test feed posts beside navigation, recommendations, messaging, and share controls.
5. Reddit: test a feed, a long post, nested comments, community navigation, and the reply composer.
6. Gmail: scan inbox rows and controls as one list, then open a message and confirm the reading pane wins.
7. Google Calendar: move across cells and events; confirm the current grid stays visible and event menus suspend the overlay.
8. Slack: move through messages, the composer, reactions, menus, and submenus; confirm the conversation stays stable.
9. Discord: scan a message channel, move through channel and member rails, and open message actions.
10. GitHub: test an issue list, an issue or pull-request conversation, code, filters, and navigation.
11. YouTube: test browse cards, comments, user-started playback, muted autoplay, picture-in-picture, and fullscreen.
12. Hacker News: scan a story list, then move through nested comments on an item page.
13. Stack Overflow: scan the question list, open a question, and move between the question, answers, and side rail.
14. Wikipedia and Chrome Developers: test long sections, tables, code blocks, contents navigation, and sticky headers.
15. CoinGecko or another comparative market table: confirm row-level autofocus stays off by default and direct selection can pin the table.

## Acceptance criteria

- First focus must not occur before 1 second of stable residence. Refocus must not occur before 1.45 seconds on one challenger.
- Composite collections must remain whole while the user scans their rows or cells.
- Leaving the current block must retire its cutout before a different block completes refocus dwell.
- Returning to the same block during the ownership grace must restore it without a second full dwell.
- Rejected controls inside a content block and leaving the browser viewport must release automatic focus.
- Menus, dialogs, dragging, and fullscreen must suspend the overlay immediately.
- Pinned focus must survive those interruptions and tab visibility changes.
- Muted autoplay must not steal focus from user-started media.
- The mask and outline must stay aligned during movement and clipping.
- A clicked control must not trap the cutout after the pointer moves away.
- Nested text, SVG, and icon nodes inside a control must inherit that control's interaction behavior.
- Direct area selection must pin the block the user clicks.
- Direct area selection must work on a folder, sidebar, or workspace panel even when automatic mode rejects it.
- Turning automatic focus off must stop every automatic acquisition path while leaving direct selection available.
- Changing page darkness must update a visible mask without reloading the page.
- When selection is uncertain, no focus is better than a broad app shell.
