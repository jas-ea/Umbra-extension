## Umbra – Reading Spotlight for the Web

Umbra is a Chrome extension that helps you stay on a single piece of content by **dimming everything except what you are actually reading**.  
It works well on timelines, long articles, and documentation pages where your eyes otherwise drift to sidebars, nav bars, and recommendations.

Umbra watches your mouse position, waits for it to settle, then infers the most likely reading block under the cursor (such as a tweet, post, or article body).  
Once it finds a good candidate, it draws a smooth spotlight around that block and darkens the rest of the viewport.

The extension lives in the `reading-spotlight-extension` folder in this repository.

---

## Features

- **Smart reading focus**  
  - Detects likely reading containers using layout, text density, and semantic hints.  
  - Tuned for feeds like X (Twitter), longer posts, and article-style layouts.

- **Aggressive background dimming**  
  - Darkens the rest of the page so your current block clearly stands out.  
  - Default overlay strength is high enough to mute distractions while keeping the page usable.

- **Dwell-based activation**  
  - No extra clicks: hold the mouse still for a short dwell time and the spotlight appears.  
  - Move away from the block or hit Escape to clear it.

- **Per-tab and global controls**  
  - Toggle the extension globally from the popup.  
  - Pause or resume behavior on the current tab only.  
  - Adjust dwell timing, overlay strength, padding, transition speed, and more.

- **Keyboard shortcut**  
  - Default: `Alt+Shift+R` to pause or resume Umbra on the active tab.

---

## How it works

- A **content script** runs on each page and tracks your pointer position.  
- When the pointer stops moving for a configurable dwell time, Umbra:
  - Finds the element under the cursor and walks its ancestors and descendants.  
  - Scores candidates based on text length, paragraphs, images, links, and viewport coverage.  
  - Prefers tweet-like and article-like containers on sites that expose semantic attributes.  
  - Chooses the best match and computes a padded rectangle around it.
- An overlay of four dark masks and a highlighted outline is positioned around that rectangle, leaving only the focused block in normal brightness.
- As you scroll or resize, the highlight tracks the same target element until you move far enough away, at which point the dwell timer starts over.

All state (such as dwell time and overlay opacity) is stored with `chrome.storage.sync`, so your settings follow you across Chrome profiles where sync is enabled.

---

## Installation (development)

1. Clone this repository:

   ```bash
   git clone https://github.com/jas-ea/Umbra-extension.git
   cd Umbra-extension/reading-spotlight-extension
   ```

2. In Chrome (or a Chromium-based browser that supports Manifest V3):
   - Open `chrome://extensions`  
   - Enable **Developer mode**  
   - Click **Load unpacked**  
   - Select the `reading-spotlight-extension` folder

3. Umbra should now appear in your extensions list and the toolbar.

---

## Using Umbra

1. **Open a reading-heavy page**
   - X / Twitter timelines or threads  
   - News articles or long blog posts  
   - Documentation pages with dense content

2. **Hover and dwell**
   - Move your pointer over the tweet, paragraph, or content block you want to focus on.  
   - Hold still for the configured dwell time (2200 ms by default).  
   - The rest of the page will dim and a rounded spotlight will appear around the active block.

3. **Leave focus**
   - Move your pointer well outside the spotlighted block, or  
   - Press `Escape` to clear the spotlight and restart dwell tracking.

---

## Popup controls

Click the Umbra toolbar icon to open the popup:

- **Enable extension** – turns Umbra on or off globally.  
- **Dwell before focus** – slider to adjust how long the pointer must stay still before focus triggers.  
- **Overlay strength** – slider to control how dark the non-focused areas become.  
- **Focus now** – immediately triggers a spotlight around the block beneath your cursor.  
- **Pause on this tab** – disables Umbra only for the current tab; useful for sites where you never want focus mode.  
- **More settings** – opens the full options page.

---

## Options page

From the popup, click **More settings**, or right-click the Umbra icon and choose **Options**.

You can tune:

- Enabled / disabled state  
- Dwell delay (milliseconds)  
- Overlay opacity (how dark the dimmed region is)  
- Horizontal and vertical padding around the focus block  
- Corner radius of the spotlight window  
- Transition speed for mask movement and fade  
- Minimum width and height for candidate blocks  
- Stationary tolerance and reveal distance used to decide when to clear focus  
- Optional debug logging in the browser console

All changes are applied via `chrome.storage.sync` and react live in open tabs.

---

## Privacy

Umbra runs entirely in your browser:

- No analytics, tracking scripts, or external network calls.  
- No content is sent to any server.  
- All heuristics run locally in the content script, and settings are stored in Chrome sync storage.

This repository is intended as a straightforward example of an opinionated “reading spotlight” implementation that you can inspect and modify.

---

## Roadmap ideas

Planned or possible enhancements:

- Additional heuristics for more platforms and layouts.  
- Per-site presets for tuning dwell and overlay strength.  
- Export/import of settings.  
- Optional keyboard-only focus controls.

If you find a layout where Umbra behaves badly, open an issue with a screenshot and URL so the heuristics can be tuned.

