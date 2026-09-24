# Umbra

Umbra is a Chrome extension that keeps the part of a webpage you are using clear and darkens everything around it.

Pause over a paragraph, message, post, list, or panel. Umbra waits one second, then darkens the surrounding page. Move to another section and it waits again before changing focus.

![Umbra keeping the OpenAI Cookbook issue list clear on GitHub](launch/assets/screenshots/github-openai-cookbook-issues.png)

Modern web applications place content beside navigation, filters, activity, controls, and repeated lists. Umbra changes their visual emphasis without changing their layout. It follows the section in use, waits before switching, and leaves the website's controls available.

Umbra is an open-source project from [Cassini Research](https://cassiniresearch.com/). Version 2.7.0 is a release candidate; the Chrome Web Store listing is still under review.

## What it does

- Waits for the pointer to settle before focusing a section.
- Uses a longer delay before switching to another section.
- Keeps inboxes, calendars, tables, and conversations together while they are being scanned.
- Focuses articles, opened messages, posts, questions, and answers individually.
- Suspends the overlay for menus, dialogs, editing, dragging, and fullscreen.
- Lets the user choose an area directly, change page darkness, pause a tab, or set behavior for the current site.

The [product note](launch/docs/01-product-note.md) explains the design and research behind the extension. [Real-world examples](launch/docs/02-real-world-examples.md) show the current build on public websites.

## Install for development

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select the `umbra-extension/` folder.

The popup contains the controls needed during normal use: on/off, Choose an area, page darkness, current-site behavior, tab pause, and Settings.

## Verify and package

```bash
npm ci
npm run lint
npm test
npm run test:e2e
npm run validate
npm run package:extension
```

The package command creates `dist/umbra-<version>.zip` from runtime files only.

## Known limits

Websites change their structure without notice. Umbra can choose the wrong section or make no automatic choice on an unfamiliar page. Canvas-heavy editors and applications without stable document structure use on-request behavior. Report reproducible failures through the issue templates without including private page content.

## Repository

- `umbra-extension/`: extension source and product documentation
- `test/`: unit, contract, and browser tests
- `launch/`: store assets, real-site screenshots, and launch copy
- `scripts/`: validation, packaging, and asset tools

Site-specific targeting belongs in `umbra-extension/site-profiles.js`. Focus handoff belongs in `umbra-extension/focus-policy.js`. Shared selection, interaction handling, clipping, and overlay behavior belongs in `umbra-extension/content.js`.

## Privacy

Umbra processes page structure and pointer position inside the browser. It has no analytics, telemetry, cloud inference, remote configuration, or product server. Preferences are stored through Chrome storage. See [PRIVACY.md](umbra-extension/PRIVACY.md) for the complete policy.

## Cassini Research

[Cassini Research](https://cassiniresearch.com/) is an independent AI lab that builds open-source software and conducts research. Follow the lab on [GitHub](https://github.com/Cassini-Research), [X](https://x.com/CassiniRes), and [LinkedIn](https://www.linkedin.com/company/cassini-research/).

## License

Umbra is available under the MIT License. See `LICENSE`.
