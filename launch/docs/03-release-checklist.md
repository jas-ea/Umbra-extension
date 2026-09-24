# Umbra 2.7.0 Release Checklist

Status: review only. Publishing, tagging, posting, and public repository changes require approval of the release candidate and final copy.

## Product gate

- Run `npm ci`, lint, unit tests, the complete browser suite, manifest validation, and packaging.
- Complete the 15-scenario live matrix in `umbra-extension/TESTING.md`, including long chat turns, feeds, inboxes, workspaces, menus, media, documentation, and comparative tables.
- Verify initial focus, delayed switching, pointer exit, same-section return, list and calendar ownership, menus, nested controls, route changes, scroll-stop behavior, fullscreen, picture-in-picture, and tab visibility.
- Verify Choose an area, tab pause, site modes, page darkness, keyboard shortcuts, and install or update injection.
- Capture public screenshots through automatic selection only.
- Recalculate the ZIP checksum after the final package is built.

## Repository gate

- Review `README.md`, the product note, real-world examples, the privacy policy, security policy, license, contributing guide, issue templates, and changelog.
- Confirm that Cassini Research, support, privacy, source, and security links resolve.
- Enable GitHub private vulnerability reporting, test the configured path, and update `SECURITY.md` to point to it.
- Set the public repository description, homepage, and topics after approval.
- Create an annotated `v2.7.0` tag from the approved commit.
- Attach the exact submitted ZIP and its SHA-256 checksum to a draft GitHub Release.

## Chrome Web Store gate

- Publisher: Cassini Research
- Developer website: `https://cassiniresearch.com/`
- Product: Umbra
- Package: `dist/umbra-2.7.0.zip`
- Package SHA-256: `a1f247294ade2523dd6d89cbbd56931ecff164b641da67ff273e0648ecb8bdee`
- Listing copy: `umbra-extension/docs/STORE_LISTING.md`
- Privacy policy: `umbra-extension/PRIVACY.md`
- Icon: `umbra-extension/icons/icon128.png`
- Store tile: `launch/assets/poster/umbra-store-promo-440x280.png`
- Screenshots: four 1280 x 800 PNG files in `launch/assets/screenshots/`

The listing must describe one purpose in direct language, explain broad website access, and match the submitted build. Chrome recommends a concise opening statement, a short feature list, and screenshots that show the actual experience. See the official [listing guidance](https://developer.chrome.com/docs/webstore/best-listing), [listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing/), [image requirements](https://developer.chrome.com/docs/webstore/images), and [program policies](https://developer.chrome.com/docs/webstore/program-policies/policies).

After approval, install from a signed-out Chrome profile and verify the listing, permission prompt, first run, update path, support link, and privacy URL before announcing availability.

## Publication sequence

1. Publish the approved GitHub Release after the Chrome Web Store listing is live.
2. Update pre-release language and add the store URL to the README.
3. Publish the product note at a stable URL.
4. Submit one Show HN post with a runnable link and a technical first comment.
5. Post once to an extension-development community after checking current rules.
6. Publish one X post and one LinkedIn post from Cassini Research.

Use one real-site screenshot for each external post. Ask for reproducible examples from difficult pages. Do not request coordinated votes, comments, or reposts.

## Final commands

```bash
npm run lint
npm test
npm run test:e2e
npm run validate
npm run package:extension
python3 /Users/jaski/.codex/skills/no-ai-slop/scripts/check_prose.py README.md launch/README.md launch/docs/*.md umbra-extension/README.md umbra-extension/PRIVACY.md umbra-extension/docs/*.md
```
