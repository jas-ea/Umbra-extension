# Umbra 2.5.0

Umbra keeps one block clear on a busy webpage while the original site stays interactive. It is a Manifest V3 Chrome extension published by Cassini Research.

## Behavior

- The first automatic focus waits 1 second. Refocusing waits 1.45 seconds on one stable candidate.
- Mail lists, calendars, grids, and conversations stay visible as collections instead of collapsing to one row or cell.
- The current cutout stays visible while a different surface is being confirmed.
- Menus, popovers, dialogs, dragging, and fullscreen suspend the overlay instead of becoming accidental targets.
- User-started visible video can hold focus; muted autoplay cannot claim focus by itself.
- The mask and outline move from the same geometry, including rounded and clipped corners.
- Choose an area lets the user click and pin a block directly.
- Page controls, forms, composers, sidebars, drawers, and broad app shells are rejected or deprioritized.
- Pause is stored per tab for the browser session.
- The popup can restore the content script on eligible pages after installation or update without asking for a reload.

## Popup

The popup contains:

- global on/off
- current site and state
- one context-sensitive primary action
- a live surrounding-darkness control
- site mode, tab pause, and Settings

The Settings page contains only automatic focus, the focus outline, site-specific choices, keyboard shortcuts, and reset.

## Site modes

- **Automatic**: hover dwell and scroll-settle selection are available.
- **On request**: only direct actions such as Choose an area are available.
- **Off**: Umbra does not run on the site.

`Escape` clears the current focus. `Shift+Click` pins a surface when the click is not extending a text selection. Chrome shortcuts can be remapped; the defaults are `Alt+Shift+U` for tab pause and `Alt+Shift+F` for immediate focus.

## Code structure

- `content.js`: candidate selection, interaction state, geometry, and overlay rendering
- `focus-policy.js`: incumbent/challenger timing and handoff state
- `site-profiles.js`: declarative rules for known page families
- `defaults.js`: authoritative settings schema
- `background.js`: tab state and toolbar badge
- `popup.*`: daily controls
- `options.*`: infrequent global settings and site preferences
- `docs/`: architecture, product, accessibility, profiles, and store copy

Keep site-specific selectors in `site-profiles.js`. Change `content.js` only when the behavior is shared across page families.

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `umbra-extension` folder.

## Verify and package

Run from the repository root:

```bash
npm ci
npm run lint
npm test
npm run test:e2e
npm run validate
npm run package:extension
```

The browser suite covers noisy chat and feed layouts, Gmail-style inboxes, Calendar grids, Slack-style conversations and menus, video and fullscreen, adjacent-item handoff, stable dwell, manual area selection, nested scrolling, route changes, clipped geometry, reduced motion, forced colors, and text selection.

The package command creates `dist/umbra-2.5.0.zip`.

## Privacy

Umbra processes page structure locally and has no first-party server, analytics, telemetry, cloud inference, remote configuration, or remote code. Preferences are stored through Chrome storage. See `PRIVACY.md`.
