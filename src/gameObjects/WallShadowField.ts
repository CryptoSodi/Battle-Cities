import { GameObject } from '../core';
import { Painter } from '../core/Painter';
import { RenderContext } from '../core/render';
import { RenderObject } from '../core/RenderObject';
import { Tag } from '../game';
import * as config from '../config';

// Casts a soft drop shadow beneath solid walls (brick/steel) onto the ground.
// Sits just above the grass and below the terrain tiles, so the opaque tiles
// paint over the interior of each shadow and only the offset "skirt" along the
// bottom/right edge of a wall cluster stays visible — giving walls a raised look.
class WallShadowPainter extends Painter {
  public casters: RenderObject[] = [];
  public offsetX = config.WALL_SHADOW_OFFSET_X;
  public offsetY = config.WALL_SHADOW_OFFSET_Y;
  public steps = config.WALL_SHADOW_STEPS;
  public color = config.WALL_SHADOW_COLOR;
  public alpha = config.WALL_SHADOW_ALPHA;

  public paint(context: RenderContext): void {
    if (this.casters.length === 0) {
      return;
    }

    const prevAlpha = context.getGlobalAlpha();
    context.setGlobalAlpha(this.alpha);

    // Step the silhouette outward in equal increments. Overlapping steps near
    // the wall accumulate to a darker shadow; the far edge gets only the last
    // step, so the shadow fades out. Interior overlap is hidden by opaque tiles.
    for (let step = 1; step <= this.steps; step += 1) {
      const fraction = step / this.steps;
      const dx = this.offsetX * fraction;
      const dy = this.offsetY * fraction;

      for (const caster of this.casters) {
        if (caster.isRemoved) {
          continue;
        }
        const box = caster.getWorldBoundingBox().toRect();
        context.fillRect(
          box.x + dx,
          box.y + dy,
          box.width,
          box.height,
          this.color,
        );
      }
    }

    context.setGlobalAlpha(prevAlpha);
  }
}

export class WallShadowField extends GameObject {
  public zIndex = config.WALL_SHADOW_Z_INDEX;
  public readonly painter = new WallShadowPainter();

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
