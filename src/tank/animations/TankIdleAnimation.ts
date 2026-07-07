import { Animation, SpriteLoader } from '../../core';
import { Rotation } from '../../game';

import { TankAnimationFrame } from '../TankAnimationFrame';
import { TankColor } from '../TankColor';
import { TankType } from '../TankType';

export class TankIdleAnimation extends Animation<TankAnimationFrame> {
  private regularFrames: TankAnimationFrame[] = [];

  constructor(
    spriteLoader: SpriteLoader,
    type: TankType,
    colors: TankColor[],
    rotation: Rotation,
  ) {
    super([], { delay: 0.12, loop: true });

    this.regularFrames = [
      new TankAnimationFrame(spriteLoader, type, colors, rotation, 1),
    ];

    this.updateFrames();
  }

  // Kept for callers that refresh tank skin state after gameplay flags change.
  public updateFrames(): void {
    this.resetWithFrames(this.regularFrames);
  }
}
