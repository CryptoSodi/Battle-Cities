import {
  Animation,
  GameObject,
  Sprite,
  SpriteAlignment,
  SpritePainter,
  Subject,
} from '../core';
import { GameUpdateArgs } from '../game';
import * as config from '../config';

import { emitExplosion } from './explosionEffect';

export class SmallExplosion extends GameObject {
  public zIndex = config.SMALL_EXPLOSION_Z_INDEX;
  public readonly painter = new SpritePainter();
  public readonly done = new Subject();
  protected animation: Animation<Sprite>;

  constructor() {
    super(64, 64);

    this.painter.alignment = SpriteAlignment.MiddleCenter;
  }

  protected setup({ spriteLoader, particles }: GameUpdateArgs): void {
    this.animation = new Animation(
      spriteLoader.loadList([
        'explosion.small.1',
        'explosion.small.2',
        'explosion.small.3',
      ]),
      { delay: 0.05, loop: false },
    );

    // Light spark puff on impact (no smoke) layered over the sprite. Refresh
    // the matrix first: the creator sets our center via setCenter() *after*
    // updateMatrix(), leaving boundingBox stale at the origin — reading
    // getCenter() without this would emit the burst at the top-left corner.
    this.updateMatrix();
    const center = this.getCenter();
    emitExplosion(particles, center.x, center.y, { scale: 0.45, smoke: false });
  }

  protected update(updateArgs: GameUpdateArgs): void {
    if (this.animation.isComplete()) {
      this.dirtyPaintBox();
      this.removeSelf();
      this.done.notify(null);
      return;
    }

    this.animation.update(updateArgs.deltaTime);
    this.painter.sprite = this.animation.getCurrentFrame();
    this.setNeedsPaint();
  }
}
