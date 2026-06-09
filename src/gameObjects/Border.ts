import { GameObject } from '../core';
import * as config from '../config';

import { BorderWall } from './BorderWall';

export class Border extends GameObject {
  protected setup(): void {
    const rects = [
      {
        x: 0,
        y: -config.BORDER_TOP_BOTTOM_HEIGHT,
        width: config.FIELD_SIZE,
        height: config.BORDER_TOP_BOTTOM_HEIGHT,
      },
      {
        x: 0,
        y: config.FIELD_SIZE,
        width: config.FIELD_SIZE,
        height: config.BORDER_TOP_BOTTOM_HEIGHT,
      },
      {
        x: -config.BORDER_LEFT_WIDTH,
        y: 0,
        width: config.BORDER_LEFT_WIDTH,
        height: config.FIELD_SIZE,
      },
      {
        x: config.FIELD_SIZE,
        y: 0,
        width: config.BORDER_RIGHT_WIDTH,
        height: config.FIELD_SIZE,
      },
    ];

    rects.forEach((rect) => {
      const wall = new BorderWall(rect.width, rect.height);
      wall.position.set(rect.x, rect.y);
      this.add(wall);
    });
  }
}
