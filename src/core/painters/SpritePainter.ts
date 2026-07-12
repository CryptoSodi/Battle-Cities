import { Sprite } from '../graphics';
import { RenderContext } from '../render';

import { Painter } from '../Painter';
import { Rect } from '../Rect';
import { RenderObject } from '../RenderObject';
import { SpriteAlignment } from '../SpriteAlignment';

export class SpritePainter extends Painter {
  public alignment: SpriteAlignment;
  public sprite: Sprite = null;
  public opacity = 1;
  // White-tint amount [0..1] for a hit flash. 0 = draw unmodified. Render-only;
  // set by the owning object (e.g. Tank on hit) and never read by the sim.
  public flash = 0;
  public tintColor: string = null;
  public tintAlpha = 0;
  private readonly objectRect = new Rect();
  private readonly destinationRect = new Rect();

  constructor(sprite: Sprite = null, alignment = SpriteAlignment.MiddleCenter) {
    super();

    this.sprite = sprite;
    this.alignment = alignment;
  }

  public paint(context: RenderContext, renderObject: RenderObject): void {
    // Simply no sprite object provided
    if (this.sprite === null) {
      return;
    }

    // Image is not yet available
    if (!this.sprite.isImageLoaded()) {
      return;
    }

    const box = renderObject.getWorldBoundingBox();
    const objectRect = this.objectRect;
    objectRect.x = box.min.x;
    objectRect.y = box.min.y;
    objectRect.width = box.max.x - box.min.x;
    objectRect.height = box.max.y - box.min.y;

    let destinationRect = objectRect;
    if (this.alignment === SpriteAlignment.Stretch) {
      destinationRect = objectRect;
    } else if (this.alignment === SpriteAlignment.AspectFit) {
      const sourceWidth =
        this.sprite.destinationRect.width || this.sprite.sourceRect.width;
      const sourceHeight =
        this.sprite.destinationRect.height || this.sprite.sourceRect.height;
      const scale = Math.min(
        objectRect.width / sourceWidth,
        objectRect.height / sourceHeight,
      );

      destinationRect = this.destinationRect;
      destinationRect.width = sourceWidth * scale;
      destinationRect.height = sourceHeight * scale;
      destinationRect.x =
        objectRect.x + objectRect.width / 2 - destinationRect.width / 2;
      destinationRect.y =
        objectRect.y + objectRect.height / 2 - destinationRect.height / 2;
    } else if (this.alignment === SpriteAlignment.AspectCover) {
      const sourceWidth =
        this.sprite.destinationRect.width || this.sprite.sourceRect.width;
      const sourceHeight =
        this.sprite.destinationRect.height || this.sprite.sourceRect.height;
      const scale = Math.max(
        objectRect.width / sourceWidth,
        objectRect.height / sourceHeight,
      );

      destinationRect = this.destinationRect;
      destinationRect.width = sourceWidth * scale;
      destinationRect.height = sourceHeight * scale;
      destinationRect.x =
        objectRect.x + objectRect.width / 2 - destinationRect.width / 2;
      destinationRect.y =
        objectRect.y + objectRect.height / 2 - destinationRect.height / 2;
    } else if (this.alignment === SpriteAlignment.TopLeft) {
      destinationRect = this.destinationRect;
      destinationRect.x = objectRect.x;
      destinationRect.y = objectRect.y;
      destinationRect.width = this.sprite.destinationRect.width;
      destinationRect.height = this.sprite.destinationRect.height;
    } else if (this.alignment === SpriteAlignment.MiddleCenter) {
      destinationRect = this.destinationRect;
      destinationRect.x =
        objectRect.x +
        objectRect.width / 2 -
        this.sprite.destinationRect.width / 2;
      destinationRect.y =
        objectRect.y +
        objectRect.height / 2 -
        this.sprite.destinationRect.height / 2;
      destinationRect.width = this.sprite.destinationRect.width;
      destinationRect.height = this.sprite.destinationRect.height;
    }

    const tmpGlobalAlpha = context.getGlobalAlpha();

    if (this.opacity !== 1) {
      context.setGlobalAlpha(this.opacity);
    }

    context.drawImage(
      this.sprite.image,
      this.sprite.sourceRect,
      destinationRect,
      this.flash,
      this.tintColor,
      this.tintAlpha,
    );

    if (this.opacity !== 1) {
      context.setGlobalAlpha(tmpGlobalAlpha);
    }
  }
}
