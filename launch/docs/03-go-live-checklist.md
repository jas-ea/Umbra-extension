# 03 - Go-Live Checklist

## Chrome Web Store

Package:

- `dist/umbra-2.2.2.zip`

Listing fields:

- Publisher: Cassini Research
- Product name: Umbra
- Summary: Soft focus for reading dense pages without leaving the live web.
- Description source: `umbra-extension/docs/STORE_LISTING.md`
- Privacy policy source: `umbra-extension/PRIVACY.md`

Required assets:

- Icon: `umbra-extension/icons/icon128.png`
- Small promo tile: `launch/assets/poster/umbra-store-promo-440x280.png`
- Screenshot 1: `launch/assets/screenshots/stackoverflow-questions.png`
- Screenshot 2: `launch/assets/screenshots/chrome-developers-permissions.png`
- Screenshot 3: `launch/assets/screenshots/wikipedia-cassini.png`
- Screenshot 4: `launch/assets/screenshots/github-openai-cookbook-issues.png`

## Blog

Use `docs/04-blog-and-social.md` as the launch blog draft. Add the poster image near the top and include two screenshots lower in the post:

- `launch/assets/poster/umbra-launch-poster.png`
- `launch/assets/screenshots/stackoverflow-questions.png`
- `launch/assets/screenshots/chrome-developers-permissions.png`

Keep the post short. The important idea is that Umbra keeps the live page intact.

## X And LinkedIn

Use the X thread and LinkedIn post from `docs/04-blog-and-social.md`. For X, attach:

- Post 1: `launch/assets/poster/umbra-launch-poster.png`
- Post 3 or 4: one real screenshot from `launch/assets/screenshots/`

For LinkedIn, attach the poster and include one screenshot in the comments if needed.

## Verification Before Posting

Run:

```bash
npm run lint
npm test
npm run test:e2e
npm run validate
npm run package:extension
python3 /Users/jaski/.codex/skills/no-ai-slop/scripts/check_prose.py launch/README.md launch/docs/*.md umbra-extension/docs/STORE_LISTING.md
```

Check manually:

- The screenshots are current and readable at social preview size.
- Store copy matches the shipped extension.
- No post claims that Umbra improves comprehension, productivity, or accessibility outcomes beyond what we have tested.
- Links point to the live Chrome Web Store listing, once available.
