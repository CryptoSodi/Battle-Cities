import { GameObject } from '../core';
import * as config from '../config';

import { BorderWall } from './BorderWall';

export class Border extends GameObject {
  constructor(
    private readonly fieldWidth: number,
    private readonly fieldHeight: number,
  ) {
    super();
  }

  protected setup(): void {
    const rects = [
      {
        x: 0,
        y: -config.BORDER_TOP_BOTTOM_HEIGHT,
        width: this.fieldWidth,
        height: config.BORDER_TOP_BOTTOM_HEIGHT,
      },
      {
        x: 0,
        y: this.fieldHeight,
        width: this.fieldWidth,
        height: config.BORDER_TOP_BOTTOM_HEIGHT,
      },
      {
        x: -config.BORDER_LEFT_WIDTH,
        y: 0,
        width: config.BORDER_LEFT_WIDTH,
        height: this.fieldHeight,
      },
      {
        x: this.fieldWidth,
        y: 0,
        width: config.BORDER_RIGHT_WIDTH,
        height: this.fieldHeight,
      },
    ];

    rects.forEach((rect) => {
      const wall = new BorderWall(rect.width, rect.height);
      wall.position.set(rect.x, rect.y);
      this.add(wall);
    });
  }
}
