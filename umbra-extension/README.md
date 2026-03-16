# Umbra

Umbra is a Chrome extension that dims the non-essential parts of a page and leaves the content block you are reading fully visible. The project is meant to be public, contributor-friendly, and easy to tune site by site without forcing every fix through one giant heuristic blob.

## Project status

Umbra has a general-purpose focus engine and a growing **site profile layer**. The general engine handles dwell, scroll-stop intent, masking, and candidate ranking. Site profiles let contributors add narrow fixes for specific products such as Gmail, Substack, X, docs tools, or whatever else behaves differently enough to need custom handling.

The core principle is simple: **general heuristics first, explicit site handling second**. Global logic should stay stable. Site-specific rules should be declarative, small, and easy to review.

## What Umbra does

Umbra waits for real user intent and then focuses the most likely reading container.

It activates only after one of these patterns:

- hover intent: the mouse settles over a region for the dwell duration
- scroll intent: the user scrolls, then stops long enough for a stable reading target to emerge

It then renders a single rounded focus shell around the chosen region inside a shadow DOM overlay so page CSS collisions are minimized.

## Architecture

Umbra is now split into two layers.

### 1. Core engine

The core engine lives in `content.js` and is responsible for:

- hover dwell and scroll-stop intent detection
- candidate collection and ranking
- context expansion so author info, metadata, and essential controls stay visible
- mask rendering and animation
- pinning, pause, ignore-domain logic, and popup/options integration

### 2. Site profile registry

The site profile registry lives in `site-profiles.js`.

A site profile declares things like:

- which hosts or layouts it matches
- what the page intent is (`gmail`, `timeline`, `article`, `chat`, `comparative`, `utility`, `generic`)
- quick selectors to snap to likely targets
- selectors and token patterns to reject app chrome or shells
- selectors to prefer when boosting candidates
- viewport sample points for scroll-stop focus
- fallback selectors if the scoring pass fails

This makes site fixes much easier to contribute and review.

## File structure

```text
umbra-extension/
  manifest.json
  site-profiles.js
  content.js
  background.js
  popup.html
  popup.css
  popup.js
  options.html
  options.css
  options.js
  icons/
  README.md
  CONTRIBUTING.md
  TESTING.md
  PRIVACY.md
  CHANGELOG.md
  docs/
    SITE_PROFILES.md
    ARCHITECTURE.md
  .github/
    ISSUE_TEMPLATE/
      bug_report.md
      site_profile_request.md
    pull_request_template.md
```

## Install

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click `Load unpacked`
4. Select this folder

## Recommended defaults

The included defaults are tuned for general browsing:

- Hover dwell: 1800 ms
- Scroll idle activation: 300 ms
- Overlay opacity: 0.62
- Blur: 2 px
- Corner radius: 24 px

## How to add a site fix

The preferred workflow is:

1. Reproduce the bad focus behavior on a real page.
2. Inspect the DOM and identify the smallest stable container that should remain visible.
3. Decide whether the problem belongs in the global engine or in a site profile.
4. If it is site-specific, add or extend a profile in `site-profiles.js`.
5. Test hover focus, scroll focus, pinning, and context expansion on at least two pages from that site.
6. Open a PR with screenshots and a short explanation of why the fix is narrow enough to stay site-specific.

There is a full contributor guide in [`CONTRIBUTING.md`](./CONTRIBUTING.md) and a profile reference in [`docs/SITE_PROFILES.md`](./docs/SITE_PROFILES.md).

## Rules for contributors

Keep these boundaries strict:

- Do not add random site hacks directly into `content.js` unless the logic is genuinely global.
- Prefer selectors and small declarative profile changes over giant custom branches.
- Reject app shells aggressively; preserve reading context conservatively.
- A good fix keeps visible the author/sender identity, timestamp, and the primary interactive controls that belong to the focused unit.
- Comparative pages such as market tables, screeners, leaderboards, and inbox-style lists should usually focus the whole table surface or default to Manual, not isolate single rows.
- A bad fix focuses inner text only or balloons to the whole application shell.

## Site profiles currently included

The repo ships with starter profiles for:

- Gmail
- Substack feed / notes
- Substack article pages
- X / Twitter
- ChatGPT / Claude / Gemini
- CoinGecko and comparative market-table pages
- generic article layouts
- generic fallback

These are meant as seeds, not a finished catalog.

## Testing expectations

Before opening a PR, test these cases where relevant:

- fresh page load should not auto-focus without user intent
- hover dwell should focus the intended unit
- scroll-stop should focus the likely reading target
- moving away should clear focus cleanly
- pinned mode should remain stable
- sidebars, search bars, toolbars, and carousels should not win target selection

See [`TESTING.md`](./TESTING.md) for more detail.

## Public repo guidance

If you publish this, keep the repo friendly to outside contributors:

- use site-profile issue templates for website-specific bugs
- ask for screenshots and DOM clues in every report
- keep profile fixes small and reversible
- document every new profile in the changelog

## Packaging note

This repository is structured so contributors can add handling for more websites without having to deeply understand the entire focus engine first. That is intentional. Umbra should improve by accumulating many small, high-quality layout fixes over time.


## Site controls and utility-app behavior

Umbra now supports three per-site modes directly from the popup.

**Auto** keeps the normal behavior. Umbra waits for hover dwell or scroll-stop, then tries to isolate the content block you are reading.

**Manual** disables auto-focus on that site but still leaves manual tools available. You can still use **Focus now**, **Pin block**, or **Shift + Click**. This is useful for hybrid apps like Notion, dashboards, or email triage where auto-focus can feel intrusive.

**Off** disables Umbra entirely on that site. This is the correct default for calendar-style apps, canvases, and heavy utility software.

Umbra also includes a first-principles **utility-app suppression layer**. Even when a site is not explicitly turned off, Umbra can suppress automatic focusing when the visible page looks more like a tool than a reading surface. It does this by combining page intent, visible interactive density, form density, and text density.

### Good candidates for Off or Manual mode

Use **Off** for pages where visual dimming interferes with operation rather than helping comprehension. Typical examples are calendars, design canvases, whiteboards, maps, project management boards, spreadsheet editors, IDEs, chat clients, and admin dashboards.

Use **Manual** for mixed environments where reading still happens, but not continuously. Good examples are Notion, Gmail inbox triage, internal tools, GitHub issue queues, and analytics dashboards.

### Public repo contribution path

When contributors find a site that behaves badly, the first question is not “how do we patch the heuristic?” but “does this site want a profile, a default mode, or a stronger utility classification?”

A good contribution sequence is:

1. Decide whether the site is primarily an **article**, **timeline/feed**, **mail/conversation**, **hybrid workspace**, or **utility app**.
2. Add or refine a profile in `site-profiles.js`.
3. Choose a sensible `defaultMode` for that site: `auto`, `manual`, or `off`.
4. Only change the core engine when the issue is cross-site and not site-specific.

That keeps the project scalable as a public repo instead of turning `content.js` into a pile of one-off exceptions.


## Surface-level focusing
For article pages, timelines, Gmail, and AI chat apps, Umbra now uses `selectionModel: "surface"`. That makes it lock to the nearest whole card, message, or article surface instead of picking arbitrary inner paragraphs, code chips, or metadata fragments.


## Interaction-first principle
When a page shifts from reading to doing, Umbra should not crop controls away. The engine now treats active editing/composer regions as higher priority than passive reading blocks and expands to the nearest interaction surface when possible. If no clean interaction surface exists, it suppresses the spotlight rather than interfering.
