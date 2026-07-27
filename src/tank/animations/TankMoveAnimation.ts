import { Animation, SpriteLoader } from '../../core';
import { Rotation } from '../../game/Rotation';

import { TankAnimationFrame } from '../TankAnimationFrame';
import { TankColor } from '../TankColor';
import { TankSpriteId } from '../TankSpriteId';
import { TankType } from '../TankType';

export class TankMoveAnimation extends Animation<TankAnimationFrame> {
  private regularFrames: TankAnimationFrame[] = [];

  constructor(
    spriteLoader: SpriteLoader,
    type: TankType,
    colors: TankColor[],
    rotation: Rotation,
  ) {
    super([], { delay: 0.02, loop: true });

    this.regularFrames = this.createRegularFrames(
      spriteLoader,
      type,
      colors,
      rotation,
    );

    this.updateFrames();
  }

  // Kept for callers that refresh tank skin state after gameplay flags change.
  public updateFrames(): void {
    this.resetWithFrames(this.regularFrames);
  }

  private createRegularFrames(
    spriteLoader: SpriteLoader,
    type: TankType,
    colors: TankColor[],
    rotation: Rotation,
  ): TankAnimationFrame[] {
    const numberedMoveFrames = this.createNumberedMoveFrames(
      spriteLoader,
      type,
      colors,
      rotation,
    );

    if (numberedMoveFrames.length > 1) {
      return numberedMoveFrames;
    }

    return [
      new TankAnimationFrame(spriteLoader, type, colors, rotation, 1),
      new TankAnimationFrame(spriteLoader, type, colors, rotation, 2),
      new TankAnimationFrame(spriteLoader, type, colors, rotation, 1),
      new TankAnimationFrame(spriteLoader, type, colors, rotation, 2),
    ];
  }

  private createNumberedMoveFrames(
    spriteLoader: SpriteLoader,
    type: TankType,
    colors: TankColor[],
    rotation: Rotation,
  ): TankAnimationFrame[] {
    const frames: TankAnimationFrame[] = [];

    for (let frameNumber = 2; ; frameNumber += 1) {
      const spriteId = TankSpriteId.create(
        type,
        colors[0],
        rotation,
        frameNumber,
      );
      if (!spriteLoader.has(spriteId)) {
        break;
      }

      frames.push(
        new TankAnimationFrame(
          spriteLoader,
          type,
          colors,
          rotation,
          frameNumber,
        ),
      );
    }

    return frames;
  }
}
