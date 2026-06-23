import { Minimap } from '../../gameObjects';
import * as config from '../../config';

import { LevelScript } from '../LevelScript';

// Fixed top-right HUD minimap. Lives on the scene root (not the scrolling
// field), reading live positions each paint. Purely presentational.
const MINIMAP_WIDTH = 132;
const MARGIN = 6;

export class LevelMinimapScript extends LevelScript {
  private minimap: Minimap;

  protected setup(): void {
    const { field } = this.world;
    const fieldWidth = field.size.width;
    const fieldHeight = field.size.height;

    const width = MINIMAP_WIDTH;
    const height = Math.round(width * (fieldHeight / fieldWidth));

    this.minimap = new Minimap(field, fieldWidth, fieldHeight, width, height);

    // Hug the top-right corner of the canvas, just below the info bar.
    const x = config.CANVAS_WIDTH - width - MARGIN;
    const y = config.LEVEL_PLAY_TOP_OFFSET + MARGIN;
    this.minimap.position.set(x, y);

    this.world.sceneRoot.add(this.minimap);
  }
}
