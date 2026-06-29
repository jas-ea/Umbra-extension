# Umbra Architecture

Umbra has three core stages.

## 1. Intent gating

The extension should never focus on page load alone. It waits for real user intent:

- hover dwell
- scroll then stop
- manual pin/focus actions

## 2. Candidate selection

The engine gathers candidate ancestors, scores them, rejects chrome-like shells, then expands the winning node upward just enough to preserve context.

## 3. Overlay rendering

The chosen rectangle is rendered as a single unified spotlight shell inside a shadow DOM host to reduce CSS collisions.

The overlay is visual only: the host is `aria-hidden`, does not trap focus, and respects reduced-motion, forced-colors, and contrast media features.

## Why site profiles exist

Some products are not well represented by generic heuristics. Mail clients, timelines, editors, and docs tools often need narrow handling. Site profiles let Umbra improve incrementally without destabilizing the global engine.


## Site modes

Each site profile can declare a `defaultMode` of `auto`, `manual`, or `off`. This lets the repo encode first-principles defaults for different product surfaces. Reading surfaces should usually be `auto`. Hybrid workspaces should often be `manual`. Pure utility apps such as calendars or canvases should usually be `off`.


## Targeting posture

The engine derives its targeting posture from `intent`, not from a separate selection-model setting. Reading intents favor articles, messages, posts, and cards; comparative intents favor table-level containers; utility intents default to Manual or Off so Umbra does not fight app controls.

## Settings schema

`defaults.js` is the authoritative settings source. Popup and Options controls must map to settings that the content engine reads; the contract test fails if a settings control is added without a production consumer.
