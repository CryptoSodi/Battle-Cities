import { ArrayUtils, GameObject, Rect, Text, TextOptions } from '../../core';
import { GameUpdateArgs } from '../../game';
import { TerrainFactory, TerrainType } from '../../terrain';
import * as config from '../../config';

import { DropShadowPainter } from '../DropShadowPainter';

export class TerrainText extends GameObject {
  private terrainType: TerrainType;
  private text: Text<Rect[]>;
  private castShadow: boolean;

  constructor(
    text = '',
    terrainType: TerrainType,
    options: TextOptions = {},
    castShadow = false,
  ) {
    super();

    this.text = new Text(text, options);
    this.terrainType = terrainType;
    this.castShadow = castShadow;
  }

  protected setup({ rectFontLoader }: GameUpdateArgs): void {
    const font = rectFontLoader.load(config.PRIMARY_RECT_FONT_ID);

    this.text.setFont(font);
    this.size.copyFrom(this.text.getSize());

    const rects = this.text.build();
    const tiles = TerrainFactory.createFromRegions(
      this.terrainType,
      ArrayUtils.flatten(rects),
    );

    // Add the shadow layer first so it renders beneath the opaque letter tiles
    // (equal z-index, drawn in insertion order). Only the offset skirt shows.
    if (this.castShadow) {
      const shadow = new GameObject();
      const painter = new DropShadowPainter();
      painter.casters = tiles;
      painter.offsetX = config.TEXT_SHADOW_OFFSET_X;
      painter.offsetY = config.TEXT_SHADOW_OFFSET_Y;
      painter.steps = config.TEXT_SHADOW_STEPS;
      painter.alpha = config.TEXT_SHADOW_ALPHA;
      shadow.painter = painter;
      this.add(shadow);
    }

    this.add(...tiles);
  }
}
