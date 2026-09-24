# Umbra Publication Drafts

Review copy only. Replace bracketed links after the Chrome Web Store listing, product note, privacy policy, and GitHub Release are public.

## Canonical description

Umbra is a Chrome extension that keeps the part of a webpage you are using clear and darkens everything around it.

Pause over a paragraph, message, post, list, or panel. Umbra waits, then darkens the surrounding page. Move to another section and it follows after a short delay.

## Blog title and opening

### Umbra: automatic visual focus for the web

Modern web applications put navigation, messages, controls, recommendations, and content in the same visual field. Much of that interface remains useful, but it competes with the section a person is using now.

We built Umbra to change that visual balance without changing the page. Pause over a paragraph, message, post, list, or panel, and the surrounding page darkens. Move away and Umbra releases the previous section before following you.

The complete article is `01-product-note.md`.

## GitHub Release

### Umbra 2.7.0

Umbra keeps the part of a webpage you are using clear and darkens everything around it.

Version 2.7.0 fixes targeting on dense applications and long conversations. A declared message can no longer be rejected because an outer layout wrapper happens to mention a composer or toolbar. Multi-screen answers focus the paragraph, list, code block, table, or figure under the pointer instead of opening one viewport-sized cutout.

Direct area selection now works independently from automatic rejection rules, including folders and sidebars. Automatic focus can be disabled without leaving route or recovery paths active. The default surrounding darkness is 80%, and profiles now cover Grok, LinkedIn, Reddit, YouTube, Discord, and Hacker News in addition to the existing chat, feed, inbox, calendar, documentation, and issue-list profiles.

Page analysis runs inside the browser. Umbra contains no analytics, remote code, cloud model, or product server.

- Chrome Web Store: [link]
- Product note: [link]
- Privacy policy: [link]
- Package SHA-256: `a1f247294ade2523dd6d89cbbd56931ecff164b641da67ff273e0648ecb8bdee`

## Show HN

### Title

`Show HN: Umbra, a Chrome extension that darkens the page around the section in use`

### First comment

I built Umbra after repeatedly losing the current item inside inboxes, chat threads, issue queues, documentation, and feeds. Those pages contain useful context, so removing the surrounding interface was not the interaction I wanted.

Umbra keeps the page in place. Pause over a paragraph, message, post, list, or panel and the surrounding page darkens. Move away and the previous section clears before the next one appears.

The difficult part is choosing the right scale. An inbox should remain a list while someone scans it. An opened email should become an individual section. A long answer should narrow to the current reading block. A toolbar inside a message should never become the selected region. The current engine combines site profiles, semantic HTML, geometry, pointer residence, scroll state, media and editing state, and an in-memory page map.

Everything runs inside the browser. The source is MIT licensed and the package contains no analytics or remote code. Broad website access is required because the extension runs on the pages where it is enabled; the privacy policy documents the data handling and permissions.

I am looking for reproducible examples from virtualized feeds, split panes, nested menus, recycled page elements, and unfamiliar web applications.

[Chrome Web Store] · [GitHub] · [Product note]

## Extension community

### Title

`[Self Promotion] Umbra - automatic visual focus for webpages`

### Body

Umbra darkens the webpage around the paragraph, message, post, list, or panel under the pointer. It waits before focusing and again before switching, so crossing navigation or controls does not immediately move the clear area.

The extension keeps inboxes, calendars, tables, and conversations together while they are being scanned. Menus, editing, dragging, video, and fullscreen have separate interaction rules. Choose an area handles direct selection.

Page analysis runs locally. The project is MIT licensed and contains no analytics or remote code.

Chrome Web Store: [link]

GitHub and product note: [link]

Please report pages where Umbra chooses the wrong scale, follows the pointer too quickly, or fails to release the previous section.

## X

We built Umbra, a Chrome extension that keeps the section you are using clear and darkens the rest of the webpage.

It waits before focusing, keeps lists and calendars together, and runs entirely inside the browser. Open source from Cassini Research.

[store link] [product note]

## LinkedIn

Modern web applications put content beside navigation, filters, activity, controls, and repeated lists. We built Umbra to reduce that visual competition while preserving the original page.

Pause over a paragraph, message, post, list, or panel. Umbra waits, then darkens everything around it. Lists, calendars, tables, and conversations remain together while they are being scanned. Opened messages, articles, posts, and answers can focus individually.

The selection engine combines page structure, geometry, pointer residence, scrolling, and explicit interaction states. All processing stays inside the browser, and the project is open source under the MIT License.

Umbra is a project from Cassini Research. We are releasing it for people who work in dense web applications and for developers interested in the selection problem behind the overlay.

[store link] [product note]
