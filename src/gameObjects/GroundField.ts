import { GameObject, Rect, Sprite } from '../core';
import { Painter } from '../core/Painter';
import { RenderContext } from '../core/render';
import { RenderObject } from '../core/RenderObject';
import { GameUpdateArgs } from '../game';
import * as config from '../config';

// Tiles grass variants across the whole field as the ground beneath everything.
// A per-cell hash picks a variant so the grass doesn't visibly repeat. Cosmetic;
// sits below all terrain (negative z-index) so walls/water/etc. draw on top.
class GroundFieldPainter extends Painter {
  public sprites: Sprite[] = [];
  public tileSize = config.TILE_SIZE_MEDIUM;

  public paint(context: RenderContext, renderObject: RenderObject): void {
    if (this.sprites.length === 0) {
      return;
    }

    const box = renderObject.getWorldBoundingBox().toRect();
    const cols = Math.ceil(box.width / this.tileSize);
    const rows = Math.ceil(box.height / this.tileSize);

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const hash = Math.abs((col * 73856093) ^ (row * 19349663));
        const sprite = this.sprites[hash % this.sprites.length];
        const dest = new Rect(
          box.x + col * this.tileSize,
          box.y + row * this.tileSize,
          this.tileSize,
          this.tileSize,
        );
        context.drawImage(sprite.image, sprite.sourceRect, dest);
      }
    }
  }
}

export class GroundField extends GameObject {
  public zIndex = config.GROUND_FIELD_Z_INDEX;
  public readonly painter = new GroundFieldPainter();

  protected setup({ spriteLoader }: GameUpdateArgs): void {
    this.painter.sprites = spriteLoader.loadSequence('terrain.grass');
  }
}
