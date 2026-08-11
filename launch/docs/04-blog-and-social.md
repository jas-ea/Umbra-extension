# 04 - Blog and Social Copy

## Blog Draft

# Umbra: soft focus for dense pages

Most reading tools ask you to leave the page. Umbra takes a smaller approach: it keeps the original website open and dims the visual noise around the block you are reading.

That matters on pages where the surrounding context is still useful. A docs page has navigation. A GitHub issue list has filters and labels. A Stack Overflow page has nearby questions, tags, and right-rail context. A long reference article has its contents and infobox. Umbra tries to make the current block easier to hold in attention without turning the site into a separate reader view.

The first release focuses on simple behavior:

- Hover and dwell over a block to focus it.
- Stop scrolling on a long page to let Umbra pick a nearby reading block.
- Use Focus, Pin, Pause tab, and per-site Auto / Manual / Off controls from the popup.
- Keep detailed tuning in Settings, not in the daily menu.

Umbra runs locally in the browser. It does not send page content, URLs, cursor history, or reading behavior to Cassini Research. Settings are stored in Chrome sync storage.

We tested this release against real dense pages and noisy fixtures: documentation pages, long reference articles, GitHub issue lists, Stack Overflow question lists, chat-style app shells, and social-feed layouts. The goal was not to make a demo page look clean. The goal was to keep the focus region useful where pages already have sidebars, filters, composers, promoted blocks, and repeated rows.

Umbra is conservative by design. On utility-heavy pages, Manual or Off mode is often the better default. A focus tool should help you keep your place; it should not fight the page.

Umbra 2.2.2 is ready for Chrome Web Store submission.

## X Thread

1. We are preparing Umbra for release from Cassini Research.

   It is a small Chrome extension for dense pages: hover or stop scrolling, and Umbra softly dims the surrounding page around the block you are reading.

2. The page stays live.

   No reader view. No DOM rewrite. No server-side processing of page content.

3. We built it for pages where context still matters: docs, long articles, GitHub issues, Stack Overflow lists, chat answers, and feeds.

4. The hard part was targeting.

   A focus tool is not useful if it grabs the sidebar, composer, ad card, or full app shell. We added noisy-page tests for chat-style app layouts and social-feed layouts because simple demo blocks are not enough.

5. Privacy posture is simple: Umbra runs locally, stores preferences in Chrome sync storage, and sends no analytics, telemetry, page content, URLs, or reading behavior to Cassini Research.

6. We will share the Chrome Web Store link once review is complete.

## LinkedIn Post

Cassini Research is preparing Umbra for release.

Umbra is a Chrome extension for reading dense pages without leaving the live website. It dims the surrounding page around the block you are reading, while keeping the original site interactive.

We built it for pages where a reader view is the wrong shape: documentation with side navigation, GitHub issue lists with labels and filters, Stack Overflow question lists, long reference articles, chat answers, and feeds.

The product constraint is simple: focus should help without fighting the page. That is why Umbra has Auto, Manual, and Off modes per site, and why the daily popup is limited to the controls people need often: Focus, Pin, Pause, and site behavior.

The privacy model is also simple. Umbra runs locally in the browser. It does not send page content, URLs, cursor history, or reading behavior to Cassini Research.

We have packaged version 2.2.2 for Chrome Web Store submission and will share the listing once review is complete.

## Short Launch Blurb

Umbra is a Chrome extension from Cassini Research that softly dims visual noise around the block you are reading, while keeping the original website interactive. It runs locally, does not rewrite the page, and sends no page content or reading behavior to Cassini Research.
