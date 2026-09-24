# Architecture

Umbra has six runtime stages.

## 1. Map the page

After the DOM becomes quiet, Umbra builds an in-memory map of known content surfaces, detail regions, collections, and preferred targets. Mutations, scrolling, resizing, and same-page navigation invalidate that map and schedule a bounded rebuild. The map stores element references and geometry only. It is never persisted or transmitted.

Host and route rules choose a known site profile. DOM evidence can reclassify a delayed generic page after hydration. A normal article containing a table no longer becomes a comparative market page solely because the table exists.

## 2. Confirm an input

Pointer work is sampled once per animation frame. Automatic focus starts only after the pointer settles on one surface or scrolling stops. The first focus waits 1 second; a new challenger waits 1.45 seconds. Moving across candidates resets that clock. Choose an area bypasses inference.

## 3. Classify the task surface

The engine classifies the pointer context as an atomic reading surface, collection, interaction surface, or media surface. Composite grids, mail lists, calendars, and message panes resolve to their enclosing collection. Open messages, articles, posts, and answers can resolve to an atomic surface.

Menus, popovers, dialogs, dragging, and fullscreen suspend automatic focus. They do not become reading targets. Pinned and manually chosen surfaces remain the incumbent while the overlay is hidden, then return after the interaction closes.

## 4. Select a candidate

The engine collects nearby ancestors, rejects utility context, scores readable surfaces, and expands only when the child is too narrow to stand alone. Accepted surfaces bound token-based rejection, which prevents an outer app wrapper such as `composer-parent` from invalidating content inside it. Explicit selectors resolve by DOM proximity rather than declaration order.

When a conversation turn is taller than the viewport, the engine selects the local paragraph, list, code block, table, figure, or heading under the pointer. Manual area selection uses a separate visual-region pass, so a user can deliberately pin a sidebar or folder panel that automatic mode ignores.

`focus-policy.js` owns the incumbent/challenger state. Leaving an incumbent retires its visual cutout after a short exit delay, while internal ownership remains briefly available for a quick return. The next candidate must still complete its dwell. Rejected chrome, viewport exit, route changes, and restored interactions cannot revive a stale visual owner.

## 5. Compute visible geometry

`rectForElement` adds configured padding, clips the rectangle against ancestor scrollports and the viewport, and records which edges were clipped. For long paragraphs distorted by adjacent floated content, it uses the rendered text range instead of the inflated CSS block box. Corners created by clipping are square; exposed corners use the configured radius.

## 6. Render one shape

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

Content scripts mount at `document_idle`. Installation and update events also inject the version-guarded runtime into eligible pages that were already open. The popup retains a per-page repair path when Chrome blocks automatic injection.

Same-document navigation refreshes the active profile. Back-forward cache page hide/show events suspend and restore the runtime without losing the page lifecycle.
