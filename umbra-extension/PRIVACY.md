# Privacy Policy

Umbra is published by [Cassini Research](https://cassiniresearch.com/). It processes webpage structure, the current page address, and pointer position locally to select and outline a section on the current page.

Its per-page surface map exists only in the tab's memory. It contains element references and geometry used by the selection engine and is discarded when the page or extension runtime closes.

## Data stored

Umbra stores preferences through Chrome storage, including whether the extension is enabled, appearance settings, and per-site modes. Per-site modes contain the hostname chosen by the user. Chrome may sync these preferences through the user's signed-in Chrome account according to the user's Chrome Sync settings.

A paused-tab identifier is stored in Chrome's session storage and removed when the tab closes. Umbra does not persist page content, full URLs, pointer positions, or its per-page surface map.

## Data not collected

Umbra does not send webpage content, URLs, pointer history, account data, or usage analytics to Cassini Research or another service. It does not use analytics, telemetry, cloud inference, remote configuration, or remote code.

Umbra does not inject advertising, affiliate code, tracking pixels, or third-party scripts.

## Permissions

`storage` saves preferences, site modes, and session-only tab pause state.

`scripting` lets the popup restore the extension on an eligible page that was already open when Umbra was installed or updated.

`<all_urls>` lets Umbra operate on websites where the user chooses to use it. Processing remains in the browser.

## Data use

Stored preferences are used only to provide Umbra's focus behavior. Umbra does not sell or share user data. Its use of information follows the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Contact

Support and bug reports: https://github.com/jas-ea/Umbra-extension/issues

_Last updated: 2026-08-17._
