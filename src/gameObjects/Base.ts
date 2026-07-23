import { GameObject, Subject } from '../core';
import * as config from '../config';

import { BaseHeart } from './BaseHeart';

export class Base extends GameObject {
  public died = new Subject();
  private heart = new BaseHeart();

  constructor() {
    super(config.BASE_DEFAULT_SIZE.width, config.BASE_DEFAULT_SIZE.height);
  }

  public activateDefence(_duration: number): void {
    // Base fortification bricks are normal terrain now, owned by the level map
    // and authoritative ER board mutations. The old Base-local wall swap is
    // intentionally disabled so the base object represents only the eagle.
  }

  protected setup(): void {
    this.heart.position.set(32, 32);
    this.heart.died.addListener(this.died.notify);
    this.add(this.heart);
  }
}
