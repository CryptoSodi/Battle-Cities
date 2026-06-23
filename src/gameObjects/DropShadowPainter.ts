import { Painter } from '../core/Painter';
import { RenderContext } from '../core/render';
import { RenderObject } from '../core/RenderObject';
import * as config from '../config';

// Reusable soft drop shadow. Draws each caster's silhouette stepped outward in
// equal increments: overlapping steps near the caster accumulate to a darker
// shadow, while the far edge gets only the last step, so the shadow fades out.
// Interior overlap is hidden wherever opaque art is drawn on top. Used by both
// the level wall shadows and the menu brick text.
export class DropShadowPainter extends Painter {
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
