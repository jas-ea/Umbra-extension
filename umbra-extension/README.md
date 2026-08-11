# Umbra 2.2.2

Umbra is a local-first focus layer for the live web, published by Cassini Research. It dims surrounding chrome without rewriting pages, and it is designed to fail safe when unsure.

## Product rules

Umbra is built around a small rule engine:

1. Pointer position plus dwell is the default truth for passive reading.
2. Read, compare, create, and act are different states.
3. Presence is weak evidence. Fresh activity is strong evidence.
4. If Umbra is uncertain, it widens, softens, or does nothing.
5. Exit quality matters as much as entry quality.

## What changed in 2.2

- Simplified the popup to daily-use controls only: enable, page status, Focus, Pin, Pause, and a collapsed site behavior section.
- Removed visible timing and intensity sliders from the popup; detailed tuning stays in Settings.
- Restored rounded spotlight cutouts with a single masked dimming layer.
- Made manual Focus and Pin choose the focused element or viewport reading band before falling back to pointer position.
- Added popup recovery for already-open pages after install or update, avoiding reload prompts when Chrome allows same-page injection.
- Added noisy-page regression coverage for ChatGPT-like app shells and X-like social feeds so targeting is checked against realistic surfaces, not only simple blocks.

## What changed in 2.1

- Added a single authoritative settings schema in `defaults.js`.
- Removed dead visual settings and wired `showOutline` to the actual overlay border.
- Removed unused profile fields so `intent` is the source of targeting posture.
- Added teardown, double-injection protection, same-document route handling, and nested-scroll tracking.
- Reduced streaming/layout churn by debouncing mutation refresh and avoiding `innerText` in scoring.
- Trimmed extension permissions to `storage` plus `<all_urls>` host access.
- Added unit, contract, and Playwright fixture coverage.
- Added viewport reading-band scroll targeting, pre-dwell boundary preview, richer dim customization, and four-rectangle dimming for transformed pages.

## Core 2.0 behavior

- Pointer-first targeting is restored as the primary invariant.
- Action and composer surfaces now use short-lived locks instead of sticky presence bias.
- Comparative pages such as market tables are treated differently from reading pages.
- A single unified spotlight shell replaces the older layered mask approach, reducing corner and shadow artifacts.
- Active surfaces are observed with `ResizeObserver` and `MutationObserver`, so growing composers and closing popups can reflow the focus shell.
- Site-specific behavior still lives in `site-profiles.js`, while the core engine remains generic.

## Core modes

- **Read**: articles, chat answers, email messages, social posts.
- **Compare**: tables, screeners, ranked lists, aligned data surfaces.
- **Create**: composers, reply boxes, editors, modal forms.
- **Act**: utility-heavy flows where interaction beats spotlight.

## Controls

- Popup: global enable, current-page status, Focus, Pin, Pause, and collapsed current-site Auto / Manual / Off behavior.
- Options: behavior, timing, overlay opacity, geometry, outline, debug logs, and per-site mode overrides.
- Hotkeys: `Alt+Shift+U` pauses the current tab, `Alt+Shift+F` forces focus now.
- Shift + Click pins the surface under the pointer.
- Escape clears the current focus and releases pinning.
- Toolbar badge: the action icon shows the current tab's state at a glance — `OFF` when disabled or set to Off, `II` when paused on the tab, `M` in Manual mode, and nothing when auto-focus is active.

Chrome extension shortcuts can be remapped. This matters on Windows/Linux setups where `Alt+Shift` is used for keyboard layout switching.

## Fallback behavior

Umbra is deliberately conservative. If it cannot identify a trustworthy surface, it prefers one of these outcomes instead of cropping the wrong thing:

1. widen to a safer parent shell
2. keep the dimming minimal
3. suspend auto-focus until clearer intent appears

## Repo structure

- `content.js`: the core pointer-first rule engine
- `defaults.js`: the single settings schema
- `site-profiles.js`: declarative site profiles and defaults
- `popup.*`: quick controls
- `options.*`: advanced settings
- `docs/`: architecture, accessibility, site profile, and Chrome Web Store notes

## Contributing

Add site fixes to `site-profiles.js` first. Only change `content.js` when the issue is truly engine-level. Start by stating the page family in one sentence:

- What is the semantic unit of attention here?
- Is this page read, compare, create, or act?
- What is the safest fallback when Umbra is uncertain?

## Install

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click **Load unpacked**
4. Select the `umbra-extension` folder

## Testing

Run the local gates from the repository root:

```bash
npm ci
npm run lint
npm test
npm run test:e2e
npm run validate
npm run package:extension
```

The Playwright suite serves local fixtures and loads the unpacked extension in Chromium. The browser fixtures include noisy app and social-feed pages with sticky headers, side rails, composers, ads, drawers, repeated posts, and nearby competing message blocks.

## Publishing

`npm run package:extension` validates the MV3 manifest, copies runtime files into `dist/umbra-<version>/`, and writes `dist/umbra-<version>.zip` for Chrome Web Store upload. Generated packages are ignored by Git.

## v2.0.2 notes

This release adds a real auto-refocus cooldown in `content.js`: after enough pointer movement or scroll activity, automatic reacquire waits out a short window so the spotlight does not fight you while you move around the page. Stale surfaces clear faster on pointer motion; transition and scroll timers respect the same cooldown.

## v2.0.1 notes

The X / Twitter profile in `site-profiles.js` was tightened so timeline posts are easier to separate from composer, drawers, and utility chrome—keeping candidate scoring aligned with pointer-first reading on that surface.
