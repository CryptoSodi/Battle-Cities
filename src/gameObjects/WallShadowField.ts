import { GameObject } from '../core';
import { RenderObject } from '../core/RenderObject';
import { Tag } from '../game';
import * as config from '../config';

import { DropShadowPainter } from './DropShadowPainter';

// Casts a soft drop shadow beneath solid walls (brick/steel) onto the ground.
// Sits just above the grass and below the terrain tiles, so the opaque tiles
// paint over the interior of each shadow and only the offset "skirt" along the
// bottom/right edge of a wall cluster stays visible — giving walls a raised look.
export class WallShadowField extends GameObject {
  public zIndex = config.WALL_SHADOW_Z_INDEX;
  public readonly painter = new DropShadowPainter();

  protected update(): void {
    // Refresh the caster list each tick so destroyed bricks stop casting.
    // Geometry is read live at paint time, so this only tracks membership.
    const casters: RenderObject[] = [];

    const field = this.parent;
    if (field !== null) {
      field.traverse((node) => {
        const { tags } = node;
        if (tags.includes(Tag.Wall) && !tags.includes(Tag.Border)) {
          casters.push(node);
        }
      });
    }

    this.painter.casters = casters;
    this.setNeedsPaint();
  }
}
