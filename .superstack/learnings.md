# Project Learnings

> Managed by `/learn`. Append-only - latest entry wins on conflicts.

## Patterns

### android-full-screen-panel-layout
- **Insight:** Android panel screens must use the Shop pattern: keep a fixed 744-unit logical content width, mark the scene with `panel-screen-active`, and let the shared CSS top-align and height-constrain the canvas; never widen panel content to the full 1288-unit canvas.
- **Confidence:** 10/10
- **Source:** manual
- **Files:** src/main.ts, public/main.css, src/scenes/main/MainShopScene.ts, src/scenes/main/MainAirdropScene.ts, src/scenes/main/MainMoreScene.ts
- **Date:** 2026-07-19

### layered-ui-navigation
- **Insight:** Arrow navigation must preserve the user's previous selection when moving between UI layers, enter item rows at the first relevant item, return to the active tab or filter, and treat an open dropdown as its actual option count rather than duplicating its trigger.
- **Confidence:** 10/10
- **Source:** manual
- **Files:** src/scenes/main/panelUi.ts, src/scenes/main/MainShopScene.ts, src/scenes/main/MainRankingScene.ts
- **Date:** 2026-07-19

## Pitfalls

### mobile-canvas-width-compensation
- **Insight:** Expanding a mobile panel to `root.size.width` is incorrect because the Android canvas intentionally crops the wider 1288-unit logical surface; it produces inconsistent sizing and conflicts with Shop's viewport behavior.
- **Confidence:** 10/10
- **Source:** manual
- **Files:** src/config.ts, src/main.ts, public/main.css
- **Date:** 2026-07-19

## Preferences

### battle-cities-panel-ui-standard
- **Insight:** New UI screens must match Shop: clean condensed font with 1px letter spacing, vertically centered labels, equal gutters, full-screen Android framing, green inactive card action bars, yellow focused bars, and the established red focused Back button.
- **Confidence:** 10/10
- **Source:** manual
- **Files:** src/scenes/main/MainShopScene.ts, src/scenes/main/panelUi.ts
- **Date:** 2026-07-19

## Architecture

## Tools
