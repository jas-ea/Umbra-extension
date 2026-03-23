# Testing

## Static checks run for Umbra 2.0

- `node --check` on `content.js`, `site-profiles.js`, `background.js`, `popup.js`, and `options.js`
- archive extraction and file presence validation
- manifest JSON parse validation

## Recommended live QA before release

1. ChatGPT: hover over answer blocks, then move into the composer and verify the surface expands and tracks growth.
2. X / Twitter: read a post, open reply, type, then move back to reading and verify the composer does not stay sticky.
3. Gmail: test inbox rows, opened message bodies, and compose.
4. Comparative site such as CoinGecko: verify row-level autofocus does not activate by default.
5. Utility site such as Calendar or Figma: verify Auto stays suppressed or Off by default.

## Acceptance criteria

- pointer-local reading should win when there is no fresh direct manipulation elsewhere
- creation surfaces should expand to include their controls
- when a surface grows or collapses, the shell should reconcile within one visible layout beat
- on uncertainty, Umbra should widen, soften, or stay off instead of cropping critical controls
