# Home menu artwork

Generated using the built-in image-generation tool for the September 8, 2026 home UI update.

## Reward chest atlas

Project asset: `public/assets/home-reward-chests.png`.

Final prompt:

> Use case: stylized-concept. Asset type: production pixel-art game UI reward chest sprite atlas for Battle Cities. One single wide horizontal sprite sheet with exactly FOUR equally sized square cells, no visible dividers. In order left to right: ornate golden military treasure chest overflowing with gold coins, silver steel chest with blue highlights and silver coins, bronze copper chest with bronze coins, small blue steel supply chest. Each object centered in its own cell, same baseline, complete silhouette, generous transparent padding, no overlap between cells. Crisp chunky pixel art, dark steel outlines, rivets and scratched armor, warm gold highlights, matching a retro tank battle game's industrial sci-fi UI. Actual transparent background, no text, no numbers, no scenery, no border, no watermark. 4:1 wide sheet if possible. Designed for CSS background-position sprite rendering.

The returned atlas is 2172 × 724. Its four equal-width cells are rendered with a 3:4 aspect ratio and 400% background width, preserving the returned artwork's proportions. CSS orders silver, gold, bronze, blue for the podium presentation.

## Trophy

Project asset: `public/assets/home-reward-trophy.png`.

Final prompt:

> Use case: stylized-concept. Asset type: one production pixel-art game UI icon. A golden championship trophy with a five-point star embossed on its bowl, dark gunmetal armored pedestal, angular handles and rivets. Battle Cities retro tank-war game style, crisp chunky pixel art, thick dark silhouette, gold highlights. Centered single object, fully visible, generous 12% transparent padding on all sides. Square canvas, genuinely transparent background. No lettering, no numbers, no scenery, no watermark. Readable as a small 48-pixel icon.

The supplied battlefield banner remains unchanged; the home UI now uses `object-fit: contain` and its 2:1 intrinsic aspect ratio rather than cropping its logo and footer.

## Verification

Run `node scripts/test-home-ui.js` for renderer checks. Add `--serve` for a local-only visual fixture on port 8083 using the actual TypeScript renderer. `/?empty=1` exercises the empty leaderboard; `/?psg1=1` enables PSG1 presentation; `/settings` renders the actual Settings class with a stub pairing provider. Fixture scores and pairing data are not used in the production app.
