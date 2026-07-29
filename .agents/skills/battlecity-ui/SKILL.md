---
name: battlecity-ui
description: Battle Cities UI standards for canvas screens, responsive desktop and Android layouts, button typography, focus states, and directional navigation. Use for every UI implementation, redesign, or visual adjustment in this repository.
---

# Battle Cities UI

## Preserve The System

- Match the established shop UI language: dark framed surfaces, restrained amber accents, green default actions, yellow active states, and red active Back actions.
- Reuse shared layout, typography, button, card, and navigation helpers. Avoid per-screen magic values when an equivalent control already exists.
- Treat desktop and Android layouts independently when their composition differs. Do not change one while fixing the other unless both need the change.

## Button Text Consistency

- Buttons with the same role or placement must share the complete text treatment, not only the same box dimensions.
- Copy the reference button's font family, font size, weight, letter spacing, line height, horizontal alignment, optical vertical offset, icon size, and icon-to-label gap.
- Keep labels visually centered inside their control. Account for the font's actual ascent and baseline; geometric centering alone is not enough when it looks optically high or low.
- Apply the same typography metrics across default, focused, active, disabled, and connected states. State changes may alter color or surface treatment, but must not shift the label.
- Equivalent Back buttons, tabs, filters, action buttons, and price bars must use shared constants or helpers. Do not duplicate slightly different local values.
- Keep text inside bounds at every supported size. Shorten, wrap, or reduce the font only when the established component cannot fit the longest valid label.

## Navigation

- Directional navigation must return to the item, tab, or filter from which the user entered the next region.
- Enter a grid at the first logical item in the requested row or column unless navigation history identifies a prior item.
- Selected filters and dropdown values remain the navigation anchor when moving out and back in.
- Off-screen items must be reachable with directional controls and brought into view. Scrollable lists must also support touch dragging on Android.

## Responsive Layout

- Full-screen screens must fill the available Android viewport without letterboxed UI gaps.
- Desktop screens must remain in bounds when the browser becomes narrow; scale or reflow the desktop composition without changing the Android layout.
- Use stable dimensions and explicit responsive constraints so focus, labels, icons, and dynamic values cannot move surrounding controls.

## Verification

- Compare every new or changed button against the nearest established peer at the same viewport.
- Check label baseline, side padding, icon gap, longest text, and all interaction states.
- Verify desktop and Android separately when the changed UI exists on both.
