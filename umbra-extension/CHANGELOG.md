# Changelog

## 2.5.0

- Replaced the conflicting hover cooldowns with a deterministic incumbent/challenger focus coordinator.
- Set automatic focus to a 1-second first dwell and a 1.45-second refocus dwell on one stable surface.
- Added collection-level targeting for Gmail inboxes, Calendar grids, and Slack conversations.
- Added immediate suspension for menus, popovers, dialogs, dragging, and fullscreen.
- Preserved pinned and manual focus across menus, dragging, fullscreen, tab visibility changes, and exit-grace re-entry.
- Added per-video ownership, muted-autoplay rejection, and picture-in-picture return behavior.
- Added dense productivity, nested-menu, media, fullscreen, visibility, and timing browser coverage.

## 2.4.0

- Increased the default surrounding darkness from 52% to 74%.
- Added a live surroundings control to the popup.
- Replaced the popup overflow menu with visible site, pause, and settings controls.
- Reduced Settings to automatic focus, outline, site preferences, shortcuts, and reset.
- Made settings save as they change and replaced raw site rules with a readable list.

## 2.3.0

- Rebuilt hover acquisition so movement across an element does not count as a settled dwell.
- Kept the active cutout visible while confirming the next block and moved the mask and outline from one interpolated rectangle.
- Clipped focus geometry against nested scrollports and the viewport, with rounded corners only on exposed edges.
- Tightened chat, feed, issue-list, question-list, documentation, and article profiles so content blocks beat broad page shells and utility controls.
- Added direct area selection, truthful action responses, session-persistent tab pause, and same-page startup recovery.
- Replaced the popup with one context-sensitive primary action and an overflow menu for site mode, tab pause, and Settings.
- Replaced the former aperture identity with the Index Shift mark and rebuilt the store tile, launch poster, listing copy, and launch documents.
- Added browser contracts for stable dwell, clicked-control handoff, direct selection, profile matching, and mask-outline alignment.

## 2.2.2

- Tuned the default focus corner radius down to a cleaner, slightly rounded shape.
- Added dense ChatGPT-like and social-feed browser fixtures to keep focus targeting honest on noisy pages.
- Added Cassini Research publishing notes, store listing copy, and a CI package check for the Chrome Web Store zip.
- Added a Cassini Research launch kit with real-site screenshots, logo assets, poster assets, blog copy, and social post drafts.

## 2.2.1

- Fixed hover focus so normal pointer dwell is not delayed by the refocus cooldown.
- Improved generic read targeting so cards, messages, posts, and article-like surfaces beat broad page shells.

## 2.2.0

- Simplified the popup around daily controls and moved per-site behavior behind a collapsed section.
- Removed always-visible dwell and intensity controls from the popup while keeping advanced tuning in Settings.
- Replaced rectangular dimmer slices with a single rounded cutout mask for the focus overlay.
- Made Focus and Pin target the focused element or viewport reading band before falling back to pointer position.
- Added popup-side same-page injection for install/update recovery instead of showing a reload prompt on scriptable pages.

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
- Added a per-tab toolbar state badge (off / paused / manual) so Umbra's status is visible without opening the popup.
- Hardened fallback surface selection against empty selector lists and cleared lingering boundary-preview outlines on scroll.
- Finalized store readiness: real privacy-policy contact and Limited Use data-use disclosure, plus a `homepage_url` in the manifest.

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
