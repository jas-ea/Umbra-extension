# Chrome Web Store Listing

Use this as the source text for the Chrome Web Store dashboard. Keep the listing factual and short; do not add rankings, competitor claims, or broad productivity promises.

## Publisher

Cassini Research

## Title

Umbra

## Summary

Soft focus for reading dense pages without leaving the live web.

## Description

Umbra dims the visual noise around the content you are reading while keeping the original page interactive. It works on articles, chat answers, email messages, and social posts without sending page content to a server.

Main features:

- Focuses after hover dwell or scroll-stop reading intent.
- Keeps the real page active instead of opening a reader view.
- Provides Focus, Pin, Pause tab, and per-site Auto / Manual / Off controls.
- Uses local browser storage for preferences.
- Sends no analytics, telemetry, page content, or reading behavior to Cassini Research.

Umbra is conservative by design. On utility-heavy pages, it can stay in Manual mode or Off so it does not fight the site's controls.

## Permission Notes

`storage` saves preferences and per-site modes.

`scripting` lets the popup recover Umbra on already-open pages after install or update when Chrome allows same-page injection.

`<all_urls>` lets the focus overlay run on the pages where the user chooses to use Umbra. Page structure is processed locally in the browser.

## Privacy Disclosure

Umbra has no first-party server, analytics, telemetry, remote configuration, or cloud inference. Page content, URLs, cursor position, and reading behavior are not transmitted to Cassini Research.

Use `PRIVACY.md` as the privacy policy URL content. It includes the Limited Use statement required for Chrome Web Store review.

## Assets

Required:

- Store icon: `icons/icon128.png`
- At least one 1280 x 800 screenshot showing the real overlay on a dense page.
- Small promo tile: 440 x 280 PNG or JPEG.

Recommended screenshots:

1. Chat or Codex-style page with one answer focused.
2. Social-feed page with one post focused near side rails and promoted content.
3. Popup showing the simple controls.
4. Options page showing advanced settings.

Keep screenshots full bleed, current to version 2.2.2, and light on text.

## Release Gate

Before upload:

```bash
npm ci
npm run lint
npm test
npm run test:e2e
npm run validate
npm run package:extension
```

Upload `dist/umbra-2.2.2.zip`.
