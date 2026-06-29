# Accessibility

Umbra is a visual overlay only. It does not move page content, replace the page with a reader view, trap focus, or add interactive controls inside the page.

## System Settings

- Reduced motion: geometry movement is suppressed and the overlay uses an opacity-only transition.
- Forced colors: dimming is disabled and the focus boundary uses system colors.
- Increased contrast: dimming and the boundary are strengthened without changing page layout.

## Assistive Technology

The overlay host is marked `aria-hidden="true"` and uses `pointer-events: none`, so it is not a reading or focus target. Umbra does not prevent the page from exposing its native accessibility tree.

## Keyboard Behavior

Escape clears Umbra focus but is not prevented, so site dialogs and controls can still handle Escape. Default shortcuts are `Alt+Shift+U` for pause/resume and `Alt+Shift+F` for focus now; on systems where `Alt+Shift` changes keyboard layout, users can remap extension shortcuts in Chrome.
