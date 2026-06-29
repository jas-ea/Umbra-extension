# Umbra Product Pillars

## North Star

Umbra is a local-first reading spotlight for the live web. It helps people keep their place by dimming visual noise around the block they are reading, without replacing, rewriting, or sending page content anywhere.

## P1 - Live page, never a reader view

Umbra works on the real, interactive DOM and dims around existing page content instead of moving content into a separate reader surface. It should never delete, rewrite, or reflow the page.

What this rules out: reader-mode clones, DOM simplification, destructive page cleanup, and any feature that breaks native page interaction.

## P2 - Follow the reading, not the cursor

Umbra uses reading intent signals such as dwell and scroll-settle behavior so the spotlight follows what the user is actually reading. Pointer position is evidence, not the whole product.

What this rules out: cursor-only spotlight behavior, sticky highlights that ignore scroll context, and interactions that fight ordinary reading motion.

## P3 - Local-first and private

Umbra runs entirely in the browser extension package and stores preferences in browser storage. It does not use analytics, telemetry, cloud inference, remote configuration, or first-party servers.

What this rules out: network calls for product behavior, cloud processing of page content, remote code, and any privacy claim that depends on server-side trust.

## P4 - Honest and respectful

Every shipped control must be consumed by the production engine and must do what its label says. Umbra should respect accessibility preferences and avoid interfering with assistive technology or site controls.

What this rules out: fiction UI, aspirational settings, surprise keyboard interception, inaccessible animation defaults, and docs that describe unshipped behavior.
