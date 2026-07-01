import {
  Animation,
  GameObject,
  Sprite,
  SpriteAlignment,
  SpritePainter,
  Subject,
} from './../core';
import { GameUpdateArgs } from '../game';
import * as config from '../config';

import { emitExplosion } from './explosionEffect';

export class Explosion extends GameObject {
  public zIndex = config.LARGE_EXPLOSION_Z_INDEX;
  public readonly painter = new SpritePainter();
  public readonly completed = new Subject();
  private animation: Animation<Sprite>;

  constructor() {
    super(136, 136);

    this.painter.alignment = SpriteAlignment.MiddleCenter;
  }

  protected setup({ spriteLoader, particles }: GameUpdateArgs): void {
    this.animation = new Animation(
      spriteLoader.loadList(['explosion.large.1', 'explosion.large.2']),
      { delay: 0.066, loop: false },
    );

    // Layer procedural flash/fireball/spark/smoke particles over the sprite.
    // Refresh the matrix first: the creator sets our center via setCenter()
    // *after* updateMatrix(), leaving boundingBox stale at the origin — reading
    // getCenter() without this would emit the blast at the top-left corner.
    this.updateMatrix();
    const center = this.getCenter();
    emitExplosion(particles, center.x, center.y, { scale: 1.3, smoke: true });
  }

  protected update(updateArgs: GameUpdateArgs): void {
    if (this.animation.isComplete()) {
      this.dirtyPaintBox();
      this.removeSelf();
      this.completed.notify(null);
      return;
    }
    this.animation.update(updateArgs.deltaTime);
    this.painter.sprite = this.animation.getCurrentFrame();
    this.setNeedsPaint();
  }
}
