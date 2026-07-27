# Umbra

Umbra is a Manifest V3 Chrome extension that softly dims visual noise around the live page content you are reading. It does not replace the page with a reader view, rewrite the DOM, or send page content to a server.

Current extension source lives in `umbra-extension/`.

---

## What It Does

- Detects reading intent from hover dwell and scroll-stop behavior.
- Keeps the real page interactive and dims around the selected block.
- Supports per-site modes from a collapsed popup section: Auto, Manual, and Off.
- Provides Focus, Pin, Pause on this tab, Shift+Click pin, and Escape clear.
- Respects reduced-motion and forced-colors settings in the overlay.
- Runs locally with no analytics, telemetry, cloud inference, or remote code.

---

## How it works

Umbra runs locally in content scripts and follows three core stages:

1. Intent gating (hover dwell or scroll-stop, plus manual pin/focus)
2. Candidate selection (collect, score, reject chrome-like shells, then expand just enough context)
3. Overlay rendering (position a single focus shell inside a shadow DOM host)

Site-specific adjustments live in `umbra-extension/site-profiles.js`, while the core engine stays generic.

---

## Installation (development)

1. Clone this repository:

   ```bash
   git clone https://github.com/jas-ea/Umbra-extension.git
   cd Umbra-extension
   ```

2. In Chrome (Manifest V3 compatible):
   - Open `chrome://extensions`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the `umbra-extension/` folder

3. Umbra should appear in the extensions list and the toolbar.

---

## Using Umbra

- Hover and dwell over the content you want to focus.
- Stop scrolling on a long page to trigger scroll-stop focus.
- Move away from the focused area to let Umbra clear, or press `Escape`.
- Shift + Click pins the currently selected surface.

Chrome lets users remap extension shortcuts. This is useful on systems where `Alt+Shift` is reserved for keyboard layout switching.

---

## Popup controls

Open the Umbra toolbar popup to control:

- Global enable/disable
- Focus
- Pin
- Pause on this tab
- Current site mode: Auto / Manual / Off, collapsed under Site behavior
- Settings entry point

---

## Options page (advanced settings)

Umbra settings are stored in `chrome.storage.sync` and applied live:

- Core behavior: enable, auto focus on hover, auto focus after scroll settles, show outline
- Timing: hover dwell, scroll idle delay
- Visuals: overlay opacity, dim tint, solid dim, edge feather
- Geometry: padding, corner radius, transition speed, stationary tolerance, reveal buffer, reading band, focus shape
- Site modes: one hostname per line as `hostname=off` or `hostname=manual`

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
- `umbra-extension/docs/ACCESSIBILITY.md` (system settings and assistive technology posture)
- `umbra-extension/CONTRIBUTING.md` (contribution workflow)
