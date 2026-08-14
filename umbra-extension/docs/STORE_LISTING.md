# Chrome Web Store Listing

## Publisher

Cassini Research

## Title

Umbra

## Summary

Keep one block clear on busy webpages without leaving the original site.

## Description

Umbra dims the area around one block while keeping the original webpage visible and interactive.

It can select a message, post, question, issue row, or article section after the pointer rests or scrolling settles. Choose an area lets you select and pin a block directly when automatic selection is not appropriate.

The popup keeps routine controls together:

- Turn Umbra on or off.
- Choose or clear an area.
- Adjust how dark the surrounding page becomes.
- Set the current site to Automatic, On request, or Off.
- Pause Umbra for the current tab.
- Open Settings for automatic focus, outline, site choices, and shortcuts.

Umbra processes page structure locally. It does not send page content, URLs, pointer history, or usage analytics to Cassini Research.

## Permission notes

`storage` saves preferences, site modes, and session-only tab pause state.

`scripting` lets the popup restore Umbra on an eligible page that was already open when the extension was installed or updated.

`<all_urls>` lets Umbra run on websites where the user chooses to use it. Page structure is processed in the browser.

## Privacy disclosure

Umbra has no first-party server, analytics, telemetry, remote configuration, cloud inference, or remote code. Use `PRIVACY.md` as the published privacy policy.

## Assets

- Icon: `icons/icon128.png`
- Store tile: `launch/assets/poster/umbra-store-promo-440x280.png`
- Screenshots: four 1280 x 800 PNG files in `launch/assets/screenshots/`

Screenshots must show the current build on real pages and leave enough surrounding interface visible to explain the product.

## Release gate

```bash
npm ci
npm run lint
npm test
npm run test:e2e
npm run validate
npm run package:extension
```

Upload `dist/umbra-2.5.0.zip`.
