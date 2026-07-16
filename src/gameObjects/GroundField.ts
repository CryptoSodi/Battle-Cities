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
  private readonly destinationRect = new Rect();

  public paint(context: RenderContext, renderObject: RenderObject): void {
    if (this.sprites.length === 0 || !this.sprites[0].isImageLoaded()) {
      return;
    }

    const box = renderObject.getWorldBoundingBox();
    const fieldX = box.min.x;
    const fieldY = box.min.y;
    const fieldWidth = box.max.x - box.min.x;
    const fieldHeight = box.max.y - box.min.y;
    const cols = Math.ceil(fieldWidth / this.tileSize);
    const rows = Math.ceil(fieldHeight / this.tileSize);
    const cull = context.getWorldCullBounds();
    let startCol = 0;
    let endCol = cols;
    let startRow = 0;
    let endRow = rows;

    if (cull !== null) {
      startCol = Math.max(0, Math.floor((cull.minX - fieldX) / this.tileSize));
      endCol = Math.min(cols, Math.ceil((cull.maxX - fieldX) / this.tileSize));
      startRow = Math.max(0, Math.floor((cull.minY - fieldY) / this.tileSize));
      endRow = Math.min(rows, Math.ceil((cull.maxY - fieldY) / this.tileSize));
      if (startCol >= endCol || startRow >= endRow) {
        return;
      }
    }

    const dest = this.destinationRect;
    dest.width = this.tileSize;
    dest.height = this.tileSize;

    for (let row = startRow; row < endRow; row += 1) {
      dest.y = fieldY + row * this.tileSize;
      for (let col = startCol; col < endCol; col += 1) {
        const hash = Math.abs((col * 73856093) ^ (row * 19349663));
        const sprite = this.sprites[hash % this.sprites.length];
        dest.x = fieldX + col * this.tileSize;
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
