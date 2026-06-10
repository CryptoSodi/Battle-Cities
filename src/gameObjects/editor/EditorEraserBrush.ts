import { GameObject, RectPainter } from '../../core';
import * as config from '../../config';

export class EditorEraserBrush extends GameObject {
  public zIndex = config.EDITOR_BRUSH_Z_INDEX;

  constructor() {
    super(config.TILE_SIZE_LARGE, config.TILE_SIZE_LARGE);
  }

  protected setup(): void {
    this.painter = new RectPainter('rgba(255,255,255,0.08)', config.COLOR_WHITE);
    (this.painter as RectPainter).lineWidth = 2;
  }
}
