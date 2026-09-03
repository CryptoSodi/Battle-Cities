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

## Industrial HTML UI Standard

Use the Shop as the reference implementation when converting other full-screen
HTML interfaces.

- Build frames, panels, tabs, cards, corner cuts, bevels, rivets, shadows, and
  state glows with HTML/CSS. Never use a screenshot or rasterized panel as a UI
  background. Raster assets are reserved for game art and semantic icons.
- Keep each screen inside a single responsive container with a fixed maximum
  width, `100dvh` height, and an independently scrollable content region. The
  navigation and status/footer regions stay visible.
- Treat web and Android as separate compositions. Shop-class desktop screens
  use the established `1280px` shell with a `298px` inventory rail and a
  separate scrollable content panel; Android/tablet keeps the horizontal status
  and inventory composition. Do not scale the Android composition up as the
  desktop layout.
- Define screen geometry and colors as CSS custom properties. Reuse one frame
  cut, steel edge, gold focus, green supply, and red Back treatment throughout
  the screen instead of introducing one-off colors.
- Use clipped square geometry with subtle bevels. Do not use rounded cards,
  pill-shaped buttons, soft dashboard styling, or decorative gradients that do
  not communicate surface depth or interaction state.
- Every control exposes three stable visual states. Inactive controls use dark
  gunmetal. Active tabs and filters use a filled amber plate with dark ink.
  Keyboard-selected controls use a bright amber edge and glow without hiding
  the active state. Hover mirrors the selected edge at lower intensity.
  Connected/available/purchase actions use supply green. A selected Back action
  uses alert red.
- A state change may alter fill, edge, glow, or text color, but must never move
  a label, resize a control, or change typography metrics.
- Use equal tracks for repeated controls: inventory slots share one size,
  category tabs share one height, and shop cards share one height per
  breakpoint. Use Grid for repeated cards. Use Flexbox for top navigation,
  category filters, status rows, and horizontal inventory strips.
- Preserve the directional navigation order in DOM order. Keyboard focus and
  pointer presses must both use the same intentional `.is-selected` state;
  never restore browser-default focus rings. When an action rerenders a screen,
  restore selection by a stable control key instead of resetting to the first
  tab.
- Dispatch keyboard/gamepad input to only the screen that owned the current
  simulation step. Navigation may mount the destination synchronously, but the
  destination must wait until the next input poll so the initiating Select press
  cannot also activate its focused Back button, card, or external link.
- When an HTML overlay calls behavior on its underlying canvas scene, ensure the
  scene has completed its one-time setup first. Overlay screens skip the normal
  scene update loop, so calling an uninitialized scene method can otherwise fail
  silently even though the button and its event handler are working.
- Keep icon boxes explicit and use `object-fit: contain` plus
  `image-rendering: pixelated` for pixel art. Missing art must use a labeled
  placeholder, never an emoji.
- At narrow widths, retain the four-button top track, eight-slot inventory
  strip, and three-column catalog. Shop cards remain square at every Android
  width; reduce the icon, price-bar, and text metrics together. Verify keyboard,
  touch, and scrolling independently.
- Loadout equipment controls use compact equal-slot cards: four tracks on web
  desktop and two tracks on Android/tablet. Keep the primary battle CTA centered
  and deliberately narrow, with a single command label and no text-arrow glyph;
  it must never stretch across the loadout panel. Show that battle CTA only when
  Loadout was entered through Start and Tank Select; Shop navigation exposes
  equipment management without a battle-start action.
- Selection rosters such as Tank Select use a framed command header, a compact
  resource briefing, and equal chassis cards: four tracks on desktop and three
  on Android. The selected chassis keeps an amber edge/glow while the active
  chassis retains its distinct raised fill; locked entries remain readable but
  visually subdued and are removed from pointer and directional navigation.
  Only the roster grid scrolls; its heading, resource briefing, action, and
  status regions remain fixed.
- Ranking, Socials, and Settings share the same 1280px industrial frame, clipped
  controls, rivets, amber selection edge, and red selected Back state. Their
  desktop and Android geometry is defined separately at the 900px breakpoint.
  Only data-heavy lists/grids scroll; headers, summaries, actions, status text,
  and version information remain stable. Async rerenders restore focus by a
  stable control key.
- Settings toggles keep enabled and selected as independent states. Enabled
  controls use readable gold state text and a filled square status lamp;
  selection adds the same amber edge and glow to the containing row used by
  selectable cards, without replacing or obscuring the enabled state.
- Headquarters uses a four-track desktop operations grid and a three-track
  Android grid. Its command header and section title stay fixed while only the
  operations grid scrolls. Treasury, Campaigns, Staking, Trading, Boosts,
  Airdrop, and Field Manual reuse the same 1280px frame and 900px responsive
  contract; their top view tabs and status rail remain fixed while the page
  content is the only scroll region. Async actions preserve the originating
  control key until the resulting view deliberately selects a new anchor.
- Match Results keeps scoring, bonuses, multiplayer countdowns, sharing, and
  continuation inside the game scene; the HTML layer is presentation and input
  only. Desktop uses one compact eight-column scoreboard row per player, while
  Android changes to stacked player cards with four equal kill-tier cells. The
  command header, mission status, summary footer, and actions remain fixed; only
  the player result region may scroll. Continue is the active amber command,
  Share is inactive gunmetal, and keyboard/pointer selection adds the shared
  amber edge without replacing either base state.
