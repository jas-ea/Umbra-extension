# Umbra

Umbra is a Chrome extension from Cassini Research. It keeps one block clear on a busy webpage while the original site stays interactive.

The extension waits for the pointer to settle on a useful surface or for scrolling to stop. It keeps mail lists, calendars, grids, and conversations visible as collections, while articles, opened messages, posts, and answers can focus individually. Menus and fullscreen suspend the overlay. The page itself is not copied, rewritten, or replaced.

## Install for development

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select the `umbra-extension/` folder.

The popup contains the controls needed during normal use: on/off, one main action, surrounding darkness, the current site mode, tab pause, and Settings.

## Verify and package

```bash
npm ci
npm run lint
npm test
npm run test:e2e
npm run validate
npm run package:extension
```

The package command creates `dist/umbra-<version>.zip` from runtime files only.

## Repository

- `umbra-extension/`: extension source and product documentation
- `test/`: unit, contract, and browser tests
- `launch/`: store assets, real-site screenshots, and launch copy
- `scripts/`: validation, packaging, and asset tools

Site-specific targeting belongs in `umbra-extension/site-profiles.js`. Focus handoff belongs in `umbra-extension/focus-policy.js`. Shared selection, interaction handling, clipping, and overlay behavior belongs in `umbra-extension/content.js`.

## Privacy

Umbra processes page structure locally. It has no analytics, telemetry, cloud inference, remote configuration, or first-party server. Preferences are stored through Chrome storage. See `umbra-extension/PRIVACY.md` for the full policy.
