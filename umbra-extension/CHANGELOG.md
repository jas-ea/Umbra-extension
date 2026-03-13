# Changelog

## 1.2.2

- Fixed two recurring targeting failures: Substack feed cards now prefer the full post card context instead of the inner text block, and Gmail now prefers message rows or message bodies over the whole shell.
- Added contextual expansion so Umbra keeps essential author metadata and action controls visible instead of cropping too narrowly into the text-only child.
- Improved page-type detection for Substack feed versus Substack article pages and adjusted viewport sampling points for timeline and Gmail layouts.
- Increased penalties for container shells, search rails, recommendation carousels, and oversized wrappers that were still slipping into focus.

# Changelog

## 1.2.1

- Fixed the most visible behavior bug: Umbra no longer auto-focuses immediately on page load before the user has shown hover or scroll intent.
- Reworked target selection around intent-gated activation, multi-point viewport sampling, and stronger penalties for toolbars, sidebars, sticky chrome, and oversized app shells.
- Added lightweight site profiles for Gmail, timeline-style sites, and long-form article sites so the focus box lands on the message, card, or article more often.
- Improved move-out behavior while scrolling or switching targets so the overlay clears faster and feels less sticky.

## 1.2.0

- Productized the original prototype into Umbra with popup controls, tab pause, site ignore, pinning, docs, and icon assets.
