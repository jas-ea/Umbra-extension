# Manual Testing Checklist

Install the unpacked extension and test each case.

On X or a similar timeline, stop scrolling on a long post and confirm Umbra focuses the visible post instead of the whole page.

On a blog article, move the cursor and let it rest over the body text. Confirm the article section is selected and the overlay transitions smoothly.

Use Shift + Click on a content block and confirm it pins. Press Escape and confirm it clears.

Pause Umbra on a tab, refresh the page, and confirm the tab pause state behaves as expected for that session.

Ignore a domain from the popup, refresh, and confirm Umbra stays inactive there.

Adjust opacity and dwell from the popup and confirm changes apply immediately.


## Regression checks

- Open a fresh page without moving the cursor. Umbra should not focus anything.
- Move the cursor and hold over a tweet, article block, or email body. Umbra should wait for dwell, then focus.
- Scroll and stop on a long article or thread. Umbra should wait for scroll idle, then focus the nearest readable block rather than the entire app shell.
- Interact with obvious controls like buttons, search boxes, compose boxes, or menus. Umbra should avoid locking onto those controls.
