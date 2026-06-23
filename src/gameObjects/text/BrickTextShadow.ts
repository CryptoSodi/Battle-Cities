import { GameObject } from '../../core';
import { RenderObject } from '../../core/RenderObject';
import * as config from '../../config';

import { DropShadowPainter } from '../DropShadowPainter';

// Soft drop shadow for brick text (the menu title). Mirrors WallShadowField:
// a sized GameObject carrying a DropShadowPainter, drawn beneath the opaque
// letter tiles so only the offset skirt shows. Casters are the static letter
// tiles, passed in at construction.
export class BrickTextShadow extends GameObject {
  public readonly painter = new DropShadowPainter();

  constructor(casters: RenderObject[], width: number, height: number) {
    super(width, height);

    this.painter.casters = casters;
    this.painter.offsetX = config.TEXT_SHADOW_OFFSET_X;
    this.painter.offsetY = config.TEXT_SHADOW_OFFSET_Y;
    this.painter.steps = config.TEXT_SHADOW_STEPS;
    this.painter.alpha = config.TEXT_SHADOW_ALPHA;
  }

  protected update(): void {
    this.setNeedsPaint();
  }
}
