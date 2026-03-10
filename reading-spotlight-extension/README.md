# Reading Spotlight

A simple Chrome extension that waits for your cursor to settle, infers the content block you are reading, and dims the rest of the page with smooth masks.

## Install
1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select this folder

## Install
1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select the `reading-spotlight-extension` folder

## Testing & usage

1. **Load the extension** (steps above). The extension should appear with a puzzle-piece icon (no custom icons yet).

2. **Enable it**  
   - Extension is on by default. Use the popup (toolbar icon) to turn **Reading Spotlight** on/off.

3. **Try the spotlight**  
   - Open any text-heavy page (e.g. a news article, Wikipedia, or a long Twitter/X thread).  
   - Move the mouse over a paragraph or block of content and **hold still** for about 2 seconds (default dwell).  
   - The rest of the page should dim and a rounded “window” should highlight the block under the cursor.  
   - Move the cursor outside that area (or press **Escape**) to clear the spotlight; hold still again to re-trigger.

4. **Popup (toolbar)**  
   - Click the extension icon.  
   - **Enable/disable** the extension.  
   - **Dwell before focus**: slider (e.g. 0.8s–8s) – how long you must stay still before the spotlight turns on.  
   - **Overlay strength**: how dark the dimmed area is.  
   - **Focus now**: immediately spotlights the block under the cursor (then closes popup).  
   - **Pause on this tab**: disables spotlight only in the current tab (handy for a tab where you don’t want it).  
   - **More settings**: opens the full options page.

5. **Options page**  
   - Right‑click the extension icon → **Options**, or use **More settings** in the popup.  
   - Adjust padding, corner radius, transition speed, minimum block size, dwell tolerance, etc.  
   - Click **Save** to store; **Reset defaults** to restore defaults.

6. **Keyboard shortcut**  
   - **Alt+Shift+R** (Windows/Linux) or **Alt+Shift+R** (Mac): pause or resume Reading Spotlight on the **current tab** only.

**If the spotlight doesn’t appear:**  
- Ensure the extension is enabled (popup toggle).  
- Check the tab isn’t paused (popup: “Resume on this tab” if it says that).  
- Try “Focus now” to force a spotlight at the cursor.  
- On very dynamic or heavily scripted pages, the heuristic may pick a different block; try moving the cursor to the middle of the paragraph you want.

## Controls
- Popup: enable/disable, dwell timing, overlay strength, focus now, pause current tab
- Options page: full tuning
- Hotkey: `Alt+Shift+R` pauses/resumes the extension on the current tab

## Default behavior
- Dwell before activation: 2200 ms
- Overlay opacity: 68%
- Smooth mask transitions: 280 ms

## Notes
This build uses heuristics to select a likely reading container, so site-specific tuning may still improve behavior on X/Twitter, Medium, Substack, or docs-heavy sites.
