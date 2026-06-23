# Material & palette bible

Canonical HD pixel-art direction (Metal Slug / Eastward / Blazing Chrome): top-
down, hand-crafted, rich metallic shading, deep shadows + subtle ambient
occlusion, strong highlights, crisp pixel-perfect edges (no anti-aliasing / no
blur), battle-worn texturing, readable silhouettes, vibrant high-contrast
palettes, cinematic explosions/smoke/sparks.

## Shared lighting convention

- Light source is **top-left**. Brighten top/left edges, darken bottom/right.
- Add a 1px near-black outline ramp per material for silhouette readability.
- Bake a subtle AO darkening into concave joins and under overhangs.
- Battle-worn: sprinkle a few darker scuff/scratch pixels; avoid noise that
  breaks the silhouette.
- Muzzle flash / explosion cores / glows are drawn **additively** (lighten),
  not as flat fills.

## Anchor ramps (dark → light)

Use a small, restricted ramp per material — that is what reads as "art-directed"
rather than "filtered". Tune freely, but keep ~4–5 steps + an outline.

| Material | Outline | Dark | Mid | Light | Highlight |
|---|---|---|---|---|---|
| Tank hull (military green) | `#16220f` | `#33491f` | `#4f6b2a` | `#6d8c39` | `#9bbd55` |
| Gunmetal / treads | `#0a0d10` | `#1a2128` | `#2c343d` | `#454f59` | — |
| Cool metal (turret) | `#1f2729` | `#39444a` | `#55626a` | `#76838a` | `#9fb0b3` |
| Gun barrel steel | `#101316` | `#272d33` | `#414950` | `#6b757d` | — |
| Brick | mortar `#241f1b` | `#5e2a16` | `#8a3f20` | `#b35a2e` | — |
| Steel plate | `#171c20` | `#2a323a` | `#3f4951` | `#58646d` | `#7e8b94` |
| Warm accent / muzzle | — | `#c8932f` | `#f2c24c` | `#ffd96b` (glow) | — |

To add later as the set grows: foliage (two-tone canopy + drop shadow + wind
sway), water (2-frame animated ripple + reflection band; extend
`terrain.water.1/2`), ice (high-spec glossy sheen + faint cracks).

## Rivet / panel detailing

- Rivets: a 2px light dot with a 1px dark pixel down-right (AO).
- Panel seams: a 1px dark groove with a 1px highlight line on the lit side.
- Tread segments: alternate dark/light 1px bands across the track to read as
  moving treads.
