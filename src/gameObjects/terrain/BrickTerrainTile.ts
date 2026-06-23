import { BoxCollider, Sprite, SpritePainter } from '../../core';
import { GameUpdateArgs, Tag } from '../../game';
import { TerrainType } from '../../terrain';
import * as config from '../../config';

import { TerrainTile } from '../TerrainTile';

// Movement collision tags are defined in BrickSuperTerrainTile.
// Bullet collsion tags are defined here.

export class BrickTerrainTile extends TerrainTile {
  public type = TerrainType.Brick;
  public collider = new BoxCollider(this);
  public zIndex = config.BRICK_TILE_Z_INDEX;
  public readonly tags = [Tag.Wall, Tag.Brick];
  public readonly painter = new SpritePainter();
  // Set by TerrainFactory for bricks at the bottom edge of a wall cluster so
  // they render the darker base course. baseVariant picks the skirt to match
  // the surrounding terrain: 'grass' on land, 'moss' where the wall meets water.
  public isBase = false;
  public baseVariant: 'grass' | 'moss' = 'grass';
  protected sprites: Sprite[];
  protected baseSprites: Sprite[];
  protected mossSprites: Sprite[];

  constructor() {
    super(config.BRICK_TILE_SIZE, config.BRICK_TILE_SIZE);
  }

  public destroy(): void {
    super.destroy();
    this.collider.unregister();
  }

  protected setup({ collisionSystem, spriteLoader }: GameUpdateArgs): void {
    collisionSystem.register(this.collider);

    this.sprites = spriteLoader.loadList(this.getSpriteIds());
    this.baseSprites = spriteLoader.loadList(this.getBaseSpriteIds());
    this.mossSprites = spriteLoader.loadList(this.getMossSpriteIds());
    this.painter.sprite = this.getSpriteByPosition();
  }

  protected update(): void {
    this.collider.update();
  }

  protected getSpriteIds(): string[] {
    return ['terrain.brick.1', 'terrain.brick.2'];
  }

  protected getBaseSpriteIds(): string[] {
    return ['terrain.brick.base.1', 'terrain.brick.base.2'];
  }

  protected getMossSpriteIds(): string[] {
    return ['terrain.brick.moss.1', 'terrain.brick.moss.2'];
  }

  protected getSpriteByPosition(): Sprite {
    const horizontalIndex =
      Math.floor(this.position.x / config.BRICK_TILE_SIZE) % 2;
    const verticalIndex =
      Math.floor(this.position.y / config.BRICK_TILE_SIZE) % 2;
    const index = (horizontalIndex + verticalIndex) % 2;

    let sprites = this.sprites;
    if (this.isBase) {
      sprites =
        this.baseVariant === 'moss' ? this.mossSprites : this.baseSprites;
    }

    return sprites[index];
  }
}
