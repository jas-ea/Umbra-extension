# 03 - Go-Live Checklist

## Chrome Web Store

- Publisher: Cassini Research
- Product: Umbra
- Summary: `Keep one block clear on busy webpages without leaving the original site.`
- Package: `dist/umbra-2.5.1.zip`
- Listing copy: `umbra-extension/docs/STORE_LISTING.md`
- Privacy policy: `umbra-extension/PRIVACY.md`

Upload:

- `umbra-extension/icons/icon128.png`
- `launch/assets/poster/umbra-store-promo-440x280.png`
- Four 1280 x 800 screenshots from `launch/assets/screenshots/`

Before submission, confirm that the package version, listing copy, permission explanations, screenshots, and privacy answers describe the same build.

## Blog and social

Use `04-blog-and-social.md` as the copy source and `umbra-launch-poster.png` as the lead image. Include one or two real-site screenshots in the blog. Do not describe the extension as live until the store listing is public and checked from a signed-out browser.

## Verification

```bash
npm run lint
npm test
npm run test:e2e
npm run validate
npm run package:extension
python3 /Users/jaski/.codex/skills/no-ai-slop/scripts/check_prose.py README.md launch/README.md launch/docs/*.md umbra-extension/README.md umbra-extension/PRIVACY.md umbra-extension/docs/*.md
```

Manual checks:

- Test ChatGPT, X, GitHub Issues, Stack Overflow, a long article, and a documentation page.
- Confirm that switching blocks has no blank frame or square-corner flash.
- Confirm that Choose an area pins the block clicked by the user.
- Confirm that pause survives a page reload in the same tab.
- Review the poster and store tile at half size.
- Open every public link.
