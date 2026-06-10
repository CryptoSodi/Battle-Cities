import { GameObject } from '../../core';
import { Tag } from '../../game';
import * as config from '../../config';

import { BorderWall } from '../BorderWall';

export class EditorBorder extends GameObject {
  constructor(
    private readonly fieldWidth: number,
    private readonly fieldHeight: number,
  ) {
    super();
  }

  protected setup(): void {
    config.getBorderRects(this.fieldWidth, this.fieldHeight).forEach((rect) => {
      const wall = new BorderWall(rect.width, rect.height);
      wall.tags = [Tag.EditorBlockMove];
      wall.position.set(rect.x, rect.y);
      this.add(wall);
    });
  }
}
