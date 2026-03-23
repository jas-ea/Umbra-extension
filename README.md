## Umbra: Pointer-First Focus Overlay for the Web

Umbra is a Chrome extension that softly dims surrounding chrome while preserving the content block you are reading. It is designed for real browsing flows across reading, comparison (tables), and creation (composers/editors).

Umbra activates only after intent is detected (hover dwell and scroll-stop) or after manual actions. When it cannot identify a trustworthy target, it fails safe by widening the focus shell or suspending auto-focus.

Current extension source: `umbra-extension/`.

---

## Key features

- Pointer-first rule stack for intent gating (hover dwell + scroll-stop)
- Explicit selection states for reading and interaction-heavy pages (read / compare / create / act)
- Single unified spotlight shell rendered in a shadow DOM overlay
- Per-site mode control from the popup (Auto / Manual / Off)
- Conservative overlay behavior with short-lived action locks and reliable reflow via `ResizeObserver` and `MutationObserver`
- Pin / Focus / Clear controls
  - Shift + Click pins the surface under the pointer
  - `Alt+Shift+F` focuses now
  - `Alt+Shift+U` pauses the current tab
  - Escape clears the current focus

---

## How it works

Umbra runs locally in a content script and follows three core stages:

1. Intent gating (hover dwell or scroll-stop, plus manual pin/focus)
2. Candidate selection (collect, score, reject chrome-like shells, then expand just enough context)
3. Overlay rendering (position a single focus shell inside a shadow DOM host)

Site-specific adjustments live in `site-profiles.js`, while the core engine stays generic.

---

## Installation (development)

1. Clone this repository:

   ```bash
   git clone https://github.com/jas-ea/Umbra-extension.git
   cd Umbra-extension/umbra-extension
   ```

2. In Chrome (Manifest V3 compatible):
   - Open `chrome://extensions`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the `umbra-extension` folder

3. Umbra should appear in the extensions list and the toolbar.

---

## Using Umbra

- Hover and dwell over the content you want to focus.
- Stop scrolling on a long page to trigger scroll-stop focus.
- Move away from the focused area to let Umbra clear, or press `Escape`.
- Shift + Click pins the currently selected surface.

---

## Popup controls

Open the Umbra toolbar popup to control:

- Global enable/disable
- Current site mode: Auto / Manual / Off
- Focus now
- Pin block
- Pause on this tab
- Add or remove the site from the ignore list
- Advanced settings entry point

---

## Options page (advanced settings)

Umbra settings are stored in `chrome.storage.sync` and applied live:

- Core behavior: enable, auto focus on hover, auto focus after scroll settles, show outline
- Timing: hover dwell, scroll idle delay
- Visuals: overlay opacity, blur strength
- Geometry: padding, corner radius, transition speed, stationary tolerance, reveal buffer, center bias
- Ignored sites: one hostname per line

---

## Privacy

Umbra runs locally in your browser:

- No analytics, tracking scripts, or external network calls
- No webpage content is sent to any server
- Settings and preferences are stored in Chrome sync storage

---

## Documentation and contribution

- `umbra-extension/README.md` (product overview and rules)
- `umbra-extension/docs/ARCHITECTURE.md` (engine stages and design constraints)
- `umbra-extension/docs/SITE_PROFILES.md` (how to add site-specific behavior)
- `umbra-extension/CONTRIBUTING.md` (contribution workflow)


