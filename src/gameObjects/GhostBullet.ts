import {
  GameObject,
  SpriteAlignment,
  SpriteLoader,
  SpritePainter,
} from '../core';
import { Rotation } from '../game';
import * as config from '../config';

const GHOST_BULLET_LIFE_SECONDS = 0.45;
const GHOST_BULLET_SPEED = 380;

export class GhostBullet extends GameObject {
  public rotation = Rotation.Up;
  private lifeLeft = GHOST_BULLET_LIFE_SECONDS;

  constructor(rotation = Rotation.Up) {
    super(config.BULLET_WIDTH, 16);

    this.rotation = rotation;
    this.pivot.set(0.5, 0.5);
    this.setZIndex(config.PLAYER_TANK_Z_INDEX + 2);
  }

  protected setup({ spriteLoader }: { spriteLoader: SpriteLoader }): void {
    const painter = new SpritePainter(null, SpriteAlignment.MiddleCenter);
    painter.opacity = 0.5;
    painter.tintColor = 'rgb(120, 200, 255)';
    painter.tintAlpha = 0.35;
    painter.sprite = spriteLoader.load(`bullet.${this.getRotationString()}`);
    this.painter = painter;
  }

  protected update({ deltaTime }: { deltaTime: number }): void {
    this.lifeLeft -= deltaTime;
    if (this.lifeLeft <= 0) {
      this.removeSelf();
      return;
    }

    this.dirtyPaintBox();
    this.translateY(GHOST_BULLET_SPEED * deltaTime);
    this.updateMatrix(true);
    this.setNeedsPaint();
  }

  private getRotationString(): string {
    switch (this.rotation) {
      case Rotation.Up:
        return 'up';
      case Rotation.Down:
        return 'down';
      case Rotation.Left:
        return 'left';
      case Rotation.Right:
        return 'right';
      default:
        return 'up';
    }
  }
}
