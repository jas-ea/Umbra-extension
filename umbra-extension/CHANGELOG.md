# Changelog

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
