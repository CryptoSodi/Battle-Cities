import { Sprite, SpritePainter } from '../../core';
import { GameUpdateArgs } from '../../game';
import { TerrainType } from '../../terrain';
import * as config from '../../config';

import { TerrainTile } from '../TerrainTile';

// Number of leading sprites in terrain.jungle.* that are bottom-edge variants.
// The first BOTTOM_VARIANT_COUNT tiles form the bottom of a jungle cluster
// (where it meets the ground); the rest build the top/interior canopy.
const BOTTOM_VARIANT_COUNT = 2;

export class JungleTerrainTile extends TerrainTile {
  public type = TerrainType.Jungle;
  public readonly painter = new SpritePainter();
  public zIndex = config.JUNGLE_TILE_Z_INDEX;
  // Set by TerrainFactory: true when there is no jungle in the cell directly
  // below, so this tile sits at the bottom edge of a jungle cluster.
  public isBottom = false;
  protected sprites: Sprite[];

  constructor() {
    super(config.JUNGLE_TILE_SIZE, config.JUNGLE_TILE_SIZE);
  }

  protected setup({ spriteLoader }: GameUpdateArgs): void {
    // Data-driven: loads terrain.jungle.1..N (6 today — 2 bottom + 4 top).
    this.sprites = spriteLoader.loadSequence('terrain.jungle');
    this.painter.sprite = this.getSpriteByPosition();
  }

  // Picks a variant per cell so the foliage doesn't visibly repeat (same hash
  // approach as the grass ground), choosing from the bottom set on the bottom
  // edge and the top set everywhere else.
  protected getSpriteByPosition(): Sprite {
    const size = config.JUNGLE_TILE_SIZE;
    const col = Math.floor(this.position.x / size);
    const row = Math.floor(this.position.y / size);
    const hash = Math.abs((col * 73856093) ^ (row * 19349663));

    if (this.isBottom) {
      const count = Math.min(BOTTOM_VARIANT_COUNT, this.sprites.length);
      return this.sprites[hash % count];
    }

    const topCount = this.sprites.length - BOTTOM_VARIANT_COUNT;
    if (topCount <= 0) {
      return this.sprites[hash % this.sprites.length];
    }
    return this.sprites[BOTTOM_VARIANT_COUNT + (hash % topCount)];
  }
}
