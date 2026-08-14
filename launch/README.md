# Umbra Launch Kit

This folder contains the reviewed public material for Umbra: four short launch documents, a logo system, store artwork, a social poster, and screenshots from public websites.

![Umbra launch poster](assets/poster/umbra-launch-poster.png)

## Assets

- Mark: `assets/logo/umbra-mark.svg` and `assets/logo/umbra-mark.png`
- Wordmark: `assets/logo/umbra-logo.svg` and `assets/logo/umbra-logo.png`
- Social poster: `assets/poster/umbra-launch-poster.svg` and `assets/poster/umbra-launch-poster.png`
- Store tile: `assets/poster/umbra-store-promo-440x280.svg` and `assets/poster/umbra-store-promo-440x280.png`
- Real-site screenshots: `assets/screenshots/`

The mark represents one page row shifting out of surrounding noise. The store tile contains no text so it remains legible at reduced size. The poster uses one headline, one product explanation, and one publisher line.

## Documents

1. `docs/01-positioning-and-research.md`
2. `docs/02-use-cases-and-screenshots.md`
3. `docs/03-go-live-checklist.md`
4. `docs/04-blog-and-social.md`

## Release gate

```bash
npm run lint
npm test
npm run test:e2e
npm run validate
npm run package:extension
```

The current upload package is `dist/umbra-2.5.1.zip`.
