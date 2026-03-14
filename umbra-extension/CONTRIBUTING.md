# Contributing to Umbra

Umbra is a focus-engine project, but it should not turn into an unreviewable pile of heuristics. The contribution model is deliberately split into **global engine fixes** and **site profile fixes**.

## Decide the right layer first

Use this rule before changing code.

### Change `content.js` only when the behavior is truly global

Examples:

- page-load intent is wrong everywhere
- context expansion is too aggressive across many sites
- interactive controls are consistently being hidden in unrelated apps
- the mask animation or pinning behavior is broken globally

### Change `site-profiles.js` when the behavior is local to one product family

Examples:

- Gmail rows are not preferred over the shell
- Substack notes focus too narrowly
- X selects the timeline wrapper instead of the tweet card
- a docs site needs its own fallback selectors and reject rules

## What to include in a pull request

Every PR should contain:

- the failing website and page type
- before/after screenshots or screen recordings
- the DOM container that should have been selected
- whether the fix is global or site-specific
- any tradeoff you noticed

## Site profile workflow

When adding or fixing a site profile:

1. Reproduce the problem.
2. Identify the correct reading unit.
3. Identify shell elements that should never win.
4. Update the profile with the smallest possible rule set:
   - `match`
   - `intent`
   - `quickSelectors`
   - `preferSelectors`
   - `rejectSelectors`
   - `rejectTokens`
   - `viewportPoints`
   - `fallbackSelectors`
5. Test at least two distinct pages on that site.
6. Add a short changelog entry.

## Profile design rules

Good profiles are:

- narrow
- declarative
- readable in review
- easy to delete later
- conservative about app chrome rejection
- conservative about preserving sender/author/action context

Bad profiles are:

- giant branches with one-off logic
- selectors copied blindly from unstable classnames without explanation
- rules that fix one page and break the rest of the site
- fallback selectors that return the full app shell

## Review checklist

Before submitting, verify:

- new pages do not focus before user intent
- the selected region preserves identity and key actions
- sidebars, search, toolbars, and recommendations do not win selection
- the fix does not regress pinning or clearing behavior
- the fix is documented in `CHANGELOG.md`

## Local install

```bash
chrome://extensions
```

Enable Developer Mode, then load the unpacked repo folder.

## Filing issues instead of code

If you are not comfortable editing selectors, open a site-profile issue using the provided template and include screenshots plus the page URL pattern.
