# Site Profiles

Umbra uses site profiles to keep website-specific handling out of the global engine whenever possible.

## Profile shape

A profile is a plain object in `site-profiles.js`.

```js
{
  id: "gmail",
  label: "Gmail",
  intent: "workspace",
  defaultMode: "auto",
  strictTargeting: true,
  match: ({ host }) =>
    host === "mail.google.com" || host.endsWith(".mail.google.com"),
  quickSelectors: ["tr.zA", ".ii.gt"],
  preferSelectors: ["tr.zA", ".ii.gt", ".a3s"],
  surfaceSelectors: ["tr.zA", ".ii.gt", ".a3s"],
  collectionSelectors: ["table.F.cf.zt", '[role="main"] [role="grid"]'],
  collectionItemSelectors: ["tr.zA", '[role="main"] [role="row"]'],
  detailSelectors: [".a3s", ".ii.gt", ".adn.ads"],
  localSelectors: ["p", "li", "pre", "table"],
  rejectSelectors: ['[role="search"]', '[role="toolbar"]'],
  rejectTokens: ["sidebar", "toolbar", "search"],
  fallbackSelectors: [".ii.gt", "tr.zA"],
}
```

## Field meanings

`match`
Determines whether the profile should be active.

`intent`
Controls the general scoring posture. Current values include `article`, `timeline`, `chat`, `workspace`, `comparative`, `utility`, `hybrid`, and `generic`.

`defaultMode`
Sets the starting behavior for the profile: `auto`, `manual`, or `off`.

`quickSelectors`
Fast path selectors used before deeper scoring.

`preferSelectors`
Selectors that should receive a boost during scoring.

`surfaceSelectors`
Selectors that identify explicit content units and protect those units from broad ancestor rejection.

`collectionSelectors`
Selectors for scan surfaces such as an inbox, calendar grid, or conversation pane. Descendants are promoted to this container during automatic focus.

`collectionItemSelectors`
Selectors for descendants that are allowed to promote ownership to a collection. Use these with `strictTargeting` when toolbars or category controls sit inside the collection shell.

`detailSelectors`
Selectors for opened or readable detail content. Detail matches take precedence over a surrounding collection.

`localSelectors`
Readable descendants used when a declared surface is taller than the viewport. Use this for long chat turns and threaded discussions; do not use it to split ordinary posts into fragments.

`rejectSelectors`
Selectors that should be treated as app chrome or layout shell.

`rejectTokens`
Class or id fragments that strongly suggest non-reading chrome.

`fallbackSelectors`
Last-resort selectors used when the normal pass fails.

`strictTargeting`
Abstains when the pointer is not on a declared detail, collection item, media surface, or editable region. Use it for applications where generic fallback would select app chrome.

## Page mapping

Umbra builds an ephemeral map of profile surfaces after initial DOM quiet and rebuilds it after significant page changes. This avoids querying every profile selector on each mouse event and lets delayed pages move from the generic profile to a stronger content profile after hydration.

The map is document-local. Do not add page text, URLs, class names, or pointer history to it, and do not persist learned selectors.

## When to add a profile

Add a profile when a site has a stable layout pattern that repeatedly defeats the global engine.

Do not add a profile just because one page was weird. First check whether the issue belongs in the global engine.

## Example contribution targets

Good profile candidates:

- Gmail
- Notion
- Linear docs
- GitHub PR conversations
- Reddit threads
- Hacker News comment pages
- long-form blogging platforms

The built-in set covers ChatGPT, Claude, Gemini, Grok, Gmail, Calendar, Slack, Discord, X, Instagram, LinkedIn, Reddit, YouTube, GitHub Issues, Stack Overflow, Hacker News, Wikipedia, Chrome Developers, Substack, and common market tables.

## Default modes

Every profile should now declare a `defaultMode`:

- `auto`: normal Umbra behavior
- `manual`: no automatic focusing, but manual tools still work
- `off`: Umbra disabled for that site by default

Use `manual` or `off` for canvases and editors that do not expose reliable semantic surfaces. Calendars and other composite widgets can use `auto` when the profile identifies a stable collection container.

## Comparative pages

For markets, leaderboards, screeners, or other data-dense tables, set `intent: "comparative"` and point surface selectors at table-level containers, not rows. Default these sites to `manual` unless the table-level autofocus is consistently useful.
