import { Sprite, SpriteAlignment, SpritePainter } from '../../../core';

import { MenuItem } from '../MenuItem';

export class SpriteMenuItem extends MenuItem {
  constructor(sprite: Sprite, width: number, height: number) {
    super();

    this.size.set(width, height);
    this.painter = new SpritePainter(sprite, SpriteAlignment.Stretch);
  }
}
