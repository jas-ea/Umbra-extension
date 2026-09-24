# Umbra Launch Kit

This folder contains the review copy and media for Umbra 2.7.0. Nothing here has been published.

![Umbra launch poster](assets/poster/umbra-launch-poster.png)

## Assets

- Mark: `assets/logo/umbra-mark.svg` and `assets/logo/umbra-mark.png`
- Wordmark: `assets/logo/umbra-logo.svg` and `assets/logo/umbra-logo.png`
- Social poster: `assets/poster/umbra-launch-poster.svg` and `assets/poster/umbra-launch-poster.png`
- Store tile: `assets/poster/umbra-store-promo-440x280.svg` and `assets/poster/umbra-store-promo-440x280.png`
- Real-site screenshots: `assets/screenshots/`

The mark shows a clear page section inside a darkened field. The poster and store tile use the same literal visual model and remain legible at reduced size.

## Documents

1. `docs/01-product-note.md`: public product story, design decisions, and research context
2. `docs/02-real-world-examples.md`: verified examples from public websites
3. `docs/03-release-checklist.md`: internal store, GitHub, verification, and publication gates
4. `docs/04-publication-drafts.md`: review copy for the store, blog, GitHub, HN, X, and LinkedIn

## Release gate

```bash
npm run lint
npm test
npm run test:e2e
npm run validate
npm run package:extension
```

The current upload package is `dist/umbra-2.7.0.zip`.

Regenerate the brand assets, extension icons, store tile, and social poster with `npm run render:assets`.
