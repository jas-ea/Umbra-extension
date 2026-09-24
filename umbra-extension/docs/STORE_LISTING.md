# Chrome Web Store Listing

## Publisher

Cassini Research

## Title

Umbra

## Summary

Keep the part of a webpage you are using clear and darken everything around it.

## Description

Umbra adds automatic visual focus to webpages. After your pointer settles, the section you are using stays clear while the rest of the page darkens.

The extension chooses the scale that fits the page. Articles, opened messages, posts, questions, and answers can focus individually. Inbox lists, calendars, tables, and conversations stay together while you scan them.

Umbra waits before changing focus, so crossing a sidebar or toolbar does not immediately move the clear area. Menus, dialogs, editing, dragging, and fullscreen suspend the overlay.

Choose an area lets you select and pin a section directly. The popup also controls page darkness, behavior for the current site, and tab pause.

Page structure and pointer position are processed inside the browser. Umbra sends no page content, URLs, pointer history, or usage analytics to Cassini Research.

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

Upload `dist/umbra-2.7.0.zip`.
