# Umbra

Umbra is a Chrome extension that dims the non-essential parts of a page and leaves the content block you are reading fully visible. It is intended for timeline reading, long posts, blogs, and documentation where interface chrome and surrounding clutter are more distracting than helpful.

## What changed in this build

This version is a full productized pass over the earlier prototype. The overlay now renders inside a shadow DOM to avoid CSS collisions, supports both hover dwell and scroll-stop activation, includes a proper global enable switch, per-tab pause, per-site ignore, manual pinning with Shift + Click, redesigned popup and options pages, a coherent logo set, and production-facing documentation.

## How it works

Umbra uses two activation paths. First, when scrolling stops for a short idle period, it looks near the upper-middle of the viewport and finds the most plausible reading container. Second, when the pointer rests in one place long enough, it uses the hovered element and its ancestors to infer a readable block such as a tweet, article, section, or post. It then draws four masks around that region and animates them smoothly.

## Core controls

Enable or disable the extension globally from the popup.
Pause or resume Umbra on the current tab.
Ignore a site from the popup or from settings.
Pin the current block from the popup, or hold Shift and click a block directly on the page.
Press Escape to clear the overlay or remove a pin.

## Hotkeys

`Alt+Shift+U` pauses or resumes Umbra on the current tab.

`Alt+Shift+F` focuses the current reading block immediately.

## Installation

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click `Load unpacked`
4. Select this folder

## Recommended defaults

The included defaults are tuned for general browsing:

- Hover dwell: 1800 ms
- Scroll idle activation: 260 ms
- Overlay opacity: 0.62
- Blur: 2 px
- Corner radius: 24 px

## Packaging notes

This repository is ready for local install and store-hardening work. It already includes the expected product surfaces: popup, options page, icon set, privacy documentation, and change log. Before any public store submission, do one browser pass across X, Medium, Substack, docs sites, and a generic news site to confirm the heuristics feel stable.


## Intent model

Umbra now waits for real user intent instead of focusing on page load. It activates only after one of these patterns:

- hover intent: the mouse settles over a region for the dwell duration
- scroll intent: the user scrolls, then stops long enough for a stable reading target to emerge

It also applies lightweight site profiles for article pages, timeline feeds, and Gmail-style mail views.
