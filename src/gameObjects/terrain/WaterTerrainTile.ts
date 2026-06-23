import { Animation, BoxCollider, Sprite, SpritePainter } from '../../core';
import { GameUpdateArgs, Tag } from '../../game';
import { TerrainType } from '../../terrain';
import * as config from '../../config';

import { TerrainTile } from '../TerrainTile';

export class WaterTerrainTile extends TerrainTile {
  public type = TerrainType.Water;
  public collider = new BoxCollider(this);
  public zIndex = config.WATER_TILE_Z_INDEX;
  public tags = [Tag.BlockMove];
  public readonly painter = new SpritePainter();
  private animation: Animation<Sprite>;

  constructor() {
    super(config.WATER_TILE_SIZE, config.WATER_TILE_SIZE);
  }

  public destroy(): void {
    super.destroy();
    this.collider.unregister();
  }

  protected setup({ collisionSystem, spriteLoader }: GameUpdateArgs): void {
    collisionSystem.register(this.collider);

    // Frame count is driven by the art: animates terrain.water.1..N for
    // however many frames exist in the manifest (2 today, more when added).
    this.animation = new Animation(spriteLoader.loadSequence('terrain.water'), {
      delay: 0.333,
      loop: true,
    });
  }

  protected update(updateArgs: GameUpdateArgs): void {
    this.collider.update();

    this.animation.update(updateArgs.deltaTime);
    this.painter.sprite = this.animation.getCurrentFrame();
    this.setNeedsPaint();
  }
}
