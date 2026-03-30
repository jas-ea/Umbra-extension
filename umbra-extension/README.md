# Umbra 2.0

Umbra is a pointer-first focus layer for the live web. It dims surrounding chrome without rewriting pages, and it is designed to fail safe when unsure.

## Product rules

Umbra 2.0 is built around a small rule engine:

1. Pointer position plus dwell is the default truth for passive reading.
2. Read, compare, create, and act are different states.
3. Presence is weak evidence. Fresh activity is strong evidence.
4. If Umbra is uncertain, it widens, softens, or does nothing.
5. Exit quality matters as much as entry quality.

## What changed in 2.0

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

- Popup: global enable, current-site Auto / Manual / Off, Focus now, Pin block, Pause on this tab.
- Hotkeys: `Alt+Shift+U` pauses the current tab, `Alt+Shift+F` forces focus now.
- Shift + Click pins the surface under the pointer.
- Escape clears the current focus and releases pinning.

## Fallback behavior

Umbra is deliberately conservative. If it cannot identify a trustworthy surface, it prefers one of these outcomes instead of cropping the wrong thing:

1. widen to a safer parent shell
2. keep the dimming minimal
3. suspend auto-focus until clearer intent appears

## Repo structure

- `content.js`: the core pointer-first rule engine
- `site-profiles.js`: declarative site profiles and defaults
- `popup.*`: quick controls
- `options.*`: advanced settings
- `docs/`: architecture and contribution notes

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

## v2.0.1 notes

This patch tightens the X / Twitter profile in `site-profiles.js` so timeline posts are easier to separate from composer, drawers, and utility chrome—keeping candidate scoring aligned with pointer-first reading on that surface.

## Testing

A static smoke-test pass was run for this build:

- all JavaScript files pass syntax checks with Node
- manifest and asset paths resolve
- the archive loads as a valid unpacked extension folder

A full live browser QA pass still matters before publishing to a store.
