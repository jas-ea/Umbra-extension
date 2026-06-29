# Changelog

## 2.1.0

- Added product pillars and a repeatable CI/tooling foundation.
- Added a single settings schema and a contract test to prevent fiction controls.
- Removed dead blur, center-bias, selection-model, and viewport-point settings.
- Wired the outline setting to the actual overlay border.
- Added lifecycle teardown, double-injection protection, and same-document route detection.
- Reduced streaming-page layout churn with debounced mutation refresh and cheaper candidate scoring.
- Fixed nested-scroll tracking and large-surface geometry.
- Trimmed permissions to `storage` plus `<all_urls>` host access and added full action icon sizes.
- Added reduced-motion, forced-colors, and contrast-aware overlay behavior.
- Unified per-site suppression around site modes.
- Added unit and Playwright fixture coverage for geometry, mutation debounce, route changes, media settings, and Shift+Click text selection.
- Added viewport reading-band scroll targeting, pre-dwell boundary preview, dim tint/feather/solid-dim/focus-shape customization, transformed-root dimming coverage, native modal suppression, storage write hygiene, and shortcut caveat documentation.

## 2.0.2

- Enforced a configurable default 5s auto-refocus cooldown after significant pointer movement and scrolling (`refocusCooldownMs`).
- Made pointer movement clear stale focus more decisively instead of letting old surfaces linger.
- Delayed transition- and scroll-driven reacquire until the cooldown expires, so browsing feels calmer and less twitchy.

## 2.0.1

- Refined the X / Twitter site profile: timeline cell articles (`cellInnerDiv`), explicit `surfaceSelectors`, and broader rejection of compose/post chrome, drawers, and toolbars so reading surfaces stay ahead of utility UI on mixed pages.

## 2.0.0

- Rebuilt the core engine around a pointer-first rule stack.
- Added explicit read / compare / create / act handling in the selection flow.
- Replaced the older multi-layer mask feel with a single unified spotlight shell.
- Added lifecycle tracking for the active surface with `ResizeObserver` and `MutationObserver`.
- Reduced sticky action bias so passive reading can reclaim control after real interaction ends.
- Tightened defaults for dwell, transitions, and hide grace to improve exit behavior.
- Kept site-specific customizations declarative in `site-profiles.js`.
