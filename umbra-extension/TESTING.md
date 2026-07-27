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
- `transformed-html.html`: transformed-root fixture for four-rectangle dimming and native modal suppression.
- `noisy-chat-app.html`: ChatGPT/Codex-style app shell with sidebars, sticky header, composer, toolbars, and adjacent answer blocks.
- `noisy-social-feed.html`: X/Instagram-style timeline with side rails, composer, sponsored content, a fixed drawer, repeated posts, and action buttons.

## Recommended Live QA Before Release

1. ChatGPT or Codex: hover across adjacent answer blocks, then move into the composer and verify focus switches cleanly without selecting the page shell.
2. X / Twitter or Instagram-style feeds: read adjacent posts near promoted content, side rails, and fixed drawers; verify posts win over surrounding chrome.
3. Gmail: test inbox rows, opened message bodies, and compose.
4. Comparative site such as CoinGecko: verify row-level autofocus does not activate by default.
5. Utility site such as Calendar or Figma: verify Auto stays suppressed or Off by default.

## Acceptance criteria

- pointer-local reading should win when there is no fresh direct manipulation elsewhere
- creation surfaces should expand to include their controls
- when a surface grows or collapses, the shell should reconcile within one visible layout beat
- on uncertainty, Umbra should widen, soften, or stay off instead of cropping critical controls
