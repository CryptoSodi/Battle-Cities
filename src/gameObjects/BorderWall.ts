import { BoxCollider, GameObject, RectPainter } from '../core';
import { GameUpdateArgs, Tag } from '../game';
import * as config from '../config';

export class BorderWall extends GameObject {
  public collider = new BoxCollider(this);
  public painter = new RectPainter(config.COLOR_BLACK);
  public tags = [Tag.Wall, Tag.Border, Tag.BlockMove];
  public zIndex = config.BORDER_WALL_Z_INDEX;

  protected setup({ collisionSystem }: GameUpdateArgs): void {
    collisionSystem.register(this.collider);
  }

  protected update(): void {
    this.collider.update();
  }
}
