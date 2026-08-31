# BattleCities Web & UI Design Rules

## Palette & Semantic Color Tokens

| Role | Token | Hex / Value | Usage & Meaning |
| :--- | :--- | :--- | :--- |
| **Page Base** | `--bg` | `#06090b` | The near-black background canvas behind all panels. |
| **Raised Panel** | `--bg-panel` | `#0d1216` | Dark interior of cards, HUD frames, and menu modules. |
| **Elevated Panel** | `--bg-panel-2` | `#162027` | Blue-black steel fill for elevated or inactive controls. |
| **Steel Edge** | `--line` | `#3a4952` | Metal borders, panel outlines, and hardware details. |
| **Primary Text** | `--white` | `#f5f2e8` | Warm off-white headings and primary labels. |
| **Secondary Text** | `--gray` | `#a3adb0` | Muted labels, quiet readouts, and secondary descriptions. |
| **Command Gold** | `--neon` | `#ffb30f` | Primary CTA buttons, active tabs, scores, and interactive focus. |
| **Burnished Gold** | `--neon-dim` | `#a96a05` | Gold shadows, restrained outlines, and secondary emphasis. |
| **Gold Glow** | `--neon-glow` | `rgba(255, 179, 15, 0.45)` | Soft focus behind selected gold controls. |
| **Friendly Blue** | `--blue` | `#1677ff` | System status, technical telemetry, friendly units, links. |
| **Blue Glow** | `--blue-glow` | `rgba(112, 183, 255, 0.38)` | Hover/focus feedback for links and informational controls. |
| **Supply Green** | `--supply` | `#47de17` | Strictly for ready, available, supplied, connected, or positive states. Never for generic decoration. |
| **Alert Red** | `--danger` | `#f04432` | Destructive actions, damage, failure, errors, and cancellation. |
| **Battle Ember** | `--ember` | `#ff6a1a` | War-zone warmth, explosions, atmospheric accents only. |

## Typography Lock

- **Allowed Font Families**:
  - `Press Start 2P`: Pixel titles, level headers, HUD badges.
  - `Chakra Petch`: Primary body font, section headers, navigation labels.
  - `Share Tech Mono`: Technical readouts, coordinates, addresses, timers.
- **Rules**:
  - Do not substitute generic system, military, or unapproved pixel fonts.
  - Retain font metrics, optical baseline alignments, and button padding.

## Accessibility & Motion

- Respect `@media (prefers-reduced-motion: reduce)`:
  - Neutralize infinite animations, glitches, and heavy motion transitions when reduced-motion is requested.
- Maintain readable contrast between text tokens (`--white` / `--gray`) and panel surfaces (`--bg`, `--bg-panel`).
