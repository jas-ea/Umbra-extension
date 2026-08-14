# Architecture

Umbra has five runtime stages.

## 1. Confirm an input

Automatic focus starts only after the pointer settles on one surface or scrolling stops. The first focus waits 1 second; a new challenger waits 1.45 seconds. Moving across candidates resets that clock. Choose an area bypasses inference.

## 2. Classify the task surface

The engine classifies the pointer context as an atomic reading surface, collection, interaction surface, or media surface. Composite grids, mail lists, calendars, and message panes resolve to their enclosing collection. Open messages, articles, posts, and answers can resolve to an atomic surface.

Menus, popovers, dialogs, dragging, and fullscreen suspend automatic focus. They do not become reading targets. Pinned and manually chosen surfaces remain the incumbent while the overlay is hidden, then return after the interaction closes.

## 3. Select a candidate

The engine collects nearby ancestors, rejects utility context, scores readable surfaces, and expands only when the child is too narrow to stand alone. Known sites contribute selectors and rejection rules through `site-profiles.js`.

`focus-policy.js` owns the incumbent/challenger state. The incumbent stays visible until the same challenger completes the required dwell. Passive DOM changes may refresh geometry but never choose a new surface.

## 4. Compute visible geometry

`rectForElement` adds configured padding, clips the rectangle against ancestor scrollports and the viewport, and records which edges were clipped. Corners created by clipping are square; exposed corners use the configured radius.

## 5. Render one shape

The SVG mask and outline use the same interpolated rectangle on every animation frame. The overlay lives in an `aria-hidden` shadow host with `pointer-events: none`.

Reduced motion removes geometry animation. Forced colors removes dimming and uses a system-color boundary. Playing video receives focus only when it is visible and either audible or recently activated by the user. Ownership belongs to that video rather than a page-wide media timer. Fullscreen suspends the overlay. Picture-in-picture releases page ownership and can restore the same video when it returns.

## State ownership

- `defaults.js`: settings schema and defaults
- `background.js`: session tab pause and toolbar badge
- `content.js`: page state, candidate selection, geometry, and rendering
- `focus-policy.js`: deterministic focus handoff state
- `site-profiles.js`: site-specific matching and selectors
- `popup.js`: state display and user commands

Settings live in Chrome sync storage. Paused tab identifiers live in Chrome session storage and are removed when their tabs close.

## Extension lifecycle

Content scripts mount at `document_idle`. The popup can inject the runtime files into an eligible tab when an already-open page predates installation or update. Injection is version guarded, and the popup retries state reads while the asynchronous mount finishes.

Same-document navigation refreshes the active profile. Back-forward cache page hide/show events suspend and restore the runtime without losing the page lifecycle.
