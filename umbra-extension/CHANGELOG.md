# Changelog

## 2.0.0

- Rebuilt the core engine around a pointer-first rule stack.
- Added explicit read / compare / create / act handling in the selection flow.
- Replaced the older multi-layer mask feel with a single unified spotlight shell.
- Added lifecycle tracking for the active surface with `ResizeObserver` and `MutationObserver`.
- Reduced sticky action bias so passive reading can reclaim control after real interaction ends.
- Tightened defaults for dwell, transitions, and hide grace to improve exit behavior.
- Kept site-specific customizations declarative in `site-profiles.js`.
