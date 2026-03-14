# Site Profiles

Umbra uses site profiles to keep website-specific handling out of the global engine whenever possible.

## Profile shape

A profile is a plain object in `site-profiles.js`.

```js
{
  id: 'gmail',
  label: 'Gmail',
  intent: 'gmail',
  match: ({ host, pathname, href, doc }) => /mail\.google\.com$/.test(host),
  quickSelectors: ['tr.zA', '.ii.gt'],
  preferSelectors: ['tr.zA', '.ii.gt', '.a3s'],
  rejectSelectors: ['[role="main"]', '[role="search"]'],
  rejectTokens: ['sidebar', 'toolbar', 'search'],
  viewportPoints: [[0.56, 0.28], [0.56, 0.42], [0.56, 0.56]],
  fallbackSelectors: ['.ii.gt', 'tr.zA']
}
```

## Field meanings

`match`
Determines whether the profile should be active.

`intent`
Controls the general scoring posture. Current values are `gmail`, `timeline`, `article`, and `generic`.

`quickSelectors`
Fast path selectors used before deeper scoring.

`preferSelectors`
Selectors that should receive a boost during scoring.

`rejectSelectors`
Selectors that should be treated as app chrome or layout shell.

`rejectTokens`
Class or id fragments that strongly suggest non-reading chrome.

`viewportPoints`
Relative viewport sample points used for scroll-stop focus.

`fallbackSelectors`
Last-resort selectors used when the normal pass fails.

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


## Default modes

Every profile should now declare a `defaultMode`:

- `auto`: normal Umbra behavior
- `manual`: no automatic focusing, but manual tools still work
- `off`: Umbra disabled for that site by default

This is the preferred way to handle calendars, editors, dashboards, canvases, and other utility-heavy surfaces.
