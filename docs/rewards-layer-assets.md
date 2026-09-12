# Shared rewards layers

## Android image update

`public/assets/android-home-v2/rewardlegend-hangar-v3.png` was edited with the built-in image-generation tool. Prompt: replace only the four chests and blank plaques in Android's v2 hangar with the design from `rewards-crates-overlay-v1.png`, preserving Android's plaque bounds, larger gold chest, warehouse, outer frame, timer and How It Works section. No added text. The prior CSS plaque overlay was removed; Android uses this updated bitmap with the existing live reward text.

Generated with the built-in image-generation tool from `web-monitor-rewards-v1.png`.

- `public/assets/rewards-hangar-background-v1.png`: Remove the four foreground reward chests, loose coins and podiums; reconstruct the empty warehouse while preserving the blue hangar, banners, lights and perspective. No text or UI border.
- `public/assets/rewards-crates-overlay-v1.png`: Extract the four chests and blank podiums in silver/gold/bronze/blue order as a transparent foreground sprite. Preserve proportions, aligned bases and blank plaque faces; no warehouse or text.

Web and PSG1 share these assets. The background uses cover; the foreground fits within a proportional box. Nine-slice rendering enlarges only the plaque faces while preserving crate proportions. Reward ranks and amounts remain live HTML. Android keeps its existing art.
